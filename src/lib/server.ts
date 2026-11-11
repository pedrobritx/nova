import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { demoContext, demoMode } from "./demo/db";
import { serviceDb, supabaseConfigured, userDbForRequest } from "./db/supabase";
import type { Db } from "./db/types";

export type Viewer = { id: string; email: string | null };
export type Context = { db: Db; service: Db; viewer: Viewer; demo: boolean };

/**
 * The data access layer's entry point: who is asking, and the database as them. Every page,
 * action and route handler starts here, so authorisation is checked next to the data.
 */
export async function context(): Promise<Context> {
  // Personal data is never part of a prerendered shell: wait for a real request first.
  await connection();
  if (demoMode()) return demoContext();
  if (!supabaseConfigured()) redirect("/setup");
  const { db, user } = await userDbForRequest();
  if (!user) redirect("/sign-in");
  return { db, service: serviceDb(), viewer: user, demo: false };
}

/** The fetcher's database, for the scheduled refresh. */
export async function fetcherDb(): Promise<Db> {
  if (demoMode()) return (await demoContext()).service;
  return serviceDb();
}
