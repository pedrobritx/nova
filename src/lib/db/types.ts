export type RpcArgs = Record<string, unknown>;

/**
 * Nova talks to its database only through the nova_* SQL functions, so the same calls run
 * on Supabase (through PostgREST) and on PGlite (tests and demo mode).
 */
export type Db = {
  rpc<T = Record<string, unknown>>(fn: string, args?: RpcArgs): Promise<T[]>;
};
