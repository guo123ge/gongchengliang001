"use client";
import { useState } from "react";
import { Plus, X, Wand2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Component, Rebar, RebarGrade } from "@/lib/types";
import { autoFillRebar } from "@/lib/g101/autoRebar";
import { parseRebarNotation, notationSummary } from "@/lib/g101/parseNotation";
import { uid } from "@/lib/utils";

const CONCRETE_GRADES = ["C20","C25","C30","C35","C40","C45","C50","C55","C60","C65","C70","C75","C80"];
const SEISMIC = [
  { v: "NONE", n: "非抗震" }, { v: "ONE", n: "一级" }, { v: "TWO", n: "二级" },
  { v: "THREE", n: "三级" }, { v: "FOUR", n: "四级" },
];
const ENV = ["Ia","Ib","IIa","IIb","IIIa","IIIb"];
const GRADES: RebarGrade[] = ["HPB300","HRB400","HRB500"];
const ROLES_BY_TYPE: Record<string, string[]> = {
  BEAM:        ["LONGITUDINAL","STIRRUP","ERECTION","BENT","SIDE","TIE","ADDITIONAL"],
  COLUMN:      ["MAIN","STIRRUP","CONSTRUCT_COL","TIE"],
  SHEAR_WALL:  ["HORIZONTAL","VERTICAL","TIE"],
  SLAB:        ["BOTTOM","TOP","DIST","NEG","CONSTRUCT","STOOL"],
  STAIR:       ["LONGITUDINAL","DIST","CONSTRUCT"],
  FOUND:       ["BOT_X","BOT_Y","TOP_X","TOP_Y","TIE"],
  STRIP_FOUND: ["TRANSVERSE","LONGITUDINAL","CONSTRUCT"],
  PILE_CAP:    ["BOT_X","BOT_Y","TOP_X","TOP_Y","TIE"],
  PILE:        ["MAIN","SPIRAL","STIFFEN","SONIC"],
  RAFT:        ["BOT_X","BOT_Y","TOP_X","TOP_Y","TIE","CONSTRUCT"],
};

type BasicTab = "geometry" | "concrete" | "section";
type RebarTab = "rebar" | "inSitu" | "central";

export default function ParamForm() {
  const c = useStore((s) => {
    const id = s.selectedId;
    return s.components.find((x) => x.id === id);
  });
  const updateComponent = useStore((s) => s.updateComponent);

  const [basicTab, setBasicTab] = useState<BasicTab>("geometry");
  const [rebarTab, setRebarTab] = useState<RebarTab>("rebar");

  if (!c) return <div className="p-4 text-on-surface-variant text-sm">请在左侧选择或新增构件。</div>;

  const patch = (p: Partial<Component>) => updateComponent(c.id, p);

  const setGeom = (key: keyof Component["geometry"], v: number) =>
    patch({ geometry: { ...c.geometry, [key]: v } });

  const setConcrete = (p: Partial<Component["concrete"]>) =>
    patch({ concrete: { ...c.concrete, ...p } });

  const addRebar = () => {
    const role = (ROLES_BY_TYPE[c.type]?.[0] ?? "MAIN") as Rebar["role"];
    const r: Rebar = { id: uid("r"), role, grade: "HRB400", diameter: 12, count: 2, spacing: 200, label: "" };
    patch({ rebars: [...c.rebars, r] });
  };
  const updRebar = (id: string, p: Partial<Rebar>) =>
    patch({ rebars: c.rebars.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const delRebar = (id: string) => patch({ rebars: c.rebars.filter((r) => r.id !== id) });

  const autoFill = () => updateComponent(c.id, autoFillRebar({ ...c, rebars: [] }));

  return (
    <div className="p-4 space-y-4 text-sm">
      {/* Component Name */}
      <div className="property-card">
        <div className="property-card-header">构件名称</div>
        <input className="input-eng" value={c.name} onChange={(e) => patch({ name: e.target.value })} />
      </div>

      {/* 基本参数 */}
      <div className="property-card">
        <div className="property-card-header">基本参数</div>
        <select className="input-eng mb-3" value={basicTab} onChange={(e) => setBasicTab(e.target.value as BasicTab)}>
          <option value="geometry">结构尺寸</option>
          <option value="concrete">混凝土参数</option>
          <option value="section">截面形状</option>
        </select>

        {basicTab === "geometry" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(c.type === "BEAM" || c.type === "COLUMN" || c.type === "SHEAR_WALL" || c.type === "STRIP_FOUND") ? (
                <>
                  <Field label={c.type === "SHEAR_WALL" ? "b 厚度" : "b 宽"}><input type="number" className="input-eng" value={c.geometry.b ?? 0} onChange={(e) => setGeom("b", +e.target.value)} /></Field>
                  <Field label={c.type === "SHEAR_WALL" ? "h 层高" : c.type === "STRIP_FOUND" ? "h 高度" : "h 高"}><input type="number" className="input-eng" value={c.geometry.h ?? 0} onChange={(e) => setGeom("h", +e.target.value)} /></Field>
                  <Field label={c.type === "SHEAR_WALL" ? "L 墙长" : c.type === "STRIP_FOUND" ? "L 总长" : "L 长"}><input type="number" className="input-eng" value={c.geometry.L ?? 0} onChange={(e) => setGeom("L", +e.target.value)} /></Field>
                  {c.type === "BEAM" && (
                    <Field label="hc 支座柱宽(mm)">
                      <input type="number" className="input-eng" value={c.geometry.hc ?? 500} onChange={(e) => setGeom("hc", +e.target.value)} />
                    </Field>
                  )}
                </>
              ) : (c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT") ? (
                <>
                  <Field label="Lx (mm)"><input type="number" className="input-eng" value={c.geometry.Lx ?? 0} onChange={(e) => setGeom("Lx", +e.target.value)} /></Field>
                  <Field label="Ly (mm)"><input type="number" className="input-eng" value={c.geometry.Ly ?? 0} onChange={(e) => setGeom("Ly", +e.target.value)} /></Field>
                  <Field label={c.type === "SLAB" ? "t 厚" : "t 高度"}><input type="number" className="input-eng" value={c.geometry.t ?? 0} onChange={(e) => setGeom("t", +e.target.value)} /></Field>
                </>
              ) : c.type === "STAIR" ? (
                <>
                  <Field label="b 宽(mm)"><input type="number" className="input-eng" value={c.geometry.b ?? 0} onChange={(e) => setGeom("b", +e.target.value)} /></Field>
                  <Field label="L 水平长"><input type="number" className="input-eng" value={c.geometry.L ?? 0} onChange={(e) => setGeom("L", +e.target.value)} /></Field>
                  <Field label="h 踏步高"><input type="number" className="input-eng" value={c.geometry.h ?? 0} onChange={(e) => setGeom("h", +e.target.value)} /></Field>
                  <Field label="t 板厚"><input type="number" className="input-eng" value={c.geometry.t ?? 0} onChange={(e) => setGeom("t", +e.target.value)} /></Field>
                </>
              ) : (
                <>
                  <Field label="D 直径"><input type="number" className="input-eng" value={c.geometry.D ?? 0} onChange={(e) => setGeom("D", +e.target.value)} /></Field>
                  <Field label="L 桩长"><input type="number" className="input-eng" value={c.geometry.L ?? 0} onChange={(e) => setGeom("L", +e.target.value)} /></Field>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label="X(mm)"><input type="number" className="input-eng" value={c.placement.x} onChange={(e) => patch({ placement: { ...c.placement, x: +e.target.value } })} /></Field>
              <Field label="Y(mm)"><input type="number" className="input-eng" value={c.placement.y} onChange={(e) => patch({ placement: { ...c.placement, y: +e.target.value } })} /></Field>
              <Field label="Z(mm)"><input type="number" className="input-eng" value={c.placement.z} onChange={(e) => patch({ placement: { ...c.placement, z: +e.target.value } })} /></Field>
            </div>
          </div>
        )}

        {basicTab === "concrete" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="强度等级">
              <select className="input-eng" value={c.concrete.grade} onChange={(e) => setConcrete({ grade: e.target.value as any })}>
                {CONCRETE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="抗渗等级">
              <select className="input-eng" value={c.concrete.impermeability ?? ""} onChange={(e) => setConcrete({ impermeability: e.target.value })}>
                {["","P6","P8","P10","P12"].map((g) => <option key={g} value={g}>{g || "无"}</option>)}
              </select>
            </Field>
            <Field label="抗震等级">
              <select className="input-eng" value={c.concrete.seismic} onChange={(e) => setConcrete({ seismic: e.target.value as any })}>
                {SEISMIC.map((s) => <option key={s.v} value={s.v}>{s.n}</option>)}
              </select>
            </Field>
            <Field label="环境类别">
              <select className="input-eng" value={c.concrete.env} onChange={(e) => setConcrete({ env: e.target.value as any })}>
                {ENV.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field label="保护层 (mm)">
              <input type="number" className="input-eng" value={c.concrete.cover} onChange={(e) => setConcrete({ cover: +e.target.value })} />
            </Field>
          </div>
        )}

        {basicTab === "section" && <SectionShape c={c} setGeom={setGeom} />}
      </div>

      {/* 钢筋配置 */}
      <div className="property-card">
        <div className="flex items-center justify-between mb-3">
          <div className="property-card-header !mb-0 !pb-0 !border-0">钢筋配置</div>
          {rebarTab === "rebar" && (
            <div className="flex gap-2">
              <button className="btn-secondary text-xs" onClick={autoFill}>按 22G101 自动补充</button>
              <button className="btn-primary text-xs" onClick={addRebar}><Plus className="w-3 h-3" />添加</button>
            </div>
          )}
        </div>
        <select className="input-eng mb-3" value={rebarTab} onChange={(e) => setRebarTab(e.target.value as RebarTab)}>
          <option value="rebar">配筋</option>
          <option value="inSitu">原位标注</option>
          <option value="central">集中标注</option>
        </select>

        {rebarTab === "rebar" && (
          <div className="space-y-3">
            {c.rebars.length === 0 && <div className="text-xs text-on-surface-variant py-2">暂无钢筋，点击上方“添加”或“自动补充”。</div>}
            {c.rebars.map((r) => (
              <div key={r.id} className="bg-surface-container-high/50 rounded-lg p-3 space-y-2 border border-outline-variant/10">
                <div className="grid grid-cols-4 gap-2">
                  <select className="input-eng" value={r.role} onChange={(e) => updRebar(r.id, { role: e.target.value as any })}>
                    {(ROLES_BY_TYPE[c.type] ?? []).map((x) => <option key={x} value={x}>{roleName(x)}</option>)}
                  </select>
                  <select className="input-eng" value={r.grade} onChange={(e) => updRebar(r.id, { grade: e.target.value as RebarGrade })}>
                    {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <input type="number" className="input-eng" placeholder="直径" value={r.diameter} onChange={(e) => updRebar(r.id, { diameter: +e.target.value })} />
                  <button className="btn-secondary justify-center text-xs" onClick={() => delRebar(r.id)}><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="根数">
                    <input type="number" className="input-eng" value={r.count ?? 0} onChange={(e) => updRebar(r.id, { count: +e.target.value })} />
                  </Field>
                  <Field label={r.role === "STIRRUP" ? "非加密间距(mm)" : "间距(mm)"}>
                    <input type="number" className="input-eng" value={r.spacing ?? 0} onChange={(e) => updRebar(r.id, { spacing: +e.target.value })} />
                  </Field>
                </div>
                {r.role === "STIRRUP" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="加密区间距(mm)">
                      <input type="number" className="input-eng" value={r.densifySpacing ?? 0}
                        onChange={(e) => updRebar(r.id, { densifySpacing: +e.target.value || undefined })} />
                    </Field>
                    <Field label="加密区长度(mm)">
                      <input type="number" className="input-eng" value={r.densifyLength ?? 0}
                        onChange={(e) => updRebar(r.id, { densifyLength: +e.target.value || undefined })} />
                    </Field>
                  </div>
                )}
                {r.role === "NEG" && (
                  <div className="grid grid-cols-1 gap-2">
                    <Field label="支座外伸长度(mm)">
                      <input type="number" className="input-eng" value={r.extension ?? 0}
                        onChange={(e) => updRebar(r.id, { extension: +e.target.value || undefined })} />
                    </Field>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {rebarTab === "inSitu" && (
          <div className="space-y-2">
            <div className="text-xs text-on-surface-variant bg-surface-container-highest/40 rounded-lg px-3 py-2 border border-outline-variant/10">
              输入平法标注（如 <span className="font-mono text-primary">2Φ25</span>、<span className="font-mono text-primary">Φ8@100/200(2)</span>），
              点击 <Wand2 className="w-3 h-3 inline text-secondary" /> 自动解析并同步钢筋参数。
            </div>
            {c.rebars.length === 0 && <div className="text-xs text-on-surface-variant py-2">暂无钢筋。</div>}
            {c.rebars.map((r) => {
              const parsed = r.label ? parseRebarNotation(r.label) : null;
              return (
                <div key={r.id} className="bg-surface-container-high/50 rounded-lg p-2 border border-outline-variant/10 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant w-16 shrink-0">{roleName(r.role)}</span>
                    <span className="text-xs text-primary font-mono w-20 shrink-0">{r.grade}-Φ{r.diameter}</span>
                    <input
                      className="input-eng flex-1"
                      value={r.label ?? ""}
                      placeholder="如 2Φ25 或 Φ8@100/200(2)"
                      onChange={(e) => updRebar(r.id, { label: e.target.value })}
                    />
                    <button
                      className="shrink-0 p-1.5 rounded-md bg-secondary/10 hover:bg-secondary/20 text-secondary transition-colors"
                      title="解析并应用标注"
                      onClick={() => {
                        if (!r.label) return;
                        const p = parseRebarNotation(r.label);
                        if (!p.valid) return;
                        const patch: Partial<typeof r> = {};
                        if (p.grade) patch.grade = p.grade;
                        if (p.diameter) patch.diameter = p.diameter;
                        if (p.count) patch.count = p.count;
                        if (p.spacing) patch.spacing = p.spacing;
                        if (p.densifySpacing) patch.densifySpacing = p.densifySpacing;
                        updRebar(r.id, patch);
                      }}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {parsed?.valid && (
                    <div className="text-[10px] font-mono text-secondary/80 px-1">
                      解析：{notationSummary(parsed)}
                      {parsed.grade && ` · ${parsed.grade}`}
                      {parsed.diameter && ` · Φ${parsed.diameter}`}
                      {parsed.count && ` · ${parsed.count}根`}
                      {parsed.spacing && ` · @${parsed.spacing}`}
                      {parsed.densifySpacing && `/${parsed.densifySpacing}(加密)`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {rebarTab === "central" && (
          <div className="space-y-2">
            <div className="text-xs text-on-surface-variant">
              集中标注包含梁编号、截面尺寸、箍筋、通长筋等，输入后点击「解析并应用」自动同步到钢筋参数。
            </div>
            <textarea
              className="input-eng w-full min-h-[80px] resize-y font-mono"
              value={c.centralLabel ?? ""}
              placeholder={`如：KL1(2) 300×600\nΦ8@100/200(2)\n2C25; 2C22`}
              onChange={(e) => patch({ centralLabel: e.target.value })}
            />
            <button
              className="btn-secondary text-xs w-full flex items-center justify-center gap-1.5"
              onClick={() => {
                const text = c.centralLabel ?? "";
                if (!text.trim()) return;
                const lines = text.split(/[\n;,]/).map((l) => l.trim()).filter(Boolean);
                const updates: { idx: number; parsed: ReturnType<typeof parseRebarNotation> }[] = [];
                let rebarIdx = 0;
                for (const line of lines) {
                  const parsed = parseRebarNotation(line);
                  if (parsed.valid && rebarIdx < c.rebars.length) {
                    updates.push({ idx: rebarIdx, parsed });
                    rebarIdx++;
                  }
                }
                if (updates.length > 0) {
                  const newRebars = c.rebars.map((r, i) => {
                    const upd = updates.find((u) => u.idx === i);
                    if (!upd) return r;
                    const p = upd.parsed;
                    return {
                      ...r,
                      ...(p.grade ? { grade: p.grade } : {}),
                      ...(p.diameter ? { diameter: p.diameter } : {}),
                      ...(p.count ? { count: p.count } : {}),
                      ...(p.spacing ? { spacing: p.spacing } : {}),
                      ...(p.densifySpacing ? { densifySpacing: p.densifySpacing } : {}),
                      label: p.label,
                    };
                  });
                  patch({ rebars: newRebars });
                }
              }}
            >
              <Wand2 className="w-3.5 h-3.5" />解析并应用到钢筋参数
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  BEAM: "矩形截面框架梁", COLUMN: "矩形截面框架柱",
  SHEAR_WALL: "剪力墙", SLAB: "楼板", STAIR: "AT型楼梯",
  FOUND: "独立基础", STRIP_FOUND: "条形基础", PILE_CAP: "桩基承台",
  PILE: "圆形截面桩", RAFT: "筏板基础",
};

function SectionShape({ c, setGeom }: { c: Component; setGeom: (k: keyof Component["geometry"], v: number) => void }) {
  const geom = c.geometry;
  const isCircle = c.type === "PILE";
  const isPlanRect = c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT";

  return (
    <div className="space-y-3">
      <div className="text-label-code text-on-surface-variant">{TYPE_LABELS[c.type] ?? c.type}</div>
      <div className="flex justify-center py-3 bg-surface-container-high/30 rounded-lg border border-outline-variant/10">
        {isCircle ? (
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="35" fill="none" stroke="#8c909f" strokeWidth="2" />
            <text x="40" y="44" textAnchor="middle" fill="#d4e4fa" fontSize="11" fontFamily="JetBrains Mono">D={geom.D}</text>
          </svg>
        ) : isPlanRect ? (
          <svg width="110" height="70" viewBox="0 0 110 70">
            <rect x="5" y="5" width="100" height="60" fill="none" stroke="#8c909f" strokeWidth="2" />
            <text x="55" y="38" textAnchor="middle" fill="#d4e4fa" fontSize="10" fontFamily="JetBrains Mono">{geom.Lx} × {geom.Ly}</text>
            <text x="55" y="52" textAnchor="middle" fill="#8c909f" fontSize="9" fontFamily="JetBrains Mono">t={geom.t}</text>
          </svg>
        ) : c.type === "STAIR" ? (
          <svg width="110" height="70" viewBox="0 0 110 70">
            <polyline points="10,60 10,45 35,45 35,30 60,30 60,15 85,15 85,10 100,10" fill="none" stroke="#8c909f" strokeWidth="2" />
            <text x="55" y="68" textAnchor="middle" fill="#d4e4fa" fontSize="9" fontFamily="JetBrains Mono">b={geom.b} L={geom.L}</text>
          </svg>
        ) : (
          <svg width="100" height="80" viewBox="0 0 100 80">
            <rect x="10" y="10" width="80" height="60" fill="none" stroke="#8c909f" strokeWidth="2" />
            <text x="50" y="42" textAnchor="middle" fill="#d4e4fa" fontSize="10" fontFamily="JetBrains Mono">{geom.b} × {geom.h}</text>
          </svg>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-label-code text-on-surface-variant">{label}</span>
      {children}
    </label>
  );
}
function roleName(r: string) {
  return ({
    TOP: "面筋", BOTTOM: "底筋", SIDE: "腰筋", STIRRUP: "箍筋", MAIN: "纵筋", DIST: "分布筋",
    SPIRAL: "螺旋箍", NEG: "支座负筋",
    LONGITUDINAL: "纵向受力筋", ERECTION: "架立筋", BENT: "弯起筋", TIE: "拉筋", ADDITIONAL: "附加筋",
    CONSTRUCT: "构造配筋", STOOL: "马凳筋",
    CONSTRUCT_COL: "纵向构造筋", STIFFEN: "加劲箍", SONIC: "声测管",
    HORIZONTAL: "水平分布筋", VERTICAL: "竖向分布筋", TRANSVERSE: "横向受力筋",
    BOT_X: "底板X向筋", BOT_Y: "底板Y向筋",
    TOP_X: "顶板X向筋", TOP_Y: "顶板Y向筋",
  } as any)[r] ?? r;
}
