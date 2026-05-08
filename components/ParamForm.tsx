"use client";
import { Plus, X } from "lucide-react";
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
  BEAM: ["TOP","BOTTOM","SIDE","STIRRUP"],
  COLUMN: ["MAIN","STIRRUP"],
  SLAB: ["TOP","BOTTOM","DIST","NEG"],
  PILE: ["MAIN","SPIRAL"],
};

export default function ParamForm() {
  const c = useStore((s) => {
    const id = s.selectedId;
    return s.components.find((x) => x.id === id);
  });
  const updateComponent = useStore((s) => s.updateComponent);

  if (!c) return <div className="p-4 text-eng-muted text-sm">请在左侧选择或新增构件。</div>;

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
    <div className="p-3 space-y-4 text-sm">
      <div>
        <div className="text-xs text-eng-muted mb-1">构件名称</div>
        <input className="input-eng" value={c.name} onChange={(e) => patch({ name: e.target.value })} />
      </div>

      <Section title="几何尺寸（mm）">
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
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Field label="X(mm)"><input type="number" className="input-eng" value={c.placement.x} onChange={(e) => patch({ placement: { ...c.placement, x: +e.target.value } })} /></Field>
          <Field label="Y(mm)"><input type="number" className="input-eng" value={c.placement.y} onChange={(e) => patch({ placement: { ...c.placement, y: +e.target.value } })} /></Field>
          <Field label="Z(mm)"><input type="number" className="input-eng" value={c.placement.z} onChange={(e) => patch({ placement: { ...c.placement, z: +e.target.value } })} /></Field>
        </div>
      </Section>

      <Section title="混凝土参数">
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
      </Section>

      <Section title="配筋" right={
        <div className="flex gap-1">
          <button className="btn-eng text-xs" onClick={autoFill}>按 22G101 自动补充</button>
          <button className="btn-primary text-xs" onClick={addRebar}><Plus className="w-3 h-3" />添加</button>
        </div>
      }>
        <div className="space-y-2">
          {c.rebars.map((r) => (
            <div key={r.id} className="panel p-2 space-y-1.5">
              <div className="grid grid-cols-4 gap-1.5">
                <select className="input-eng" value={r.role} onChange={(e) => updRebar(r.id, { role: e.target.value as any })}>
                  {(ROLES_BY_TYPE[c.type] ?? []).map((x) => <option key={x} value={x}>{roleName(x)}</option>)}
                </select>
                <select className="input-eng" value={r.grade} onChange={(e) => updRebar(r.id, { grade: e.target.value as RebarGrade })}>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <input type="number" className="input-eng" placeholder="直径" value={r.diameter} onChange={(e) => updRebar(r.id, { diameter: +e.target.value })} />
                <button className="btn-eng justify-center" onClick={() => delRebar(r.id)}><X className="w-3.5 h-3.5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Field label="根数">
                  <input type="number" className="input-eng" value={r.count ?? 0} onChange={(e) => updRebar(r.id, { count: +e.target.value })} />
                </Field>
                <Field label={r.role === "STIRRUP" ? "非加密间距(mm)" : "间距(mm)"}>
                  <input type="number" className="input-eng" value={r.spacing ?? 0} onChange={(e) => updRebar(r.id, { spacing: +e.target.value })} />
                </Field>
                <Field label="原位标注">
                  <input className="input-eng" value={r.label ?? ""} placeholder="如 2C25+2C22" onChange={(e) => updRebar(r.id, { label: e.target.value })} />
                </Field>
              </div>
              {r.role === "STIRRUP" && (
                <div className="grid grid-cols-2 gap-1.5">
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
                <div className="grid grid-cols-1 gap-1.5">
                  <Field label="支座外伸长度(mm)">
                    <input type="number" className="input-eng" value={r.extension ?? 0}
                      onChange={(e) => updRebar(r.id, { extension: +e.target.value || undefined })} />
                  </Field>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs uppercase tracking-wider text-eng-muted">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-eng-muted">{label}</span>
      {children}
    </label>
  );
}
function roleName(r: string) {
  return ({ TOP: "上部筋", BOTTOM: "下部筋", SIDE: "腰筋", STIRRUP: "箍筋", MAIN: "纵筋", DIST: "分布筋", SPIRAL: "螺旋箍", NEG: "支座负筋" } as any)[r] ?? r;
}
