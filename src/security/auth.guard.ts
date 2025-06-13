import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentLogComponent } from '../common/agentlog.component';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private validApiKeys: Set<string>;

  constructor(
    private configService: ConfigService,
    private agentLog: AgentLogComponent,
  ) {
    this.initializeApiKeys();
  }

  private initializeApiKeys(): void {
    const apiKeysConfig = this.configService.get('API_KEYS', '[]');
    
    try {
      const parsedKeys = JSON.parse(apiKeysConfig);
      if (Array.isArray(parsedKeys)) {
        const keys = parsedKeys.map((config: any) => config.key).filter(key => key && key.length > 0);
        this.validApiKeys = new Set(keys);
        this.agentLog.log(`Initialized ${this.validApiKeys.size} API keys for authentication`);
      } else {
        this.agentLog.error('API_KEYS must be a JSON array of key configurations');
        this.validApiKeys = new Set();
      }
    } catch (error) {
      this.agentLog.error('Failed to parse API_KEYS configuration. Expected JSON format.', error.stack);
      this.validApiKeys = new Set();
    }
    
    if (this.validApiKeys.size === 0) {
      this.agentLog.error('No valid API keys configured in API_KEYS environment variable');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.agentLog.warn(`Access denied: No API key provided from IP ${request.ip}`);
      throw new UnauthorizedException('API key required. Provide via X-API-Key header, Authorization header, or apiKey query parameter');
    }

    if (!this.validApiKeys.has(apiKey)) {
      this.agentLog.warn(`Access denied: Invalid API key from IP ${request.ip}`);
      throw new UnauthorizedException('Invalid API key');
    }

    this.agentLog.debug(`API access granted for key: ${apiKey.substring(0, 8)}...`);
    return true;
  }

  private extractApiKey(request: Request): string | null {
    // Check multiple locations for API key
    return (
      request.headers['x-api-key'] as string ||
      request.headers['authorization']?.replace('Bearer ', '') ||
      request.query.apiKey as string ||
      null
    );
  }
} 