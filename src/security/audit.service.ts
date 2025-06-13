import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AgentLogComponent } from '../common/agentlog.component';
import { AuditLog, QueryFilter } from '../dynamic-query/interfaces/crud.interface';

@Injectable()
export class AuditService {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private agentLog: AgentLogComponent,
  ) {
    this.initializeAuditTable();
  }

  private async initializeAuditTable(): Promise<void> {
    try {
      // Create audit table if it doesn't exist
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS dynapi_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          api_key VARCHAR(64) NOT NULL,
          operation VARCHAR(10) NOT NULL,
          table_name VARCHAR(100) NOT NULL,
          affected_rows INTEGER NOT NULL DEFAULT 0,
          filters JSONB,
          data JSONB,
          ip_address INET,
          user_agent TEXT,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          success BOOLEAN NOT NULL DEFAULT true,
          error_message TEXT
        );
      `);

      // Create indexes for better query performance
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_dynapi_audit_timestamp ON dynapi_audit_log(timestamp);
        CREATE INDEX IF NOT EXISTS idx_dynapi_audit_operation ON dynapi_audit_log(operation);
        CREATE INDEX IF NOT EXISTS idx_dynapi_audit_table ON dynapi_audit_log(table_name);
        CREATE INDEX IF NOT EXISTS idx_dynapi_audit_api_key ON dynapi_audit_log(api_key);
      `);

      this.agentLog.log('Audit table initialized successfully');
    } catch (error) {
      this.agentLog.error('Failed to initialize audit table', error.stack);
    }
  }

  async logOperation(auditLog: AuditLog): Promise<void> {
    try {
      await this.dataSource.query(`
        INSERT INTO dynapi_audit_log (
          api_key, operation, table_name, affected_rows, filters, data, 
          ip_address, user_agent, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        auditLog.apiKey.substring(0, 8) + '***', // Hash the API key for security
        auditLog.operation,
        auditLog.table,
        auditLog.affectedRows,
        auditLog.filters ? JSON.stringify(auditLog.filters) : null,
        auditLog.data ? JSON.stringify(this.sanitizeData(auditLog.data)) : null,
        auditLog.ip,
        auditLog.userAgent,
        auditLog.success,
        auditLog.error
      ]);

      this.agentLog.debug(`Audit logged: ${auditLog.operation} on ${auditLog.table}`);
    } catch (error) {
      this.agentLog.error('Failed to log audit entry', error.stack);
    }
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['password', 'secret', 'token', 'private_key', 'api_key', 'credit_card', 'ssn'];
    const sanitized = { ...data };

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  async getAuditLogs(options: {
    table?: string;
    operation?: string;
    apiKey?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      let query = 'SELECT * FROM dynapi_audit_log WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (options.table) {
        query += ` AND table_name = $${paramIndex++}`;
        params.push(options.table);
      }

      if (options.operation) {
        query += ` AND operation = $${paramIndex++}`;
        params.push(options.operation);
      }

      if (options.apiKey) {
        query += ` AND api_key LIKE $${paramIndex++}`;
        params.push(options.apiKey.substring(0, 8) + '%');
      }

      if (options.startDate) {
        query += ` AND timestamp >= $${paramIndex++}`;
        params.push(options.startDate);
      }

      if (options.endDate) {
        query += ` AND timestamp <= $${paramIndex++}`;
        params.push(options.endDate);
      }

      query += ' ORDER BY timestamp DESC';

      if (options.limit) {
        query += ` LIMIT $${paramIndex++}`;
        params.push(options.limit);
      }

      if (options.offset) {
        query += ` OFFSET $${paramIndex++}`;
        params.push(options.offset);
      }

      const result = await this.dataSource.query(query, params);
      return result;
    } catch (error) {
      this.agentLog.error('Failed to retrieve audit logs', error.stack);
      return [];
    }
  }

  async getAuditStatistics(): Promise<any> {
    try {
      const stats = await this.dataSource.query(`
        SELECT 
          operation,
          table_name,
          COUNT(*) as count,
          SUM(affected_rows) as total_affected_rows,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_operations
        FROM dynapi_audit_log 
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
        GROUP BY operation, table_name
        ORDER BY count DESC
      `);

      return stats;
    } catch (error) {
      this.agentLog.error('Failed to get audit statistics', error.stack);
      return [];
    }
  }
} 