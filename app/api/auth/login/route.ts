import { NextRequest, NextResponse } from "next/server";
import { isAuthConfigured, setSessionCookie, verifyAdminPassword } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json({ error: "服务器未配置 ADMIN_PASSWORD" }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  if (!verifyAdminPassword(String(body.password ?? ""))) {
    return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
  }
  const resp = NextResponse.json({ ok: true });
  setSessionCookie(resp);
  return resp;
}
