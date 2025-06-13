import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentLogComponent } from '../common/agentlog.component';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly validApiKeys: Set<string>;

  constructor(
    private configService: ConfigService,
    private agentLog: AgentLogComponent,
  ) {
    // Initialize with API keys from environment
    const apiKeys = this.configService.get('API_KEYS', 'dynamicapi-dev-key,dynamicapi-prod-key').split(',').filter(key => key.length > 0);
    this.validApiKeys = new Set(apiKeys);
    
    if (this.validApiKeys.size === 0) {
      this.agentLog.error('No API keys configured in API_KEYS environment variable');
    } else {
      this.agentLog.log(`Initialized ${this.validApiKeys.size} API keys for authentication`);
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