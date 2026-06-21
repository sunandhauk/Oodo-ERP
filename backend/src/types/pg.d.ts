declare module 'pg' {
  export interface QueryResultRow {
    [column: string]: unknown;
  }

  export class Pool {
    constructor(config?: unknown);
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
    connect(): Promise<{
      query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
      release(): void;
    }>;
    end(): Promise<void>;
  }
}
