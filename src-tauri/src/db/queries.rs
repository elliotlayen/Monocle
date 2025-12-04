pub const TABLES_AND_COLUMNS_QUERY: &str = r#"
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    c.name AS column_name,
    ty.name AS data_type,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN (
    SELECT ic.object_id, ic.column_id
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE i.is_primary_key = 1
) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id
"#;

pub const FOREIGN_KEYS_QUERY: &str = r#"
SELECT
    fk.name AS fk_name,
    sch_src.name AS src_schema,
    t_src.name AS src_table,
    c_src.name AS src_column,
    sch_ref.name AS ref_schema,
    t_ref.name AS ref_table,
    c_ref.name AS ref_column
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables t_src
  ON fkc.parent_object_id = t_src.object_id
JOIN sys.schemas sch_src
  ON t_src.schema_id = sch_src.schema_id
JOIN sys.columns c_src
  ON fkc.parent_object_id = c_src.object_id
 AND fkc.parent_column_id = c_src.column_id
JOIN sys.tables t_ref
  ON fkc.referenced_object_id = t_ref.object_id
JOIN sys.schemas sch_ref
  ON t_ref.schema_id = sch_ref.schema_id
JOIN sys.columns c_ref
  ON fkc.referenced_object_id = c_ref.object_id
 AND fkc.referenced_column_id = c_ref.column_id
"#;

pub fn format_data_type(
    type_name: &str,
    max_length: i16,
    precision: u8,
    scale: u8,
) -> String {
    match type_name {
        "varchar" | "char" | "nchar" => {
            if max_length == -1 {
                format!("{}(max)", type_name)
            } else {
                format!("{}({})", type_name, max_length)
            }
        }
        "nvarchar" => {
            if max_length == -1 {
                format!("{}(max)", type_name)
            } else {
                // nvarchar stores 2 bytes per character
                format!("{}({})", type_name, max_length / 2)
            }
        }
        "decimal" | "numeric" => {
            format!("{}({},{})", type_name, precision, scale)
        }
        "float" => {
            if precision > 0 && precision != 53 {
                format!("float({})", precision)
            } else {
                "float".to_string()
            }
        }
        "datetime2" | "datetimeoffset" | "time" => {
            if scale > 0 && scale != 7 {
                format!("{}({})", type_name, scale)
            } else {
                type_name.to_string()
            }
        }
        "varbinary" | "binary" => {
            if max_length == -1 {
                format!("{}(max)", type_name)
            } else {
                format!("{}({})", type_name, max_length)
            }
        }
        _ => type_name.to_string(),
    }
}
