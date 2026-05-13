"use client";
import { CheckCircle2, AlertTriangle, XCircle, Ruler, PanelBottom, PanelBottomOpen } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function BottomBar({ collapsed, onToggle }: Props) {
  const validations = useStore((s) => s.validations);
  const components = useStore((s) => s.components);
  const pass = validations.filter((v) => v.severity === "pass").length;
  const warn = validations.filter((v) => v.severity === "warn").length;
  const err = validations.filter((v) => v.severity === "error").length;

  if (collapsed) {
    return (
      <footer className="h-full w-full border-t border-eng-border bg-eng-panel flex items-center justify-between px-3 text-xs text-eng-muted">
        <span>构件：{components.length} · 通过 {pass} / 警告 {warn} / 错误 {err}</span>
        <button onClick={onToggle} className="p-0.5 rounded hover:bg-eng-panel2 text-eng-muted" title="展开">
          <PanelBottomOpen className="w-3.5 h-3.5" />
        </button>
      </footer>
    );
  }

  return (
    <footer className="h-full w-full border-t border-eng-border bg-eng-panel flex flex-col">
      <div className="flex items-center justify-between px-3 py-1 border-b border-eng-border shrink-0">
        <div className="flex items-center gap-4 text-xs text-eng-muted">
          <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />单位：mm / m³ / kg</span>
          <span>构件：{components.length}</span>
        </div>
        <button onClick={onToggle} className="p-0.5 rounded hover:bg-eng-panel2 text-eng-muted" title="收起">
          <PanelBottom className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-2 text-xs">
        <div className="flex gap-4 mb-2">
          <span className="flex items-center gap-1 text-eng-ok"><CheckCircle2 className="w-3 h-3" />通过 {pass}</span>
          <span className="flex items-center gap-1 text-eng-warn"><AlertTriangle className="w-3 h-3" />警告 {warn}</span>
          <span className="flex items-center gap-1 text-eng-err"><XCircle className="w-3 h-3" />错误 {err}</span>
          <span className="text-eng-muted">22G101 · 阶段 A</span>
        </div>
        {validations.length > 0 && (
          <div className="space-y-0.5">
            {validations.map((v, i) => (
              <div key={i} className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded",
                v.severity === "pass" && "text-eng-ok bg-eng-ok/10",
                v.severity === "warn" && "text-eng-warn bg-eng-warn/10",
                v.severity === "error" && "text-eng-err bg-eng-err/10",
              )}>
                {v.severity === "pass" && <CheckCircle2 className="w-3 h-3 shrink-0" />}
                {v.severity === "warn" && <AlertTriangle className="w-3 h-3 shrink-0" />}
                {v.severity === "error" && <XCircle className="w-3 h-3 shrink-0" />}
                <span className="truncate">{v.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}
