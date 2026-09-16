import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const loginPath = "/ai-workforce/command/login";

  if (!url || !publishableKey) {
    if (request.nextUrl.pathname.startsWith(loginPath)
      || request.nextUrl.pathname.startsWith("/unauthorized")) {
      return response;
    }
    return NextResponse.redirect(new URL(loginPath, request.url));
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

  let hasValidSession = false;
  try {
    const { data } = await supabase.auth.getUser();
    hasValidSession = Boolean(data?.user);
  } catch {
    // Treat any verification failure (bad/expired token, network hiccup) as "not signed in"
    // rather than letting it crash the request.
    hasValidSession = false;
  }

  const pathname = request.nextUrl.pathname;
  const publicPath = pathname.startsWith(loginPath)
    || pathname.startsWith("/unauthorized");

  if (!hasValidSession && !publicPath) {
    return NextResponse.redirect(new URL(loginPath, request.url));
  }
  return response;
}
