"use client";
import { useEffect, useState } from "react";
import {
  HardHat, ChevronRight, Calculator, Box, Sparkles, FileSpreadsheet,
  CheckCircle, Layers, Cpu, BookOpen,
  RectangleHorizontal, MoveUpRight, Triangle, Minus, Hexagon, Grid3X3,
  Columns, Square, Circle,
} from "lucide-react";

const STORAGE_KEY = "bimcore_landing_seen";

interface Props {
  open: boolean;
  onClose: () => void;
}

const FEATURES = [
  {
    icon: Calculator,
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    title: "工程量精确计算",
    desc: "混凝土体积、模板面积、钢筋用量按钢筋号分段统计，覆盖梁 / 柱 / 墙 / 板 / 桩基全构件类型。",
  },
  {
    icon: Box,
    color: "text-tertiary",
    bg: "bg-tertiary/10 border-tertiary/20",
    title: "3D 配筋可视化",
    desc: "基于 three.js 的实时 3D 场景，支持旋转 / 剖切参考面 / 钢筋混凝土分色显示，点击任意钢筋即时显示详细信息。",
  },
  {
    icon: Sparkles,
    color: "text-secondary",
    bg: "bg-secondary/10 border-secondary/20",
    title: "AI 多模型接入",
    desc: "内置 DeepSeek / 通义千问 / Kimi / OpenAI 快速配置，一键选择服务商，支持图纸图片 AI 识别自动建模。",
  },
  {
    icon: FileSpreadsheet,
    color: "text-[#4edea3]",
    bg: "bg-[#4edea3]/10 border-[#4edea3]/20",
    title: "多格式报表导出",
    desc: "一键导出 Excel 工程量表、Word 计算书、PNG / JPG 截图及 PDF，满足施工图交付需求。",
  },
];

const G101_PHASES = [
  {
    phase: "A",
    color: "bg-primary/20 text-primary border-primary/30",
    items: ["最小配筋率校验", "最大箍筋间距", "保护层厚度 (22G101-1 P54)", "锚固长度 La / LaE", "搭接长度 Ll / LlE", "箍筋最小直径与基础间距"],
  },
  {
    phase: "B",
    color: "bg-secondary/20 text-secondary border-secondary/30",
    items: ["箍筋加密区长度与间距", "梁柱节点连接构造", "板支座负筋延伸长度", "AT 型楼梯配筋规则"],
  },
  {
    phase: "C",
    color: "bg-tertiary/20 text-tertiary border-tertiary/30",
    items: ["洞口加强钢筋", "变截面构造处理", "特殊抗震节点（持续扩展）"],
  },
];

const COMPONENT_GROUPS = [
  {
    name: "上部结构",
    types: [
      { label: "梁 KL", icon: Box, color: "text-blue-400" },
      { label: "柱 KZ", icon: Columns, color: "text-emerald-400" },
      { label: "墙 Q", icon: RectangleHorizontal, color: "text-purple-400" },
      { label: "板 LB", icon: Square, color: "text-violet-400" },
      { label: "楼梯 LT", icon: MoveUpRight, color: "text-cyan-400" },
    ],
  },
  {
    name: "基础",
    types: [
      { label: "独基 DJ", icon: Triangle, color: "text-amber-400" },
      { label: "条基 TJ", icon: Minus, color: "text-orange-400" },
      { label: "承台 CT", icon: Hexagon, color: "text-red-400" },
      { label: "桩 ZJ", icon: Circle, color: "text-rose-400" },
      { label: "筏板 FB", icon: Grid3X3, color: "text-pink-400" },
    ],
  },
];

const TECH_STACK = [
  { name: "Next.js 14", desc: "App Router + SSR" },
  { name: "TypeScript", desc: "全量类型安全" },
  { name: "three.js", desc: "WebGL 3D 渲染" },
  { name: "Tailwind CSS", desc: "原子化样式" },
  { name: "Zustand", desc: "轻量全局状态" },
  { name: "22G101", desc: "平法规范引擎" },
];

export default function LandingOverlay({ open, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    if (open) {
      setAnimateOut(false);
      setVisible(true);
    }
  }, [open]);

  const handleClose = () => {
    setAnimateOut(true);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    setTimeout(() => {
      setVisible(false);
      onClose();
    }, 320);
  };

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-y-auto bg-[#020c18]/95 backdrop-blur-md
        transition-opacity duration-300 ${animateOut ? "opacity-0" : "opacity-100"}`}
      style={{ scrollbarGutter: "stable" }}
    >
      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">

        {/* ── Hero ── */}
        <section className="flex flex-col items-center text-center gap-6 pt-6">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <HardHat className="w-9 h-9 text-primary" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-5xl font-bold text-white tracking-tight leading-tight">
              BIM.<span className="text-primary">Core</span>{" "}
              <span className="text-on-surface-variant font-normal">Reinforced</span>
            </h1>
            <p className="text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              基于 22G101 平法的钢筋混凝土工程量计算与 3D 配筋可视化平台。
              <br />零后端依赖，全量浏览器运行，可一键部署到 Netlify。
            </p>
          </div>
          <p className="text-xs text-on-surface-variant/50 mt-4">无需注册 · 数据存于本地浏览器</p>
        </section>

        {/* ── Feature Cards ── */}
        <section className="space-y-6">
          <SectionHeader icon={Layers} title="核心功能" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`p-5 rounded-xl border bg-surface-container-low/60 backdrop-blur ${f.bg} flex gap-4`}
                >
                  <div className={`mt-0.5 shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${f.bg}`}>
                    <Icon className={`w-5 h-5 ${f.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-on-surface mb-1">{f.title}</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 支持的构件类型 ── */}
        <section className="space-y-6">
          <SectionHeader icon={Box} title="支持的构件类型" />
          <div className="space-y-4">
            {COMPONENT_GROUPS.map((group) => (
              <div key={group.name}>
                <p className="text-xs uppercase tracking-widest text-on-surface-variant/60 mb-3">{group.name}</p>
                <div className="grid grid-cols-5 gap-3">
                  {group.types.map((t) => {
                    const Icon = t.icon;
                    return (
                      <div
                        key={t.label}
                        className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl
                          bg-surface-container-low/60 border border-outline-variant/20"
                      >
                        <Icon className={`w-6 h-6 ${t.color}`} />
                        <span className="text-on-surface text-xs font-medium text-center leading-tight">{t.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 22G101 规范覆盖 ── */}
        <section className="space-y-6">
          <SectionHeader icon={BookOpen} title="22G101 规范覆盖" />
          <p className="text-sm text-on-surface-variant leading-relaxed">
            内置 22G101-1（现浇框架/剪力墙/梁/板）、22G101-2（板式楼梯）、22G101-3（独立/条形/筏形/桩基础）全套平法规则引擎，
            分阶段持续扩展覆盖深度。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {G101_PHASES.map((p) => (
              <div
                key={p.phase}
                className="p-4 rounded-xl bg-surface-container-low/60 border border-outline-variant/20 space-y-3"
              >
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${p.color}`}>
                  阶段 {p.phase}
                </div>
                <ul className="space-y-1.5">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-on-surface-variant">
                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-tertiary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── 技术栈 ── */}
        <section className="space-y-6">
          <SectionHeader icon={Cpu} title="技术栈" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TECH_STACK.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-3 px-4 py-3 rounded-xl
                  bg-surface-container-low/60 border border-outline-variant/20"
              >
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-on-surface">{t.name}</p>
                  <p className="text-xs text-on-surface-variant">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="flex flex-col items-center gap-4 pb-8">
          <div className="w-full h-px bg-outline-variant/20" />
          <p className="text-sm text-on-surface-variant">准备好了吗？</p>
          <button
            onClick={handleClose}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-on-primary
              font-semibold text-base hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20"
          >
            进入应用工作台
            <ChevronRight className="w-5 h-5" />
          </button>
          <p className="text-xs text-on-surface-variant/40">
            BIM.Core Reinforced · 基于 22G101 · MIT License
          </p>
        </section>

      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-on-surface">{title}</h2>
      <div className="flex-1 h-px bg-outline-variant/20" />
    </div>
  );
}
