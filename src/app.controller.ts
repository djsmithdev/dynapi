import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AgentLogComponent } from './common/agentlog.component';

@Controller()
export class AppController {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
    private readonly agentLog: AgentLogComponent,
  ) {}

  @Get()
  getHello(): string {
    return 'Welcome to DynAPI - Dynamic Database Query API';
  }

  @Get('health')
  async getHealth() {
    const startTime = Date.now();
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: {
          status: 'unknown',
          responseTime: 0,
        },
        application: {
          status: 'healthy',
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
        }
      }
    };

    try {
      // Test database connectivity
      const dbStartTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const dbResponseTime = Date.now() - dbStartTime;
      
      healthStatus.services.database = {
        status: 'healthy',
        responseTime: dbResponseTime,
      };
      
      this.agentLog.log(`Health check completed successfully in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      healthStatus.status = 'unhealthy';
      healthStatus.services.database = {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
      };
      
      this.agentLog.error('Health check failed - database connectivity issue', error.stack);
    }

    return healthStatus;
  }
} 