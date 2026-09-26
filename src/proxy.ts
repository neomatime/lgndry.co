import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/db/proxy";

// Next.js 16 renamed the `middleware` file convention to `proxy`.
export async function proxy(request: NextRequest) {
  // Customer pages (the account area and checkout) read the signed-in customer
  // on the server. All the proxy does for them is keep the session cookies
  // fresh; nothing here blocks a visitor, and a missing configuration must not
  // take the page down.
  if (!request.nextUrl.pathname.startsWith("/ops")) {
    try {
      return (await updateSession(request)).response;
    } catch (error) {
      console.error("proxy: could not refresh the session", error);
      return NextResponse.next();
    }
  }

  const { response, isAuthenticated } = await updateSession(request);

  if (!isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/ops/:path*", "/account", "/checkout"],
};
