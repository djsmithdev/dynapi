import { Injectable, BadRequestException } from '@nestjs/common';
import { AgentLogComponent } from '../common/agentlog.component';

@Injectable()
export class ValidationService {
  private readonly maliciousPatterns = [
    /;\s*(drop|delete|insert|update|create|alter)\s/i,
    /union\s+select/i,
    /script\s*>/i,
    /<\s*script/i,
    /javascript\s*:/i,
    /data\s*:\s*text\/html/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /exec\s*\(/i,
    /(xp_|sp_)cmdshell/i,
    /waitfor\s+delay/i,
    /convert\s*\(\s*int/i,
  ];

  constructor(private agentLog: AgentLogComponent) {}

  validateQueryParams(params: Record<string, any>): void {
    for (const [key, value] of Object.entries(params)) {
      this.validateInput(key, 'parameter name');
      if (typeof value === 'string') {
        this.validateInput(value, `parameter value for ${key}`);
      }
    }
  }

  validateTableName(tableName: string): void {
    // Allow only alphanumeric characters and underscores
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      this.agentLog.warn(`Invalid table name attempted: ${tableName}`);
      throw new BadRequestException('Invalid table name format');
    }

    // Additional length check
    if (tableName.length > 100) {
      throw new BadRequestException('Table name too long');
    }

    // Check for reserved words
    const reservedWords = ['user', 'password', 'admin', 'root', 'config', 'system'];
    if (reservedWords.includes(tableName.toLowerCase())) {
      this.agentLog.warn(`Attempted access to restricted table: ${tableName}`);
      throw new BadRequestException('Access to this table is restricted');
    }
  }

  validateColumns(columns: string | string[]): void {
    const columnList = Array.isArray(columns) ? columns : [columns];
    
    for (const column of columnList) {
      if (column !== '*' && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
        this.agentLog.warn(`Invalid column name attempted: ${column}`);
        throw new BadRequestException(`Invalid column name format: ${column}`);
      }

      // Check column length
      if (column.length > 100) {
        throw new BadRequestException('Column name too long');
      }
    }
  }

  validatePaginationParams(limit?: number, offset?: number): { limit?: number; offset?: number } {
    const result: { limit?: number; offset?: number } = {};

    if (limit !== undefined) {
      if (limit < 1 || limit > 1000) {
        throw new BadRequestException('Limit must be between 1 and 1000');
      }
      result.limit = limit;
    }

    if (offset !== undefined) {
      if (offset < 0) {
        throw new BadRequestException('Offset must be non-negative');
      }
      result.offset = offset;
    }

    return result;
  }

  validateFilterValue(value: any, operator: string): any {
    if (operator === 'in' || operator === 'not_in') {
      if (!Array.isArray(value)) {
        // Convert comma-separated string to array
        const arrayValue = (value as string).split(',').map(v => v.trim());
        if (arrayValue.length > 100) {
          throw new BadRequestException('Too many values in IN clause (max 100)');
        }
        return arrayValue;
      } else {
        if (value.length > 100) {
          throw new BadRequestException('Too many values in IN clause (max 100)');
        }
        return value;
      }
    }

    if (typeof value === 'string') {
      this.validateInput(value, 'filter value');
    }

    return value;
  }

  private validateInput(input: string, context: string): void {
    // Check for malicious patterns
    for (const pattern of this.maliciousPatterns) {
      if (pattern.test(input)) {
        this.agentLog.error(`Malicious pattern detected in ${context}: ${input}`);
        throw new BadRequestException('Invalid input detected');
      }
    }

    // Check for excessive length
    if (input.length > 1000) {
      throw new BadRequestException('Input too long');
    }

    // Check for null bytes
    if (input.includes('\0')) {
      throw new BadRequestException('Null bytes not allowed');
    }
  }
} 