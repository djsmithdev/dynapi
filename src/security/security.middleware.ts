import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AgentLogComponent } from '../common/agentlog.component';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  constructor(private agentLog: AgentLogComponent) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    // Remove server information
    res.removeHeader('X-Powered-By');

    // CORS is now handled by NestJS built-in CORS in main.ts

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Block common attack patterns in URLs
    const suspiciousPatterns = [
      /\.\./,  // Directory traversal
      /\/etc\/passwd/,
      /\/proc\//,
      /<script/i,
      /javascript:/i,
      /data:/i,
    ];

    const fullUrl = req.originalUrl || req.url;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(fullUrl)) {
        this.agentLog.warn(`Blocked suspicious request: ${fullUrl} from ${req.ip}`);
        res.status(400).json({ error: 'Bad Request' });
        return;
      }
    }

    // Set rate limiting headers (basic)
    res.setHeader('X-RateLimit-Limit', '1000');

    // Log request with minimal details for security
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const maskedIP = this.maskIP(req.ip);
    this.agentLog.debug(`${req.method} ${req.path} from ${maskedIP} [${userAgent.substring(0, 50)}]`);
    
    next();
  }

  private maskIP(ip: string): string {
    // Mask last octet of IPv4 for privacy
    if (ip && ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    return 'masked';
  }
} 