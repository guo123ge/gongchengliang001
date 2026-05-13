"use client";
import { useState } from "react";
import { Send, Loader2, Bot, User as UserIcon, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Component } from "@/lib/types";
import { loadAIConfig } from "./SettingsDialog";

interface Msg { role: "user" | "assistant"; content: string }

export default function AIPanel() {
  const components = useStore((s) => s.components);
  const updateComponent = useStore((s) => s.updateComponent);
  const addFromComponent = (c: Component) => {
    useStore.setState((s) => ({ components: [...s.components, c] }));
    useStore.getState().revalidate();
  };
  const removeComponent = useStore((s) => s.removeComponent);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Msg = { role: "user", content: text };
    const context = `当前模型 JSON：\n${JSON.stringify(components, null, 2)}`;
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const cfg = loadAIConfig();
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...next.map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: context }],
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          model: cfg.model,
          temperature: cfg.temperature,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        setMsgs((m) => [...m, { role: "assistant", content: `错误：${data.error ?? "未知"}` }]);
      } else {
        const content: string = data.content ?? "";
        setMsgs((m) => [...m, { role: "assistant", content }]);
        applyOps(content);
      }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `请求失败：${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  const applyOps = (text: string) => {
    const m = text.match(/```json\s*([\s\S]*?)```/);
    if (!m) return;
    try {
      const ops = JSON.parse(m[1]);
      if (!Array.isArray(ops)) return;
      for (const op of ops) {
        if (op.action === "update" && op.id && op.patch) updateComponent(op.id, op.patch);
        else if (op.action === "create" && op.component) addFromComponent(op.component);
        else if (op.action === "delete" && op.id) removeComponent(op.id);
      }
    } catch {}
  };

  return (
    <div className="flex flex-col h-full bg-surface-container-low">
      {/* Header */}
      <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-title-sm text-title-sm font-semibold text-on-surface">AI 助手</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">结构计算智能助手</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
        {msgs.length === 0 && (
          <div className="text-on-surface-variant text-xs bg-surface-container-high/30 rounded-lg p-4">
            <p className="font-medium mb-2">示例指令：</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>把 KL1 的梁高改为 700mm，并重新校验配筋</li>
              <li>新建一根 C40 C 级钢筋的柱 KZ2，500x500x3600</li>
              <li>解释 22G101 中 LaE 抗震锚固的计算</li>
            </ul>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className="mt-0.5 shrink-0">
              {m.role === "user" ? (
                <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-on-surface-variant" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
            <div className={`flex-1 max-w-[85%] ${m.role === "user" ? "text-right" : ""}`}>
              <div className={`inline-block rounded-lg px-3 py-2 whitespace-pre-wrap break-words leading-relaxed ${
                m.role === "user"
                  ? "bg-primary/10 text-on-surface border border-primary/20"
                  : "bg-surface-container-high/50 text-on-surface border border-outline-variant/10"
              }`}>
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2 text-on-surface-variant items-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">思考中...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-outline-variant/20 p-3 flex gap-2 bg-surface-container-low">
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="描述要修改的构件或咨询平法规则..."
          className="input-eng flex-1 resize-none"
        />
        <button className="btn-primary self-end" onClick={send} disabled={busy}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
