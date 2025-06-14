import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { DynamicQueryModule } from './dynamic-query/dynamic-query.module';
import { SecurityModule } from './security/security.module';
import { SecurityMiddleware } from './security/security.middleware';
import { AgentLogComponent } from './common/agentlog.component';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    DynamicQueryModule,
    SecurityModule,
  ],
  controllers: [AppController],
  providers: [AgentLogComponent],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityMiddleware)
      .forRoutes('*'); // Apply security middleware to all routes
  }
} 