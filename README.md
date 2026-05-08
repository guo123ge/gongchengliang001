# Rebar Quant — 钢筋混凝土工程量计算应用

基于 **Next.js 14 + TypeScript + three.js + Tailwind** 的 22G101 工程量计算与可视化应用。零后端数据库依赖，可直接部署到 Vercel。

## 功能模块

1. **参数输入**：梁 / 板 / 柱 / 桩基参数输入与保存，22G101 平法规则自动补充与校验（覆盖加密区、节点构造、板支座负筋等阶段 B 规则）
2. **3D 可视化**：three.js 场景，旋转/拖动/缩放、剖切面剖面图、钢筋/混凝土分色显示
3. **DXF 蓝图导入**：图层过滤 + SVG 预览 + 栅格化贴图叠加在地面，支持鼠标拖动定位、构件吸附到 DXF 端点
4. **工程量统计**：混凝土/模板/钢筋按钢筋号分段计算，导出 Word / Excel
5. **AI 助手**：OpenAI 兼容接口，结构化指令修改模型；配置存浏览器 `localStorage`，请求经 `/api/ai/chat` 服务端代理转发

## 快速开始（本地）

```bash
npm install
npm run dev
```

访问 <http://localhost:3000> 。

## 部署到 Vercel

1. Fork / 克隆本仓库到自己的 GitHub
2. 登录 <https://vercel.com> → **Add New Project** → 选择该仓库
3. Framework 自动识别为 Next.js，**无需任何环境变量**，直接 Deploy
4. 部署完成后，点击右上角 **设置** 配置 AI（Base URL / Key / Model 存于本地浏览器）

## AI 助手配置

进入应用后点击右上角"设置"，填写：

- **Base URL**：如 `https://api.openai.com/v1` 或 `https://api.deepseek.com/v1`
- **API Key**：OpenAI 兼容密钥（存储于浏览器 `localStorage`，仅本机使用）
- **Model**：如 `gpt-4o-mini`、`deepseek-chat`、`qwen-plus` 等

## 目录结构

```
app/                 # Next.js App Router 页面与 API 路由
  api/ai/chat/       # AI 代理接口（无状态，从请求体读取配置）
components/          # UI 组件
lib/
  g101/              # 22G101 平法规则引擎与配筋表
  three/             # 3D 场景与构件几何生成
  dxf/               # DXF 解析、SVG 渲染、端点变换
  quantity/          # 工程量计算
  export/            # Word / Excel 导出
  store.ts           # Zustand 全局状态
```

## 22G101 规则覆盖

- **阶段 A**（MVP）：最小配筋率、最大间距、保护层厚度、锚固长度 La/LaE、搭接长度 Ll/LlE、箍筋最小直径与基础间距校验
- **阶段 B**：箍筋加密区长度与间距、梁柱节点连接、板支座负筋长度
- **阶段 C**（持续扩展）：洞口加强、变截面构造、特殊抗震节点

## 注意事项

- DWG 文件需先转换为 DXF（建议 R2018 ASCII）后再导入
- DXF 子集：LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / TEXT / MTEXT；SPLINE / HATCH / BLOCK 需先 EXPLODE
- 大规模模型（>500 构件）将在后续引入 InstancedMesh 优化
