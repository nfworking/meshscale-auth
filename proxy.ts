import { NextResponse, type NextRequest } from "next/server";
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";

/**
 * The auth server is not a destination. People arrive here only when the platform starts a sign-in,
 * and the OAuth provider signs that request. A page that shows login, sign-up, organization or
 * consent UI is served only when the URL carries a valid signature. Anything else goes back to the platform,
 * which starts a fresh sign-in if one is needed.
 */
const GATED = ["/sign-in", "/sign-up", "/select-org", "/consent"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const platform = process.env.PLATFORM_URL!;

  if (pathname === "/") return NextResponse.redirect(platform);

  if (GATED.includes(pathname)) {
    const valid = search.length > 1 && (await verifyOAuthQueryParams(search.slice(1), process.env.BETTER_AUTH_SECRET!));
    if (!valid) return NextResponse.redirect(platform);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/sign-in", "/sign-up", "/select-org", "/consent"],
  // /device is deliberately not gated: the CLI sends people to the platform first, which forwards them here once signed in.
  // Without a session the page itself sends them back to the platform.
};
