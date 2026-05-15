"use client";
import { HardHat, Box, Columns, Square, Circle, FileUp, BookOpen, ArrowRight } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ComponentType } from "@/lib/types";

const TYPES: { t: ComponentType; label: string; desc: string; icon: any; color: string }[] = [
  { t: "BEAM", label: "梁", desc: "矩形截面梁参数输入", icon: Box, color: "text-blue-400" },
  { t: "COLUMN", label: "柱", desc: "矩形截面柱参数输入", icon: Columns, color: "text-emerald-400" },
  { t: "SLAB", label: "板", desc: "楼板参数输入", icon: Square, color: "text-violet-400" },
  { t: "PILE", label: "桩基", desc: "灌注桩参数输入", icon: Circle, color: "text-amber-400" },
];

export default function WelcomeEmpty() {
  const addComponent = useStore((s) => s.addComponent);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] select-none">
      {/* Hero */}
      <div className="flex items-center gap-3 mb-6">
        <HardHat className="w-10 h-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">BIM.Core</h1>
          <p className="text-sm text-slate-400">Reinforced Concrete Quantification</p>
        </div>
      </div>

      <p className="text-slate-400 text-sm mb-8 text-center max-w-md">
        钢筋混凝土工程量计算与 3D 可视化工具<br />
        支持 22G101 平法规则校验 · DXF 蓝图导入 · AI 辅助设计
      </p>

      {/* Quick Add */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.t}
              onClick={() => addComponent(t.t)}
              className="flex flex-col items-center gap-2 px-6 py-5 rounded-xl
                bg-slate-800/60 border border-slate-700/50
                hover:bg-slate-700/60 hover:border-primary/40
                transition-all duration-200 group cursor-pointer"
            >
              <Icon className={`w-8 h-8 ${t.color} group-hover:scale-110 transition-transform`} />
              <span className="text-white text-sm font-medium">{t.label}</span>
              <span className="text-slate-500 text-[10px]">{t.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Tutorial */}
      <div className="flex items-center gap-6 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-mono">1</span>
          <span>左侧栏管理构件树</span>
        </div>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-mono">2</span>
          <span>右键拖拽旋转场景</span>
        </div>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-mono">3</span>
          <span>右侧面板调整参数</span>
        </div>
        <ArrowRight className="w-3 h-3 text-slate-600" />
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-mono">4</span>
          <span>导出报表或 AI 辅助</span>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="mt-8 flex items-center gap-2 text-[10px] text-slate-600">
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">↑↓</kbd>
        <span>缩放</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">中键</kbd>
        <span>平移</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">右键</kbd>
        <span>旋转</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">Ctrl+S</kbd>
        <span>保存</span>
      </div>
    </div>
  );
}
