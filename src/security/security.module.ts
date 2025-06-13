import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './auth.guard';
import { ValidationService } from './validation.service';
import { SecurityMiddleware } from './security.middleware';
import { AgentLogComponent } from '../common/agentlog.component';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [{
        ttl: parseInt(configService.get('THROTTLE_TTL', '900000'), 10), // Default: 15 minutes (900000ms)
        limit: parseInt(configService.get('THROTTLE_LIMIT', '1000'), 10), // Default: 1000 requests per TTL
      }],
    }),
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