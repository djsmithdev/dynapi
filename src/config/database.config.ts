import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';

@Injectable()
export class DatabaseConfigService implements TypeOrmOptionsFactory {
  private readonly logger = new Logger('DatabaseConfig');

  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    const config: TypeOrmModuleOptions = {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_DATABASE'),
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: this.configService.get('NODE_ENV') !== 'production',
      logging: this.configService.get('NODE_ENV') !== 'production',
      ssl: this.configService.get('DB_SSL') === 'true' ? {
        rejectUnauthorized: false
      } : false,
    };

    this.logger.log(`Database configuration loaded for environment: ${this.configService.get('NODE_ENV') || 'development'}`);
    return config;
  }
} 