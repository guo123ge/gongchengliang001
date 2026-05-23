"use client";
import { HardHat, Box, Columns, Square, Circle, ArrowRight,
  RectangleHorizontal, MoveUpRight, Triangle, Minus, Hexagon, Grid3X3 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ComponentType } from "@/lib/types";

const TYPE_GROUPS: {
  name: string;
  types: { t: ComponentType; code: string; label: string; desc: string; icon: any; color: string }[];
}[] = [
  {
    name: "上部结构",
    types: [
      { t: "BEAM",       code: "KL",  label: "梁 KL",   desc: "框架梁",   icon: Box,                 color: "text-blue-400" },
      { t: "COLUMN",     code: "KZ",  label: "柱 KZ",   desc: "框架柱",   icon: Columns,             color: "text-emerald-400" },
      { t: "SHEAR_WALL", code: "Q",   label: "墙 Q",    desc: "剪力墙",   icon: RectangleHorizontal, color: "text-purple-400" },
      { t: "SLAB",       code: "LB",  label: "板 LB",   desc: "楼板",     icon: Square,              color: "text-violet-400" },
      { t: "STAIR",      code: "LT",  label: "楼梯 LT", desc: "AT型楼梯", icon: MoveUpRight,         color: "text-cyan-400" },
    ],
  },
  {
    name: "基础",
    types: [
      { t: "FOUND",       code: "DJ", label: "独基 DJ", desc: "独立基础",   icon: Triangle, color: "text-amber-400" },
      { t: "STRIP_FOUND", code: "TJ", label: "条基 TJ", desc: "条形基础",   icon: Minus,    color: "text-orange-400" },
      { t: "PILE_CAP",    code: "CT", label: "承台 CT", desc: "桩基承台",   icon: Hexagon,  color: "text-red-400" },
      { t: "PILE",        code: "ZJ", label: "桩 ZJ",   desc: "灌注桩",     icon: Circle,   color: "text-rose-400" },
      { t: "RAFT",        code: "FB", label: "筏板 FB", desc: "筏板基础",   icon: Grid3X3,  color: "text-pink-400" },
    ],
  },
];

export default function WelcomeEmpty() {
  const addComponent = useStore((s) => s.addComponent);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f172a] select-none overflow-auto py-8">
      {/* Hero */}
      <div className="flex items-center gap-3 mb-4">
        <HardHat className="w-9 h-9 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">BIM.Core Reinforced</h1>
          <p className="text-xs text-slate-400">22G101 平法工程量计算 · 3D 配筋可视化</p>
        </div>
      </div>

      <p className="text-slate-500 text-xs mb-6 text-center">
        支持平法校验 · DXF 蓝图导入 · AI 辅助设计 · Excel/Word 报表
      </p>

      {/* Quick Add Groups */}
      <div className="space-y-4 mb-6 w-full max-w-xl px-4">
        {TYPE_GROUPS.map((group) => (
          <div key={group.name}>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-1">{group.name}</div>
            <div className="grid grid-cols-5 gap-2">
              {group.types.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.t}
                    onClick={() => addComponent(t.t)}
                    className="flex flex-col items-center gap-1.5 px-2 py-4 rounded-xl
                      bg-slate-800/60 border border-slate-700/50
                      hover:bg-slate-700/60 hover:border-primary/40
                      transition-all duration-200 group cursor-pointer"
                  >
                    <Icon className={`w-6 h-6 ${t.color} group-hover:scale-110 transition-transform`} />
                    <span className="text-white text-[11px] font-medium leading-tight text-center">{t.label}</span>
                    <span className="text-slate-500 text-[9px] leading-tight">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
        {["左侧栏管理构件树", "右键拖拽旋转场景", "右侧面板调整参数", "导出报表或 AI 辅助"].map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            {i > 0 && <ArrowRight className="w-3 h-3 text-slate-700" />}
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-[10px] font-mono shrink-0">{i + 1}</span>
              <span>{s}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="flex items-center gap-2 text-[10px] text-slate-600">
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">滚轮</kbd><span>缩放</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">中键</kbd><span>平移</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">右键</kbd><span>旋转</span>
        <span className="mx-1">·</span>
        <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">Ctrl+S</kbd><span>保存</span>
      </div>
    </div>
  );
}
