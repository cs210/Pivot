import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request);

  // Refresh session if expired
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Get the pathname
  const pathname = request.nextUrl.pathname;

  // Check if it's a shared project route - allow access regardless of authentication status
  if (pathname.startsWith("/shared/")) {
    // Allow both authenticated and unauthenticated users to access shared project pages
    return response;
  }

  // For API routes that handle public project access
  if (pathname.startsWith("/api/public/")) {
    return response;
  }

  // If accessing protected routes without session, redirect to login
  if (
    !session &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/project"))
  ) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If accessing auth pages with session, redirect to dashboard
  if (
    session &&
    (pathname.startsWith("/login") || pathname.startsWith("/register"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/project/:path*",
    "/shared/:path*",
    "/api/public/:path*",
    "/login",
    "/register",
  ],
};
