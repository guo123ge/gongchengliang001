import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.component.findMany({ orderBy: { updatedAt: "desc" } });
  const items = rows.map((r) => ({ id: r.id, name: r.name, type: r.type, ...JSON.parse(r.data) }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { id, type, name, ...rest } = body;
  const data = JSON.stringify(rest);
  const saved = await prisma.component.upsert({
    where: { id: id ?? "" },
    update: { name, type, data },
    create: { id, name, type, data },
  });
  return NextResponse.json({ id: saved.id });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.component.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
