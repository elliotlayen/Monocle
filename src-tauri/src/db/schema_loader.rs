use std::collections::HashMap;

use odbc_api::{buffers::TextRowSet, Cursor};

use crate::db::{create_connection, format_data_type, FOREIGN_KEYS_QUERY, TABLES_AND_COLUMNS_QUERY};
use crate::types::{Column, RelationshipEdge, SchemaGraph, TableNode};

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

    // Load foreign key relationships
    let relationships = load_foreign_keys(&conn)?;

    Ok(SchemaGraph {
        tables,
        relationships,
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
