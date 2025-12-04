use std::collections::HashMap;

use odbc_api::{buffers::TextRowSet, Cursor};

use crate::db::{
    create_connection, format_data_type, FOREIGN_KEYS_QUERY, STORED_PROCEDURES_QUERY,
    TABLES_AND_COLUMNS_QUERY, TRIGGERS_QUERY, VIEWS_AND_COLUMNS_QUERY,
};
use crate::types::{
    Column, ProcedureParameter, RelationshipEdge, SchemaGraph, StoredProcedure, TableNode, Trigger,
    ViewNode,
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
    let views = load_views_and_columns(&conn)?;

    // Load foreign key relationships
    let relationships = load_foreign_keys(&conn)?;

    // Load triggers
    let triggers = load_triggers(&conn)?;

    // Load stored procedures
    let stored_procedures = load_stored_procedures(&conn)?;

    Ok(SchemaGraph {
        tables,
        views,
        relationships,
        triggers,
        stored_procedures,
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
    let mut views: HashMap<String, ViewNode> = HashMap::new();

    if let Some(mut cursor) = conn.execute(VIEWS_AND_COLUMNS_QUERY, ())? {
        let mut buffers = TextRowSet::for_cursor(1000, &mut cursor, Some(4096))?;
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

                let view_id = format!("{}.{}", schema_name, view_name);
                let formatted_type = format_data_type(&data_type, max_length, precision, scale);

                let column = Column {
                    name: column_name,
                    data_type: formatted_type,
                    is_nullable,
                    is_primary_key: false,
                };

                views
                    .entry(view_id.clone())
                    .or_insert_with(|| ViewNode {
                        id: view_id,
                        name: view_name,
                        schema: schema_name,
                        columns: Vec::new(),
                    })
                    .columns
                    .push(column);
            }
        }
    }

    Ok(views.into_values().collect())
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

fn load_triggers(conn: &odbc_api::Connection<'_>) -> Result<Vec<Trigger>, SchemaError> {
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
                });
            }
        }
    }

    Ok(triggers)
}

fn load_stored_procedures(
    conn: &odbc_api::Connection<'_>,
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
                    StoredProcedure {
                        id: procedure_id,
                        name: procedure_name,
                        schema: schema_name,
                        procedure_type,
                        parameters: Vec::new(),
                        definition,
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
