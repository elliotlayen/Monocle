use std::collections::{HashMap, HashSet};

use futures_util::TryStreamExt;
use once_cell::sync::Lazy;
use regex::Regex;
use tiberius::Client;
use tokio::net::TcpStream;
use tokio_util::compat::Compat;

use crate::db::{
    create_client, format_data_type, ConnectionError, FOREIGN_KEYS_QUERY, SCALAR_FUNCTIONS_QUERY,
    STORED_PROCEDURES_QUERY, TABLES_AND_COLUMNS_QUERY, TRIGGERS_QUERY, VIEWS_AND_COLUMNS_QUERY,
    VIEW_COLUMN_SOURCES_QUERY,
};
use crate::types::{
    Column, ConnectionParams, ProcedureParameter, RelationshipEdge, ScalarFunction, SchemaGraph,
    StoredProcedure, TableNode, Trigger, ViewNode,
};

#[derive(Debug, thiserror::Error)]
pub enum SchemaError {
    #[error("Connection error: {0}")]
    Connection(#[from] ConnectionError),
    #[error("Database error: {0}")]
    Tiberius(#[from] tiberius::error::Error),
}

impl serde::Serialize for SchemaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub async fn load_schema(params: &ConnectionParams) -> Result<SchemaGraph, SchemaError> {
    let mut client = create_client(params).await?;

    // Core data - must succeed
    let tables = load_tables_and_columns(&mut client).await?;
    let mut views = load_views_and_columns(&mut client).await?;

    // Optional enrichment - continue if fails (DMV queries can fail on broken references)
    load_view_column_sources(&mut client, &mut views).await;

    let name_to_id = build_name_lookup(&tables, &views);

    // Populate view references (needs tables to be loaded first)
    load_views_with_references(&mut views, &name_to_id);

    // Optional data - continue with empty if fails
    let relationships = load_foreign_keys(&mut client).await.unwrap_or_default();
    let triggers = load_triggers(&mut client, &name_to_id)
        .await
        .unwrap_or_default();
    let stored_procedures = load_stored_procedures(&mut client, &name_to_id)
        .await
        .unwrap_or_default();
    let scalar_functions = load_scalar_functions(&mut client, &name_to_id)
        .await
        .unwrap_or_default();

    Ok(SchemaGraph {
        tables,
        views,
        relationships,
        triggers,
        stored_procedures,
        scalar_functions,
    })
}

async fn load_tables_and_columns(
    client: &mut Client<Compat<TcpStream>>,
) -> Result<Vec<TableNode>, SchemaError> {
    let mut tables: HashMap<String, TableNode> = HashMap::new();

    let stream = client.query(TABLES_AND_COLUMNS_QUERY, &[]).await?;
    let mut row_stream = stream.into_row_stream();

    while let Some(row) = row_stream.try_next().await? {
        let schema_name: &str = row.get(0).unwrap_or_default();
        let table_name: &str = row.get(1).unwrap_or_default();
        let column_name: &str = row.get(2).unwrap_or_default();
        let data_type: &str = row.get(3).unwrap_or_default();
        let max_length: i16 = row.get(4).unwrap_or_default();
        let precision: u8 = row.get(5).unwrap_or_default();
        let scale: u8 = row.get(6).unwrap_or_default();
        let is_nullable: bool = row.get(7).unwrap_or_default();
        let is_primary_key: i32 = row.get(8).unwrap_or_default();

        let table_id = format!("{}.{}", schema_name, table_name);
        let formatted_type = format_data_type(data_type, max_length, precision, scale);

        let column = Column {
            name: column_name.to_string(),
            data_type: formatted_type,
            is_nullable,
            is_primary_key: is_primary_key != 0,
            source_table: None,
            source_column: None,
        };

        tables
            .entry(table_id.clone())
            .or_insert_with(|| TableNode {
                id: table_id,
                name: table_name.to_string(),
                schema: schema_name.to_string(),
                columns: Vec::new(),
            })
            .columns
            .push(column);
    }

    Ok(tables.into_values().collect())
}

async fn load_views_and_columns(
    client: &mut Client<Compat<TcpStream>>,
) -> Result<Vec<ViewNode>, SchemaError> {
    let mut views: HashMap<String, (ViewNode, String)> = HashMap::new();

    let stream = client.query(VIEWS_AND_COLUMNS_QUERY, &[]).await?;
    let mut row_stream = stream.into_row_stream();

    while let Some(row) = row_stream.try_next().await? {
        let schema_name: &str = row.get(0).unwrap_or_default();
        let view_name: &str = row.get(1).unwrap_or_default();
        let column_name: &str = row.get(2).unwrap_or_default();
        let data_type: &str = row.get(3).unwrap_or_default();
        let max_length: i16 = row.get(4).unwrap_or_default();
        let precision: u8 = row.get(5).unwrap_or_default();
        let scale: u8 = row.get(6).unwrap_or_default();
        let is_nullable: bool = row.get(7).unwrap_or_default();
        let definition: &str = row.get(8).unwrap_or_default();

        let view_id = format!("{}.{}", schema_name, view_name);
        let formatted_type = format_data_type(data_type, max_length, precision, scale);

        let column = Column {
            name: column_name.to_string(),
            data_type: formatted_type,
            is_nullable,
            is_primary_key: false,
            source_table: None,
            source_column: None,
        };

        let entry = views.entry(view_id.clone()).or_insert_with(|| {
            (
                ViewNode {
                    id: view_id,
                    name: view_name.to_string(),
                    schema: schema_name.to_string(),
                    columns: Vec::new(),
                    definition: definition.to_string(),
                    referenced_tables: Vec::new(),
                },
                definition.to_string(),
            )
        });
        entry.0.columns.push(column);
    }

    Ok(views.into_values().map(|(v, _)| v).collect())
}

/// Load view column sources from SQL Server dependency metadata.
/// This is optional enrichment - errors are silently ignored to handle databases
/// with broken object references (views referencing non-existent columns/tables).
async fn load_view_column_sources(
    client: &mut Client<Compat<TcpStream>>,
    views: &mut [ViewNode],
) {
    let mut column_sources: HashMap<String, HashMap<String, (String, String)>> = HashMap::new();

    // Query can fail if views reference non-existent objects
    let stream = match client.query(VIEW_COLUMN_SOURCES_QUERY, &[]).await {
        Ok(s) => s,
        Err(_) => return, // Continue without column sources
    };

    let mut row_stream = stream.into_row_stream();

    // Handle errors while iterating (DMV can fail mid-stream on broken references)
    loop {
        match row_stream.try_next().await {
            Ok(Some(row)) => {
                let view_schema: &str = row.get(0).unwrap_or_default();
                let view_name: &str = row.get(1).unwrap_or_default();
                let view_column: &str = row.get(2).unwrap_or_default();
                let source_table: &str = row.get(3).unwrap_or_default();
                let source_column: &str = row.get(4).unwrap_or_default();

                let view_id = format!("{}.{}", view_schema, view_name);

                column_sources.entry(view_id).or_default().insert(
                    view_column.to_string(),
                    (source_table.to_string(), source_column.to_string()),
                );
            }
            Ok(None) => break,
            Err(_) => break, // Stop on error, keep what we have
        }
    }

    // Apply collected sources to views
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
}

fn load_views_with_references(views: &mut [ViewNode], name_to_id: &HashMap<String, String>) {
    for view in views.iter_mut() {
        let (read_refs, _) = extract_table_references(&view.definition, name_to_id);
        view.referenced_tables = read_refs;
    }
}

async fn load_foreign_keys(
    client: &mut Client<Compat<TcpStream>>,
) -> Result<Vec<RelationshipEdge>, SchemaError> {
    let mut relationships = Vec::new();

    let stream = client.query(FOREIGN_KEYS_QUERY, &[]).await?;
    let mut row_stream = stream.into_row_stream();

    while let Some(row) = row_stream.try_next().await? {
        let fk_name: &str = row.get(0).unwrap_or_default();
        let src_schema: &str = row.get(1).unwrap_or_default();
        let src_table: &str = row.get(2).unwrap_or_default();
        let src_column: &str = row.get(3).unwrap_or_default();
        let ref_schema: &str = row.get(4).unwrap_or_default();
        let ref_table: &str = row.get(5).unwrap_or_default();
        let ref_column: &str = row.get(6).unwrap_or_default();

        let from_id = format!("{}.{}", src_schema, src_table);
        let to_id = format!("{}.{}", ref_schema, ref_table);

        relationships.push(RelationshipEdge {
            id: fk_name.to_string(),
            from: from_id,
            to: to_id,
            from_column: src_column.to_string(),
            to_column: ref_column.to_string(),
        });
    }

    Ok(relationships)
}

async fn load_triggers(
    client: &mut Client<Compat<TcpStream>>,
    name_to_id: &HashMap<String, String>,
) -> Result<Vec<Trigger>, SchemaError> {
    let mut triggers = Vec::new();

    let stream = client.query(TRIGGERS_QUERY, &[]).await?;
    let mut row_stream = stream.into_row_stream();

    while let Some(row) = row_stream.try_next().await? {
        let schema_name: &str = row.get(0).unwrap_or_default();
        let table_name: &str = row.get(1).unwrap_or_default();
        let trigger_name: &str = row.get(2).unwrap_or_default();
        let trigger_type: &str = row.get(3).unwrap_or_default();
        let is_disabled: bool = row.get(4).unwrap_or_default();
        let fires_on_insert: i32 = row.get(5).unwrap_or_default();
        let fires_on_update: i32 = row.get(6).unwrap_or_default();
        let fires_on_delete: i32 = row.get(7).unwrap_or_default();
        let definition: &str = row.get(8).unwrap_or_default();

        let table_id = format!("{}.{}", schema_name, table_name);
        let trigger_id = format!("{}.{}.{}", schema_name, table_name, trigger_name);

        let (referenced_tables, affected_tables) = extract_table_references(definition, name_to_id);

        triggers.push(Trigger {
            id: trigger_id,
            name: trigger_name.to_string(),
            schema: schema_name.to_string(),
            table_id,
            trigger_type: trigger_type.to_string(),
            is_disabled,
            fires_on_insert: fires_on_insert != 0,
            fires_on_update: fires_on_update != 0,
            fires_on_delete: fires_on_delete != 0,
            definition: definition.to_string(),
            referenced_tables,
            affected_tables,
        });
    }

    Ok(triggers)
}

async fn load_stored_procedures(
    client: &mut Client<Compat<TcpStream>>,
    name_to_id: &HashMap<String, String>,
) -> Result<Vec<StoredProcedure>, SchemaError> {
    let mut procedures: HashMap<String, StoredProcedure> = HashMap::new();

    let stream = client.query(STORED_PROCEDURES_QUERY, &[]).await?;
    let mut row_stream = stream.into_row_stream();

    while let Some(row) = row_stream.try_next().await? {
        let schema_name: &str = row.get(0).unwrap_or_default();
        let procedure_name: &str = row.get(1).unwrap_or_default();
        let procedure_type: &str = row.get(2).unwrap_or_default();
        let parameter_name: &str = row.get(3).unwrap_or_default();
        let parameter_type: &str = row.get(4).unwrap_or_default();
        let is_output: bool = row.get(5).unwrap_or_default();
        let definition: &str = row.get(6).unwrap_or_default();

        let procedure_id = format!("{}.{}", schema_name, procedure_name);

        let procedure = procedures.entry(procedure_id.clone()).or_insert_with(|| {
            let (referenced_tables, affected_tables) = extract_table_references(definition, name_to_id);
            StoredProcedure {
                id: procedure_id,
                name: procedure_name.to_string(),
                schema: schema_name.to_string(),
                procedure_type: procedure_type.to_string(),
                parameters: Vec::new(),
                definition: definition.to_string(),
                referenced_tables,
                affected_tables,
            }
        });

        if !parameter_name.is_empty() {
            procedure.parameters.push(ProcedureParameter {
                name: parameter_name.to_string(),
                data_type: parameter_type.to_string(),
                is_output,
            });
        }
    }

    Ok(procedures.into_values().collect())
}

async fn load_scalar_functions(
    client: &mut Client<Compat<TcpStream>>,
    name_to_id: &HashMap<String, String>,
) -> Result<Vec<ScalarFunction>, SchemaError> {
    let mut functions: HashMap<String, ScalarFunction> = HashMap::new();

    let stream = client.query(SCALAR_FUNCTIONS_QUERY, &[]).await?;
    let mut row_stream = stream.into_row_stream();

    while let Some(row) = row_stream.try_next().await? {
        let schema_name: &str = row.get(0).unwrap_or_default();
        let function_name: &str = row.get(1).unwrap_or_default();
        let function_type: &str = row.get(2).unwrap_or_default();
        let parameter_name: &str = row.get(3).unwrap_or_default();
        let parameter_type: &str = row.get(4).unwrap_or_default();
        let is_output: bool = row.get(5).unwrap_or_default();
        let return_type: &str = row.get(6).unwrap_or_default();
        let definition: &str = row.get(7).unwrap_or_default();

        let function_id = format!("{}.{}", schema_name, function_name);

        let function = functions.entry(function_id.clone()).or_insert_with(|| {
            let (referenced_tables, affected_tables) = extract_table_references(definition, name_to_id);
            ScalarFunction {
                id: function_id,
                name: function_name.to_string(),
                schema: schema_name.to_string(),
                function_type: function_type.to_string(),
                parameters: Vec::new(),
                return_type: return_type.to_string(),
                definition: definition.to_string(),
                referenced_tables,
                affected_tables,
            }
        });

        if !parameter_name.is_empty() {
            function.parameters.push(ProcedureParameter {
                name: parameter_name.to_string(),
                data_type: parameter_type.to_string(),
                is_output,
            });
        }
    }

    Ok(functions.into_values().collect())
}

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

fn build_name_lookup(tables: &[TableNode], views: &[ViewNode]) -> HashMap<String, String> {
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
