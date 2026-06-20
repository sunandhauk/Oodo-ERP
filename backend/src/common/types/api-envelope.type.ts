import { RequestStatus } from '../enums/request-status.enum';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T = unknown> {
  status: RequestStatus;
  requestId: string;
  data: T | null;
  error: ApiErrorBody | null;
  timestamp: string;
}
