import { QueryResultRow } from 'pg';

export interface AppUserRecord extends QueryResultRow {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  status: string;
  roles: string[];
  permissions: string[];
}

export interface IdempotencyRecord extends QueryResultRow {
  id: string;
  tenant_id: string;
  method: string;
  path: string;
  idempotency_key: string;
  request_hash: string;
  response_status: number | null;
  response_payload: unknown | null;
}
