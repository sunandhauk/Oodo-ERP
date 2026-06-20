import { Request } from 'express';
import { IncomingMessage, ServerResponse } from 'http';

export interface RequestContextState {
  requestId: string;
  tenantId: string;
  request: Request;
  response: ServerResponse | IncomingMessage;
}
