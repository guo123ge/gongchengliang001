import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `你是一名资深结构工程师 AI 助手，精通中国 22G101 平法图集与钢筋混凝土工程量计算。
用户会提供当前模型 JSON（components 数组）以及自然语言指令。

你的任务：
1. 用简洁中文回答问题、解释平法规则或说明工程量计算逻辑。
2. 如果用户要求修改模型，请在回复末尾输出一段以 \`\`\`json ... \`\`\` 包裹的操作指令数组：
[
  {"action":"update","id":"<componentId>","patch":{"geometry":{...},"concrete":{...},"rebars":[...]}},
  {"action":"create","component":{"id":"...","name":"...","type":"BEAM","geometry":{},"concrete":{},"rebars":[],"placement":{"x":0,"y":0,"z":0}}},
  {"action":"delete","id":"<componentId>"}
]
3. 不确定时只解释，不输出操作 JSON。
4. 所有长度单位均为 mm，构件类型必须使用项目已有类型：BEAM、COLUMN、SHEAR_WALL、SLAB、STAIR、FOUND、STRIP_FOUND、PILE_CAP、PILE、RAFT。`;

const SERVER_BASE_URL = process.env.AI_BASE_URL ?? "";
const SERVER_API_KEY = process.env.AI_API_KEY ?? "";
const SERVER_MODEL = process.env.AI_MODEL ?? "";

export async function POST(req: NextRequest) {
  const auth = requireAuth();
  if (auth) return auth;

  const body = await req.json();
  const { messages, model, temperature, stream } = body as {
    messages: any[];
    model?: string;
    temperature?: number;
    stream?: boolean;
  };

  const finalModel = model || SERVER_MODEL;
  if (!SERVER_BASE_URL || !SERVER_API_KEY || !finalModel) {
    return NextResponse.json(
      { error: "服务器未配置 AI_BASE_URL / AI_API_KEY / AI_MODEL。" },
      { status: 400 },
    );
  }

  const isStream = stream === true;
  const payload: Record<string, any> = {
    model: finalModel,
    temperature: typeof temperature === "number" ? temperature : 0.3,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: isStream,
  };

  try {
    const base = SERVER_BASE_URL.replace(/\/$/, "");
    const versionedBase = /\/v\d+$/.test(base) ? base : `${base}/v1`;
    const resp = await fetch(`${versionedBase}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVER_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      let errData: any = {};
      try {
        errData = JSON.parse(errText);
      } catch {}
      const detail = errData?.error?.message || errData?.error?.code || errText || "未知错误";
      return NextResponse.json(
        { error: `AI 接口返回 HTTP ${resp.status}: ${detail}`, raw: errData || errText },
        { status: resp.status },
      );
    }

    if (isStream) {
      const encoder = new TextEncoder();
      const out = new ReadableStream({
        async start(controller) {
          const reader = resp.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (data === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content ?? "";
                  if (content) controller.enqueue(encoder.encode(content));
                } catch {}
              }
            }
            controller.enqueue(encoder.encode("__STREAM_DONE__"));
          } catch (e: any) {
            controller.enqueue(encoder.encode(`\n\n[错误: ${e.message}]`));
          } finally {
            controller.close();
            reader.releaseLock();
          }
        },
      });

      return new Response(out, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "no-cache",
        },
      });
    }

    const data = await resp.json();
    return NextResponse.json({ content: data?.choices?.[0]?.message?.content ?? "" });
  } catch (e: any) {
    const msg = e?.message || "网络错误";
    if (isStream) return new Response(msg, { headers: { "Content-Type": "text/plain; charset=utf-8" }, status: 500 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
