"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [hasKey, setHasKey] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/ai/config").then((r) => r.json()).then((d) => {
      setBaseUrl(d.baseUrl || "");
      setModel(d.model || "");
      setTemperature(d.temperature ?? 0.3);
      setHasKey(!!d.hasKey);
    });
  }, []);

  const save = async () => {
    const r = await fetch("/api/ai/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, model, apiKey: apiKey || undefined, temperature }),
    });
    if (r.ok) {
      setMsg("已保存");
      setApiKey("");
      setHasKey(true);
      setTimeout(() => setMsg(""), 1500);
    } else {
      setMsg("保存失败");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-[480px] p-4 shadow-xl">
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium">AI 接口设置</div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-eng-muted mb-1">Base URL（OpenAI 兼容）</div>
            <input className="input-eng" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1" />
          </div>
          <div>
            <div className="text-xs text-eng-muted mb-1">Model</div>
            <input className="input-eng" value={model} onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini / deepseek-chat / qwen-plus" />
          </div>
          <div>
            <div className="text-xs text-eng-muted mb-1">
              API Key {hasKey && <span className="text-eng-ok">（已配置，留空则保留原值）</span>}
            </div>
            <input className="input-eng" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "••••••••" : "sk-..."} />
          </div>
          <div>
            <div className="text-xs text-eng-muted mb-1">Temperature：{temperature}</div>
            <input type="range" min={0} max={1} step={0.1} value={temperature}
              onChange={(e) => setTemperature(+e.target.value)} className="w-full" />
          </div>
          <div className="text-xs text-eng-muted">
            Key 保存在服务端 SQLite，前端不可见，通过 <code>/api/ai/chat</code> 代理调用。
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <span className="flex-1 text-xs text-eng-ok self-center">{msg}</span>
          <button className="btn-eng" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  );
}
