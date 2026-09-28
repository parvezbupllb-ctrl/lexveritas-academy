import { NextResponse, type NextRequest } from "next/server";
import { env } from "cloudflare:workers";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname.replace(/\/$/, "") || "/";
  try {
    const binding = (env as any).DB;
    if (binding) {
      const rule = await binding
        .prepare("SELECT new_url,status_code FROM seo_redirects WHERE old_url=? AND active=1")
        .bind(path)
        .first();
      if (rule) return NextResponse.redirect(new URL(rule.new_url, request.url), rule.status_code === 302 ? 302 : 301);
    }
  } catch {
    // A missing migration must not interrupt the public website.
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|admin(?:/|$)|_next/|assets/|fonts/|favicon\\.svg).*)"],
};
