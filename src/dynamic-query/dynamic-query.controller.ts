import { Controller, Get, Param, Query, BadRequestException } from '@nestjs/common';
import { DynamicQueryService } from './dynamic-query.service';
import { QueryFilter, QueryParams } from './interfaces/query.interface';
import { AgentLogComponent } from '../common/agentlog.component';

@Controller()
export class DynamicQueryController {
  constructor(
    private readonly dynamicQueryService: DynamicQueryService,
    private readonly agentLog: AgentLogComponent,
  ) {}

  @Get('tables')
  async getTables() {
    const tables = this.dynamicQueryService.getAllowedTables();
    return { tables };
  }

  @Get('tables/:table/schema')
  async getTableSchema(@Param('table') table: string) {
    const schema = await this.dynamicQueryService.getTableSchema(table);
    return { table, schema };
  }

  @Get(':table/:columns')
  async queryData(
    @Param('table') table: string,
    @Param('columns') columns: string,
    @Query() queryParams: any,
  ) {
    try {
      // Parse columns parameter
      const columnsList = columns === '*' ? '*' : columns.split(',').map(col => col.trim());

      // Parse filters from query parameters
      const filters: QueryFilter[] = this.parseFilters(queryParams);

      // Extract pagination and ordering parameters
      const limit = queryParams.limit ? parseInt(queryParams.limit, 10) : undefined;
      const offset = queryParams.offset ? parseInt(queryParams.offset, 10) : undefined;
      const orderBy = queryParams.orderBy || undefined;
      const orderDirection = queryParams.orderDirection?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      const params: QueryParams = {
        table,
        columns: columnsList,
        filters,
        limit,
        offset,
        orderBy,
        orderDirection,
      };

      const result = await this.dynamicQueryService.executeQuery(params);
      
      return result;
    } catch (error) {
      this.agentLog.error(`Query failed for table ${table}`, error.stack);
      throw error;
    }
  }

  private parseFilters(queryParams: any): QueryFilter[] {
    const filters: QueryFilter[] = [];
    const filterKeys = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'not_in', 'is_null', 'is_not_null'];

    for (const [key, value] of Object.entries(queryParams)) {
      // Skip non-filter parameters
      if (['limit', 'offset', 'orderBy', 'orderDirection'].includes(key)) {
        continue;
      }

      // Handle filter format: column_operator=value
      const parts = key.split('_');
      if (parts.length >= 2) {
        const operator = parts[parts.length - 1];
        const column = parts.slice(0, -1).join('_');

        if (filterKeys.includes(operator)) {
          const filter: QueryFilter = {
            column,
            operator: operator as any,
          };

          // Handle special operators
          if (operator === 'is_null' || operator === 'is_not_null') {
            // No value needed for null checks
          } else if (operator === 'in' || operator === 'not_in') {
            // Handle array values for IN operations
            filter.value = Array.isArray(value) ? value : (value as string).split(',');
          } else {
            filter.value = value;
          }

          filters.push(filter);
        }
      }
    }

    return filters;
  }
} 