import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseForRequest } from "@/lib/db/supabase";

// The sign-in email lands here. Supabase sends either a one-time code (PKCE) or a token hash,
// depending on the email template; both become a session cookie, then Today.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await supabaseForRequest();

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  const target = new URL(ok ? "/" : "/sign-in?expired=1", url.origin);
  return NextResponse.redirect(target);
}
