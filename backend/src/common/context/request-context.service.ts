import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { RequestContextState } from '../types/request-context.type';

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  run<T>(state: RequestContextState, callback: () => T): T {
    return this.storage.run(state, callback);
  }

  get(): RequestContextState | undefined {
    return this.storage.getStore();
  }

  getRequestId(): string {
    return this.get()?.requestId ?? 'unknown-request';
  }

  getTenantId(): string {
    return this.get()?.tenantId ?? 'default';
  }
}
