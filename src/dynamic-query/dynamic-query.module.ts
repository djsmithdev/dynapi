import { Module } from '@nestjs/common';
import { DynamicQueryController } from './dynamic-query.controller';
import { DynamicQueryService } from './dynamic-query.service';
import { AgentLogComponent } from '../common/agentlog.component';

@Module({
  controllers: [DynamicQueryController],
  providers: [DynamicQueryService, AgentLogComponent],
  exports: [DynamicQueryService, AgentLogComponent],
})
export class DynamicQueryModule {} 