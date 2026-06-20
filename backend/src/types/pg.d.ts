declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export interface PoolConfig {
    connectionString?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean };
  }

  export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
    rows: T[];
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    connect(): Promise<{
      query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
      release(): void;
    }>;
    end(): Promise<void>;
  }
}
