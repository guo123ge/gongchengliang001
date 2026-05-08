import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const cfg = await prisma.aIConfig.findFirst();
  if (!cfg) return NextResponse.json({ baseUrl: "", model: "", temperature: 0.3, hasKey: false });
  return NextResponse.json({
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    temperature: cfg.temperature,
    hasKey: Boolean(cfg.apiKey),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { baseUrl, apiKey, model, temperature } = body as {
    baseUrl: string; apiKey?: string; model: string; temperature?: number;
  };
  const existing = await prisma.aIConfig.findFirst();
  if (existing) {
    await prisma.aIConfig.update({
      where: { id: existing.id },
      data: {
        baseUrl,
        model,
        temperature: temperature ?? existing.temperature,
        ...(apiKey ? { apiKey } : {}),
      },
    });
  } else {
    await prisma.aIConfig.create({
      data: { baseUrl, apiKey: apiKey ?? "", model, temperature: temperature ?? 0.3 },
    });
  }
  return NextResponse.json({ ok: true });
}
