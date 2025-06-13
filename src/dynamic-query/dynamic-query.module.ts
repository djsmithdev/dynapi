import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamicQueryController } from './dynamic-query.controller';
import { SecureDynamicQueryController } from './secure-dynamic-query.controller';
import { DynamicQueryService } from './dynamic-query.service';
import { SecurityModule } from '../security/security.module';
import { AgentLogComponent } from '../common/agentlog.component';

@Module({
  imports: [ConfigModule, SecurityModule],
  controllers: [SecureDynamicQueryController, DynamicQueryController],
  providers: [DynamicQueryService, AgentLogComponent],
  exports: [DynamicQueryService, AgentLogComponent],
})
export class DynamicQueryModule {} 