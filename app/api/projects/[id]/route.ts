import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { deleteProjectRecord, getProjectRecord, upsertProjectRecord } from "@/lib/server/projects";

export const runtime = "nodejs";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth();
  if (auth) return auth;
  const project = getProjectRecord(params.id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ project });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth();
  if (auth) return auth;
  const body = await req.json();
  const existing = getProjectRecord(params.id);
  const project = upsertProjectRecord({
    id: params.id,
    name: body.name,
    components: body.components ?? [],
    blueprint: body.blueprint ?? null,
    createdAt: existing?.createdAt ?? body.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    version: body.version ?? 1,
    componentCount: body.components?.length ?? 0,
  });
  return NextResponse.json({ project });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth();
  if (auth) return auth;
  deleteProjectRecord(params.id);
  return NextResponse.json({ ok: true });
}
