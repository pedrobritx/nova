import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Keep signed-in sessions fresh, but let guests access only the explicit public paths.
const PUBLIC = [/^\/sign-in(?:\/|$)/, /^\/auth\//, /^\/setup(?:\/|$)/, /^\/guest(?:\/|$)/, /^\/api\/guest\//, /^\/api\/refresh(?:\/|$)/];

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (process.env.NOVA_DEMO === "1" || !url || !key) return NextResponse.next({ request });
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  if (!signedIn && !PUBLIC.some((pattern) => pattern.test(path))) {
    const target = request.nextUrl.clone();
    target.pathname = "/sign-in";
    target.search = "";
    return NextResponse.redirect(target);
  }
  if (signedIn && path === "/sign-in") return NextResponse.redirect(new URL("/", request.url));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|ground/|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};