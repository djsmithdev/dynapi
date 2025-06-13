export interface QueryFilter {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value?: any;
}

export interface QueryParams {
  table: string;
  columns: string | string[];
  filters?: QueryFilter[];
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface QueryResult {
  data: any[];
  total: number;
  page?: number;
  pageSize?: number;
} 