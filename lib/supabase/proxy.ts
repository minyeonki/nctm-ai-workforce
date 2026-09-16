import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Missing auth configuration must not silently open protected routes.
  if (!url || !publishableKey) {
    if (request.nextUrl.pathname.startsWith("/login")
      || request.nextUrl.pathname.startsWith("/unauthorized")
      || request.nextUrl.pathname.startsWith("/ai-workforce/command/login")) {
      return response;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Validate/refresh immediately after client creation; do not trust getSession().
  const { data } = await supabase.auth.getClaims();
  const pathname = request.nextUrl.pathname;
  const publicPath = pathname.startsWith("/login")
    || pathname.startsWith("/unauthorized")
    || pathname.startsWith("/ai-workforce/command/login");

  if (!data?.claims && !publicPath) {
    const loginPath = pathname.startsWith("/ai-workforce/command")
      ? "/ai-workforce/command/login"
      : "/login";
    return NextResponse.redirect(new URL(loginPath, request.url));
  }
  return response;
}
