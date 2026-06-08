"use client";
import { useEffect, useState } from "react";
import { Check, ServerCog, X } from "lucide-react";

const KEY = "rebar-quant.aiConfig.v4";

export interface AIConfig {
  model: string;
  temperature: number;
}

export function loadAIConfig(): AIConfig {
  if (typeof window === "undefined") return { model: "", temperature: 0.3 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const c = JSON.parse(raw);
      return {
        model: c.model || "",
        temperature: typeof c.temperature === "number" ? c.temperature : 0.3,
      };
    }
  } catch {}
  return { model: "", temperature: 0.3 };
}

export function saveAIConfig(cfg: AIConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cfg));
  } catch {}
}

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.3);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const c = loadAIConfig();
    setModel(c.model);
    setTemperature(c.temperature);
  }, []);

  const save = () => {
    saveAIConfig({ model, temperature });
    setMsg("已保存");
    setTimeout(() => setMsg(""), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-[520px] p-4 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-on-surface">AI 接口设置</div>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-container-high">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 mb-4 flex gap-2 text-sm">
          <ServerCog className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-emerald-400 font-medium">AI Key 由服务器环境变量统一管理</div>
            <div className="text-xs text-on-surface-variant mt-1">
              前端不再保存或发送 API Key。请在服务器配置 AI_BASE_URL / AI_API_KEY / AI_MODEL。
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs text-on-surface-variant mb-1">Model 覆盖值（留空使用服务器默认）</div>
            <input
              className="input-eng"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-chat"
            />
          </div>
          <div>
            <div className="text-xs text-on-surface-variant mb-1">Temperature：{temperature}</div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(+e.target.value)}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <span className="flex-1 text-xs text-tertiary self-center">{msg}</span>
          <button className="btn-eng" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={save}>
            <Check className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
