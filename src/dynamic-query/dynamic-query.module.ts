import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamicQueryController } from './dynamic-query.controller';
import { CrudController } from './crud.controller';
import { DynamicQueryService } from './dynamic-query.service';
import { SecurityModule } from '../security/security.module';
import { AgentLogComponent } from '../common/agentlog.component';

@Module({
  imports: [ConfigModule, SecurityModule],
  controllers: [
    DynamicQueryController,
    CrudController,
  ],
  providers: [DynamicQueryService, AgentLogComponent],
  exports: [DynamicQueryService, AgentLogComponent],
})
export class DynamicQueryModule {} 