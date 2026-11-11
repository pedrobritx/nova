import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Db, RpcArgs } from "./types";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.local and fill it in, or run with NOVA_DEMO=1.`);
  return value;
}

/** Wrap supabase.rpc so it returns rows the way PGlite does: scalars become [{ fn: value }]. */
function asDb(client: SupabaseClient): Db {
  return {
    async rpc<T>(fn: string, args: RpcArgs = {}): Promise<T[]> {
      const { data, error } = await client.rpc(fn, args);
      if (error) throw new Error(`${fn}: ${error.message}`);
      if (Array.isArray(data)) return data as T[];
      return [{ [fn]: data } as T];
    },
  };
}

/** A client acting as the person whose session cookie came with the request. */
export async function supabaseForRequest(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        // Server Components cannot set cookies; the proxy refreshes the session instead.
        try {
          for (const { name, value, options } of toSet) store.set(name, value, options);
        } catch {
          /* called from a Server Component */
        }
      },
    },
  });
}

export async function userDbForRequest(): Promise<{ db: Db; user: { id: string; email: string | null } | null }> {
  const client = await supabaseForRequest();
  const { data } = await client.auth.getClaims();
  const claims = data?.claims;
  const user = claims?.sub ? { id: claims.sub, email: (claims.email as string | undefined) ?? null } : null;
  return { db: asDb(client), user };
}

let service: Db | null = null;

/** The fetcher's client. It bypasses row-level security, so it never touches request input directly. */
export function serviceDb(): Db {
  service ??= asDb(
    createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SECRET_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  return service;
}
