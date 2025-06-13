import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to DynamicAPI! A secure, high-performance API for PostgreSQL databases.';
  }
} 