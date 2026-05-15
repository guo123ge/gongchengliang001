"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Layers, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { parseDxf, renderDxfToSvg, rasterizeSvg, type DxfParseResult } from "@/lib/dxf/parser";
import { useStore } from "@/lib/store";
import { renderPdfPageToImage, getPdfPageCount, type PdfRenderResult } from "@/lib/pdf/renderer";

type Mode = "none" | "image" | "pdf" | "dxf";

export default function DrawingImport({ onClose, defaultAccept }: { onClose: () => void; defaultAccept?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("none");
  const [dxf, setDxf] = useState<DxfParseResult | null>(null);
  const [activeLayers, setActiveLayers] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fileRef, setFileRef] = useState<File | null>(null);
  const setBlueprint = useStore((s) => s.setBlueprint);

  // PDF 专用状态
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPageIndex, setPdfPageIndex] = useState(0);
  const [pdfRenderResult, setPdfRenderResult] = useState<PdfRenderResult | null>(null);
  const [pdfQuality, setPdfQuality] = useState<1 | 2 | 3>(2);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  useEffect(() => {
    if (!defaultAccept) return;
    const t = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.accept = defaultAccept;
        inputRef.current.click();
      }
    }, 50);
    return () => clearTimeout(t);
  }, [defaultAccept]);

  const svg = useMemo(() => {
    if (!dxf) return "";
    return renderDxfToSvg(dxf.entities, dxf.bbox, activeLayers);
  }, [dxf, activeLayers]);

  // ─── 文件选择 ───

  const onFile = async (f: File) => {
    setErr("");
    setName(f.name);
    setDxf(null);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setPdfRenderResult(null);
    setPdfPageCount(0);

    if (/\.dxf$/i.test(f.name)) {
      setMode("dxf");
      setBusy(true);
      try {
        const text = await f.text();
        const r = parseDxf(text);
        setDxf(r);
        setActiveLayers(new Set(r.layers.map((l) => l.name)));
      } catch (e: any) {
        setErr(`DXF 解析失败：${e?.message ?? e}`);
      } finally { setBusy(false); }
    } else if (/\.dwg$/i.test(f.name)) {
      setMode("none");
      setErr("DWG 暂不支持原生解析，请先在 CAD 中另存为 DXF（推荐 R2018 ASCII）。");
    } else if (f.type.startsWith("image/")) {
      setMode("image");
      setUrl(URL.createObjectURL(f));
      setFileRef(f);
    } else if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      setMode("pdf");
      setUrl(URL.createObjectURL(f));
      setFileRef(f);
      setBusy(true);
      try {
        const count = await getPdfPageCount(f);
        setPdfPageCount(count);
        await renderPdfPage(0, f, pdfQuality);
      } catch (e: any) {
        setErr(`PDF 解析失败：${e?.message ?? e}`);
      } finally { setBusy(false); }
    } else {
      setMode("none");
      setErr("未识别的文件类型（支持 DXF / PDF / PNG / JPG）");
    }
  };

  // ─── PDF 翻页 ───

  const renderPdfPage = async (idx: number, file?: File, quality?: number) => {
    const f = file ?? fileRef;
    const q = quality ?? pdfQuality;
    if (!f) return;
    setPdfPageIndex(idx);
    setBusy(true);
    try {
      const result = await renderPdfPageToImage(f, idx, q);
      setPdfRenderResult(result);
      if (url) URL.revokeObjectURL(url);
      setUrl(result.dataUrl);
    } catch (e: any) {
      setErr(`PDF 第 ${idx + 1} 页渲染失败：${e?.message ?? e}`);
    } finally { setBusy(false); }
  };

  const prevPage = () => {
    if (pdfPageIndex > 0) renderPdfPage(pdfPageIndex - 1);
  };
  const nextPage = () => {
    if (pdfPageIndex < pdfPageCount - 1) renderPdfPage(pdfPageIndex + 1);
  };

  // ─── 图层控制 ───

  const toggleLayer = (n: string) => {
    setActiveLayers((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

  // ─── 发送到 3D 场景 ───

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const sendImageToScene = async () => {
    if (!fileRef || mode !== "image") return;
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(fileRef);
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });
      const widthMm = img.width;
      const heightMm = img.height;
      setBlueprint({
        imageUrl: dataUrl, widthMm, heightMm,
        offsetX: 0, offsetZ: 0, rotation: 0, scale: 1, visible: true,
        bbox: { minX: 0, minY: 0, maxX: widthMm, maxY: heightMm },
        endpoints: [], layers: [], activeLayers: [],
        snapEnabled: false, locked: false,
      });
      onClose();
    } catch (e: any) {
      setErr(`图片处理失败：${e?.message ?? e}`);
    } finally { setBusy(false); }
  };

  const sendPdfToScene = async () => {
    if (!pdfRenderResult || !url) return;
    setBusy(true);
    try {
      const { dataUrl, widthMm, heightMm } = pdfRenderResult;
      setBlueprint({
        imageUrl: dataUrl, widthMm, heightMm,
        offsetX: 0, offsetZ: 0, rotation: 0, scale: 1, visible: true,
        bbox: { minX: 0, minY: 0, maxX: widthMm, maxY: heightMm },
        endpoints: [], layers: [], activeLayers: [],
        snapEnabled: false, locked: false,
      });
      onClose();
    } catch (e: any) {
      setErr(`PDF 发送失败：${e?.message ?? e}`);
    } finally { setBusy(false); }
  };

  const sendToScene = async () => {
    if (mode === "image") { await sendImageToScene(); return; }
    if (mode === "pdf") { await sendPdfToScene(); return; }
    if (!dxf) return;
    setBusy(true);
    try {
      const { dataUrl } = await rasterizeSvg(svg, 2048);
      setBlueprint({
        imageUrl: dataUrl,
        widthMm: dxf.bbox.maxX - dxf.bbox.minX,
        heightMm: dxf.bbox.maxY - dxf.bbox.minY,
        offsetX: 0, offsetZ: 0, rotation: 0,
        scale: dxf.unitScale, visible: true,
        bbox: dxf.bbox, endpoints: dxf.endpoints,
        layers: dxf.layers.map((l) => l.name),
        activeLayers: Array.from(activeLayers),
        snapEnabled: true, locked: false,
      });
      onClose();
    } catch (e: any) {
      setErr(`栅格化失败：${e?.message ?? e}`);
    } finally { setBusy(false); }
  };

  // ─── 可以发送的条件 ───

  const canSend =
    (mode === "dxf" && dxf && activeLayers.size > 0) ||
    (mode === "image" && fileRef) ||
    (mode === "pdf" && pdfRenderResult !== null);

  // ─── UI ───

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-[960px] h-[680px] p-4 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium">图纸导入（DXF / PDF / PNG / JPG）</div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        {/* Toolbar */}
        <div className="flex gap-2 mb-3 items-center flex-wrap">
          <input ref={inputRef} type="file" accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className="btn-primary" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4" />选择文件
          </button>
          <span className="text-xs text-eng-muted">{name}</span>

          {/* PDF 翻页 */}
          {mode === "pdf" && pdfPageCount > 1 && (
            <div className="flex items-center gap-1 text-xs text-eng-muted">
              <button className="btn-eng p-1" onClick={prevPage} disabled={pdfPageIndex <= 0 || busy}>
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="font-mono px-1">{pdfPageIndex + 1} / {pdfPageCount}</span>
              <button className="btn-eng p-1" onClick={nextPage} disabled={pdfPageIndex >= pdfPageCount - 1 || busy}>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* PDF 质量选择 */}
          {mode === "pdf" && (
            <select
              className="input-eng w-24 text-xs"
              value={pdfQuality}
              onChange={(e) => {
                const q = +e.target.value as 1 | 2 | 3;
                setPdfQuality(q);
                if (fileRef) renderPdfPage(pdfPageIndex, fileRef, q);
              }}
            >
              <option value={1}>低质量</option>
              <option value={2}>标准</option>
              <option value={3}>高清</option>
            </select>
          )}

          <div className="flex-1" />

          {/* 发送按钮 */}
          <button
            className={canSend ? "btn-primary" : "btn-secondary opacity-50 cursor-not-allowed"}
            onClick={sendToScene}
            disabled={busy || !canSend}
            title={canSend ? "" : "请先选择文件"}
          >
            <Send className="w-4 h-4" />发送到 3D 场景
          </button>
        </div>

        {/* 错误提示 */}
        {err && <div className="text-xs text-eng-err mb-2">{err}</div>}

        {/* DXF 图层信息 */}
        {mode === "dxf" && dxf && (
          <div className="text-xs text-eng-muted mb-2 flex gap-3 items-center flex-wrap">
            <Layers className="w-3.5 h-3.5" />
            <span>尺寸：{((dxf.bbox.maxX - dxf.bbox.minX) * dxf.unitScale).toFixed(0)} × {((dxf.bbox.maxY - dxf.bbox.minY) * dxf.unitScale).toFixed(0)} mm</span>
            <span>实体 {dxf.total} | 端点 {dxf.endpoints.length}</span>
            {Object.entries(dxf.counts).slice(0, 5).map(([k, v]) => <span key={k}>{k}: {v}</span>)}
          </div>
        )}

        {/* 图片提示 */}
        {mode === "image" && (
          <div className="text-xs text-eng-muted mb-2">图片导入：默认 1 像素 = 1 mm，导入后可在工具栏调整缩放比例</div>
        )}

        {/* PDF 提示 */}
        {mode === "pdf" && pdfRenderResult && (
          <div className="text-xs text-eng-muted mb-2">
            PDF 已渲染为图片（{pdfRenderResult.widthMm} × {pdfRenderResult.heightMm} px），导入后可调整缩放比例
          </div>
        )}

        {/* 主内容区 */}
        <div className="flex-1 flex gap-3 min-h-0">
          {/* DXF 图层侧边栏 */}
          {mode === "dxf" && dxf && (
            <div className="panel p-2 w-44 overflow-auto">
              <div className="text-[11px] text-eng-muted mb-1 flex gap-2 items-center">
                <span>图层（{activeLayers.size}/{dxf.layers.length}）</span>
                <button className="text-eng-accent hover:underline ml-auto"
                  onClick={() => setActiveLayers(new Set(dxf.layers.map((l) => l.name)))}>全选</button>
                <button className="text-eng-accent hover:underline"
                  onClick={() => setActiveLayers(new Set())}>清空</button>
              </div>
              <div className="space-y-0.5">
                {dxf.layers.map((l) => (
                  <label key={l.name} className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-eng-bg2 px-1 py-0.5 rounded">
                    <input type="checkbox" checked={activeLayers.has(l.name)} onChange={() => toggleLayer(l.name)} />
                    <span className="truncate">{l.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 预览区域 */}
          <div className="flex-1 panel overflow-auto flex items-center justify-center bg-white min-h-0">
            {busy && <div className="text-slate-400 text-xs p-6">解析中...</div>}
            {!busy && mode === "none" && <div className="text-slate-400 text-xs p-6">尚未导入文件</div>}
            {!busy && (mode === "image" || mode === "pdf") && url && (
              <img src={url} alt="drawing" className="max-w-full max-h-full" />
            )}
            {!busy && mode === "dxf" && dxf && (
              <div className="w-full h-full overflow-auto p-2"
                dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-end items-center gap-2 mt-3 pt-3 border-t border-outline-variant/20">
          <button
            className={canSend ? "btn-primary" : "btn-secondary opacity-50 cursor-not-allowed"}
            onClick={sendToScene}
            disabled={busy || !canSend}
          >
            <Send className="w-4 h-4" />发送到 3D 场景
          </button>
        </div>

        {/* 底部说明 */}
        <div className="text-xs text-eng-muted mt-2">
          {mode === "dxf" ? "子集：LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / TEXT / MTEXT；其余将忽略。建议 CAD 内 EXPLODE BLOCK 后另存。" :
           mode === "pdf" ? "PDF 使用 pdfjs-dist 渲染为图片，支持多页选择和渲染质量调节。" :
           "支持 DXF（推荐 ASCII R2018）/ PDF / PNG / JPG 格式"}
        </div>
      </div>
    </div>
  );
}
