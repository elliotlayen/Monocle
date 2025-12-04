use crate::types::{Column, RelationshipEdge, SchemaGraph, TableNode};

#[tauri::command]
pub fn load_schema_mock() -> Result<SchemaGraph, String> {
    let customers = TableNode {
        id: "dbo.Customers".to_string(),
        name: "Customers".to_string(),
        schema: "dbo".to_string(),
        columns: vec![
            Column {
                name: "Id".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: true,
            },
            Column {
                name: "Name".to_string(),
                data_type: "nvarchar(100)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "Email".to_string(),
                data_type: "nvarchar(255)".to_string(),
                is_nullable: true,
                is_primary_key: false,
            },
            Column {
                name: "CreatedAt".to_string(),
                data_type: "datetime2".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
        ],
    };

    let orders = TableNode {
        id: "dbo.Orders".to_string(),
        name: "Orders".to_string(),
        schema: "dbo".to_string(),
        columns: vec![
            Column {
                name: "Id".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: true,
            },
            Column {
                name: "CustomerId".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "OrderDate".to_string(),
                data_type: "datetime2".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "TotalAmount".to_string(),
                data_type: "decimal(18,2)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "Status".to_string(),
                data_type: "nvarchar(50)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
        ],
    };

    let products = TableNode {
        id: "dbo.Products".to_string(),
        name: "Products".to_string(),
        schema: "dbo".to_string(),
        columns: vec![
            Column {
                name: "Id".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: true,
            },
            Column {
                name: "Name".to_string(),
                data_type: "nvarchar(200)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "Price".to_string(),
                data_type: "decimal(18,2)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "CategoryId".to_string(),
                data_type: "int".to_string(),
                is_nullable: true,
                is_primary_key: false,
            },
        ],
    };

    let order_items = TableNode {
        id: "dbo.OrderItems".to_string(),
        name: "OrderItems".to_string(),
        schema: "dbo".to_string(),
        columns: vec![
            Column {
                name: "Id".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: true,
            },
            Column {
                name: "OrderId".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "ProductId".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "Quantity".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "UnitPrice".to_string(),
                data_type: "decimal(18,2)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
        ],
    };

    let categories = TableNode {
        id: "dbo.Categories".to_string(),
        name: "Categories".to_string(),
        schema: "dbo".to_string(),
        columns: vec![
            Column {
                name: "Id".to_string(),
                data_type: "int".to_string(),
                is_nullable: false,
                is_primary_key: true,
            },
            Column {
                name: "Name".to_string(),
                data_type: "nvarchar(100)".to_string(),
                is_nullable: false,
                is_primary_key: false,
            },
            Column {
                name: "Description".to_string(),
                data_type: "nvarchar(500)".to_string(),
                is_nullable: true,
                is_primary_key: false,
            },
        ],
    };

    Ok(SchemaGraph {
        tables: vec![customers, orders, products, order_items, categories],
        relationships: vec![
            RelationshipEdge {
                id: "FK_Orders_Customers".to_string(),
                from: "dbo.Orders".to_string(),
                to: "dbo.Customers".to_string(),
                from_column: "CustomerId".to_string(),
                to_column: "Id".to_string(),
            },
            RelationshipEdge {
                id: "FK_OrderItems_Orders".to_string(),
                from: "dbo.OrderItems".to_string(),
                to: "dbo.Orders".to_string(),
                from_column: "OrderId".to_string(),
                to_column: "Id".to_string(),
            },
            RelationshipEdge {
                id: "FK_OrderItems_Products".to_string(),
                from: "dbo.OrderItems".to_string(),
                to: "dbo.Products".to_string(),
                from_column: "ProductId".to_string(),
                to_column: "Id".to_string(),
            },
            RelationshipEdge {
                id: "FK_Products_Categories".to_string(),
                from: "dbo.Products".to_string(),
                to: "dbo.Categories".to_string(),
                from_column: "CategoryId".to_string(),
                to_column: "Id".to_string(),
            },
        ],
    })
}
