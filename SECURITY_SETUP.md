# Security Configuration Guide

## Overview
The DynAPI now includes comprehensive security features to prevent abuse and unauthorized access.

## Security Layers Implemented

### 1. API Key Authentication
- **Endpoint**: All `/secure/*` endpoints require API keys
- **Configuration**: Set `API_KEYS` environment variable with comma-separated keys
- **Usage**: Include API key via:
  - Header: `X-API-Key: your-api-key`
  - Authorization: `Authorization: Bearer your-api-key`
  - Query parameter: `?apiKey=your-api-key`

### 2. Rate Limiting
- **Limit**: 1000 requests per 15 minutes per IP+API key combination
- **Headers**: Responses include rate limit information
- **Throttling**: Built-in NestJS Throttler module

### 3. Input Validation
- **SQL Injection Protection**: Pattern-based detection and blocking
- **XSS Prevention**: Script tag and JavaScript protocol blocking
- **Parameter Validation**: Table names, column names, and filter values
- **Length Limits**: Maximum input lengths enforced

### 4. Security Headers
- **CSP**: Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **XSS Protection**: X-XSS-Protection header
- **Frame Options**: X-Frame-Options to prevent clickjacking
- **Content Type**: X-Content-Type-Options to prevent MIME sniffing

### 5. CORS Configuration
- **Origin Control**: Only allowed origins can access the API
- **Method Restriction**: Limited to GET, POST, OPTIONS
- **Header Control**: Specific allowed headers

## Environment Variables

Create a `.env` file with these settings:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=dynapi
DB_SSL=false

# Security Configuration
API_KEYS=dynapi-dev-key-12345,dynapi-prod-key-67890,dynapi-admin-key-99999
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3002,https://your-frontend.com

# Application Configuration
NODE_ENV=development
PORT=3000
```

## API Endpoints

### Public Endpoints (No Authentication)
- `GET /tables` - List all available tables
- `GET /tables/:table/schema` - Get table schema
- `GET /:table/:columns` - Basic queries (with limitations)

### Secure Endpoints (API Key Required)
- `GET /secure/tables` - List all available tables (authenticated)
- `GET /secure/tables/:table/schema` - Get table schema (authenticated)
- `GET /secure/:table/:columns` - Full query capabilities with security

## Usage Examples

### Secure API Access
```bash
# Using X-API-Key header
curl -H "X-API-Key: dynapi-dev-key-12345" \
  "http://localhost:3000/secure/mapSolarSystems/*?limit=10"

# Using Authorization header
curl -H "Authorization: Bearer dynapi-dev-key-12345" \
  "http://localhost:3000/secure/mapSolarSystems/*?fromSolarSystemID_eq=30000142"

# Using query parameter
curl "http://localhost:3000/secure/mapRegions/*?apiKey=dynapi-dev-key-12345&limit=20"
```

### Node.js Client Example
```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'X-API-Key': 'dynapi-dev-key-12345'
  }
});

// Get Jita connections securely
async function getJitaConnections() {
  try {
    const response = await client.get('/secure/mapSolarSystemJumps/*', {
      params: { fromSolarSystemID_eq: 30000142 }
    });
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.error('Invalid API key');
    } else if (error.response?.status === 429) {
      console.error('Rate limit exceeded');
    }
    throw error;
  }
}
```

## Security Features

### Input Validation Rules
- Table names: alphanumeric + underscores only
- Column names: alphanumeric + underscores only
- Maximum 10 filters per query
- Maximum 1000 results per query
- Maximum 100 values in IN clauses

### Blocked Patterns
- SQL injection patterns (DROP, DELETE, UNION, etc.)
- XSS patterns (script tags, javascript:, etc.)
- Directory traversal (../, /etc/passwd, etc.)
- Null bytes and excessive input lengths

### Rate Limiting Details
- **Window**: 15 minutes
- **Limit**: 1000 requests
- **Identifier**: IP address + API key
- **Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

## Monitoring and Logging

### Security Events Logged
- Invalid API key attempts
- Rate limit violations
- Malicious pattern detections
- Blocked suspicious requests
- Failed authentication attempts

### Log Levels
- **DEBUG**: Successful API access
- **WARN**: Security violations
- **ERROR**: Critical security events

## Production Deployment

### Recommended Security Settings
```env
NODE_ENV=production
API_KEYS=strong-random-api-key-production
ALLOWED_ORIGINS=https://your-production-domain.com
DB_SSL=true
```

### Additional Security Recommendations
1. Use HTTPS in production
2. Implement API key rotation
3. Monitor rate limit violations
4. Set up alerts for security events
5. Use strong, unique API keys
6. Regularly review access logs
7. Consider implementing JWT for user authentication
8. Use environment-specific API keys

## Frontend Microservice Pattern

For additional security, implement a frontend microservice that:
1. Handles user authentication
2. Validates user permissions
3. Proxies requests to the secure API
4. Adds additional business logic validation
5. Caches frequently accessed data

This creates an additional layer between your frontend and the database API. 