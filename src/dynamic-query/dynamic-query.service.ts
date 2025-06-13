import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AgentLogComponent } from '../common/agentlog.component';
import { QueryFilter, QueryParams, QueryResult } from './interfaces/query.interface';

@Injectable()
export class DynamicQueryService {
  private readonly allowedTables: Set<string> = new Set();
  private readonly forbiddenColumns: Set<string> = new Set(['password', 'secret', 'token', 'private_key']);

  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private agentLog: AgentLogComponent,
  ) {
    this.initializeAllowedTables();
  }

  private async initializeAllowedTables(): Promise<void> {
    try {
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `;
      const result = await this.dataSource.query(query);
      result.forEach((row: any) => this.allowedTables.add(row.table_name));
      this.agentLog.log(`Initialized ${this.allowedTables.size} allowed tables`);
    } catch (error) {
      this.agentLog.error('Failed to initialize allowed tables', error.stack);
    }
  }

  async executeQuery(params: QueryParams): Promise<QueryResult> {
    this.validateQuery(params);
    
    const { table, columns, filters, limit, offset, orderBy, orderDirection } = params;
    
    // Build the base query using raw SQL approach for more flexibility
    let selectColumns = this.buildSelectColumns(columns);
    let baseQuery = `SELECT ${selectColumns} FROM "${table}"`;
    let countQuery = `SELECT COUNT(*) as count FROM "${table}"`;
    
    const queryParams: any[] = [];
    let whereClause = '';
    
    // Apply filters
    if (filters && filters.length > 0) {
      const { clause, params } = this.buildWhereClause(filters);
      whereClause = clause;
      queryParams.push(...params);
    }
    
    if (whereClause) {
      baseQuery += ` WHERE ${whereClause}`;
      countQuery += ` WHERE ${whereClause}`;
    }
    
    // Apply ordering
    if (orderBy) {
      baseQuery += ` ORDER BY "${orderBy}" ${orderDirection || 'ASC'}`;
    }
    
    // Get total count for pagination
    const totalResult = await this.dataSource.query(countQuery, queryParams);
    const total = parseInt(totalResult[0]?.count || '0');
    
    // Apply pagination
    if (limit) {
      baseQuery += ` LIMIT ${limit}`;
    }
    if (offset) {
      baseQuery += ` OFFSET ${offset}`;
    }

    const data = await this.dataSource.query(baseQuery, queryParams);
    
    this.agentLog.log(`Executed query on table: ${table}, returned ${data.length} rows`);

    return {
      data,
      total,
      page: offset && limit ? Math.floor(offset / limit) + 1 : undefined,
      pageSize: limit,
    };
  }

  private validateQuery(params: QueryParams): void {
    const { table, columns } = params;

    // Validate table exists and is allowed
    if (!this.allowedTables.has(table)) {
      throw new ForbiddenException(`Table '${table}' is not accessible`);
    }

    // Validate columns
    const columnList = Array.isArray(columns) ? columns : [columns];
    if (columnList.includes('*')) {
      return; // Allow wildcard selection
    }

    columnList.forEach(column => {
      if (this.forbiddenColumns.has(column.toLowerCase())) {
        throw new ForbiddenException(`Column '${column}' is not accessible`);
      }
    });
  }

  private buildSelectColumns(columns: string | string[]): string {
    if (columns === '*' || (Array.isArray(columns) && columns.includes('*'))) {
      return '*';
    }

    const columnList = Array.isArray(columns) ? columns : [columns];
    return columnList.map(col => `"${col}"`).join(', ');
  }

  private buildWhereClause(filters: QueryFilter[]): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    filters.forEach((filter) => {
      switch (filter.operator) {
        case 'eq':
          conditions.push(`"${filter.column}" = $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'ne':
          conditions.push(`"${filter.column}" != $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'gt':
          conditions.push(`"${filter.column}" > $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'gte':
          conditions.push(`"${filter.column}" >= $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'lt':
          conditions.push(`"${filter.column}" < $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'lte':
          conditions.push(`"${filter.column}" <= $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'like':
          conditions.push(`"${filter.column}" ILIKE $${paramIndex}`);
          params.push(`%${filter.value}%`);
          paramIndex++;
          break;
        case 'in':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            const placeholders = filter.value.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`"${filter.column}" IN (${placeholders})`);
            params.push(...filter.value);
          }
          break;
        case 'not_in':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            const placeholders = filter.value.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`"${filter.column}" NOT IN (${placeholders})`);
            params.push(...filter.value);
          }
          break;
        case 'is_null':
          conditions.push(`"${filter.column}" IS NULL`);
          break;
        case 'is_not_null':
          conditions.push(`"${filter.column}" IS NOT NULL`);
          break;
        default:
          throw new BadRequestException(`Unsupported operator: ${filter.operator}`);
      }
    });

    return {
      clause: conditions.join(' AND '),
      params,
    };
  }

  async getTableSchema(tableName: string): Promise<any[]> {
    if (!this.allowedTables.has(tableName)) {
      throw new ForbiddenException(`Table '${tableName}' is not accessible`);
    }

    const query = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    return this.dataSource.query(query, [tableName]);
  }

  getAllowedTables(): string[] {
    return Array.from(this.allowedTables);
  }
} 