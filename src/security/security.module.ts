import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyGuard } from './auth.guard';
import { ValidationService } from './validation.service';
import { SecurityMiddleware } from './security.middleware';
import { WritePermissionsService } from './write-permissions.service';
import { AuditService } from './audit.service';
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
    TypeOrmModule, // For audit service database access
  ],
  providers: [
    ApiKeyGuard,
    ValidationService,
    SecurityMiddleware,
    WritePermissionsService,
    AuditService,
    AgentLogComponent,
  ],
  exports: [
    ApiKeyGuard,
    ValidationService,
    SecurityMiddleware,
    WritePermissionsService,
    AuditService,
    ThrottlerModule,
    AgentLogComponent,
  ],
})
export class SecurityModule {} 