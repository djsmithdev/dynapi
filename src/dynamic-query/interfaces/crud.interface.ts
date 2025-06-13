export interface CreateParams {
  table: string;
  data: Record<string, any>;
  returnColumns?: string[];
}

export interface UpdateParams {
  table: string;
  data: Record<string, any>;
  filters: QueryFilter[];
  returnColumns?: string[];
}

export interface DeleteParams {
  table: string;
  filters: QueryFilter[];
  returnColumns?: string[];
}

export interface CrudResult {
  success: boolean;
  affectedRows: number;
  data?: any[];
  message: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  timestamp: string;
}

export interface QueryFilter {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'not_in' | 'is_null' | 'is_not_null';
  value?: any;
}

export interface WritePermission {
  apiKey: string;
  allowedTables: string[];
  allowedOperations: ('CREATE' | 'UPDATE' | 'DELETE')[];
  maxRecordsPerOperation?: number;
  rateLimitOverride?: {
    ttl: number;
    limit: number;
  };
}

export interface AuditLog {
  id?: string;
  apiKey: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  affectedRows: number;
  filters?: QueryFilter[];
  data?: Record<string, any>;
  ip: string;
  userAgent: string;
  timestamp: Date;
  success: boolean;
  error?: string;
} 