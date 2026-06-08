import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createOcrJob } from "@/lib/server/ocr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = requireAuth();
  if (auth) return auth;
  const body = await req.json().catch(() => ({}));
  if (!body.fileId) {
    return NextResponse.json({ error: "缺少 fileId" }, { status: 400 });
  }
  try {
    const job = createOcrJob(String(body.fileId), body.projectId ? String(body.projectId) : null);
    return NextResponse.json({ job });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "创建 OCR 任务失败" }, { status: 400 });
  }
}
