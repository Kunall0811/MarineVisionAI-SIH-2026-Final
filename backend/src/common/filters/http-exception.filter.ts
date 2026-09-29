import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    console.error('[HttpExceptionFilter CAUGHT]:', exception);
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'error' in (body as any)) {
        const err = (body as any).error;
        code = err.code || code;
        message = err.message || message;
      } else if (typeof body === 'object' && body !== null && 'message' in (body as any)) {
        const m = (body as any).message;
        message = Array.isArray(m) ? m.join('; ') : m;
        code = this.codeFromStatus(status);
      } else {
        message = String(body);
        code = this.codeFromStatus(status);
      }
    } else if (exception instanceof Error) {
      console.error('[HttpExceptionFilter caught Error]:', exception.message, exception.stack);
      this.logger.error(exception.message, exception.stack);
    } else {
      console.error('[HttpExceptionFilter caught Unknown]:', exception);
    }

    // Never leak stack traces to clients.
    response.status(status).json({
      success: false,
      error: { code, message },
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
