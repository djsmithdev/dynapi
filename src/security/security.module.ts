import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyGuard } from './auth.guard';
import { ValidationService } from './validation.service';
import { SecurityMiddleware } from './security.middleware';
import { AgentLogComponent } from '../common/agentlog.component';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([{
      ttl: 15 * 60 * 1000, // 15 minutes
      limit: 1000, // requests per TTL
    }]),
  ],
  providers: [
    ApiKeyGuard,
    ValidationService,
    SecurityMiddleware,
    AgentLogComponent,
  ],
  exports: [
    ApiKeyGuard,
    ValidationService,
    SecurityMiddleware,
    ThrottlerModule,
    AgentLogComponent,
  ],
})
export class SecurityModule {} 