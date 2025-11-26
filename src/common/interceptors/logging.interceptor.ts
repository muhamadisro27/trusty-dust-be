import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<AuthenticatedRequest>();
    const method = request?.method;
    const url = request?.url;
    const userId = request?.user?.id;

    const now = Date.now();
    this.logger.log(`Incoming ${method} ${url}${userId ? ` (user:${userId})` : ''}`);

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`Handled ${method} ${url} in ${Date.now() - now}ms`),
        error: (err) => this.logger.error(`Error on ${method} ${url}`, err?.stack ?? err),
      }),
    );
  }
}
