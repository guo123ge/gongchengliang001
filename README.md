# Rebar Quant — 钢筋混凝土工程量计算应用

基于 **Next.js 14 + TypeScript + three.js + Tailwind + Prisma/SQLite** 的工程量计算与可视化应用，覆盖参数建模、3D 可视化剖切、工程量统计导出、AI 助手四大模块。

## 功能模块

1. **参数输入**：梁 / 板 / 柱 / 桩基参数输入与保存，22G101 平法规则自动补充与校验
2. **3D 可视化**：three.js 场景，旋转/拖动/缩放、剖切面生成剖面图、钢筋/混凝土标注
3. **工程量统计**：混凝土/钢筋/模板用量计算，导出 Word / Excel
4. **AI 助手**：OpenAI 兼容接口，结构化指令修改模型，API Key 后端代理

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化数据库
npx prisma db push
npx prisma generate

# 4. 启动开发服务器
npm run dev
```

访问 <http://localhost:3000> 。

## AI 助手配置

进入应用后点击右上角"设置"，填写：

- **Base URL**：如 `https://api.openai.com/v1` 或 `https://api.deepseek.com/v1`
- **API Key**：OpenAI 兼容密钥（存储于服务端 SQLite，前端不可见）
- **Model**：如 `gpt-4o-mini`、`deepseek-chat`、`qwen-plus` 等

## 目录结构

```
app/                 # Next.js App Router 页面与 API 路由
components/          # UI 组件
lib/
  g101/              # 22G101 平法规则引擎
  three/             # 3D 场景与几何生成
  quantity/          # 工程量计算
  export/            # Word/Excel 导出
  store/             # Zustand 状态
prisma/schema.prisma # 数据库 Schema
```

## 22G101 规则覆盖

当前交付 **阶段 A**（MVP 核心规则）：最小配筋率、最大间距、保护层厚度、锚固长度 La/LaE、搭接长度 Ll/LlE、箍筋最小直径与加密区。后续阶段 B/C 逐步扩展梁柱节点、洞口加强、特殊构造详图。

## 注意事项

- DWG 文件需先转换为 DXF 后导入（浏览器不支持原生 DWG 解析）
- 大规模模型（>500 构件）后续引入 InstancedMesh 优化
