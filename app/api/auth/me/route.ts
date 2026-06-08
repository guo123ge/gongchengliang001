import { NextResponse } from "next/server";
import { isAuthConfigured, isAuthenticated } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: isAuthConfigured(),
    authenticated: isAuthenticated(),
  });
}
