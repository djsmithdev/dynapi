import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { DynamicQueryService } from './dynamic-query.service';
import { QueryFilter, QueryParams, QueryJoin } from './interfaces/query.interface';
import { AgentLogComponent } from '../common/agentlog.component';
import { ApiKeyGuard } from '../security/auth.guard';
import { ValidationService } from '../security/validation.service';

@Controller('api')
@UseGuards(ApiKeyGuard, ThrottlerGuard)
export class DynamicQueryController {
  constructor(
    private readonly dynamicQueryService: DynamicQueryService,
    private readonly agentLog: AgentLogComponent,
    private readonly validationService: ValidationService,
  ) {}

  @Get('tables')
  async getTables() {
    const tables = this.dynamicQueryService.getAllowedTables();
    this.agentLog.log('Secure tables list accessed');
    return { 
      tables,
      count: tables.length,
      message: 'Available tables for querying'
    };
  }

  @Get('tables/:table/schema')
  async getTableSchema(@Param('table') table: string) {
    try {
      this.validationService.validateTableName(table);
      const schema = await this.dynamicQueryService.getTableSchema(table);
      this.agentLog.log(`Schema accessed for table: ${table}`);
      return { 
        table, 
        schema,
        columnCount: schema.length
      };
    } catch (error) {
      this.agentLog.error(`Schema access failed for table ${table}`, error.stack);
      throw error;
    }
  }

  @Get('query/:table/:columns')
  async queryData(
    @Param('table') table: string,
    @Param('columns') columns: string,
    @Query() queryParams: any,
  ) {
    try {
      // Validate inputs
      this.validationService.validateTableName(table);
      this.validationService.validateQueryParams(queryParams);
      
      // Parse columns parameter
      const columnsList = columns === '*' ? '*' : columns.split(',').map(col => col.trim());
      this.validationService.validateColumns(columnsList);

      // Parse and validate pagination parameters
      const rawLimit = queryParams.limit ? parseInt(queryParams.limit, 10) : undefined;
      const rawOffset = queryParams.offset ? parseInt(queryParams.offset, 10) : undefined;
      const validatedPagination = this.validationService.validatePaginationParams(rawLimit, rawOffset);

      // Parse filters from query parameters
      const filters: QueryFilter[] = this.parseAndValidateFilters(queryParams);

      // Parse joins from query parameters
      const joins: QueryJoin[] = this.parseAndValidateJoins(queryParams);

      // Validate ordering parameters
      const orderBy = queryParams.orderBy || undefined;
      if (orderBy) {
        this.validationService.validateColumns(orderBy);
      }
      const orderDirection = queryParams.orderDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const params: QueryParams = {
        table,
        columns: columnsList,
        filters,
        joins,
        limit: validatedPagination.limit,
        offset: validatedPagination.offset,
        orderBy,
        orderDirection,
      };

      const result = await this.dynamicQueryService.executeQuery(params);
      
      // Log successful query (without sensitive data)
      this.agentLog.log(`Secure query executed: table=${table}, columns=${Array.isArray(columnsList) ? columnsList.length : 'all'}, filters=${filters.length}, joins=${joins.length}, results=${result.data.length}`);
      
      return {
        ...result,
        meta: {
          table,
          columnsRequested: Array.isArray(columnsList) ? columnsList.length : 'all',
          filtersApplied: filters.length,
          joinsApplied: joins.length,
          securityLevel: 'authenticated'
        }
      };
    } catch (error) {
      this.agentLog.error(`Secure query failed for table ${table}`, error.stack);
      throw error;
    }
  }

  private parseAndValidateJoins(queryParams: any): QueryJoin[] {
    const joins: QueryJoin[] = [];
    
    // Handle both single join and array of joins
    const joinParams = queryParams.join ? 
      (Array.isArray(queryParams.join) ? queryParams.join : [queryParams.join]) : 
      [];

    joinParams.forEach((joinParam: string) => {
      // Format: localColumn:joinTable:joinColumn:selectColumns[:joinType]
      // Example: regionID:mapRegions:regionID:regionName,regionDescription:LEFT
      const parts = joinParam.split(':');
      
      if (parts.length < 4) {
        throw new Error(`Invalid join format. Expected: localColumn:joinTable:joinColumn:selectColumns[:joinType]`);
      }

      const [localColumn, joinTable, joinColumn, selectColumnsStr, joinType] = parts;
      const selectColumns = selectColumnsStr.split(',').map(col => col.trim());

      // Validate all components
      this.validationService.validateColumns(localColumn);
      this.validationService.validateTableName(joinTable);
      this.validationService.validateColumns(joinColumn);
      selectColumns.forEach(col => this.validationService.validateColumns(col));

      const join: QueryJoin = {
        localColumn,
        joinTable,
        joinColumn,
        selectColumns,
        joinType: (joinType as 'INNER' | 'LEFT' | 'RIGHT') || 'LEFT'
      };

      joins.push(join);
    });

    // Limit number of joins to prevent overly complex queries
    if (joins.length > 5) {
      throw new Error('Too many joins (maximum 5 allowed)');
    }

    return joins;
  }

  private parseAndValidateFilters(queryParams: any): QueryFilter[] {
    const filters: QueryFilter[] = [];
    const filterKeys = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'not_in', 'is_null', 'is_not_null'];

    for (const [key, value] of Object.entries(queryParams)) {
      // Skip non-filter parameters
      if (['limit', 'offset', 'orderBy', 'orderDirection', 'join'].includes(key)) {
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