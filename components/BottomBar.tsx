"use client";
import { CheckCircle2, AlertTriangle, XCircle, Ruler } from "lucide-react";
import { useStore } from "@/lib/store";

export default function BottomBar() {
  const validations = useStore((s) => s.validations);
  const components = useStore((s) => s.components);
  const pass = validations.filter((v) => v.severity === "pass").length;
  const warn = validations.filter((v) => v.severity === "warn").length;
  const err = validations.filter((v) => v.severity === "error").length;

  return (
    <footer className="h-7 shrink-0 border-t border-eng-border bg-eng-panel flex items-center px-3 text-xs text-eng-muted gap-4">
      <span className="flex items-center gap-1"><Ruler className="w-3 h-3" />单位：mm / m³ / kg</span>
      <span>构件：{components.length}</span>
      <div className="flex-1" />
      <span className="flex items-center gap-1 text-eng-ok"><CheckCircle2 className="w-3 h-3" />通过 {pass}</span>
      <span className="flex items-center gap-1 text-eng-warn"><AlertTriangle className="w-3 h-3" />警告 {warn}</span>
      <span className="flex items-center gap-1 text-eng-err"><XCircle className="w-3 h-3" />错误 {err}</span>
      <span>22G101 · 阶段 A</span>
    </footer>
  );
}
