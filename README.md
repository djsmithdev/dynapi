# 🚀 DynAPI

A secure, high-performance NestJS-based API for accessing PostgreSQL databases with dynamic query capabilities and comprehensive security features.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Usage](#-api-usage)
- [Security](#-security)
- [Rate Limiting](#-rate-limiting)
- [Audit Logging](#-audit-logging)
- [Examples](#-examples)
- [Development](#-development)
- [Deployment](#-deployment)
- [License](#-license)

## ✨ Features

- **🔒 Secure by Default**: All API endpoints require authentication
- **🚀 Dynamic Queries**: Query any table with custom column selection and filtering
- **📝 Full CRUD Operations**: Create, Read, Update, Delete with granular permissions
- **🛡️ Comprehensive Security**: API key authentication, input validation, SQL injection protection
- **📋 Audit Logging**: Complete audit trail for all write operations
- **⚡ Rate Limiting**: Configurable request throttling
- **🔍 Advanced Filtering**: 11 filter operators (eq, ne, gt, gte, lt, lte, like, in, not_in, is_null, is_not_null)
- **📄 Pagination & Sorting**: Built-in support for limit, offset, and ordering

## 🚀 Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp environment.example .env
   # Edit .env with your database and security settings
   ```

3. **Start the Application**
   ```bash
   npm run start:dev
   ```

4. **Test the API**
   ```bash
   # Test with your API key
   curl -H "X-API-Key: your-api-key" "http://localhost:4000/api/tables"
   ```

## 📦 Installation

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- npm or yarn package manager

### Setup

```bash
# Install dependencies
npm install

# Copy environment configuration
cp environment.example .env

# Configure your .env file (see Configuration section)
# Start in development mode
npm run start:dev
```

## ⚙️ Configuration

### Environment Variables

```bash
# Application
NODE_ENV=development
PORT=4000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database
DB_SSL=false

# Security - API Keys (JSON format)
API_KEYS=[{"key":"admin-key","permissions":{"allowedTables":["*"],"allowedOperations":["CREATE","UPDATE","DELETE"],"maxRecordsPerOperation":100}},{"key":"readonly-key"}]

# CORS
ALLOWED_ORIGINS=http://localhost:4000,http://localhost:4001

# Rate Limiting
THROTTLE_TTL=900000     # 15 minutes
THROTTLE_LIMIT=1000     # Max requests per window
```

### API Key Types

- **Admin Keys**: Full access with `"allowedTables": ["*"]`
- **Editor Keys**: Limited to specific tables with write permissions
- **Read-Only Keys**: No `permissions` object - read access only

## 🔌 API Usage

### Base URL
```
http://localhost:4000/api
```

### Authentication
Include API key in request header:
```bash
curl -H "X-API-Key: your-api-key" "http://localhost:4000/api/tables"
```

### Core Endpoints

#### **List Available Tables**
```bash
GET /api/tables
```

#### **Get Table Schema**
```bash
GET /api/tables/{table}/schema
```

#### **Query Table Data**
```bash
GET /api/query/{table}/{columns}?[filters]&[pagination]&[sorting]
```

### Query Parameters

#### **Column Selection**
```bash
# All columns
/api/query/users/*

# Specific columns
/api/query/users/id,username,email
```

#### **Filtering**
Format: `{column}_{operator}={value}`

**Available Operators:**
- `eq` - Equal to
- `ne` - Not equal to  
- `gt` - Greater than
- `gte` - Greater than or equal to
- `lt` - Less than
- `lte` - Less than or equal to
- `like` - Case-insensitive pattern matching
- `in` - Value in list (comma-separated)
- `not_in` - Value not in list
- `is_null` - Is null
- `is_not_null` - Is not null

#### **Pagination & Sorting**
```bash
?limit=50&offset=100&orderBy=columnName&orderDirection=DESC
```

## 📚 Examples

### Basic Queries

```bash
# Get all users
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/query/users/*"

# Get specific columns
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/query/users/id,username,email"

# Filter by exact match
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/query/users/*?email_eq=john@example.com"

# Pattern matching
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/query/products/*?name_like=laptop"

# Multiple filters with pagination
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/query/orders/*?status_eq=completed&total_gte=50&limit=20&orderBy=created_at&orderDirection=DESC"
```

### Write Operations

*Requires API keys with write permissions*

#### **Create Records**
```bash
curl -X POST \
  -H "X-API-Key: your-write-key" \
  -H "Content-Type: application/json" \
  -d '{"data":[{"name":"Product A","price":99.99}]}' \
  "http://localhost:4000/api/products"
```

#### **Update Records**
```bash
curl -X PUT \
  -H "X-API-Key: your-write-key" \
  -H "Content-Type: application/json" \
  -d '{"filters":"id:eq:123","data":{"status":"inactive"}}' \
  "http://localhost:4000/api/users"
```

#### **Delete Records**
```bash
curl -X DELETE \
  -H "X-API-Key: your-write-key" \
  -H "Content-Type: application/json" \
  -d '{"filters":"id:eq:123"}' \
  "http://localhost:4000/api/users"
```

## 🛡️ Security Features

- **API Key Authentication**: Required for all endpoints
- **Permission-Based Access Control**: Granular table and operation permissions
- **Input Validation**: SQL injection and XSS protection
- **Rate Limiting**: Configurable request throttling
- **CORS Protection**: Restricted cross-origin access
- **Audit Logging**: Complete audit trail for write operations

## 📋 Response Format

### Read Operations
```json
{
  "data": [...],
  "total": 150,
  "meta": {
    "table": "users",
    "columnsRequested": "all",
    "filtersApplied": 1,
    "securityLevel": "authenticated"
  }
}
```

### Write Operations
```json
{
  "success": true,
  "operation": "CREATE",
  "table": "users",
  "affectedRows": 2,
  "auditId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## 🛠️ Development

### Available Scripts
```bash
npm run start:dev    # Development with hot reload
npm run build        # Production build
npm run start:prod   # Production start
npm run test         # Run tests
```

### Project Structure
```
src/
├── common/              # Shared components
├── config/              # Configuration
├── database/            # Database configuration
├── dynamic-query/       # Core API logic
├── security/            # Security components
└── main.ts             # Application entry point
```

## 🚀 Production Deployment

### Environment Configuration
```bash
NODE_ENV=production
PORT=4000
DB_SSL=true
DETAILED_ERRORS=false
THROTTLE_LIMIT=500      # More restrictive for production
```

### Security Best Practices
1. Generate strong API keys: `openssl rand -hex 32`
2. Use different keys for development and production
3. Enable SSL for database connections
4. Restrict CORS origins to your actual domains
5. Set lower rate limits for production

## 📊 Audit Logging

All write operations are automatically logged with:
- Operation details (CREATE, UPDATE, DELETE)
- Affected row counts
- API key (masked) and IP address
- Timestamps and success/failure status

Access audit logs via:
```bash
POST /api/audit/logs
POST /api/audit/statistics
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is [UNLICENSED](LICENSE).

---

**⚠️ Security Notice**: Always use strong, unique API keys and never commit your `.env` file to version control.
