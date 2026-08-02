import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    const expectedKey = process.env.ARUNAKI_API_KEY;
    if (!expectedKey) {
      this.logger.error('ARUNAKI_API_KEY is not set in environment. Access DENIED.');
      throw new UnauthorizedException('Server configuration error: Missing API Key');
    }

    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');
    
    if (apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing API Key');
    }

    return true;
  }
}
