pub const LIST_DATABASES_QUERY: &str = r#"
SELECT name
FROM sys.databases
WHERE state_desc = 'ONLINE'
  AND database_id > 4
  AND HAS_DBACCESS(name) = 1
ORDER BY name
"#;

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

pub const TRIGGERS_QUERY: &str = r#"
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    tr.name AS trigger_name,
    tr.type_desc AS trigger_type,
    tr.is_disabled,
    ISNULL(OBJECTPROPERTY(tr.object_id, 'ExecIsInsertTrigger'), 0) AS is_insert,
    ISNULL(OBJECTPROPERTY(tr.object_id, 'ExecIsUpdateTrigger'), 0) AS is_update,
    ISNULL(OBJECTPROPERTY(tr.object_id, 'ExecIsDeleteTrigger'), 0) AS is_delete,
    ISNULL(OBJECT_DEFINITION(tr.object_id), '') AS trigger_definition
FROM sys.triggers tr
JOIN sys.tables t ON tr.parent_id = t.object_id
JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, tr.name
"#;

pub const STORED_PROCEDURES_QUERY: &str = r#"
SELECT
    s.name AS schema_name,
    p.name AS procedure_name,
    p.type_desc AS procedure_type,
    ISNULL(sp.name, '') AS parameter_name,
    ISNULL(ty.name, '') AS parameter_type,
    ISNULL(sp.is_output, 0) AS is_output,
    ISNULL(OBJECT_DEFINITION(p.object_id), '') AS procedure_definition
FROM sys.procedures p
JOIN sys.schemas s ON p.schema_id = s.schema_id
LEFT JOIN sys.parameters sp ON p.object_id = sp.object_id AND sp.parameter_id > 0
LEFT JOIN sys.types ty ON sp.user_type_id = ty.user_type_id
WHERE p.is_ms_shipped = 0
ORDER BY s.name, p.name, sp.parameter_id
"#;

pub const VIEWS_AND_COLUMNS_QUERY: &str = r#"
SELECT
    s.name AS schema_name,
    v.name AS view_name,
    c.name AS column_name,
    ty.name AS data_type,
    c.max_length,
    c.precision,
    c.scale,
    c.is_nullable,
    ISNULL(OBJECT_DEFINITION(v.object_id), '') AS view_definition
FROM sys.views v
JOIN sys.schemas s ON v.schema_id = s.schema_id
JOIN sys.columns c ON v.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE v.is_ms_shipped = 0
ORDER BY s.name, v.name, c.column_id
"#;

pub const VIEW_COLUMN_SOURCES_QUERY: &str = r#"
SELECT
    vs.name AS view_schema,
    v.name AS view_name,
    vc.name AS view_column,
    ref.referenced_entity_name AS source_table,
    ref.referenced_minor_name AS source_column
FROM sys.views v
JOIN sys.schemas vs ON v.schema_id = vs.schema_id
JOIN sys.columns vc ON v.object_id = vc.object_id
CROSS APPLY sys.dm_sql_referenced_entities(
    QUOTENAME(vs.name) + '.' + QUOTENAME(v.name), 'OBJECT'
) ref
WHERE v.is_ms_shipped = 0
  AND ref.referenced_minor_name IS NOT NULL
  AND ref.referenced_class_desc = 'OBJECT_OR_COLUMN'
ORDER BY vs.name, v.name, vc.column_id
"#;

pub const SCALAR_FUNCTIONS_QUERY: &str = r#"
SELECT
    s.name AS schema_name,
    o.name AS function_name,
    o.type_desc AS function_type,
    ISNULL(p.name, '') AS parameter_name,
    ISNULL(ty.name, '') AS parameter_type,
    ISNULL(p.is_output, 0) AS is_output,
    ISNULL(rt.name, '') AS return_type,
    ISNULL(OBJECT_DEFINITION(o.object_id), '') AS function_definition
FROM sys.objects o
JOIN sys.schemas s ON o.schema_id = s.schema_id
LEFT JOIN sys.parameters p ON o.object_id = p.object_id AND p.parameter_id > 0
LEFT JOIN sys.types ty ON p.user_type_id = ty.user_type_id
LEFT JOIN sys.parameters rp ON o.object_id = rp.object_id AND rp.parameter_id = 0
LEFT JOIN sys.types rt ON rp.user_type_id = rt.user_type_id
WHERE o.type = 'FN'
  AND o.is_ms_shipped = 0
ORDER BY s.name, o.name, p.parameter_id
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
