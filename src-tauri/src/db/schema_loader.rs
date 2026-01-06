use std::collections::{HashMap, HashSet};

use odbc_api::{buffers::TextRowSet, Cursor};
use once_cell::sync::Lazy;
use regex::Regex;

use crate::db::{
    create_connection, format_data_type, FOREIGN_KEYS_QUERY, SCALAR_FUNCTIONS_QUERY,
    STORED_PROCEDURES_QUERY, TABLES_AND_COLUMNS_QUERY, TRIGGERS_QUERY, VIEWS_AND_COLUMNS_QUERY,
    VIEW_COLUMN_SOURCES_QUERY,
};
use crate::types::{
    Column, ProcedureParameter, RelationshipEdge, ScalarFunction, SchemaGraph, StoredProcedure,
    TableNode, Trigger, ViewNode,
};

#[derive(Debug, thiserror::Error)]
pub enum SchemaError {
    #[error("ODBC error: {0}")]
    Odbc(#[from] odbc_api::Error),
    #[error("Failed to parse column data: {0}")]
    Parse(String),
}

impl serde::Serialize for SchemaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub fn load_schema_from_connection(connection_string: &str) -> Result<SchemaGraph, SchemaError> {
    let conn = create_connection(connection_string)?;

    // Load tables and columns
    let tables = load_tables_and_columns(&conn)?;

    // Load views and columns
    let mut views = load_views_and_columns(&conn)?;

    // Populate view column sources (from SQL Server dependency metadata)
    load_view_column_sources(&conn, &mut views)?;

    let name_to_id = build_name_lookup(&tables, &views);

    // Populate view references (needs tables to be loaded first)
    load_views_with_references(&mut views, &name_to_id);

    // Load foreign key relationships
    let relationships = load_foreign_keys(&conn)?;

    // Load triggers with table reference parsing
    let triggers = load_triggers(&conn, &name_to_id)?;

    // Load stored procedures with table reference parsing
    let stored_procedures = load_stored_procedures(&conn, &name_to_id)?;

    // Load scalar functions with table reference parsing
    let scalar_functions = load_scalar_functions(&conn, &name_to_id)?;

    Ok(SchemaGraph {
        tables,
        views,
        relationships,
        triggers,
        stored_procedures,
        scalar_functions,
    })
}

fn load_tables_and_columns(
    conn: &odbc_api::Connection<'_>,
) -> Result<Vec<TableNode>, SchemaError> {
    let mut tables: HashMap<String, TableNode> = HashMap::new();

    if let Some(mut cursor) = conn.execute(TABLES_AND_COLUMNS_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(4096))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let schema_name = get_string_column(&batch, 0, row_idx)?;
                let table_name = get_string_column(&batch, 1, row_idx)?;
                let column_name = get_string_column(&batch, 2, row_idx)?;
                let data_type = get_string_column(&batch, 3, row_idx)?;
                let max_length = get_i16_column(&batch, 4, row_idx)?;
                let precision = get_u8_column(&batch, 5, row_idx)?;
                let scale = get_u8_column(&batch, 6, row_idx)?;
                let is_nullable = get_bool_column(&batch, 7, row_idx)?;
                let is_primary_key = get_bool_column(&batch, 8, row_idx)?;

                let table_id = format!("{}.{}", schema_name, table_name);
                let formatted_type = format_data_type(&data_type, max_length, precision, scale);

                let column = Column {
                    name: column_name,
                    data_type: formatted_type,
                    is_nullable,
                    is_primary_key,
                    source_table: None,
                    source_column: None,
                };

                tables
                    .entry(table_id.clone())
                    .or_insert_with(|| TableNode {
                        id: table_id,
                        name: table_name,
                        schema: schema_name,
                        columns: Vec::new(),
                    })
                    .columns
                    .push(column);
            }
        }
    }

    Ok(tables.into_values().collect())
}

fn load_views_and_columns(conn: &odbc_api::Connection<'_>) -> Result<Vec<ViewNode>, SchemaError> {
    // First pass: collect views with definitions
    let mut views: HashMap<String, (ViewNode, String)> = HashMap::new();

    if let Some(mut cursor) = conn.execute(VIEWS_AND_COLUMNS_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(8192))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let schema_name = get_string_column(&batch, 0, row_idx)?;
                let view_name = get_string_column(&batch, 1, row_idx)?;
                let column_name = get_string_column(&batch, 2, row_idx)?;
                let data_type = get_string_column(&batch, 3, row_idx)?;
                let max_length = get_i16_column(&batch, 4, row_idx)?;
                let precision = get_u8_column(&batch, 5, row_idx)?;
                let scale = get_u8_column(&batch, 6, row_idx)?;
                let is_nullable = get_bool_column(&batch, 7, row_idx)?;
                let definition = get_string_column(&batch, 8, row_idx).unwrap_or_default();

                let view_id = format!("{}.{}", schema_name, view_name);
                let formatted_type = format_data_type(&data_type, max_length, precision, scale);

                let column = Column {
                    name: column_name,
                    data_type: formatted_type,
                    is_nullable,
                    is_primary_key: false,
                    source_table: None,
                    source_column: None,
                };

                let entry = views
                    .entry(view_id.clone())
                    .or_insert_with(|| {
                        (
                            ViewNode {
                                id: view_id,
                                name: view_name,
                                schema: schema_name,
                                columns: Vec::new(),
                                definition: definition.clone(),
                                referenced_tables: Vec::new(),
                            },
                            definition,
                        )
                    });
                entry.0.columns.push(column);
            }
        }
    }

    Ok(views.into_values().map(|(v, _)| v).collect())
}

fn load_view_column_sources(
    conn: &odbc_api::Connection<'_>,
    views: &mut [ViewNode],
) -> Result<(), SchemaError> {
    // Build a map from view_id -> column_name -> (source_table, source_column)
    let mut column_sources: HashMap<String, HashMap<String, (String, String)>> = HashMap::new();

    if let Some(mut cursor) = conn.execute(VIEW_COLUMN_SOURCES_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(4096))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let view_schema = get_string_column(&batch, 0, row_idx)?;
                let view_name = get_string_column(&batch, 1, row_idx)?;
                let view_column = get_string_column(&batch, 2, row_idx)?;
                let source_table = get_string_column(&batch, 3, row_idx)?;
                let source_column = get_string_column(&batch, 4, row_idx)?;

                let view_id = format!("{}.{}", view_schema, view_name);

                column_sources
                    .entry(view_id)
                    .or_default()
                    .insert(view_column, (source_table, source_column));
            }
        }
    }

    // Apply sources to view columns
    for view in views.iter_mut() {
        if let Some(view_sources) = column_sources.get(&view.id) {
            for column in view.columns.iter_mut() {
                if let Some((source_table, source_column)) = view_sources.get(&column.name) {
                    column.source_table = Some(source_table.clone());
                    column.source_column = Some(source_column.clone());
                }
            }
        }
    }

    Ok(())
}

fn load_views_with_references(
    views: &mut [ViewNode],
    name_to_id: &HashMap<String, String>,
) {
    // Extract table references from each view's definition
    // Views only read, so we just use the read references
    for view in views.iter_mut() {
        let (read_refs, _) = extract_table_references(&view.definition, &name_to_id);
        view.referenced_tables = read_refs;
    }
}

fn load_foreign_keys(
    conn: &odbc_api::Connection<'_>,
) -> Result<Vec<RelationshipEdge>, SchemaError> {
    let mut relationships = Vec::new();

    if let Some(mut cursor) = conn.execute(FOREIGN_KEYS_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(4096))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let fk_name = get_string_column(&batch, 0, row_idx)?;
                let src_schema = get_string_column(&batch, 1, row_idx)?;
                let src_table = get_string_column(&batch, 2, row_idx)?;
                let src_column = get_string_column(&batch, 3, row_idx)?;
                let ref_schema = get_string_column(&batch, 4, row_idx)?;
                let ref_table = get_string_column(&batch, 5, row_idx)?;
                let ref_column = get_string_column(&batch, 6, row_idx)?;

                let from_id = format!("{}.{}", src_schema, src_table);
                let to_id = format!("{}.{}", ref_schema, ref_table);

                relationships.push(RelationshipEdge {
                    id: fk_name,
                    from: from_id,
                    to: to_id,
                    from_column: src_column,
                    to_column: ref_column,
                });
            }
        }
    }

    Ok(relationships)
}

fn get_string_column(batch: &TextRowSet, col: usize, row: usize) -> Result<String, SchemaError> {
    batch
        .at(col, row)
        .and_then(|bytes| std::str::from_utf8(bytes).ok())
        .map(|s| s.to_string())
        .ok_or_else(|| SchemaError::Parse(format!("Failed to get string at column {}", col)))
}

fn get_i16_column(batch: &TextRowSet, col: usize, row: usize) -> Result<i16, SchemaError> {
    let s = get_string_column(batch, col, row)?;
    s.parse()
        .map_err(|_| SchemaError::Parse(format!("Failed to parse i16 from '{}'", s)))
}

fn get_u8_column(batch: &TextRowSet, col: usize, row: usize) -> Result<u8, SchemaError> {
    let s = get_string_column(batch, col, row)?;
    s.parse()
        .map_err(|_| SchemaError::Parse(format!("Failed to parse u8 from '{}'", s)))
}

fn get_bool_column(batch: &TextRowSet, col: usize, row: usize) -> Result<bool, SchemaError> {
    let s = get_string_column(batch, col, row)?;
    Ok(s == "1" || s.eq_ignore_ascii_case("true"))
}

fn load_triggers(
    conn: &odbc_api::Connection<'_>,
    name_to_id: &HashMap<String, String>,
) -> Result<Vec<Trigger>, SchemaError> {
    let mut triggers = Vec::new();

    if let Some(mut cursor) = conn.execute(TRIGGERS_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(8192))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let schema_name = get_string_column(&batch, 0, row_idx)?;
                let table_name = get_string_column(&batch, 1, row_idx)?;
                let trigger_name = get_string_column(&batch, 2, row_idx)?;
                let trigger_type = get_string_column(&batch, 3, row_idx)?;
                let is_disabled = get_bool_column(&batch, 4, row_idx)?;
                let fires_on_insert = get_bool_column(&batch, 5, row_idx)?;
                let fires_on_update = get_bool_column(&batch, 6, row_idx)?;
                let fires_on_delete = get_bool_column(&batch, 7, row_idx)?;
                let definition = get_string_column(&batch, 8, row_idx).unwrap_or_default();

                let table_id = format!("{}.{}", schema_name, table_name);
                let trigger_id = format!("{}.{}.{}", schema_name, table_name, trigger_name);

                // Extract table references from the trigger definition
                let (referenced_tables, affected_tables) =
                    extract_table_references(&definition, name_to_id);

                triggers.push(Trigger {
                    id: trigger_id,
                    name: trigger_name,
                    schema: schema_name,
                    table_id,
                    trigger_type,
                    is_disabled,
                    fires_on_insert,
                    fires_on_update,
                    fires_on_delete,
                    definition,
                    referenced_tables,
                    affected_tables,
                });
            }
        }
    }

    Ok(triggers)
}

fn load_stored_procedures(
    conn: &odbc_api::Connection<'_>,
    name_to_id: &HashMap<String, String>,
) -> Result<Vec<StoredProcedure>, SchemaError> {
    let mut procedures: HashMap<String, StoredProcedure> = HashMap::new();

    if let Some(mut cursor) = conn.execute(STORED_PROCEDURES_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(8192))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let schema_name = get_string_column(&batch, 0, row_idx)?;
                let procedure_name = get_string_column(&batch, 1, row_idx)?;
                let procedure_type = get_string_column(&batch, 2, row_idx)?;
                let parameter_name = get_string_column(&batch, 3, row_idx).unwrap_or_default();
                let parameter_type = get_string_column(&batch, 4, row_idx).unwrap_or_default();
                let is_output = get_bool_column(&batch, 5, row_idx).unwrap_or(false);
                let definition = get_string_column(&batch, 6, row_idx).unwrap_or_default();

                let procedure_id = format!("{}.{}", schema_name, procedure_name);

                let procedure = procedures.entry(procedure_id.clone()).or_insert_with(|| {
                    let (referenced_tables, affected_tables) =
                        extract_table_references(&definition, name_to_id);
                    StoredProcedure {
                        id: procedure_id,
                        name: procedure_name,
                        schema: schema_name,
                        procedure_type,
                        parameters: Vec::new(),
                        definition,
                        referenced_tables,
                        affected_tables,
                    }
                });

                if !parameter_name.is_empty() {
                    procedure.parameters.push(ProcedureParameter {
                        name: parameter_name,
                        data_type: parameter_type,
                        is_output,
                    });
                }
            }
        }
    }

    Ok(procedures.into_values().collect())
}

/// Extract table/view references from SQL definition
/// Returns (read_tables, write_tables) - tables read from vs. tables written to
static READ_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?i)\bFROM\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?").unwrap(),
        Regex::new(r"(?i)\bJOIN\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?").unwrap(),
    ]
});

static WRITE_PATTERNS: Lazy<Vec<Regex>> = Lazy::new(|| {
    vec![
        Regex::new(r"(?i)\bINSERT\s+INTO\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?").unwrap(),
        Regex::new(r"(?i)\bUPDATE\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?").unwrap(),
        Regex::new(r"(?i)\bDELETE\s+FROM\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?").unwrap(),
    ]
});

fn extract_table_references(
    definition: &str,
    name_to_id: &HashMap<String, String>,
) -> (Vec<String>, Vec<String>) {
    let mut read_refs: HashSet<String> = HashSet::new();
    let mut write_refs: HashSet<String> = HashSet::new();

    if definition.is_empty() {
        return (Vec::new(), Vec::new());
    }

    // Process read patterns
    for pattern in READ_PATTERNS.iter() {
        for cap in pattern.captures_iter(definition) {
            let schema = cap.get(1).map(|m| m.as_str());
            if let Some(table) = cap.get(2).map(|m| m.as_str()) {
                let lookup_key = if let Some(s) = schema {
                    format!("{}.{}", s, table).to_lowercase()
                } else {
                    table.to_lowercase()
                };

                if let Some(id) = name_to_id.get(&lookup_key) {
                    read_refs.insert(id.clone());
                }
            }
        }
    }

    // Process write patterns
    for pattern in WRITE_PATTERNS.iter() {
        for cap in pattern.captures_iter(definition) {
            let schema = cap.get(1).map(|m| m.as_str());
            if let Some(table) = cap.get(2).map(|m| m.as_str()) {
                let lookup_key = if let Some(s) = schema {
                    format!("{}.{}", s, table).to_lowercase()
                } else {
                    table.to_lowercase()
                };

                if let Some(id) = name_to_id.get(&lookup_key) {
                    write_refs.insert(id.clone());
                }
            }
        }
    }

    (read_refs.into_iter().collect(), write_refs.into_iter().collect())
}

fn load_scalar_functions(
    conn: &odbc_api::Connection<'_>,
    name_to_id: &HashMap<String, String>,
) -> Result<Vec<ScalarFunction>, SchemaError> {
    let mut functions: HashMap<String, ScalarFunction> = HashMap::new();

    if let Some(mut cursor) = conn.execute(SCALAR_FUNCTIONS_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(8192))?;
        let mut row_set_cursor = cursor.bind_buffer(&mut buffers)?;

        while let Some(batch) = row_set_cursor.fetch()? {
            for row_idx in 0..batch.num_rows() {
                let schema_name = get_string_column(&batch, 0, row_idx)?;
                let function_name = get_string_column(&batch, 1, row_idx)?;
                let function_type = get_string_column(&batch, 2, row_idx)?;
                let parameter_name = get_string_column(&batch, 3, row_idx).unwrap_or_default();
                let parameter_type = get_string_column(&batch, 4, row_idx).unwrap_or_default();
                let is_output = get_bool_column(&batch, 5, row_idx).unwrap_or(false);
                let return_type = get_string_column(&batch, 6, row_idx).unwrap_or_default();
                let definition = get_string_column(&batch, 7, row_idx).unwrap_or_default();

                let function_id = format!("{}.{}", schema_name, function_name);

                let function = functions.entry(function_id.clone()).or_insert_with(|| {
                    let (referenced_tables, affected_tables) =
                        extract_table_references(&definition, name_to_id);
                    ScalarFunction {
                        id: function_id,
                        name: function_name,
                        schema: schema_name,
                        function_type,
                        parameters: Vec::new(),
                        return_type: return_type.clone(),
                        definition,
                        referenced_tables,
                        affected_tables,
                    }
                });

                if !parameter_name.is_empty() {
                    function.parameters.push(ProcedureParameter {
                        name: parameter_name,
                        data_type: parameter_type,
                        is_output,
                    });
                }
            }
        }
    }

    Ok(functions.into_values().collect())
}

fn build_name_lookup(
    tables: &[TableNode],
    views: &[ViewNode],
) -> HashMap<String, String> {
    let mut name_to_id: HashMap<String, String> = HashMap::new();

    for table in tables {
        name_to_id.insert(table.name.to_lowercase(), table.id.clone());
        name_to_id.insert(table.id.to_lowercase(), table.id.clone());
    }
    for view in views {
        name_to_id.insert(view.name.to_lowercase(), view.id.clone());
        name_to_id.insert(view.id.to_lowercase(), view.id.clone());
    }

    name_to_id
}
