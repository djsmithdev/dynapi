import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AgentLogComponent } from '../common/agentlog.component';
import { QueryFilter, QueryParams, QueryResult, QueryJoin } from './interfaces/query.interface';
import { CreateParams, UpdateParams, DeleteParams, CrudResult } from './interfaces/crud.interface';

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
    
    const { table, columns, filters, joins, limit, offset, orderBy, orderDirection } = params;
    
    // Build the base query using raw SQL approach for more flexibility
    let selectColumns = this.buildSelectColumns(columns, joins, table);
    let baseQuery = `SELECT ${selectColumns} FROM "${table}"`;
    let countQuery = `SELECT COUNT(*) as count FROM "${table}"`;
    
    // Add JOIN clauses
    if (joins && joins.length > 0) {
      const joinClauses = this.buildJoinClauses(joins, table);
      baseQuery += joinClauses;
      countQuery += joinClauses;
    }
    
    const queryParams: any[] = [];
    let whereClause = '';
    
    // Apply filters
    if (filters && filters.length > 0) {
      const { clause, params } = this.buildWhereClause(filters, joins, table);
      whereClause = clause;
      queryParams.push(...params);
    }
    
    if (whereClause) {
      baseQuery += ` WHERE ${whereClause}`;
      countQuery += ` WHERE ${whereClause}`;
    }
    
    // Apply ordering (handle joined table columns)
    if (orderBy) {
      const orderByColumn = this.getQualifiedColumnName(orderBy, table, joins);
      baseQuery += ` ORDER BY ${orderByColumn} ${orderDirection || 'ASC'}`;
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
    const { table, columns, joins } = params;

    // Validate table exists and is allowed
    if (!this.allowedTables.has(table)) {
      throw new ForbiddenException(`Table '${table}' is not accessible`);
    }

    // Validate joined tables
    if (joins && joins.length > 0) {
      joins.forEach(join => {
        if (!this.allowedTables.has(join.joinTable)) {
          throw new ForbiddenException(`Join table '${join.joinTable}' is not accessible`);
        }
        
        // Validate join columns
        [join.localColumn, join.joinColumn, ...join.selectColumns].forEach(column => {
          if (this.forbiddenColumns.has(column.toLowerCase())) {
            throw new ForbiddenException(`Column '${column}' is not accessible`);
          }
        });
      });
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

  private buildSelectColumns(columns: string | string[], joins?: QueryJoin[], table?: string): string {
    let selectParts: string[] = [];
    
    // Handle main table columns
    if (columns === '*' || (Array.isArray(columns) && columns.includes('*'))) {
      if (joins && joins.length > 0 && table) {
        // When using joins with *, we need to qualify the main table columns
        selectParts.push(`"${table}".*`);
      } else {
        selectParts.push('*');
      }
    } else {
      const columnList = Array.isArray(columns) ? columns : [columns];
      if (joins && joins.length > 0 && table) {
        // Qualify main table columns when using joins
        const mainColumns = columnList.map(col => `"${table}"."${col}"`);
        selectParts.push(...mainColumns);
      } else {
        const mainColumns = columnList.map(col => `"${col}"`);
        selectParts.push(...mainColumns);
      }
    }
    
    // Add joined table columns
    if (joins && joins.length > 0) {
      joins.forEach(join => {
        const joinedColumns = join.selectColumns.map(col => 
          `"${join.joinTable}"."${col}" AS "${join.joinTable}_${col}"`
        );
        selectParts.push(...joinedColumns);
      });
    }
    
    return selectParts.join(', ');
  }

  private buildJoinClauses(joins: QueryJoin[], mainTable: string): string {
    return joins.map(join => {
      const joinType = join.joinType || 'LEFT';
      return ` ${joinType} JOIN "${join.joinTable}" ON "${mainTable}"."${join.localColumn}" = "${join.joinTable}"."${join.joinColumn}"`;
    }).join('');
  }

  private buildWhereClause(filters: QueryFilter[], joins?: QueryJoin[], table?: string): { clause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    filters.forEach((filter) => {
      // Determine if this is a joined table column (we need the main table name for proper qualification)
      const qualifiedColumn = this.getQualifiedColumnName(filter.column, table, joins);
      
      switch (filter.operator) {
        case 'eq':
          conditions.push(`${qualifiedColumn} = $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'ne':
          conditions.push(`${qualifiedColumn} != $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'gt':
          conditions.push(`${qualifiedColumn} > $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'gte':
          conditions.push(`${qualifiedColumn} >= $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'lt':
          conditions.push(`${qualifiedColumn} < $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'lte':
          conditions.push(`${qualifiedColumn} <= $${paramIndex}`);
          params.push(filter.value);
          paramIndex++;
          break;
        case 'like':
          conditions.push(`${qualifiedColumn} ILIKE $${paramIndex}`);
          params.push(`%${filter.value}%`);
          paramIndex++;
          break;
        case 'in':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            const placeholders = filter.value.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`${qualifiedColumn} IN (${placeholders})`);
            params.push(...filter.value);
          }
          break;
        case 'not_in':
          if (Array.isArray(filter.value) && filter.value.length > 0) {
            const placeholders = filter.value.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`${qualifiedColumn} NOT IN (${placeholders})`);
            params.push(...filter.value);
          }
          break;
        case 'is_null':
          conditions.push(`${qualifiedColumn} IS NULL`);
          break;
        case 'is_not_null':
          conditions.push(`${qualifiedColumn} IS NOT NULL`);
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

  private getQualifiedColumnName(column: string, mainTable?: string, joins?: QueryJoin[]): string {
    // Check if column belongs to a joined table
    if (joins) {
      for (const join of joins) {
        if (join.selectColumns.includes(column)) {
          return `"${join.joinTable}"."${column}"`;
        }
      }
    }
    
    // If we have joins and a main table, qualify the column with the main table
    if (joins && joins.length > 0 && mainTable) {
      return `"${mainTable}"."${column}"`;
    }
    
    // Default to quoted column name (works for single table queries)
    return `"${column}"`;
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

  // =============================================
  // CRUD Operations
  // =============================================

  async createRecord(params: CreateParams): Promise<CrudResult> {
    this.validateTable(params.table);
    this.validateDataForInsert(params.data);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const columns = Object.keys(params.data);
      const values = Object.values(params.data);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      
      // Build INSERT query
      const insertQuery = `
        INSERT INTO "${params.table}" (${columns.map(col => `"${col}"`).join(', ')})
        VALUES (${placeholders})
        ${params.returnColumns ? `RETURNING ${params.returnColumns.map(col => `"${col}"`).join(', ')}` : 'RETURNING *'}
      `;

      this.agentLog.debug(`Executing CREATE: ${insertQuery.replace(/\$\d+/g, '?')}`);
      
      const result = await queryRunner.query(insertQuery, values);
      
      await queryRunner.commitTransaction();

      const crudResult: CrudResult = {
        success: true,
        affectedRows: result.length,
        data: result,
        message: `Successfully created ${result.length} record(s) in ${params.table}`,
        operation: 'CREATE',
        table: params.table,
        timestamp: new Date().toISOString(),
      };

      this.agentLog.log(`CREATE operation completed: ${params.table}, ${result.length} records created`);
      return crudResult;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.agentLog.error(`CREATE operation failed for table ${params.table}`, error.stack);
      throw new BadRequestException(`Create operation failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async updateRecord(params: UpdateParams): Promise<CrudResult> {
    this.validateTable(params.table);
    this.validateDataForUpdate(params.data);
    this.validateUpdateFilters(params.filters);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const setClause = Object.keys(params.data)
        .map((key, index) => `"${key}" = $${index + 1}`)
        .join(', ');
      
      const values = Object.values(params.data);
      const { whereClause, whereValues } = this.buildCrudWhereClause(params.filters, values.length);
      
      const updateQuery = `
        UPDATE "${params.table}"
        SET ${setClause}
        ${whereClause}
        ${params.returnColumns ? `RETURNING ${params.returnColumns.map(col => `"${col}"`).join(', ')}` : 'RETURNING *'}
      `;

      this.agentLog.debug(`Executing UPDATE: ${updateQuery.replace(/\$\d+/g, '?')}`);
      
      const result = await queryRunner.query(updateQuery, [...values, ...whereValues]);
      
      await queryRunner.commitTransaction();

      const crudResult: CrudResult = {
        success: true,
        affectedRows: result.length,
        data: result,
        message: `Successfully updated ${result.length} record(s) in ${params.table}`,
        operation: 'UPDATE',
        table: params.table,
        timestamp: new Date().toISOString(),
      };

      this.agentLog.log(`UPDATE operation completed: ${params.table}, ${result.length} records updated`);
      return crudResult;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.agentLog.error(`UPDATE operation failed for table ${params.table}`, error.stack);
      throw new BadRequestException(`Update operation failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  async deleteRecord(params: DeleteParams): Promise<CrudResult> {
    this.validateTable(params.table);
    this.validateUpdateFilters(params.filters);

    // Prevent accidental deletion of all records
    if (params.filters.length === 0) {
      throw new BadRequestException('DELETE operations require at least one filter to prevent accidental data loss');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { whereClause, whereValues } = this.buildCrudWhereClause(params.filters);
      
      const deleteQuery = `
        DELETE FROM "${params.table}"
        ${whereClause}
        ${params.returnColumns ? `RETURNING ${params.returnColumns.map(col => `"${col}"`).join(', ')}` : 'RETURNING *'}
      `;

      this.agentLog.debug(`Executing DELETE: ${deleteQuery.replace(/\$\d+/g, '?')}`);
      
      const result = await queryRunner.query(deleteQuery, whereValues);
      
      await queryRunner.commitTransaction();

      const crudResult: CrudResult = {
        success: true,
        affectedRows: result.length,
        data: result,
        message: `Successfully deleted ${result.length} record(s) from ${params.table}`,
        operation: 'DELETE',
        table: params.table,
        timestamp: new Date().toISOString(),
      };

      this.agentLog.log(`DELETE operation completed: ${params.table}, ${result.length} records deleted`);
      return crudResult;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.agentLog.error(`DELETE operation failed for table ${params.table}`, error.stack);
      throw new BadRequestException(`Delete operation failed: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  // =============================================
  // Helper Methods for CRUD
  // =============================================

  private validateTable(table: string): void {
    if (!this.allowedTables.has(table)) {
      throw new ForbiddenException(`Table '${table}' is not accessible`);
    }
  }

  private validateDataForInsert(data: Record<string, any>): void {
    if (!data || Object.keys(data).length === 0) {
      throw new BadRequestException('Insert data cannot be empty');
    }

    // Check for forbidden columns
    Object.keys(data).forEach(column => {
      if (this.forbiddenColumns.has(column.toLowerCase())) {
        throw new ForbiddenException(`Column '${column}' is not accessible for modification`);
      }
    });

    // Validate data types and prevent SQL injection
    Object.entries(data).forEach(([key, value]) => {
      this.validateColumnName(key);
      this.validateColumnValue(value);
    });
  }

  private validateDataForUpdate(data: Record<string, any>): void {
    if (!data || Object.keys(data).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    // Check for forbidden columns
    Object.keys(data).forEach(column => {
      if (this.forbiddenColumns.has(column.toLowerCase())) {
        throw new ForbiddenException(`Column '${column}' is not accessible for modification`);
      }
    });

    // Validate data types and prevent SQL injection
    Object.entries(data).forEach(([key, value]) => {
      this.validateColumnName(key);
      this.validateColumnValue(value);
    });
  }

  private validateUpdateFilters(filters: QueryFilter[]): void {
    if (!filters || filters.length === 0) {
      return;
    }

    filters.forEach(filter => {
      this.validateColumnName(filter.column);
      if (filter.value !== undefined) {
        this.validateColumnValue(filter.value);
      }
    });
  }

  private validateColumnName(columnName: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName)) {
      throw new BadRequestException(`Invalid column name: ${columnName}`);
    }
  }

  private validateColumnValue(value: any): void {
    if (typeof value === 'string') {
      // Check for SQL injection patterns
      const sqlInjectionPatterns = [
        /;\s*(drop|delete|insert|update|create|alter)\s/i,
        /union\s+select/i,
        /--/,
        /\/\*/,
        /\*\//,
      ];

      sqlInjectionPatterns.forEach(pattern => {
        if (pattern.test(value)) {
          throw new BadRequestException('Invalid data: potential SQL injection detected');
        }
      });
    }
  }

  private buildCrudWhereClause(filters: QueryFilter[], startIndex: number = 0): { whereClause: string; whereValues: any[] } {
    if (!filters || filters.length === 0) {
      return { whereClause: '', whereValues: [] };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = startIndex + 1;

    filters.forEach(filter => {
      const column = `"${filter.column}"`;
      const operator = filter.operator;

      switch (operator) {
        case 'eq':
          conditions.push(`${column} = $${paramIndex++}`);
          values.push(filter.value);
          break;
        case 'ne':
          conditions.push(`${column} != $${paramIndex++}`);
          values.push(filter.value);
          break;
        case 'gt':
          conditions.push(`${column} > $${paramIndex++}`);
          values.push(filter.value);
          break;
        case 'gte':
          conditions.push(`${column} >= $${paramIndex++}`);
          values.push(filter.value);
          break;
        case 'lt':
          conditions.push(`${column} < $${paramIndex++}`);
          values.push(filter.value);
          break;
        case 'lte':
          conditions.push(`${column} <= $${paramIndex++}`);
          values.push(filter.value);
          break;
        case 'like':
          conditions.push(`${column} ILIKE $${paramIndex++}`);
          values.push(`%${filter.value}%`);
          break;
        case 'in':
          const inValues = Array.isArray(filter.value) ? filter.value : filter.value.split(',');
          const inPlaceholders = inValues.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${column} IN (${inPlaceholders})`);
          values.push(...inValues);
          break;
        case 'not_in':
          const notInValues = Array.isArray(filter.value) ? filter.value : filter.value.split(',');
          const notInPlaceholders = notInValues.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${column} NOT IN (${notInPlaceholders})`);
          values.push(...notInValues);
          break;
        case 'is_null':
          conditions.push(`${column} IS NULL`);
          break;
        case 'is_not_null':
          conditions.push(`${column} IS NOT NULL`);
          break;
      }
    });

    return {
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      whereValues: values
    };
  }
} 