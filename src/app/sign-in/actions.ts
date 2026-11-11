"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { supabaseConfigured, supabaseForRequest } from "@/lib/db/supabase";

export type SignInState = { email?: string; sent?: boolean; error?: string } | null;

const Email = z.email().max(320);

async function origin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function sendSignInLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = Email.safeParse(email);
  if (!parsed.success) return { email, error: "Enter an email address, like you@example.com" };
  if (!supabaseConfigured()) return { email, error: "Sign-in is not set up on this server yet" };
  const supabase = await supabaseForRequest();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/confirm` },
  });
  if (error) {
    return { email, error: error.status === 429 ? "Too many links sent. Wait a minute and try again." : "Nova could not send the link. Try again." };
  }
  return { email: parsed.data, sent: true };
}
