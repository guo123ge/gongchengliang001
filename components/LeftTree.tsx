"use client";
import { Trash2, Box, Square, Columns, Circle, PanelLeftOpen, PanelLeft, Layers,
  RectangleHorizontal, MoveUpRight, Triangle, Minus, Hexagon, Grid3X3 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { ComponentType } from "@/lib/types";
import { cn } from "@/lib/utils";

type TypeDef = { t: ComponentType; code: string; label: string; desc: string; icon: any; color: string };

const TYPE_GROUPS: { name: string; types: TypeDef[] }[] = [
  {
    name: "上部结构",
    types: [
      { t: "BEAM",       code: "KL",  label: "梁",     desc: "框架梁",   icon: Box,                  color: "text-blue-400" },
      { t: "COLUMN",     code: "KZ",  label: "柱",     desc: "框架柱",   icon: Columns,              color: "text-emerald-400" },
      { t: "SHEAR_WALL", code: "Q",   label: "墙",     desc: "剪力墙",   icon: RectangleHorizontal,  color: "text-purple-400" },
      { t: "SLAB",       code: "LB",  label: "板",     desc: "楼板",     icon: Square,               color: "text-violet-400" },
      { t: "STAIR",      code: "LT",  label: "楼梯",   desc: "AT型楼梯", icon: MoveUpRight,          color: "text-cyan-400" },
    ],
  },
  {
    name: "基础",
    types: [
      { t: "FOUND",       code: "DJ",  label: "独基",   desc: "独立基础",   icon: Triangle,    color: "text-amber-400" },
      { t: "STRIP_FOUND", code: "TJ",  label: "条基",   desc: "条形基础",   icon: Minus,       color: "text-orange-400" },
      { t: "PILE_CAP",    code: "CT",  label: "承台",   desc: "桩基承台",   icon: Hexagon,     color: "text-red-400" },
      { t: "PILE",        code: "ZJ",  label: "桩",     desc: "灌注桩",     icon: Circle,      color: "text-rose-400" },
      { t: "RAFT",        code: "FB",  label: "筏板",   desc: "筏板基础",   icon: Grid3X3,     color: "text-pink-400" },
    ],
  },
];

const ALL_TYPES = TYPE_GROUPS.flatMap((g) => g.types);

interface Props {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function LeftTree({ collapsed, onToggle }: Props) {
  const components = useStore((s) => s.components);
  const selectedId = useStore((s) => s.selectedId);
  const addComponent = useStore((s) => s.addComponent);
  const removeComponent = useStore((s) => s.removeComponent);
  const select = useStore((s) => s.select);

  if (collapsed) {
    return (
      <aside className="w-full h-full flex flex-col items-center py-panel-padding gap-1 bg-surface-container-low">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="展开">
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <div className="w-full h-px bg-outline-variant/20 my-1" />
        {ALL_TYPES.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.t} className={cn("p-2 rounded-lg hover:bg-surface-container-high transition-colors", t.color)} title={`${t.code} ${t.desc}`} onClick={() => addComponent(t.t)}>
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="w-full h-full flex flex-col bg-surface-container-low">
      {/* Header */}
      <div className="px-panel-padding py-3 border-b border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">工程结构</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">构件管理</p>
          </div>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors" title="收起">
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Component Type Groups Quick Add */}
      <div className="px-panel-padding py-2 space-y-3">
        {TYPE_GROUPS.map((group) => (
          <div key={group.name}>
            <div className="text-[10px] uppercase tracking-widest text-on-surface-variant/50 px-1 mb-1.5">{group.name}</div>
            <div className="grid grid-cols-5 gap-1">
              {group.types.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.t}
                    title={`新增 ${t.desc}（${t.code}）`}
                    className={cn(
                      "flex flex-col items-center gap-0.5 py-2 rounded-lg bg-surface-container-high/50 hover:bg-surface-container-high transition-colors border border-outline-variant/20 group",
                    )}
                    onClick={() => addComponent(t.t)}
                  >
                    <Icon className={cn("w-3.5 h-3.5", t.color)} />
                    <span className="text-[9px] text-on-surface-variant group-hover:text-on-surface font-mono leading-none">{t.code}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto px-panel-padding py-2">
        {TYPE_GROUPS.map((group) => {
          const items = components.filter((c) => group.types.some((t) => t.t === c.type));
          if (items.length === 0) return null;
          return (
            <div key={group.name} className="mt-3">
              <div className="flex items-center gap-1 text-[10px] text-on-surface-variant px-1 mb-1.5 uppercase tracking-widest">
                <Layers className="w-3 h-3" />
                {group.name}
                <span className="quantity-chip">{items.length}</span>
              </div>
              {group.types.map((typeDef) => {
                const typeItems = components.filter((c) => c.type === typeDef.t);
                if (typeItems.length === 0) return null;
                const Icon = typeDef.icon;
                return (
                  <div key={typeDef.t} className="mb-2">
                    <div className={cn("flex items-center gap-1.5 text-[10px] px-1 mb-1 font-mono", typeDef.color)}>
                      <Icon className="w-3 h-3" />
                      {typeDef.code} {typeDef.desc}
                    </div>
                    <div className="relative pl-3 border-l border-outline-variant/20">
                      {typeItems.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => select(c.id)}
                          className={cn(
                            "group flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer rounded transition-colors",
                            selectedId === c.id
                              ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                              : "hover:bg-surface-container-high/50 text-on-surface border-l-2 border-l-transparent",
                          )}
                        >
                          <span className="flex-1 truncate font-mono text-xs">{c.name}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-error hover:text-error-container transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`删除 ${c.name}？`)) removeComponent(c.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {components.length === 0 && (
          <div className="text-xs text-on-surface-variant text-center py-6">点击上方图标添加构件</div>
        )}
      </div>
    </aside>
  );
}
