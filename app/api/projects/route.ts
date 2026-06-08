import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { listProjectRecords, upsertProjectRecord } from "@/lib/server/projects";

export const runtime = "nodejs";

export async function GET() {
  const auth = requireAuth();
  if (auth) return auth;
  return NextResponse.json({ projects: listProjectRecords() });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth();
  if (auth) return auth;
  const body = await req.json();
  const record = upsertProjectRecord({
    id: body.id,
    name: body.name,
    components: body.components ?? [],
    blueprint: body.blueprint ?? null,
    createdAt: body.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    version: body.version ?? 1,
    componentCount: body.components?.length ?? 0,
  });
  return NextResponse.json({ project: record });
}
