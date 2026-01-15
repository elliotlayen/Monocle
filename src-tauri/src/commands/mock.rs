use crate::types::{
    Column, ProcedureParameter, RelationshipEdge, ScalarFunction, SchemaGraph, StoredProcedure,
    TableNode, Trigger, ViewNode,
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

fn simple_hash(seed: usize, index: usize) -> usize {
    let mut h = seed.wrapping_add(index);
    h = h.wrapping_mul(2654435761);
    h ^= h >> 16;
    h
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

        let num_columns = 3 + (simple_hash(i, 2) % 8);
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
            from_column: fk_col_name,
            to_column: "Id".to_string(),
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

        let num_source_tables = 1 + (simple_hash(i, 20) % 3).min(tables.len());
        let mut referenced_tables = Vec::with_capacity(num_source_tables);
        let mut columns = Vec::new();

        for t in 0..num_source_tables {
            let table_idx = simple_hash(i * 10 + t, 21) % tables.len();
            let table = &tables[table_idx];
            referenced_tables.push(table.id.clone());

            for col in table.columns.iter().take(3) {
                columns.push(Column {
                    name: format!("{}_{}", table.name, col.name),
                    data_type: col.data_type.clone(),
                    is_nullable: col.is_nullable,
                    is_primary_key: false,
                    source_table: Some(table.name.clone()),
                    source_column: Some(col.name.clone()),
                });
                if columns.len() >= 8 {
                    break;
                }
            }
            if columns.len() >= 8 {
                break;
            }
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
                referenced_tables.push(tables[table_idx].id.clone());
            }

            if prefix == "Update" || prefix == "Delete" || prefix == "Insert" {
                let write_count = 1 + simple_hash(i, 47) % 2;
                for w in 0..write_count {
                    let table_idx = simple_hash(i * 10 + w, 48) % tables.len();
                    affected_tables.push(tables[table_idx].id.clone());
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
