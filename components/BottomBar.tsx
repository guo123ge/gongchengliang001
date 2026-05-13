"use client";
import { CheckCircle2, AlertTriangle, XCircle, Ruler, PanelBottom, PanelBottomOpen, ClipboardCheck } from "lucide-react";
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
      <footer className="h-full w-full flex items-center justify-between px-3 text-xs text-on-surface-variant bg-surface-container-low">
        <span className="font-label-code">构件：{components.length} · 通过 {pass} / 警告 {warn} / 错误 {err}</span>
        <button onClick={onToggle} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors" title="展开">
          <PanelBottomOpen className="w-4 h-4" />
        </button>
      </footer>
    );
  }

  return (
    <footer className="h-full w-full flex flex-col bg-surface-container-low">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-label-code text-on-surface-variant">
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>校验结果</span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-tertiary"><CheckCircle2 className="w-3.5 h-3.5" />通过 {pass}</span>
            <span className="flex items-center gap-1 text-secondary"><AlertTriangle className="w-3.5 h-3.5" />警告 {warn}</span>
            <span className="flex items-center gap-1 text-error"><XCircle className="w-3.5 h-3.5" />错误 {err}</span>
          </div>
          <div className="h-4 w-px bg-outline-variant/30" />
          <span className="flex items-center gap-1 text-label-code text-on-surface-variant">
            <Ruler className="w-3 h-3" />22G101 · 阶段 A
          </span>
        </div>
        <button onClick={onToggle} className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant transition-colors" title="收起">
          <PanelBottom className="w-4 h-4" />
        </button>
      </div>

      {/* Validation List */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {validations.length > 0 ? (
          <div className="space-y-1">
            {validations.map((v, i) => (
              <div key={i} className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                v.severity === "pass" && "text-tertiary bg-tertiary/10 border border-tertiary/20",
                v.severity === "warn" && "text-secondary bg-secondary/10 border border-secondary/20",
                v.severity === "error" && "text-error bg-error/10 border border-error/20",
              )}>
                {v.severity === "pass" && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                {v.severity === "warn" && <AlertTriangle className="w-4 h-4 shrink-0" />}
                {v.severity === "error" && <XCircle className="w-4 h-4 shrink-0" />}
                <span className="truncate font-mono text-xs">{v.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-on-surface-variant text-sm">
            暂无校验结果
          </div>
        )}
      </div>
    </footer>
  );
}
