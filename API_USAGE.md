# Dynamic Query API Usage

This API provides dynamic access to all tables in your read-only database with comprehensive filtering capabilities.

## Endpoints

### 1. Get Available Tables
```
GET /tables
```
Returns a list of all accessible tables in the database.

**Response:**
```json
{
  "tables": ["users", "products", "orders", "categories"]
}
```

### 2. Get Table Schema
```
GET /tables/{table}/schema
```
Returns the schema information for a specific table.

**Response:**
```json
{
  "table": "users",
  "schema": [
    {
      "column_name": "id",
      "data_type": "integer",
      "is_nullable": "NO",
      "column_default": "nextval('users_id_seq'::regclass)"
    },
    {
      "column_name": "email",
      "data_type": "character varying",
      "is_nullable": "NO",
      "column_default": null
    }
  ]
}
```

### 3. Query Table Data
```
GET /{table}/{columns}
```
Dynamically query any table with specified columns and filters.

**Parameters:**
- `{table}`: The table name
- `{columns}`: Comma-separated column names or `*` for all columns

**Query Parameters:**

#### Filtering
Filters use the format: `{column}_{operator}={value}`

**Supported Operators:**
- `eq` - Equal to
- `ne` - Not equal to
- `gt` - Greater than
- `gte` - Greater than or equal to
- `lt` - Less than
- `lte` - Less than or equal to
- `like` - Case-insensitive pattern matching
- `in` - Value in list (comma-separated)
- `not_in` - Value not in list (comma-separated)
- `is_null` - Is null (no value required)
- `is_not_null` - Is not null (no value required)

#### Pagination
- `limit` - Number of records to return
- `offset` - Number of records to skip

#### Sorting
- `orderBy` - Column to sort by
- `orderDirection` - `ASC` or `DESC` (default: ASC)

## Examples

### Get all columns from users table:
```
GET /users/*
```

### Get specific columns:
```
GET /users/id,email,name
```

### Filter by exact match:
```
GET /users/id,email?email_eq=john@example.com
```

### Filter by range:
```
GET /products/id,name,price?price_gte=10&price_lt=100
```

### Pattern matching:
```
GET /users/id,name,email?name_like=john
```

### Multiple filters:
```
GET /orders/id,user_id,status,total?status_eq=completed&total_gte=50&user_id_in=1,2,3
```

### Pagination and sorting:
```
GET /products/id,name,price?limit=20&offset=40&orderBy=price&orderDirection=DESC
```

### Complex query example:
```
GET /orders/id,user_id,status,total,created_at?status_in=pending,completed&total_gte=25&limit=50&offset=0&orderBy=created_at&orderDirection=DESC
```

### Check for null values:
```
GET /users/id,name,phone?phone_is_null=true
```

## Response Format

All data queries return:
```json
{
  "data": [...], // Array of matching records
  "total": 150,  // Total count of matching records
  "page": 3,     // Current page (if pagination used)
  "pageSize": 20 // Page size (if pagination used)
}
```

## Security Features

- **Table Whitelist**: Only tables that exist in the database are accessible
- **Column Blacklist**: Sensitive columns (password, secret, token, private_key) are blocked
- **SQL Injection Protection**: All queries use parameterized statements
- **Read-Only**: Only SELECT operations are allowed

## Error Responses

- `400 Bad Request` - Invalid query parameters or operators
- `403 Forbidden` - Access to table or column is denied
- `404 Not Found` - Table does not exist

## Notes

- Column names in filters should match the exact column names in the database
- String comparisons are case-sensitive except for `like` operator which is case-insensitive
- For `in` and `not_in` operators, separate multiple values with commas
- Date/time filtering works with standard formats (ISO 8601 recommended) 