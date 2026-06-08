import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getOcrJob } from "@/lib/server/ocr";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth();
  if (auth) return auth;
  const job = getOcrJob(params.id);
  if (!job) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  return NextResponse.json({ job });
}
