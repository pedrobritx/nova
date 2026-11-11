import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import type { Db, RpcArgs } from "./types";

// Supabase pieces the migrations rely on, recreated for an in-process Postgres (PGlite):
// the auth schema and auth.uid(), and the three API roles. Used by the tests and by demo mode.
const SUPABASE_SHIM = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

/** The Supabase migrations, in order. Paths stay literal so the bundler traces only this folder. */
export function readMigrations(): string[] {
  return readdirSync(path.join(process.cwd(), "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(process.cwd(), "supabase", "migrations", f), "utf8"));
}

export async function createPglite(): Promise<PGlite> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = await PGlite.create();
  await pg.exec(SUPABASE_SHIM);
  for (const sql of readMigrations()) await pg.exec(sql);
  return pg;
}

function call(fn: string, args: RpcArgs): { sql: string; params: unknown[] } {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error(`Bad function name ${fn}`);
  const entries = Object.entries(args).filter(([, v]) => v !== undefined);
  for (const [k] of entries) if (!/^p_[a-z0-9_]+$/.test(k)) throw new Error(`Bad argument ${k}`);
  const list = entries.map(([k], i) => `${k} => $${i + 1}`).join(", ");
  const params = entries.map(([, v]) => (v !== null && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v));
  return { sql: `select * from public.${fn}(${list})`, params };
}

/** Run nova_* functions as a signed-in person (RLS applies) or as the fetcher (service role). */
export function pgliteDb(pg: PGlite, userId: string | null): Db {
  async function rpc<T>(fn: string, args: RpcArgs = {}): Promise<T[]> {
    const { sql, params } = call(fn, args);
    return pg.transaction(async (tx) => {
      if (userId) {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId, role: "authenticated" })]);
        await tx.exec("set local role authenticated");
      } else {
        await tx.exec("set local role service_role");
      }
      const res = await tx.query<T>(sql, params);
      return res.rows;
    });
  }
  return { rpc };
}

export async function ensureUser(pg: PGlite, id: string, email: string): Promise<void> {
  await pg.query("insert into auth.users (id, email) values ($1, $2) on conflict do nothing", [id, email]);
}
