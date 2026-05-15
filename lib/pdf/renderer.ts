// PDF 渲染服务 — 使用 pdfjs-dist 将 PDF 逐页渲染为图片底图
// 用于 DrawImport 组件，与 DXF/图片 统一为蓝图数据格式

export interface PdfRenderResult {
  dataUrl: string;       // PNG dataUrl
  widthMm: number;       // 宽度（像素数，默认 1px = 1mm）
  heightMm: number;      // 高度（像素数）
  pageCount: number;     // 总页数
  pageIndex: number;     // 当前渲染页码（0-based）
}

/** 懒加载 pdfjs 并动态设置 worker */
async function getPdfJs(): Promise<typeof import("pdfjs-dist")> {
  // 动态导入（避免 SSR 时加载）
  const pdfjs = await import("pdfjs-dist");

  // 使用 CDN worker（免搭建静态资源）
  // pdfjs 4.x+ 的 worker 地址
  const version = (pdfjs as any).version ?? "4.0.379";
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;

  return pdfjs;
}

/**
 * 渲染 PDF 指定页为图片数据 URL
 * @param file      源文件
 * @param pageIndex 页码（0-based）
 * @param scale     渲染倍率（2 = 2x 清晰度，值越大图片越清晰但体积越大）
 */
export async function renderPdfPageToImage(
  file: File,
  pageIndex: number = 0,
  scale: number = 2,
): Promise<PdfRenderResult> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(pageIndex + 1); // pdfjs 页码 1-based
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;

  // 白色背景
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas: canvas, canvasContext: ctx, viewport }).promise;

  // 默认 1px = 1mm，用户可在场景工具栏调整 scale
  return {
    dataUrl: canvas.toDataURL("image/png"),
    widthMm: viewport.width,
    heightMm: viewport.height,
    pageCount: pdf.numPages,
    pageIndex,
  };
}

/**
 * 获取 PDF 总页数（快速检测，不渲染内容）
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  return pdf.numPages;
}
