use crate::types::{
    Column, ProcedureParameter, RelationshipEdge, SchemaGraph, StoredProcedure, TableNode, Trigger,
};

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
        triggers: vec![
            Trigger {
                id: "dbo.Orders.TR_Orders_Audit".to_string(),
                name: "TR_Orders_Audit".to_string(),
                schema: "dbo".to_string(),
                table_id: "dbo.Orders".to_string(),
                trigger_type: "AFTER".to_string(),
                is_disabled: false,
                fires_on_insert: true,
                fires_on_update: true,
                fires_on_delete: false,
                definition: r#"CREATE TRIGGER TR_Orders_Audit
ON dbo.Orders
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.AuditLog (TableName, Action, RecordId, ChangedAt)
    SELECT 'Orders',
           CASE WHEN EXISTS(SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           i.Id,
           GETDATE()
    FROM inserted i;
END"#
                    .to_string(),
            },
            Trigger {
                id: "dbo.Products.TR_Products_UpdatePrice".to_string(),
                name: "TR_Products_UpdatePrice".to_string(),
                schema: "dbo".to_string(),
                table_id: "dbo.Products".to_string(),
                trigger_type: "AFTER".to_string(),
                is_disabled: false,
                fires_on_insert: false,
                fires_on_update: true,
                fires_on_delete: false,
                definition: r#"CREATE TRIGGER TR_Products_UpdatePrice
ON dbo.Products
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF UPDATE(Price)
    BEGIN
        INSERT INTO dbo.PriceHistory (ProductId, OldPrice, NewPrice, ChangedAt)
        SELECT d.Id, d.Price, i.Price, GETDATE()
        FROM deleted d
        INNER JOIN inserted i ON d.Id = i.Id
        WHERE d.Price <> i.Price;
    END
END"#
                    .to_string(),
            },
            Trigger {
                id: "dbo.Customers.TR_Customers_ValidateEmail".to_string(),
                name: "TR_Customers_ValidateEmail".to_string(),
                schema: "dbo".to_string(),
                table_id: "dbo.Customers".to_string(),
                trigger_type: "INSTEAD OF".to_string(),
                is_disabled: true,
                fires_on_insert: true,
                fires_on_update: true,
                fires_on_delete: false,
                definition: r#"CREATE TRIGGER TR_Customers_ValidateEmail
ON dbo.Customers
INSTEAD OF INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    -- Validate email format before insert/update
    IF EXISTS (SELECT 1 FROM inserted WHERE Email NOT LIKE '%@%.%')
    BEGIN
        RAISERROR('Invalid email format', 16, 1);
        RETURN;
    END
    -- Perform the actual insert/update
    INSERT INTO dbo.Customers (Name, Email, CreatedAt)
    SELECT Name, Email, CreatedAt FROM inserted;
END"#
                    .to_string(),
            },
        ],
        stored_procedures: vec![
            StoredProcedure {
                id: "dbo.GetOrdersByCustomer".to_string(),
                name: "GetOrdersByCustomer".to_string(),
                schema: "dbo".to_string(),
                procedure_type: "SQL_STORED_PROCEDURE".to_string(),
                parameters: vec![
                    ProcedureParameter {
                        name: "@CustomerId".to_string(),
                        data_type: "int".to_string(),
                        is_output: false,
                    },
                    ProcedureParameter {
                        name: "@StartDate".to_string(),
                        data_type: "datetime2".to_string(),
                        is_output: false,
                    },
                    ProcedureParameter {
                        name: "@EndDate".to_string(),
                        data_type: "datetime2".to_string(),
                        is_output: false,
                    },
                ],
                definition: r#"CREATE PROCEDURE GetOrdersByCustomer
    @CustomerId INT,
    @StartDate DATETIME2 = NULL,
    @EndDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT o.Id, o.OrderDate, o.TotalAmount, o.Status
    FROM dbo.Orders o
    WHERE o.CustomerId = @CustomerId
      AND (@StartDate IS NULL OR o.OrderDate >= @StartDate)
      AND (@EndDate IS NULL OR o.OrderDate <= @EndDate)
    ORDER BY o.OrderDate DESC;
END"#
                    .to_string(),
            },
            StoredProcedure {
                id: "dbo.CalculateOrderTotal".to_string(),
                name: "CalculateOrderTotal".to_string(),
                schema: "dbo".to_string(),
                procedure_type: "SQL_STORED_PROCEDURE".to_string(),
                parameters: vec![
                    ProcedureParameter {
                        name: "@OrderId".to_string(),
                        data_type: "int".to_string(),
                        is_output: false,
                    },
                    ProcedureParameter {
                        name: "@Total".to_string(),
                        data_type: "decimal".to_string(),
                        is_output: true,
                    },
                ],
                definition: r#"CREATE PROCEDURE CalculateOrderTotal
    @OrderId INT,
    @Total DECIMAL(18,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT @Total = SUM(Quantity * UnitPrice)
    FROM dbo.OrderItems
    WHERE OrderId = @OrderId;
END"#
                    .to_string(),
            },
            StoredProcedure {
                id: "dbo.ArchiveOldOrders".to_string(),
                name: "ArchiveOldOrders".to_string(),
                schema: "dbo".to_string(),
                procedure_type: "SQL_STORED_PROCEDURE".to_string(),
                parameters: vec![ProcedureParameter {
                    name: "@DaysOld".to_string(),
                    data_type: "int".to_string(),
                    is_output: false,
                }],
                definition: r#"CREATE PROCEDURE ArchiveOldOrders
    @DaysOld INT = 365
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;

    INSERT INTO dbo.OrdersArchive
    SELECT * FROM dbo.Orders
    WHERE OrderDate < DATEADD(DAY, -@DaysOld, GETDATE());

    DELETE FROM dbo.Orders
    WHERE OrderDate < DATEADD(DAY, -@DaysOld, GETDATE());

    COMMIT TRANSACTION;
END"#
                    .to_string(),
            },
        ],
    })
}
