"use client";
import { useState } from "react";
import { Send, Loader2, Bot, User as UserIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Component } from "@/lib/types";

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
      const r = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...next.map((m) => ({ role: m.role, content: m.content })),
            { role: "user" as const, content: context }],
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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
        {msgs.length === 0 && (
          <div className="text-eng-muted text-xs">
            示例指令：
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>把 KL1 的梁高改为 700mm，并重新校验配筋</li>
              <li>新建一根 C40 C 级钢筋的柱 KZ2，500x500x3600</li>
              <li>解释 22G101 中 LaE 抗震锚固的计算</li>
            </ul>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-2">
            <div className="mt-0.5">
              {m.role === "user" ? <UserIcon className="w-4 h-4 text-eng-muted" /> : <Bot className="w-4 h-4 text-eng-accent" />}
            </div>
            <div className="flex-1 whitespace-pre-wrap break-words text-eng-text leading-relaxed">
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-2 text-eng-muted"><Loader2 className="w-4 h-4 animate-spin" />思考中...</div>
        )}
      </div>
      <div className="border-t border-eng-border p-2 flex gap-2">
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
        <button className="btn-primary" onClick={send} disabled={busy}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
