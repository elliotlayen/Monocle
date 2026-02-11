use crate::types::{
    Column, ColumnSource, ProcedureParameter, RelationshipEdge, ScalarFunction, SchemaGraph,
    StoredProcedure, TableNode, Trigger, ViewNode,
};

struct MockConfig {
    tables: usize,
    views: usize,
    relationships: usize,
    triggers: usize,
    procedures: usize,
    functions: usize,
}

impl MockConfig {
    fn from_size(size: &str) -> Self {
        match size {
            "small" => MockConfig {
                tables: 10,
                views: 3,
                relationships: 15,
                triggers: 5,
                procedures: 5,
                functions: 5,
            },
            "medium" => MockConfig {
                tables: 100,
                views: 20,
                relationships: 150,
                triggers: 30,
                procedures: 20,
                functions: 20,
            },
            "large" => MockConfig {
                tables: 500,
                views: 50,
                relationships: 750,
                triggers: 100,
                procedures: 50,
                functions: 50,
            },
            "stress" => MockConfig {
                tables: 2000,
                views: 200,
                relationships: 3000,
                triggers: 300,
                procedures: 150,
                functions: 150,
            },
            _ => MockConfig {
                tables: 10,
                views: 3,
                relationships: 15,
                triggers: 5,
                procedures: 5,
                functions: 5,
            },
        }
    }
}

const SCHEMAS: [&str; 4] = ["dbo", "sales", "inventory", "hr"];

const TABLE_PREFIXES: [&str; 20] = [
    "Customer", "Order", "Product", "Category", "Employee", "Department", "Invoice", "Payment",
    "Shipment", "Supplier", "Warehouse", "Stock", "Account", "Transaction", "Report", "Log",
    "Audit", "Config", "Setting", "User",
];

const TABLE_SUFFIXES: [&str; 10] = [
    "", "s", "Detail", "History", "Archive", "Temp", "Backup", "Master", "Ref", "Lookup",
];

const COLUMN_NAMES: [&str; 30] = [
    "Id", "Name", "Description", "Status", "Type", "Code", "Value", "Amount", "Quantity", "Price",
    "Date", "CreatedAt", "UpdatedAt", "DeletedAt", "IsActive", "IsDeleted", "Priority", "Sequence",
    "Notes", "Comments", "Email", "Phone", "Address", "City", "Country", "PostalCode", "Rating",
    "Score", "Level", "Version",
];

const DATA_TYPES: [&str; 10] = [
    "int",
    "bigint",
    "nvarchar(100)",
    "nvarchar(255)",
    "decimal(18,2)",
    "datetime2",
    "bit",
    "uniqueidentifier",
    "float",
    "nvarchar(max)",
];

const MIN_COLUMNS: usize = 5;
const MAX_COLUMNS: usize = 300;
const WIDE_COLUMN_TIERS: [usize; 5] = [100, 150, 200, 250, 300];
const TABLE_COLUMN_SEED: usize = 200;
const VIEW_COLUMN_SEED: usize = 400;

fn simple_hash(seed: usize, index: usize) -> usize {
    let mut h = seed.wrapping_add(index);
    h = h.wrapping_mul(2654435761);
    h ^= h >> 16;
    h
}

fn generate_column_count(index: usize, seed: usize) -> usize {
    if index < WIDE_COLUMN_TIERS.len() {
        return WIDE_COLUMN_TIERS[index];
    }

    let range = MAX_COLUMNS - MIN_COLUMNS + 1;
    MIN_COLUMNS + (simple_hash(seed, index) % range)
}

fn generate_tables(config: &MockConfig) -> Vec<TableNode> {
    let mut tables = Vec::with_capacity(config.tables);

    for i in 0..config.tables {
        let schema_idx = i % SCHEMAS.len();
        let prefix_idx = simple_hash(i, 0) % TABLE_PREFIXES.len();
        let suffix_idx = simple_hash(i, 1) % TABLE_SUFFIXES.len();

        let schema = SCHEMAS[schema_idx].to_string();
        let name = format!(
            "{}{}{}",
            TABLE_PREFIXES[prefix_idx], TABLE_SUFFIXES[suffix_idx], i
        );
        let id = format!("{}.{}", schema, name);

        let num_columns = generate_column_count(i, TABLE_COLUMN_SEED);
        let mut columns = Vec::with_capacity(num_columns);

        columns.push(Column {
            name: "Id".to_string(),
            data_type: "int".to_string(),
            is_nullable: false,
            is_primary_key: true,
            ..Default::default()
        });

        for c in 1..num_columns {
            let col_idx = simple_hash(i * 100 + c, 3) % COLUMN_NAMES.len();
            let type_idx = simple_hash(i * 100 + c, 4) % DATA_TYPES.len();

            columns.push(Column {
                name: format!("{}{}", COLUMN_NAMES[col_idx], c),
                data_type: DATA_TYPES[type_idx].to_string(),
                is_nullable: simple_hash(i * 100 + c, 5).is_multiple_of(2),
                is_primary_key: false,
                ..Default::default()
            });
        }

        tables.push(TableNode {
            id,
            name,
            schema,
            columns,
        });
    }

    tables
}

fn generate_relationships(tables: &[TableNode], config: &MockConfig) -> Vec<RelationshipEdge> {
    if tables.len() < 2 {
        return vec![];
    }

    let mut relationships = Vec::with_capacity(config.relationships);
    let max_rels = config.relationships.min(tables.len() * 2);

    for i in 0..max_rels {
        let from_idx = simple_hash(i, 10) % tables.len();
        let mut to_idx = simple_hash(i, 11) % tables.len();

        if to_idx == from_idx {
            to_idx = (to_idx + 1) % tables.len();
        }

        let from_table = &tables[from_idx];
        let to_table = &tables[to_idx];

        let fk_col_name = format!("{}Id", to_table.name.trim_end_matches(char::is_numeric));

        relationships.push(RelationshipEdge {
            id: format!("FK_{}_{}_{}", from_table.name, to_table.name, i),
            from: from_table.id.clone(),
            to: to_table.id.clone(),
            from_column: Some(fk_col_name),
            to_column: Some("Id".to_string()),
        });
    }

    relationships
}

fn generate_views(tables: &[TableNode], config: &MockConfig) -> Vec<ViewNode> {
    if tables.is_empty() {
        return vec![];
    }

    let mut views = Vec::with_capacity(config.views);

    for i in 0..config.views {
        let schema_idx = i % SCHEMAS.len();
        let schema = SCHEMAS[schema_idx].to_string();
        let name = format!("vw_Report{}", i);
        let id = format!("{}.{}", schema, name);

        let max_source_tables = 3.min(tables.len());
        let num_source_tables = 1 + (simple_hash(i, 20) % max_source_tables);
        let start_idx = simple_hash(i, 21) % tables.len();
        let mut source_table_indices = Vec::with_capacity(num_source_tables);
        for offset in 0..num_source_tables {
            source_table_indices.push((start_idx + offset) % tables.len());
        }

        let referenced_tables = source_table_indices
            .iter()
            .map(|idx| tables[*idx].id.clone())
            .collect::<Vec<_>>();

        let target_column_count = generate_column_count(i, VIEW_COLUMN_SEED);
        let mut columns = Vec::with_capacity(target_column_count);

        for c in 0..target_column_count {
            let source_table_idx =
                source_table_indices[simple_hash(i * 1000 + c, 22) % source_table_indices.len()];
            let source_table = &tables[source_table_idx];
            let source_column = &source_table.columns[simple_hash(i * 1000 + c, 23) % source_table.columns.len()];

            columns.push(Column {
                name: format!("{}_{}_{}", source_table.name, source_column.name, c + 1),
                data_type: source_column.data_type.clone(),
                is_nullable: source_column.is_nullable,
                is_primary_key: false,
                source_columns: vec![ColumnSource {
                    table: source_table.id.clone(),
                    column: source_column.name.clone(),
                }],
                source_table: Some(source_table.id.clone()),
                source_column: Some(source_column.name.clone()),
            });
        }

        let definition = format!(
            "CREATE VIEW {} AS\nSELECT * FROM {} -- Mock view",
            name,
            referenced_tables.first().unwrap_or(&"unknown".to_string())
        );

        views.push(ViewNode {
            id,
            name,
            schema,
            columns,
            definition,
            referenced_tables,
        });
    }

    views
}

fn generate_triggers(tables: &[TableNode], config: &MockConfig) -> Vec<Trigger> {
    if tables.is_empty() {
        return vec![];
    }

    let mut triggers = Vec::with_capacity(config.triggers);
    let trigger_types = ["AFTER", "INSTEAD OF"];

    for i in 0..config.triggers {
        let table_idx = simple_hash(i, 30) % tables.len();
        let table = &tables[table_idx];

        let name = format!("TR_{}_{}", table.name, i);
        let trigger_type = trigger_types[simple_hash(i, 31) % trigger_types.len()].to_string();

        let fires_on_insert = simple_hash(i, 32).is_multiple_of(2);
        let fires_on_update = simple_hash(i, 33).is_multiple_of(2) || !fires_on_insert;
        let fires_on_delete = simple_hash(i, 34).is_multiple_of(3);

        let mut affected_tables = vec![];
        if simple_hash(i, 35).is_multiple_of(2) && tables.len() > 1 {
            let affected_idx = (table_idx + 1 + simple_hash(i, 36)) % tables.len();
            affected_tables.push(tables[affected_idx].id.clone());
        }

        triggers.push(Trigger {
            id: format!("{}.{}", table.id, name),
            name: name.clone(),
            schema: table.schema.clone(),
            table_id: table.id.clone(),
            trigger_type,
            is_disabled: simple_hash(i, 37).is_multiple_of(5),
            fires_on_insert,
            fires_on_update,
            fires_on_delete,
            definition: format!(
                "CREATE TRIGGER {} ON {} -- Mock trigger {}",
                name, table.id, i
            ),
            referenced_tables: vec![],
            affected_tables,
        });
    }

    triggers
}

fn generate_procedures(tables: &[TableNode], config: &MockConfig) -> Vec<StoredProcedure> {
    let mut procedures = Vec::with_capacity(config.procedures);
    let proc_prefixes = ["Get", "Update", "Delete", "Insert", "Calculate", "Process", "Validate"];

    for i in 0..config.procedures {
        let schema_idx = i % SCHEMAS.len();
        let schema = SCHEMAS[schema_idx].to_string();
        let prefix = proc_prefixes[simple_hash(i, 40) % proc_prefixes.len()];
        let name = format!("{}Data{}", prefix, i);
        let id = format!("{}.{}", schema, name);

        let num_params = 1 + (simple_hash(i, 41) % 4);
        let mut parameters = Vec::with_capacity(num_params);

        for p in 0..num_params {
            let param_name_idx = simple_hash(i * 10 + p, 42) % COLUMN_NAMES.len();
            let type_idx = simple_hash(i * 10 + p, 43) % DATA_TYPES.len();

            parameters.push(ProcedureParameter {
                name: format!("@{}", COLUMN_NAMES[param_name_idx]),
                data_type: DATA_TYPES[type_idx].to_string(),
                is_output: p == num_params - 1 && simple_hash(i, 44).is_multiple_of(3),
            });
        }

        let mut referenced_tables = vec![];
        let mut affected_tables = vec![];

        if !tables.is_empty() {
            let read_count = simple_hash(i, 45) % 3;
            for r in 0..read_count {
                let table_idx = simple_hash(i * 10 + r, 46) % tables.len();
                let table_id = tables[table_idx].id.clone();
                if !referenced_tables.contains(&table_id) {
                    referenced_tables.push(table_id);
                }
            }

            if prefix == "Update" || prefix == "Delete" || prefix == "Insert" {
                let write_count = 1 + simple_hash(i, 47) % 2;
                for w in 0..write_count {
                    let table_idx = simple_hash(i * 10 + w, 48) % tables.len();
                    let table_id = tables[table_idx].id.clone();
                    if !affected_tables.contains(&table_id) {
                        affected_tables.push(table_id);
                    }
                }
            }
        }

        procedures.push(StoredProcedure {
            id,
            name: name.clone(),
            schema,
            procedure_type: "SQL_STORED_PROCEDURE".to_string(),
            parameters,
            definition: format!("CREATE PROCEDURE {} -- Mock procedure {}", name, i),
            referenced_tables,
            affected_tables,
        });
    }

    procedures
}

fn generate_functions(tables: &[TableNode], config: &MockConfig) -> Vec<ScalarFunction> {
    let mut functions = Vec::with_capacity(config.functions);
    let fn_prefixes = ["fn_Get", "fn_Calculate", "fn_Format", "fn_Validate", "fn_Convert"];
    let return_types = [
        "int",
        "decimal(18,2)",
        "nvarchar(100)",
        "bit",
        "datetime2",
    ];

    for i in 0..config.functions {
        let schema_idx = i % SCHEMAS.len();
        let schema = SCHEMAS[schema_idx].to_string();
        let prefix = fn_prefixes[simple_hash(i, 50) % fn_prefixes.len()];
        let name = format!("{}Value{}", prefix, i);
        let id = format!("{}.{}", schema, name);

        let num_params = 1 + (simple_hash(i, 51) % 3);
        let mut parameters = Vec::with_capacity(num_params);

        for p in 0..num_params {
            let param_name_idx = simple_hash(i * 10 + p, 52) % COLUMN_NAMES.len();
            let type_idx = simple_hash(i * 10 + p, 53) % DATA_TYPES.len();

            parameters.push(ProcedureParameter {
                name: format!("@{}", COLUMN_NAMES[param_name_idx]),
                data_type: DATA_TYPES[type_idx].to_string(),
                is_output: false,
            });
        }

        let return_type = return_types[simple_hash(i, 54) % return_types.len()].to_string();

        let mut referenced_tables = vec![];
        if !tables.is_empty() && simple_hash(i, 55).is_multiple_of(2) {
            let table_idx = simple_hash(i, 56) % tables.len();
            referenced_tables.push(tables[table_idx].id.clone());
        }

        functions.push(ScalarFunction {
            id,
            name: name.clone(),
            schema,
            function_type: "SQL_SCALAR_FUNCTION".to_string(),
            parameters,
            return_type,
            definition: format!("CREATE FUNCTION {} -- Mock function {}", name, i),
            referenced_tables,
            affected_tables: vec![],
        });
    }

    functions
}

#[tauri::command]
pub fn load_schema_mock(size: String) -> Result<SchemaGraph, String> {
    let config = MockConfig::from_size(&size);

    let tables = generate_tables(&config);
    let relationships = generate_relationships(&tables, &config);
    let views = generate_views(&tables, &config);
    let triggers = generate_triggers(&tables, &config);
    let stored_procedures = generate_procedures(&tables, &config);
    let scalar_functions = generate_functions(&tables, &config);

    Ok(SchemaGraph {
        tables,
        views,
        relationships,
        triggers,
        stored_procedures,
        scalar_functions,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    const SIZES: [&str; 4] = ["small", "medium", "large", "stress"];

    fn table_column_counts_for(size: &str) -> Vec<usize> {
        let config = MockConfig::from_size(size);
        generate_tables(&config)
            .iter()
            .map(|table| table.columns.len())
            .collect()
    }

    fn view_column_counts_for(size: &str) -> Vec<usize> {
        let config = MockConfig::from_size(size);
        let tables = generate_tables(&config);
        generate_views(&tables, &config)
            .iter()
            .map(|view| view.columns.len())
            .collect()
    }

    fn collect_generated_edges(
        relationships: &[RelationshipEdge],
        triggers: &[Trigger],
        procedures: &[StoredProcedure],
        functions: &[ScalarFunction],
    ) -> Vec<(String, String, String)> {
        let mut edges = Vec::new();

        for relationship in relationships {
            edges.push((
                relationship.id.clone(),
                relationship.from.clone(),
                relationship.to.clone(),
            ));
        }

        for trigger in triggers {
            edges.push((
                format!("trigger-edge-{}", trigger.id),
                trigger.table_id.clone(),
                trigger.id.clone(),
            ));

            for table_id in &trigger.referenced_tables {
                if *table_id == trigger.table_id {
                    continue;
                }
                edges.push((
                    format!("trigger-ref-edge-{}-{}", trigger.id, table_id),
                    trigger.id.clone(),
                    table_id.clone(),
                ));
            }

            for table_id in &trigger.affected_tables {
                if *table_id == trigger.table_id {
                    continue;
                }
                edges.push((
                    format!("trigger-affects-{}-{}", trigger.id, table_id),
                    trigger.id.clone(),
                    table_id.clone(),
                ));
            }
        }

        for procedure in procedures {
            for table_id in &procedure.referenced_tables {
                edges.push((
                    format!("proc-edge-{}-{}", procedure.id, table_id),
                    table_id.clone(),
                    procedure.id.clone(),
                ));
            }
            for table_id in &procedure.affected_tables {
                edges.push((
                    format!("proc-affects-{}-{}", procedure.id, table_id),
                    procedure.id.clone(),
                    table_id.clone(),
                ));
            }
        }

        for function in functions {
            for table_id in &function.referenced_tables {
                edges.push((
                    format!("func-edge-{}-{}", function.id, table_id),
                    table_id.clone(),
                    function.id.clone(),
                ));
            }
        }

        edges
    }

    #[test]
    fn tables_and_views_columns_stay_within_range_for_all_presets() {
        for size in SIZES {
            for count in table_column_counts_for(size) {
                assert!(
                    (MIN_COLUMNS..=MAX_COLUMNS).contains(&count),
                    "table column count {count} out of range for preset {size}"
                );
            }
            for count in view_column_counts_for(size) {
                assert!(
                    (MIN_COLUMNS..=MAX_COLUMNS).contains(&count),
                    "view column count {count} out of range for preset {size}"
                );
            }
        }
    }

    #[test]
    fn tiered_wide_counts_present_for_tables_and_views_when_available() {
        for size in SIZES {
            let table_counts = table_column_counts_for(size);
            if table_counts.len() >= WIDE_COLUMN_TIERS.len() {
                assert_eq!(&table_counts[..WIDE_COLUMN_TIERS.len()], &WIDE_COLUMN_TIERS);
            }

            let view_counts = view_column_counts_for(size);
            if view_counts.len() >= WIDE_COLUMN_TIERS.len() {
                assert_eq!(&view_counts[..WIDE_COLUMN_TIERS.len()], &WIDE_COLUMN_TIERS);
            }
        }
    }

    #[test]
    fn mock_column_counts_are_deterministic_for_same_preset() {
        for size in SIZES {
            let table_counts_first = table_column_counts_for(size);
            let table_counts_second = table_column_counts_for(size);
            assert_eq!(
                table_counts_first, table_counts_second,
                "table counts should be deterministic for preset {size}"
            );

            let view_counts_first = view_column_counts_for(size);
            let view_counts_second = view_column_counts_for(size);
            assert_eq!(
                view_counts_first, view_counts_second,
                "view counts should be deterministic for preset {size}"
            );
        }
    }

    #[test]
    fn generated_edge_ids_are_unique_and_endpoints_exist_for_all_presets() {
        for size in SIZES {
            let config = MockConfig::from_size(size);
            let tables = generate_tables(&config);
            let views = generate_views(&tables, &config);
            let relationships = generate_relationships(&tables, &config);
            let triggers = generate_triggers(&tables, &config);
            let procedures = generate_procedures(&tables, &config);
            let functions = generate_functions(&tables, &config);

            let mut object_ids = HashSet::new();
            for table in &tables {
                object_ids.insert(table.id.clone());
            }
            for view in &views {
                object_ids.insert(view.id.clone());
            }
            for trigger in &triggers {
                object_ids.insert(trigger.id.clone());
            }
            for procedure in &procedures {
                object_ids.insert(procedure.id.clone());
            }
            for function in &functions {
                object_ids.insert(function.id.clone());
            }

            let edges =
                collect_generated_edges(&relationships, &triggers, &procedures, &functions);

            let mut seen_edge_ids = HashSet::new();
            for (edge_id, source, target) in edges {
                assert!(
                    seen_edge_ids.insert(edge_id.clone()),
                    "duplicate edge id {edge_id} in preset {size}"
                );
                assert!(
                    object_ids.contains(&source),
                    "edge {edge_id} source endpoint {source} missing in preset {size}"
                );
                assert!(
                    object_ids.contains(&target),
                    "edge {edge_id} target endpoint {target} missing in preset {size}"
                );
            }
        }
    }
}
