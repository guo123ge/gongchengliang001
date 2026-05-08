"use client";
import { create } from "zustand";
import type { Component, ComponentType, ValidationItem } from "./types";
import { uid } from "./utils";
import { autoFillRebar } from "./g101/autoRebar";
import { validateAll } from "./g101/rules";
import type { DxfBBox, DxfEndpoint } from "./dxf/parser";

interface ClipPlane {
  axis: "x" | "y" | "z";
  position: number; // mm
  enabled: boolean;
}

export interface Blueprint {
  imageUrl: string;     // PNG dataUrl
  widthMm: number;
  heightMm: number;
  offsetX: number;      // mm
  offsetZ: number;      // mm
  rotation: number;     // 度（世界 Y 轴）
  scale: number;
  visible: boolean;
  bbox: DxfBBox;        // DXF 原始 bbox（用于端点变换）
  endpoints: DxfEndpoint[]; // DXF 局部端点
  layers: string[];     // 全部图层名
  activeLayers: string[]; // 当前显示的图层
  snapEnabled: boolean; // 端点吸附开关
  locked: boolean;      // 是否禁止鼠标拖动底图
}

interface State {
  projectName: string;
  components: Component[];
  selectedId: string | null;
  validations: ValidationItem[];
  clip: ClipPlane;
  showRebar: boolean;
  showConcrete: boolean;
  aiOpen: boolean;
  gizmoMode: "translate" | "rotate";
  setGizmoMode: (m: "translate" | "rotate") => void;
  setProjectName: (n: string) => void;
  addComponent: (t: ComponentType) => string;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, patch: Partial<Component>) => void;
  select: (id: string | null) => void;
  revalidate: () => void;
  setClip: (p: Partial<ClipPlane>) => void;
  toggleRebar: () => void;
  toggleConcrete: () => void;
  setAiOpen: (b: boolean) => void;
  loadAll: (cs: Component[]) => void;
  blueprint: Blueprint | null;
  setBlueprint: (b: Blueprint | null) => void;
  updateBlueprint: (p: Partial<Blueprint>) => void;
}

function defaultComponent(type: ComponentType): Component {
  const base = {
    id: uid(type.toLowerCase()),
    type,
    name: type === "BEAM" ? "KL1" : type === "COLUMN" ? "KZ1" : type === "SLAB" ? "B1" : "ZJ1",
    concrete: {
      grade: "C30" as const,
      seismic: "THREE" as const,
      cover: 25,
      env: "IIa" as const,
      impermeability: "P6",
    },
    rebars: [],
    placement: { x: 0, y: 0, z: 0, rot: 0 },
  };
  let geometry: Component["geometry"];
  switch (type) {
    case "BEAM": geometry = { b: 300, h: 600, L: 6000 }; break;
    case "COLUMN": geometry = { b: 500, h: 500, L: 3600 }; break;
    case "SLAB": geometry = { Lx: 6000, Ly: 4000, t: 120 }; break;
    case "PILE": geometry = { D: 800, L: 12000 }; break;
  }
  return autoFillRebar({ ...base, geometry } as Component);
}

export const useStore = create<State>((set, get) => ({
  projectName: "未命名项目",
  components: [],
  selectedId: null,
  validations: [],
  clip: { axis: "x", position: 0, enabled: false },
  showRebar: true,
  showConcrete: true,
  aiOpen: false,
  gizmoMode: "translate",
  setGizmoMode: (m) => set({ gizmoMode: m }),
  setProjectName: (n) => set({ projectName: n }),
  addComponent: (t) => {
    const c = defaultComponent(t);
    set((s) => ({ components: [...s.components, c], selectedId: c.id }));
    get().revalidate();
    return c.id;
  },
  removeComponent: (id) =>
    set((s) => ({
      components: s.components.filter((c) => c.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  updateComponent: (id, patch) => {
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    get().revalidate();
  },
  select: (id) => set({ selectedId: id }),
  revalidate: () => set({ validations: validateAll(get().components) }),
  setClip: (p) => set((s) => ({ clip: { ...s.clip, ...p } })),
  toggleRebar: () => set((s) => ({ showRebar: !s.showRebar })),
  toggleConcrete: () => set((s) => ({ showConcrete: !s.showConcrete })),
  setAiOpen: (b) => set({ aiOpen: b }),
  loadAll: (cs) => {
    set({ components: cs });
    get().revalidate();
  },
  blueprint: null,
  setBlueprint: (b) => set({ blueprint: b }),
  updateBlueprint: (p) => set((s) => ({ blueprint: s.blueprint ? { ...s.blueprint, ...p } : null })),
}));
