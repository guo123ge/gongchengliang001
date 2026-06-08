import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST() {
  const resp = NextResponse.json({ ok: true });
  clearSessionCookie(resp);
  return resp;
}
