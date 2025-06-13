export interface QueryFilter {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value?: any;
}

export interface QueryJoin {
  localColumn: string;      // Column in the main table
  joinTable: string;        // Table to join with
  joinColumn: string;       // Column in the joined table
  selectColumns: string[];  // Columns to select from joined table
  joinType?: 'INNER' | 'LEFT' | 'RIGHT'; // Join type (default: LEFT)
}

export interface QueryParams {
  table: string;
  columns: string | string[];
  filters?: QueryFilter[];
  joins?: QueryJoin[];
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