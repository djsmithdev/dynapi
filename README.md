# 🚀 DynAPI

A secure, high-performance NestJS-based API for accessing PostgreSQL databases with dynamic query capabilities, comprehensive security features, and configurable rate limiting.

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [API Usage](#-api-usage)
- [Security](#-security)
- [Rate Limiting](#-rate-limiting)
- [Examples](#-examples)
- [Development](#-development)
- [Deployment](#-deployment)
- [License](#-license)

## ✨ Features

- **🔒 Secure by Default**: All API endpoints require authentication
- **🚀 Dynamic Queries**: Query any table with custom column selection and filtering
- **🛡️ Comprehensive Security**: API key authentication, input validation, SQL injection protection
- **⚡ Rate Limiting**: Configurable request throttling with environment variables
- **🌐 CORS Support**: Configurable cross-origin resource sharing
- **📊 Database Agnostic**: Works with any PostgreSQL database
- **🔍 Advanced Filtering**: 11 filter operators (eq, ne, gt, gte, lt, lte, like, in, not_in, is_null, is_not_null)
- **📄 Pagination & Sorting**: Built-in support for limit, offset, and ordering
- **📝 Minimal Logging**: Privacy-focused logging with IP masking

## 🚀 Quick Start

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd dynapi
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

### Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp environment.example .env
# Edit .env with your actual values
```

### Environment Variables

#### **Application Settings**
```bash
NODE_ENV=development          # Environment: development, production, test
PORT=4000                    # Server port (default: 4000)
```

#### **Database Configuration**
```bash
# PostgreSQL database connection settings
DB_HOST=localhost            # PostgreSQL host
DB_PORT=5432                # PostgreSQL port  
DB_USERNAME=your_postgres_username    # Database username
DB_PASSWORD=your_postgres_password    # Database password
DB_DATABASE=your_database    # Database name
DB_SSL=false                # Enable SSL (true for production)
```

#### **Security Configuration**
```bash
# API Keys for authentication (JSON format with embedded permissions)
# Generate strong, unique keys for each environment: openssl rand -hex 32
API_KEYS=[{"key":"admin-key-replace-me","permissions":{"allowedTables":["*"],"allowedOperations":["CREATE","UPDATE","DELETE"],"maxRecordsPerOperation":100}},{"key":"editor-key-replace-me","permissions":{"allowedTables":["specific-tables"],"allowedOperations":["CREATE","UPDATE","DELETE"],"maxRecordsPerOperation":50}},{"key":"readonly-key-replace-me"}]

# Allowed Origins for CORS (comma-separated)
# Add all domains that will access your API
ALLOWED_ORIGINS=http://localhost:4000,http://localhost:4001,https://yourdomain.com

# Rate Limiting Configuration
# THROTTLE_TTL: Time window in milliseconds (default: 900000 = 15 minutes)
# THROTTLE_LIMIT: Maximum requests per time window (default: 1000)
THROTTLE_TTL=900000         # Time window in milliseconds (15 minutes)
THROTTLE_LIMIT=1000         # Max requests per window
```

#### **Optional Configuration**
```bash
# Enable detailed error messages (set to false in production)
DETAILED_ERRORS=true        # Show detailed errors (false in production)
```

### Production Example Configuration

For production deployment, use these recommended settings:

```bash
# Production Environment
NODE_ENV=production
PORT=4000
DB_HOST=your-production-db-host.com
DB_PORT=5432
DB_USERNAME=production_user
DB_PASSWORD=secure_production_password
DB_DATABASE=your_prod_database
DB_SSL=true

# Production Security (JSON format with permissions)
API_KEYS=[{"key":"secure-prod-admin","permissions":{"allowedTables":["*"],"allowedOperations":["CREATE","UPDATE","DELETE"],"maxRecordsPerOperation":100}},{"key":"secure-prod-editor","permissions":{"allowedTables":["specific-tables"],"allowedOperations":["CREATE","UPDATE","DELETE"],"maxRecordsPerOperation":50}},{"key":"client-readonly-key"}]
ALLOWED_ORIGINS=https://yourapp.com,https://admin.yourapp.com
DETAILED_ERRORS=false

# Production Rate Limiting (more restrictive)
THROTTLE_TTL=900000    # 15 minutes
THROTTLE_LIMIT=500     # 500 requests per 15 minutes
```

### Development Configuration

For development, you can use more permissive settings:

```bash
# Development Rate Limiting (more permissive)
THROTTLE_TTL=300000    # 5 minutes  
THROTTLE_LIMIT=2000    # 2000 requests per 5 minutes
```

### Rate Limiting Guidelines

Adjust rate limiting based on your expected traffic patterns:

- **Production**: Lower limits (e.g., 500 requests per 15 minutes)
- **Development**: Higher limits (e.g., 2000 requests per 5 minutes)  
- **High-traffic APIs**: Consider shorter TTL with higher limits

### Security Best Practices

1. **Never commit your actual .env file to version control**
2. **Generate strong API keys using**: `openssl rand -hex 32`
3. **Use different API keys for development and production**
4. **Enable SSL (DB_SSL=true) for production databases**
5. **Restrict ALLOWED_ORIGINS to your actual domains in production**
6. **Set DETAILED_ERRORS=false in production for security**

## 🔑 API Key Configuration

### Unified JSON Format

DynAPI uses a modern JSON-based API key configuration that embeds permissions directly:

```json
API_KEYS=[
  {
    "key": "admin-super-key-2024",
    "permissions": {
      "allowedTables": ["*"],
      "allowedOperations": ["CREATE", "UPDATE", "DELETE"],
      "maxRecordsPerOperation": 100,
      "rateLimitOverride": {
        "ttl": 60000,
        "limit": 200
      }
    }
  },
  {
    "key": "editor-limited-key-2024",
    "permissions": {
      "allowedTables": ["certCerts", "agtAgentTypes"],
      "allowedOperations": ["CREATE", "UPDATE", "DELETE"],
      "maxRecordsPerOperation": 50
    }
  },
  {
    "key": "readonly-client-key-2024"
  }
]
```

### Key Types

- **Admin Keys**: Full access with `allowedTables: ["*"]`
- **Editor Keys**: Limited to specific tables and operations
- **Read-Only Keys**: No `permissions` object - read access only
- **Custom Rate Limits**: Optional `rateLimitOverride` per key

## 🔌 API Usage

### Base URL
```
http://localhost:4000/api
```

### Authentication
All endpoints require an API key via one of these methods:

```bash
# Header (Recommended)
curl -H "X-API-Key: your-api-key" "http://localhost:4000/api/tables"

# Authorization Header
curl -H "Authorization: Bearer your-api-key" "http://localhost:4000/api/tables"

# Query Parameter (Less secure)
curl "http://localhost:4000/api/tables?apiKey=your-api-key"
```

### Core Endpoints

#### **List All Tables**
```bash
GET /api/tables
```
Returns all available database tables.

#### **Get Table Schema**
```bash
GET /api/tables/{table}/schema
```
Returns column information for a specific table.

#### **Dynamic Data Query**
```bash
GET /api/{table}/{columns}?[filters]&[pagination]&[sorting]
```

### Query Parameters

#### **Column Selection**
```bash
# Single column
/api/users/username

# Multiple columns
/api/users/id,username,email

# All columns
/api/users/*
```

#### **Filtering**
```bash
# Basic filters
?filters=columnName:operator:value

# Multiple filters (comma-separated)
?filters=status:eq:active,created_at:gte:2023-01-01

# Available operators:
# eq, ne, gt, gte, lt, lte, like, in, not_in, is_null, is_not_null
```

#### **Pagination**
```bash
?limit=50          # Max results (default: 100, max: 1000)
?offset=100        # Skip results
```

#### **Sorting**
```bash
?orderBy=columnName           # Sort column
?orderDirection=ASC|DESC      # Sort direction (default: ASC)
```

## 🛡️ Security

### Multi-Layer Security Architecture

1. **API Key Authentication**: Required for all endpoints
2. **Input Validation**: SQL injection and XSS protection
3. **Rate Limiting**: Configurable request throttling
4. **CORS Protection**: Restricted cross-origin access
5. **Security Headers**: Helmet.js security headers
6. **IP Masking**: Privacy-focused logging

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options

## ⚡ Rate Limiting

### Default Limits
- **Development**: 1000 requests per 15 minutes
- **Production**: Configurable via environment variables

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Custom Configuration
```bash
# 5 minutes, 2000 requests (development)
THROTTLE_TTL=300000
THROTTLE_LIMIT=2000

# 15 minutes, 500 requests (production)
THROTTLE_TTL=900000
THROTTLE_LIMIT=500
```

## 📚 Examples

### Basic Queries

#### **Get All Users**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/users/id,username,email"
```

#### **Find Active Users**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/users/username,status?filters=status:eq:active"
```

#### **Recent Records**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/orders/id,created_at,total?filters=created_at:gte:2023-01-01&limit=10&orderBy=created_at&orderDirection=DESC"
```

#### **Search by Name**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/products/name,price?filters=name:like:%laptop%"
```

### Advanced Filtering

#### **Multiple Conditions**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/products/*?filters=price:gte:100,price:lt:500,category_id:eq:1"
```

#### **IN Operator**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/users/username?filters=role_id:in:1,2,3"
```

#### **LIKE Search**
```bash
curl -H "X-API-Key: your-key" \
  "http://localhost:4000/api/customers/company_name?filters=company_name:like:%Tech%"
```

### Response Format
```json
{
  "data": [...],
  "count": 42,
  "total": 1337,
  "limit": 100,
  "offset": 0,
  "securityLevel": "authenticated",
  "query": {
    "table": "users",
    "columns": ["username", "email"],
    "filters": [...]
  }
}
```

## 🛠️ Development

### Available Scripts

```bash
# Development with hot reload
npm run start:dev

# Production build
npm run build

# Production start
npm run start:prod

# Run tests
npm run test

# Test coverage
npm run test:cov

# End-to-end tests
npm run test:e2e
```

### Project Structure
```
src/
├── common/           # Shared components (AgentLog)
├── config/           # Configuration modules
├── database/         # Database configuration
├── dynamic-query/    # Core API logic
│   ├── interfaces/   # TypeScript interfaces
│   ├── dynamic-query.controller.ts
│   ├── dynamic-query.service.ts
│   └── dynamic-query.module.ts
├── security/         # Security components
│   ├── auth.guard.ts
│   ├── validation.service.ts
│   ├── security.middleware.ts
│   └── security.module.ts
└── main.ts          # Application entry point
```

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=4000
   DB_SSL=true
   DETAILED_ERRORS=false
   ```

2. **Security Configuration**
   - Generate strong API keys: `openssl rand -hex 32`
   - Configure restrictive CORS origins
   - Set appropriate rate limits

3. **Database**
   - Enable SSL connections
   - Use connection pooling
   - Regular backups

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 4000
CMD ["npm", "run", "start:prod"]
```

### Railway Deployment
This application is configured for Railway deployment with automatic builds on push to main branch.

## 📊 Database Support

DynamicAPI works with any PostgreSQL database and automatically discovers:

- **Tables**: All available tables in your database
- **Columns**: Column names, types, and constraints
- **Relationships**: Foreign key relationships
- **Indexes**: Database indexes and constraints

Use `/api/tables` to see all available tables in your connected database.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is [UNLICENSED](LICENSE).

---

**⚠️ Security Notice**: Always use strong, unique API keys and never commit your `.env` file to version control. Generate API keys using `openssl rand -hex 32` for maximum security.
