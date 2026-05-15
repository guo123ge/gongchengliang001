"use client";
import { create } from "zustand";
import type { Component, ComponentType, ValidationItem } from "./types";
import { uid } from "./utils";
import { autoFillRebar } from "./g101/autoRebar";
import { validateAll } from "./g101/rules";
import type { DxfBBox, DxfEndpoint } from "./dxf/parser";
import {
  saveProject,
  loadProject,
  listProjects,
  deleteProject,
  genProjectId,
  isIndexedDBAvailable,
  type ProjectRecord,
} from "./db";

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
  projectId: string | null;       // IndexedDB 项目 ID
  projectList: ProjectRecord[];   // 项目列表（轻量，无 components）
  saveStatus: "saved" | "saving" | "unsaved";
  components: Component[];
  selectedId: string | null;
  validations: ValidationItem[];
  clip: ClipPlane;
  showRebar: boolean;
  showConcrete: boolean;
  showDimensions: boolean;
  showCollisions: boolean;
  toggleDimensions: () => void;
  toggleCollisions: () => void;
  aiOpen: boolean;
  leftPanelOpen: boolean;
  bottomPanelOpen: boolean;
  toggleLeftPanel: () => void;
  toggleBottomPanel: () => void;
  cameraView: "front" | "top" | "side" | "nw" | "sw" | "ne" | "se" | "tour" | null;
  setCameraView: (v: State["cameraView"]) => void;
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
  // === 新增持久化方法 ===
  saveToDB: () => Promise<void>;
  loadFromDB: (id: string) => Promise<boolean>;
  listFromDB: () => Promise<void>;
  deleteFromDB: (id: string) => Promise<void>;
  newProject: () => void;
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
    centralLabel: "",
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
  projectId: null,
  projectList: [],
  saveStatus: "saved",
  components: [],
  selectedId: null,
  validations: [],
  clip: { axis: "x", position: 0, enabled: false },
  showRebar: true,
  showConcrete: true,
  showDimensions: true,
  showCollisions: true,
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  toggleCollisions: () => set((s) => ({ showCollisions: !s.showCollisions })),
  aiOpen: false,
  leftPanelOpen: true,
  bottomPanelOpen: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleBottomPanel: () => set((s) => ({ bottomPanelOpen: !s.bottomPanelOpen })),
  cameraView: null,
  setCameraView: (v) => set({ cameraView: v }),
  gizmoMode: "translate",
  setGizmoMode: (m) => set({ gizmoMode: m }),
  setProjectName: (n) => set({ projectName: n, saveStatus: "unsaved" }),
  addComponent: (t) => {
    const c = defaultComponent(t);
    set((s) => ({ components: [...s.components, c], selectedId: c.id, saveStatus: "unsaved" }));
    get().revalidate();
    return c.id;
  },
  removeComponent: (id) => {
    set((s) => ({
      components: s.components.filter((ci) => ci.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      saveStatus: "unsaved",
    }));
  },
  updateComponent: (id, patch) => {
    set((s) => ({
      components: s.components.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      saveStatus: "unsaved",
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

  // === 持久化方法 ===
  saveToDB: async () => {
    const s = get();
    set({ saveStatus: "saving" });
    try {
      const record: ProjectRecord = {
        id: s.projectId ?? genProjectId(),
        name: s.projectName,
        components: s.components,
        blueprint: s.blueprint,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        componentCount: s.components.length,
      };
      await saveProject(record);
      set({ projectId: record.id, saveStatus: "saved" });
      // 刷新列表
      get().listFromDB();
    } catch {
      set({ saveStatus: "unsaved" });
      console.error("IndexedDB 保存失败");
    }
  },

  loadFromDB: async (id) => {
    try {
      const record = await loadProject(id);
      if (!record) return false;
      set({
        projectId: record.id,
        projectName: record.name,
        components: record.components,
        blueprint: record.blueprint,
        selectedId: null,
        saveStatus: "saved",
      });
      get().revalidate();
      return true;
    } catch {
      console.error("IndexedDB 加载失败");
      return false;
    }
  },

  listFromDB: async () => {
    try {
      const list = await listProjects();
      set({ projectList: list });
    } catch {
      // 静默失败
    }
  },

  deleteFromDB: async (id) => {
    try {
      await deleteProject(id);
      set((s) => {
        const list = s.projectList.filter((p) => p.id !== id);
        // 如果删除的是当前项目，重置
        if (s.projectId === id) {
          return { projectList: list, projectId: null, projectName: "未命名项目", components: [], blueprint: null, selectedId: null };
        }
        return { projectList: list };
      });
    } catch {
      console.error("IndexedDB 删除失败");
    }
  },

  newProject: () => {
    set({
      projectId: null,
      projectName: "未命名项目",
      components: [],
      blueprint: null,
      selectedId: null,
      saveStatus: "saved",
      validations: [],
    });
  },
}));
