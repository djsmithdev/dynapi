import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentLogComponent } from '../common/agentlog.component';
import { WritePermission } from '../dynamic-query/interfaces/crud.interface';

interface ApiKeyConfig {
  key: string;
  permissions?: {
    allowedTables?: string[];
    allowedOperations?: ('CREATE' | 'UPDATE' | 'DELETE')[];
    maxRecordsPerOperation?: number;
    rateLimitOverride?: {
      ttl: number;
      limit: number;
    };
  };
}

@Injectable()
export class WritePermissionsService {
  private readonly writePermissions: Map<string, WritePermission> = new Map();

  constructor(
    private configService: ConfigService,
    private agentLog: AgentLogComponent,
  ) {
    this.initializeWritePermissions();
  }

  private initializeWritePermissions(): void {
    const apiKeysConfig = this.configService.get('API_KEYS', '');
    
    if (!apiKeysConfig) {
      this.agentLog.warn('No API_KEYS configuration found');
      return;
    }

    try {
      const parsedKeys = JSON.parse(apiKeysConfig);
      if (Array.isArray(parsedKeys)) {
        this.loadApiKeyPermissions(parsedKeys);
      } else {
        this.agentLog.error('API_KEYS must be a JSON array of key configurations');
      }
    } catch (error) {
      this.agentLog.error('Failed to parse API_KEYS configuration. Expected JSON format.', error.stack);
    }
  }

  private loadApiKeyPermissions(keysConfig: ApiKeyConfig[]): void {
    let writeKeysCount = 0;
    
    keysConfig.forEach((config: ApiKeyConfig) => {
      if (config.permissions?.allowedOperations && config.permissions.allowedOperations.length > 0) {
        const writePermission: WritePermission = {
          apiKey: config.key,
          allowedTables: config.permissions.allowedTables || ['*'],
          allowedOperations: config.permissions.allowedOperations,
          maxRecordsPerOperation: config.permissions.maxRecordsPerOperation || 100,
          rateLimitOverride: config.permissions.rateLimitOverride,
        };
        this.writePermissions.set(config.key, writePermission);
        writeKeysCount++;
      }
    });

    this.agentLog.log(`Initialized ${writeKeysCount} API keys with write permissions`);
  }

  hasWritePermission(apiKey: string): boolean {
    return this.writePermissions.has(apiKey);
  }

  validateWriteOperation(
    apiKey: string,
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    table: string,
    recordCount: number = 1
  ): void {
    const permission = this.writePermissions.get(apiKey);
    
    if (!permission) {
      throw new ForbiddenException('Write operations require special API key permissions');
    }

    // Check if operation is allowed
    if (!permission.allowedOperations.includes(operation)) {
      throw new ForbiddenException(`${operation} operation not permitted for this API key`);
    }

    // Check if table is allowed
    if (!permission.allowedTables.includes('*') && !permission.allowedTables.includes(table)) {
      throw new ForbiddenException(`${operation} operation not permitted on table '${table}'`);
    }

    // Check record count limits
    if (permission.maxRecordsPerOperation && recordCount > permission.maxRecordsPerOperation) {
      throw new ForbiddenException(
        `Operation exceeds maximum records limit (${permission.maxRecordsPerOperation})`
      );
    }

    this.agentLog.debug(`Write permission validated: ${operation} on ${table} for key ${apiKey.substring(0, 8)}...`);
  }

  getWritePermission(apiKey: string): WritePermission | undefined {
    return this.writePermissions.get(apiKey);
  }

  // Get custom rate limits for write operations if specified
  getCustomRateLimit(apiKey: string): { ttl: number; limit: number } | undefined {
    const permission = this.writePermissions.get(apiKey);
    return permission?.rateLimitOverride;
  }
} 