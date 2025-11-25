import { BadRequestException, ForbiddenException, NotFoundException, HttpException } from '@nestjs/common';

export type DomainErrorType = 'not_found' | 'forbidden' | 'bad_request';

export interface DomainErrorOptions {
  type: DomainErrorType;
  message: string;
  context?: Record<string, unknown>;
}

export class DomainErrorFactory {
  static create(options: DomainErrorOptions): HttpException {
    switch (options.type) {
      case 'not_found':
        return new NotFoundException(options.message);
      case 'forbidden':
        return new ForbiddenException(options.message);
      case 'bad_request':
      default:
        return new BadRequestException(options.message);
    }
  }
}
