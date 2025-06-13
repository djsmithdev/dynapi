import { Controller, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DynamicQueryService } from './dynamic-query.service';
import { CreateParams, UpdateParams, DeleteParams, QueryFilter } from './interfaces/crud.interface';
import { AgentLogComponent } from '../common/agentlog.component';
import { ApiKeyGuard } from '../security/auth.guard';
import { ValidationService } from '../security/validation.service';
import { WritePermissionsService } from '../security/write-permissions.service';
import { AuditService } from '../security/audit.service';
import { Request } from 'express';

@Controller('api')
@UseGuards(ApiKeyGuard, ThrottlerGuard)
export class CrudController {
  constructor(
    private readonly dynamicQueryService: DynamicQueryService,
    private readonly agentLog: AgentLogComponent,
    private readonly validationService: ValidationService,
    private readonly writePermissionsService: WritePermissionsService,
    private readonly auditService: AuditService,
  ) {}

  @Post(':table')
  async createRecord(
    @Param('table') table: string,
    @Body() body: { data: Record<string, any>; returnColumns?: string[] },
    @Req() request: Request,
  ) {
    const apiKey = this.extractApiKey(request);
    const startTime = Date.now();
    
    try {
      // Validate table name
      this.validationService.validateTableName(table);
      
      // Validate write permissions
      this.writePermissionsService.validateWriteOperation(apiKey, 'CREATE', table, 1);

      // Validate request body
      if (!body.data) {
        throw new Error('Request body must contain "data" field');
      }

      const params: CreateParams = {
        table,
        data: body.data,
        returnColumns: body.returnColumns,
      };

      const result = await this.dynamicQueryService.createRecord(params);
      
      // Log successful operation
      await this.auditService.logOperation({
        apiKey,
        operation: 'CREATE',
        table,
        affectedRows: result.affectedRows,
        data: body.data,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
        success: true,
      });

      this.agentLog.log(`CREATE operation: ${table}, ${result.affectedRows} records, ${Date.now() - startTime}ms`);
      
      return {
        ...result,
        meta: {
          table,
          operation: 'CREATE',
          securityLevel: 'write-authenticated',
          executionTime: `${Date.now() - startTime}ms`
        }
      };

    } catch (error) {
      // Log failed operation
      await this.auditService.logOperation({
        apiKey,
        operation: 'CREATE',
        table,
        affectedRows: 0,
        data: body?.data,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
        success: false,
        error: error.message,
      });

      this.agentLog.error(`CREATE operation failed for table ${table}`, error.stack);
      throw error;
    }
  }

  @Put(':table')
  async updateRecord(
    @Param('table') table: string,
    @Body() body: { data: Record<string, any>; returnColumns?: string[] },
    @Query() queryParams: any,
    @Req() request: Request,
  ) {
    const apiKey = this.extractApiKey(request);
    const startTime = Date.now();
    
    try {
      // Validate table name
      this.validationService.validateTableName(table);
      
      // Parse filters from query parameters
      const filters: QueryFilter[] = this.parseAndValidateFilters(queryParams);
      
      // Require filters for UPDATE operations
      if (filters.length === 0) {
        throw new Error('UPDATE operations require at least one filter to prevent accidental mass updates');
      }

      // Validate write permissions - estimate record count for safety
      this.writePermissionsService.validateWriteOperation(apiKey, 'UPDATE', table, 100); // Conservative estimate

      // Validate request body
      if (!body.data) {
        throw new Error('Request body must contain "data" field');
      }

      const params: UpdateParams = {
        table,
        data: body.data,
        filters,
        returnColumns: body.returnColumns,
      };

      const result = await this.dynamicQueryService.updateRecord(params);
      
      // Log successful operation
      await this.auditService.logOperation({
        apiKey,
        operation: 'UPDATE',
        table,
        affectedRows: result.affectedRows,
        filters,
        data: body.data,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
        success: true,
      });

      this.agentLog.log(`UPDATE operation: ${table}, ${result.affectedRows} records, ${Date.now() - startTime}ms`);
      
      return {
        ...result,
        meta: {
          table,
          operation: 'UPDATE',
          filtersApplied: filters.length,
          securityLevel: 'write-authenticated',
          executionTime: `${Date.now() - startTime}ms`
        }
      };

    } catch (error) {
      // Log failed operation
      await this.auditService.logOperation({
        apiKey,
        operation: 'UPDATE',
        table,
        affectedRows: 0,
        filters: this.parseAndValidateFilters(queryParams),
        data: body?.data,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
        success: false,
        error: error.message,
      });

      this.agentLog.error(`UPDATE operation failed for table ${table}`, error.stack);
      throw error;
    }
  }

  @Delete(':table')
  async deleteRecord(
    @Param('table') table: string,
    @Query() queryParams: any,
    @Body() body: { returnColumns?: string[] } = {},
    @Req() request: Request,
  ) {
    const apiKey = this.extractApiKey(request);
    const startTime = Date.now();
    
    try {
      // Validate table name
      this.validationService.validateTableName(table);
      
      // Parse filters from query parameters
      const filters: QueryFilter[] = this.parseAndValidateFilters(queryParams);
      
      // Require filters for DELETE operations
      if (filters.length === 0) {
        throw new Error('DELETE operations require at least one filter to prevent accidental mass deletions');
      }

      // Validate write permissions - estimate record count for safety
      this.writePermissionsService.validateWriteOperation(apiKey, 'DELETE', table, 100); // Conservative estimate

      const params: DeleteParams = {
        table,
        filters,
        returnColumns: body.returnColumns,
      };

      const result = await this.dynamicQueryService.deleteRecord(params);
      
      // Log successful operation
      await this.auditService.logOperation({
        apiKey,
        operation: 'DELETE',
        table,
        affectedRows: result.affectedRows,
        filters,
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
        success: true,
      });

      this.agentLog.log(`DELETE operation: ${table}, ${result.affectedRows} records, ${Date.now() - startTime}ms`);
      
      return {
        ...result,
        meta: {
          table,
          operation: 'DELETE',
          filtersApplied: filters.length,
          securityLevel: 'write-authenticated',
          executionTime: `${Date.now() - startTime}ms`
        }
      };

    } catch (error) {
      // Log failed operation
      await this.auditService.logOperation({
        apiKey,
        operation: 'DELETE',
        table,
        affectedRows: 0,
        filters: this.parseAndValidateFilters(queryParams),
        ip: request.ip,
        userAgent: request.headers['user-agent'] || 'Unknown',
        timestamp: new Date(),
        success: false,
        error: error.message,
      });

      this.agentLog.error(`DELETE operation failed for table ${table}`, error.stack);
      throw error;
    }
  }

  @Post('audit/logs')
  async getAuditLogs(
    @Body() body: {
      table?: string;
      operation?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    },
    @Req() request: Request,
  ) {
    const apiKey = this.extractApiKey(request);
    
    try {
      // Only allow audit access for write-enabled API keys
      if (!this.writePermissionsService.hasWritePermission(apiKey)) {
        throw new Error('Audit log access requires write permissions');
      }

      const options = {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        limit: body.limit || 100,
        offset: body.offset || 0,
      };

      const logs = await this.auditService.getAuditLogs(options);
      
      this.agentLog.log(`Audit logs accessed: ${logs.length} records returned`);
      
      return {
        data: logs,
        count: logs.length,
        filters: options,
        message: 'Audit logs retrieved successfully'
      };

    } catch (error) {
      this.agentLog.error('Audit logs access failed', error.stack);
      throw error;
    }
  }

  @Post('audit/statistics')
  async getAuditStatistics(@Req() request: Request) {
    const apiKey = this.extractApiKey(request);
    
    try {
      // Only allow audit access for write-enabled API keys
      if (!this.writePermissionsService.hasWritePermission(apiKey)) {
        throw new Error('Audit statistics access requires write permissions');
      }

      const stats = await this.auditService.getAuditStatistics();
      
      this.agentLog.log('Audit statistics accessed');
      
      return {
        data: stats,
        message: 'Audit statistics for the last 24 hours'
      };

    } catch (error) {
      this.agentLog.error('Audit statistics access failed', error.stack);
      throw error;
    }
  }

  // =============================================
  // Helper Methods
  // =============================================

  private extractApiKey(request: Request): string {
    return (
      request.headers['x-api-key'] as string ||
      request.headers['authorization']?.replace('Bearer ', '') ||
      request.query.apiKey as string ||
      ''
    );
  }

  private parseAndValidateFilters(queryParams: any): QueryFilter[] {
    const filters: QueryFilter[] = [];
    const filterKeys = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'not_in', 'is_null', 'is_not_null'];

    for (const [key, value] of Object.entries(queryParams)) {
      // Skip non-filter parameters
      if (['limit', 'offset', 'orderBy', 'orderDirection', 'apiKey'].includes(key)) {
        continue;
      }

      // Handle filter format: column_operator=value
      const parts = key.split('_');
      if (parts.length >= 2) {
        const operator = parts[parts.length - 1];
        const column = parts.slice(0, -1).join('_');

        if (filterKeys.includes(operator)) {
          this.validationService.validateColumns(column);

          const filter: QueryFilter = {
            column,
            operator: operator as any,
          };

          // Handle special operators with validation
          if (operator === 'is_null' || operator === 'is_not_null') {
            // No value needed for null checks
          } else {
            filter.value = this.validationService.validateFilterValue(value, operator);
          }

          filters.push(filter);
        }
      }
    }

    // Limit number of filters to prevent complex queries
    if (filters.length > 10) {
      throw new Error('Too many filters (maximum 10 allowed)');
    }

    return filters;
  }
} 