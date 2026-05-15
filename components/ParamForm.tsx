"use client";
import { useState } from "react";
import { Plus, X, Box, Square, Columns, Circle } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Component, Rebar, RebarGrade } from "@/lib/types";
import { autoFillRebar } from "@/lib/g101/autoRebar";
import { uid } from "@/lib/utils";

const CONCRETE_GRADES = ["C20","C25","C30","C35","C40","C45","C50","C55","C60","C65","C70","C75","C80"];
const SEISMIC = [
  { v: "NONE", n: "非抗震" }, { v: "ONE", n: "一级" }, { v: "TWO", n: "二级" },
  { v: "THREE", n: "三级" }, { v: "FOUR", n: "四级" },
];
const ENV = ["Ia","Ib","IIa","IIb","IIIa","IIIb"];
const GRADES: RebarGrade[] = ["HPB300","HRB400","HRB500"];
const ROLES_BY_TYPE: Record<string, string[]> = {
  BEAM: ["LONGITUDINAL","STIRRUP","ERECTION","BENT","SIDE","TIE","ADDITIONAL"],
  COLUMN: ["MAIN","STIRRUP","CONSTRUCT_COL","TIE"],
  SLAB: ["BOTTOM","TOP","DIST","NEG","CONSTRUCT","STOOL"],
  PILE: ["MAIN","SPIRAL","STIFFEN","SONIC"],
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
              {c.type === "BEAM" || c.type === "COLUMN" ? (
                <>
                  <Field label="b 宽"><input type="number" className="input-eng" value={c.geometry.b ?? 0} onChange={(e) => setGeom("b", +e.target.value)} /></Field>
                  <Field label="h 高"><input type="number" className="input-eng" value={c.geometry.h ?? 0} onChange={(e) => setGeom("h", +e.target.value)} /></Field>
                  <Field label="L 长"><input type="number" className="input-eng" value={c.geometry.L ?? 0} onChange={(e) => setGeom("L", +e.target.value)} /></Field>
                </>
              ) : c.type === "SLAB" ? (
                <>
                  <Field label="Lx"><input type="number" className="input-eng" value={c.geometry.Lx ?? 0} onChange={(e) => setGeom("Lx", +e.target.value)} /></Field>
                  <Field label="Ly"><input type="number" className="input-eng" value={c.geometry.Ly ?? 0} onChange={(e) => setGeom("Ly", +e.target.value)} /></Field>
                  <Field label="t 厚"><input type="number" className="input-eng" value={c.geometry.t ?? 0} onChange={(e) => setGeom("t", +e.target.value)} /></Field>
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
            {c.rebars.length === 0 && <div className="text-xs text-on-surface-variant py-2">暂无钢筋。</div>}
            {c.rebars.map((r) => (
              <div key={r.id} className="flex items-center gap-2 bg-surface-container-high/50 rounded-lg p-2 border border-outline-variant/10">
                <span className="text-xs text-on-surface-variant w-16 shrink-0">{roleName(r.role)}</span>
                <span className="text-xs text-primary font-mono w-14 shrink-0">{r.grade}-{r.diameter}</span>
                <input className="input-eng" value={r.label ?? ""} placeholder="如 2C25+2C22" onChange={(e) => updRebar(r.id, { label: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        {rebarTab === "central" && (
          <div className="space-y-2">
            <div className="text-xs text-on-surface-variant">
              集中标注通常包含梁编号、截面尺寸、箍筋、通长筋等信息，用于施工图表达。
            </div>
            <textarea
              className="input-eng w-full min-h-[80px] resize-y"
              value={c.centralLabel ?? ""}
              placeholder={`如：KL1(2) 300×600\nΦ8@100/200(2)\n2C25; 2C22`}
              onChange={(e) => patch({ centralLabel: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SectionShape({ c, setGeom }: { c: Component; setGeom: (k: keyof Component["geometry"], v: number) => void }) {
  const geom = c.geometry;
  const typeLabel = c.type === "BEAM" ? "矩形截面梁" : c.type === "COLUMN" ? "矩形截面柱" : c.type === "SLAB" ? "矩形板" : "圆形截面桩";

  return (
    <div className="space-y-3">
      <div className="text-label-code text-on-surface-variant">{typeLabel}</div>
      <div className="flex justify-center py-3 bg-surface-container-high/30 rounded-lg border border-outline-variant/10">
        {c.type === "PILE" ? (
          <div className="flex flex-col items-center gap-1">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="#8c909f" strokeWidth="2" />
              <text x="40" y="44" textAnchor="middle" fill="#d4e4fa" fontSize="12" fontFamily="JetBrains Mono">D={geom.D}</text>
            </svg>
          </div>
        ) : c.type === "SLAB" ? (
          <div className="flex flex-col items-center gap-1">
            <svg width="100" height="60" viewBox="0 0 100 60">
              <rect x="5" y="5" width="90" height="50" fill="none" stroke="#8c909f" strokeWidth="2" />
              <text x="50" y="35" textAnchor="middle" fill="#d4e4fa" fontSize="10" fontFamily="JetBrains Mono">{geom.Lx} × {geom.Ly}</text>
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <svg width="100" height="80" viewBox="0 0 100 80">
              <rect x="10" y="10" width="80" height="60" fill="none" stroke="#8c909f" strokeWidth="2" />
              <text x="50" y="42" textAnchor="middle" fill="#d4e4fa" fontSize="10" fontFamily="JetBrains Mono">{geom.b} × {geom.h}</text>
            </svg>
          </div>
        )}
      </div>
      {/* 截面尺寸输入 */}
      {c.type === "BEAM" || c.type === "COLUMN" ? (
        <div className="grid grid-cols-3 gap-2">
          <Field label="b 宽 (mm)"><input type="number" className="input-eng" value={geom.b ?? 0} onChange={(e) => setGeom("b", +e.target.value)} /></Field>
          <Field label="h 高 (mm)"><input type="number" className="input-eng" value={geom.h ?? 0} onChange={(e) => setGeom("h", +e.target.value)} /></Field>
          <Field label="L 长 (mm)"><input type="number" className="input-eng" value={geom.L ?? 0} onChange={(e) => setGeom("L", +e.target.value)} /></Field>
        </div>
      ) : c.type === "SLAB" ? (
        <div className="grid grid-cols-3 gap-2">
          <Field label="Lx (mm)"><input type="number" className="input-eng" value={geom.Lx ?? 0} onChange={(e) => setGeom("Lx", +e.target.value)} /></Field>
          <Field label="Ly (mm)"><input type="number" className="input-eng" value={geom.Ly ?? 0} onChange={(e) => setGeom("Ly", +e.target.value)} /></Field>
          <Field label="t 厚 (mm)"><input type="number" className="input-eng" value={geom.t ?? 0} onChange={(e) => setGeom("t", +e.target.value)} /></Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="D 直径 (mm)"><input type="number" className="input-eng" value={geom.D ?? 0} onChange={(e) => setGeom("D", +e.target.value)} /></Field>
          <Field label="L 桩长 (mm)"><input type="number" className="input-eng" value={geom.L ?? 0} onChange={(e) => setGeom("L", +e.target.value)} /></Field>
        </div>
      )}
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
    CONSTRUCT: "构造钢筋", STOOL: "马凳筋",
    CONSTRUCT_COL: "纵向构造筋", STIFFEN: "加劲箍", SONIC: "声测钢管",
  } as any)[r] ?? r;
}
