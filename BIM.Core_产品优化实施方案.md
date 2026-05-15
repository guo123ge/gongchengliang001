# BIM.Core (Rebar Quant) 产品优化实施方案

> 钢筋混凝土工程量计算与 3D 可视化应用  
> 版本: 0.1.0 · 基于 Next.js 14 + TypeScript + Three.js + Zustand  
> 方案生成日期: 2026-05-14

---

## 目录

1. [修复保存/加载断裂](#1-修复保存加载断裂)
2. [IndexedDB 本地持久化](#2-indexeddb-本地持久化)
3. [项目管理与自动保存](#3-项目管理与自动保存)
4. [冷启动体验优化](#4-冷启动体验优化)
5. [AI Key 安全存储方案](#5-ai-key-安全存储方案)
6. [AI 流式输出（SSE）](#6-ai-流式输出sse)
7. [PDF 图纸直接导入](#7-pdf-图纸直接导入)
8. [InstancedMesh 大模型性能优化](#8-instancedmesh-大模型性能优化)
9. [实施路线图](#9-实施路线图)

---

## 1. 修复保存/加载断裂

### 现状问题

`TopBar.tsx` 中的 `saveProject()` 和 `loadProject()` 向 `/api/components` 发 POST/GET 请求，但 **代码仓库中没有此 API Route 的实现**。点击"保存"/"加载"会直接报错。

```typescript
// 当前代码 (TopBar.tsx): 调用不存在的 API
const saveProject = async () => {
  await Promise.all(
    components.map((c) =>
      fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      }),
    ),
  );
};
```

### 解决方案：IndexedDB 零后端方案

放弃对不存在 API 的依赖，改用 **浏览器 IndexedDB** 做本地持久化，保持项目"零后端数据库依赖"的核心设计理念。

### 修改文件

| 文件 | 改动 |
|------|------|
| `lib/store.ts` | 新增 IndexedDB 持久化层，增加 `projectList`/`currentProjectId` 状态，增加 `saveToDB`/`loadFromDB` 方法 |
| `components/TopBar.tsx` | 保存/加载改为调 IndexedDB，保存成功后弹出 toast |

---

## 2. IndexedDB 本地持久化

### 架构设计

```
┌──────────────────────┐
│   Zustand Store      │  ← 运行时状态（内存）
│   components[]       │
│   projectName        │
│   ...                │
└──────┬───────────────┘
       │ saveToDB() / loadFromDB()
       ▼
┌──────────────────────┐
│   IndexedDB Layer    │  ← 持久化层
│   db: rebar-quant    │
│   ├─ projectsStore   │  { key: projectId, name, components[], updatedAt }
│   └─ currentProject  │  当前项目最后打开的 ID
└──────────────────────┘
```

### 数据模型

```typescript
interface ProjectRecord {
  id: string;           // uuid
  name: string;         // 项目名称
  components: Component[];
  blueprint: Blueprint | null;
  createdAt: number;    // timestamp
  updatedAt: number;    // timestamp
  version: number;      // 版本号（用于未来版本控制）
}
```

### 自动保存机制

```typescript
// store.ts 中增加
const AUTO_SAVE_DELAY = 3000; // 3秒防抖

useEffect(() => {
  // 订阅状态变化，debounce 后自动保存
  const timer = setTimeout(() => {
    if (components.length > 0) {
      saveCurrentProject(projectName, components, blueprint);
    }
  }, AUTO_SAVE_DELAY);
  
  return () => clearTimeout(timer);
}, [components, projectName, blueprint]);
```

### 关键代码

```typescript
// lib/db.ts — IndexedDB 封装

const DB_NAME = "rebar-quant";
const DB_VERSION = 1;
const STORE_NAME = "projects";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectRecord(record: ProjectRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProjectRecord(id: string): Promise<ProjectRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listProjectRecords(): Promise<ProjectRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const list = (req.result ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProjectRecord(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

---

## 3. 项目管理与自动保存

### 功能详情

需要增加一个"项目选择/管理"界面，支持：

- **新建项目**：显示空白场景，输入项目名称
- **打开项目**：列出所有 IndexedDB 中保存的项目（名称、构件数量、最后修改时间）
- **重命名项目**：在项目列表中直接重命名
- **删除项目**：带确认对话框
- **复制项目**：快速复制现有项目作为模板
- **自动保存**：状态变化后 3 秒自动保存（有视觉反馈）

### UI 布局

新增一个**项目管理对话框**（类似 SettingsDialog），覆盖在场景上方：

```
┌─────────────────────────────────────┐
│  项目管理                   [×]     │
├─────────────────────────────────────┤
│  ┌───────────────────────────────┐  │
│  │ [+ 新建项目]                  │  │
│  ├───────────────────────────────┤  │
│  │ 项目名称       | 构件 | 修改时间 │  │
│  │───────────────|──────|────────│  │
│  │ 某住宅楼      |  12  | 今天  │  │
│  │ 商业中心B区   |   8  | 昨天  │  │
│  │ 桥梁方案一    |  24  | 3天前  │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 自动保存的视觉反馈

在 TopBar 的项目名称输入框旁边增加一个保存状态指示器：

```
[项目名称] ● 已保存    ← 绿色圆点
[项目名称] ○ 保存中... ← 旋转动画
[项目名称] ○ 未保存    ← 灰色圆点
```

### 快捷键支持

- `Ctrl+S` — 手动保存
- `Ctrl+N` — 新建项目
- `Ctrl+O` — 打开项目管理器

### 修改文件

| 文件 | 改动 |
|------|------|
| `lib/db.ts` | **新建** IndexedDB 封装层 |
| `lib/store.ts` | 增加项目列表、当前项目 ID、自动保存逻辑 |
| `components/TopBar.tsx` | 增加项目名称切换、保存状态指示、快捷键 |
| `components/ProjectManager.tsx` | **新建** 项目管理对话框 |
| `app/page.tsx` | 挂载快捷键监听 |

---

## 4. 冷启动体验优化

### 现状问题

```typescript
// page.tsx 当前代码
useEffect(() => {
  if (components.length === 0) {
    addComponent("COLUMN");
    addComponent("BEAM");
  }
}, []);
```

用户第一次打开看到两根莫名其妙的构件，没有任何引导。

### 解决方案

**移除自动添加**，改为欢迎空状态：

1. **删除** `page.tsx` 中的 `useEffect` 自动添加逻辑
2. **增加** 页面级别的欢迎组件 `WelcomeEmpty.tsx`
3. **显示位置**：3D 场景区域居中显示，覆盖在场景之上
4. **欢迎内容**：

```
┌─────────────────────────────────────────┐
│     🏗️ 欢迎使用 BIM.Core               │
│       Reinforced Concrete Quant         │
│                                         │
│     [➕ 新建梁]  [➕ 新建柱]            │
│     [➕ 新建板]  [➕ 新建桩基]          │
│                                         │
│     或从菜单栏打开已有项目 / 导入图纸    │
│                                         │
│     ────────── 快速教程 ──────────      │
│     • 左侧栏管理构件树                   │
│     • 右键场景旋转/平移/缩放             │
│     • 右侧面板调整参数                   │
│     • 顶部工具栏导入图纸、导出报表        │
└─────────────────────────────────────────┘
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `app/page.tsx` | 移除自动添加 useEffect，增加空状态渲染 |
| `components/WelcomeEmpty.tsx` | **新建** 欢迎空状态组件 |

---

## 5. AI Key 安全存储方案

### 现状问题

```typescript
// SettingsDialog.tsx
localStorage.setItem(KEY, JSON.stringify(cfg));
// KEY = "rebar-quant.aiConfig"
// cfg 包含 { baseUrl, model, apiKey, temperature }
```

API Key **明文存储在 localStorage**，同源所有脚本均可读取。部署到生产环境后存在严重安全隐患。

### 方案选择对比

| 方案 | 安全性 | 实现复杂度 | 用户体验 |
|------|--------|-----------|---------|
| **sessionStorage** | ⭐⭐⭐ | 低 | 每次关闭页面需重新输入 |
| **Web Crypto 加密存储** | ⭐⭐⭐⭐ | 中 | 需输入密码/生物识别 |
| **后端代理加密** | ⭐⭐⭐⭐⭐ | 高 | 无感（需要后端支持） |
| **环境变量 + 服务端配置** | ⭐⭐⭐⭐⭐ | 中 | 需要部署时配置 |

### 推荐方案：sessionStorage + 后端代理

**短期方案（立即实施）**：改用 `sessionStorage`，关闭标签页即清除。同时增加 UI 提示。

**中期方案**：改造 `/api/ai/chat` 使其支持从服务端环境变量读取默认配置，用户 Key 在客户端不持久化：

```typescript
// route.ts 增加服务端默认配置支持
const SERVER_BASE_URL = process.env.AI_BASE_URL;
const SERVER_API_KEY = process.env.AI_API_KEY;
const SERVER_MODEL = process.env.AI_MODEL;

export async function POST(req: NextRequest) {
  const body = await req.json();
  // 优先使用请求体中的配置（客户端覆盖）
  // 其次使用服务端环境变量（部署者配置）
  const baseUrl = body.baseUrl || SERVER_BASE_URL;
  const apiKey = body.apiKey || SERVER_API_KEY;
  const model = body.model || SERVER_MODEL;
  // ...
}
```

**安全边界说明**：
- API Key 仅在**当前浏览器会话**内存中存在（sessionStorage）
- 请求经 `/api/ai/chat` 以服务器身份代发，浏览器端无需跨域
- 生产部署时，管理员可在 `.env.local` 中预配默认 Key，用户无需输入

### 修改文件

| 文件 | 改动 |
|------|------|
| `components/SettingsDialog.tsx` | localStorage → sessionStorage + 安全提示 |
| `app/api/ai/chat/route.ts` | 增加服务端环境变量回退逻辑 |

---

## 6. AI 流式输出（SSE）

### 现状问题

```typescript
// AIPanel.tsx
const r = await fetch("/api/ai/chat", { ... });
const data = await r.json(); // 等完整响应才显示
setMsgs((m) => [...m, { role: "assistant", content }]);
```

等待完整响应才显示，大模型回答可能需要 5-20 秒，用户感受差。

### 解决方案：Server-Sent Events（SSE）流式输出

#### 后端改造（route.ts）

```typescript
// /api/ai/chat 支持流式
export async function POST(req: NextRequest) {
  const body = await req.json();
  // ... 配置获取 ...
  
  const payload = {
    model,
    temperature: temperature ?? 0.3,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    stream: true, // 开启流式
  };

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  // 转发 SSE 流到浏览器
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 保留未完成行

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content ?? "";
              if (content) controller.enqueue(encoder.encode(content));
            } catch {}
          }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache",
    },
  });
}
```

#### 前端改造（AIPanel.tsx）

```typescript
const [streamingContent, setStreamingContent] = useState("");

const send = async () => {
  const text = input.trim();
  if (!text) return;
  
  const userMsg: Msg = { role: "user", content: text };
  const context = `当前模型 JSON：\n${JSON.stringify(components, null, 2)}`;
  const next = [...msgs, userMsg];
  setMsgs(next);
  setInput("");
  setBusy(true);
  setStreamingContent("");

  try {
    const cfg = loadAIConfig();
    const r = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...next.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: context }],
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        stream: true,
      }),
    });

    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;
      setStreamingContent(full);
    }

    setMsgs((m) => [...m, { role: "assistant", content: full }]);
    setStreamingContent("");
    applyOps(full);
  } catch (e: any) {
    setMsgs((m) => [...m, { role: "assistant", content: `请求失败：${e.message}` }]);
  } finally {
    setBusy(false);
  }
};
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `app/api/ai/chat/route.ts` | 支持 stream=true 返回 SSE 流 |
| `components/AIPanel.tsx` | 前端流式读取 + 逐字显示 |

---

## 7. PDF 图纸直接导入

### 现状问题

```typescript
// DrawingImport.tsx
} else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
  setMode("pdf");
  setUrl(URL.createObjectURL(f));
  // 仅显示 iframe 预览，没有实质导入
}
// 底部提示：PDF 暂不支持直接导入，请先转换为图片
```

PDF 导入当前只显示了预览，不能发送到 3D 场景。

### 解决方案：集成 pdfjs-dist

使用 Mozilla 的 `pdfjs-dist` 库将 PDF 逐页渲染为 Canvas → 图片数据 URL，然后作为底图发送到 3D 场景。

#### 安装依赖

```bash
npm install pdfjs-dist
npm install --save-dev @types/pdfjs-dist
```

#### 核心实现

```typescript
// lib/pdf/renderer.ts — PDF 渲染服务
import * as pdfjsLib from "pdfjs-dist";

// 重要: pdfjs-dist worker 需要 CDN 或本地配置
pdfjsLib.GlobalWorkerOptions.workerSrc = 
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

export interface PdfRenderResult {
  dataUrl: string;
  widthMm: number;
  heightMm: number;
  pageCount: number;
}

export async function renderPdfToImage(
  file: File,
  pageIndex: number = 0,
  scale: number = 2, // 2x 渲染质量
): Promise<PdfRenderResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  
  await page.render({ canvasContext: ctx, viewport }).promise;
  
  // 默认 1px = 1mm（用户在场景中可调整缩放）
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: viewport.width,
    heightMm: viewport.height,
    pageCount: pdf.numPages,
  };
}
```

#### UI 改动

PDF 导入对话框增加：

1. **页面选择器**：多页 PDF 时可选导入哪一页
2. **发送到场景**按钮：与图片/DXF 导入类似，将渲染结果作为底图

```
[选择文件] test.pdf         [发送到 3D 场景  ➤]

页码: [1] / [2] / [3] ▼    渲染质量: [标准] / [高清]

┌────────────────────────────────┐
│                                │
│       PDF 页面预览             │
│                                │
└────────────────────────────────┘

提示: PDF 已栅格化为图片，导入后可调整缩放和位置
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `lib/pdf/renderer.ts` | **新建** PDF 渲染服务 |
| `components/DrawingImport.tsx` | PDF 模式增加页面选择 + 发送到场景 |

---

## 8. InstancedMesh 大模型性能优化

### 现状问题

```typescript
// Scene3D.tsx 中逐个创建 Mesh
const mesh = concreteMesh(c);
if (mesh) group.add(mesh);
// 每个构件独立 Mesh → 500+ 构件时 draw call 爆炸
```

当前每根梁/柱/板都是独立的 `THREE.Mesh`，每个 Mesh 产生一个 WebGL draw call。500 构件 × 2（混凝土+钢筋）≈ 1000+ draw calls，在移动端/集成显卡上帧率会跌到个位数。

### 解决方案：按类型合并为 InstancedMesh

#### 思路

将同类型（同几何体）的多个实例合并到单个 `InstancedMesh` 中，每个实例只存一个变换矩阵，WebGL draw call 从 N 降到 1。

#### 实现方案

```typescript
// lib/three/instanced.ts — InstancedMesh 构建器

import * as THREE from "three";
import type { Component } from "../types";

interface BuildResult {
  concrete: THREE.InstancedMesh | null;
  rebarLines: THREE.Object3D[];
}

export function buildInstancedScene(
  components: Component[],
  opts: { showConcrete: boolean; showRebar: boolean },
): BuildResult {
  // 按 (type, geometry 特征) 分组
  const groups = new Map<string, Component[]>();
  
  for (const c of components) {
    const key = `${c.type}_${geomSignature(c)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  let concreteInstanced: THREE.InstancedMesh | null = null;
  const rebarObjects: THREE.Object3D[] = [];

  for (const [key, list] of groups) {
    const [type] = key.split("_");
    
    if (opts.showConcrete) {
      // 创建基础几何体
      const baseGeo = createBaseGeometry(type as Component["type"], list[0].geometry);
      if (baseGeo) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xcbd5e1,
          transparent: true,
          opacity: 0.45,
          metalness: 0.05,
          roughness: 0.9,
        });
        
        const im = new THREE.InstancedMesh(baseGeo, mat, list.length);
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          const p = c.placement;
          dummy.position.set((p.x || 0) / 1000, (p.y || 0) / 1000, (p.z || 0) / 1000);
          dummy.rotation.y = ((p.rot || 0) * Math.PI) / 180;
          dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          im.setColorAt(i, new THREE.Color(0xcbd5e1));
        }
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor!.needsUpdate = true;
        
        if (!concreteInstanced) concreteInstanced = im;
        else { /* 合并到主实例 */ }
      }
    }
    
    // 钢筋保持原有 Line 方式（钢筋数量少，draw call 影响小）
    if (opts.showRebar) {
      for (const c of list) {
        for (const r of c.rebars) {
          const line = rebarLines(c, r);
          if (line) rebarObjects.push(line);
        }
      }
    }
  }

  return { concrete: concreteInstanced, rebarLines: rebarObjects };
}
```

#### 性能预期

| 构件数 | 优化前 (FPS) | 优化后 (FPS) | 提升 |
|--------|-------------|-------------|------|
| 50     | 60          | 60          | 持平 |
| 200    | 45          | 60          | 33%  |
| 500    | 15          | 55          | 3.6x |
| 1000   | 5           | 40          | 8x   |

#### 其他性能优化并行建议

1. **LOD (Level of Detail)**：远距离构件用简化几何体
2. **视锥剔除优化**：Three.js 默认自动，但需要确保构件 Object3D 层级合理
3. **纹理/材质复用**：所有柱共用材质，不 clone
4. **更新策略**：仅在构件变更时重建，运行时不做无用遍历

### 修改文件

| 文件 | 改动 |
|------|------|
| `lib/three/instanced.ts` | **新建** InstancedMesh 构建逻辑 |
| `lib/three/geometry.ts` | 保留作为回退方案（构件数 < 50 时用原方案） |
| `components/Scene3D.tsx` | 根据构件数量选择 InstancedMesh / 传统方案 |

---

## 9. 实施路线图

### 阶段一：基础修复（1-2天）

```
□ 冷启动体验优化（欢迎空状态）            ★ 删 useEffect，加 WelcomeEmpty
□ 修复保存/加载断裂（IndexedDB 基础版）    ★ 建 lib/db.ts，存单项目
```

### 阶段二：用户体验提升（2-3天）

```
□ 项目管理对话框                           ★ ProjectManager.tsx
□ 自动保存（3秒防抖 + 视觉反馈）          ★ store.ts + TopBar.tsx
□ AI Key sessionStorage + 环境变量回退     ★ SettingsDialog.tsx + route.ts
□ AI 流式输出（SSE）                      ★ route.ts + AIPanel.tsx
```

### 阶段三：功能增强（3-5天）

```
□ PDF 图纸导入（pdfjs-dist 集成）          ★ lib/pdf/renderer.ts + DrawingImport.tsx
□ InstancedMesh 性能优化                   ★ lib/three/instanced.ts + Scene3D.tsx
□ 快捷键支持（Ctrl+S/N/O）                ★ page.tsx + TopBar.tsx
```

### 阶段四：打磨与测试（2-3天）

```
□ 移动端响应式适配
□ 错误边界处理（IndexedDB 不可用时降级）
□ 用户操作手册更新
□ 部署到 Netlify/Vercel 验证
```

### 实现优先级矩阵

```
                      │  高用户影响  │  低用户影响
──────────────────────┼─────────────┼─────────────
  低实现成本 (≤1天)   │ 冷启动优化   │ AI Key 安全
                      │ 保存/加载修复 │
──────────────────────┼─────────────┼─────────────
  高实现成本 (≥2天)   │ AI 流式输出  │ InstancedMesh
                      │ 项目管理    │ PDF 导入
                      │ 自动保存     │
──────────────────────┴─────────────┴─────────────
```

**建议首批实施**（左上象限）：冷启动优化 + 保存/加载修复，两者成本低、用户感知强。

---

## 附录：文件变更清单总表

| # | 操作 | 文件 | 说明 |
|---|------|------|------|
| 1 | **新增** | `lib/db.ts` | IndexedDB 持久化封装 |
| 2 | **新增** | `lib/pdf/renderer.ts` | PDF 渲染服务 (pdfjs-dist) |
| 3 | **新增** | `lib/three/instanced.ts` | InstancedMesh 构建器 |
| 4 | **新增** | `components/WelcomeEmpty.tsx` | 冷启动欢迎组件 |
| 5 | **新增** | `components/ProjectManager.tsx` | 项目管理对话框 |
| 6 | **修改** | `lib/store.ts` | 持久化层集成 + 项目列表 + 自动保存 |
| 7 | **修改** | `app/page.tsx` | 移除自动添加 + 空状态渲染 |
| 8 | **修改** | `components/TopBar.tsx` | IndexedDB 保存/加载 + 项目管理入口 |
| 9 | **修改** | `components/AIPanel.tsx` | SSE 流式读取 |
| 10 | **修改** | `app/api/ai/chat/route.ts` | SSE 流式输出 + 环境变量回退 |
| 11 | **修改** | `components/SettingsDialog.tsx` | sessionStorage + 安全提示 |
| 12 | **修改** | `components/DrawingImport.tsx` | PDF 导入功能 |
| 13 | **修改** | `components/Scene3D.tsx` | InstancedMesh 集成 |
| — | **新增** | `package.json` | 新增依赖: pdfjs-dist |

---

*本方案由 AI 产品经理自动生成*  
*BIM.Core (Rebar Quant) — 让钢筋混凝土计算更智能*
