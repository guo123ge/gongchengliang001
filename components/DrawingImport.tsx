"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Layers, Send } from "lucide-react";
import { parseDxf, renderDxfToSvg, rasterizeSvg, type DxfParseResult } from "@/lib/dxf/parser";
import { useStore } from "@/lib/store";

type Mode = "none" | "image" | "pdf" | "dxf";

export default function DrawingImport({ onClose }: { onClose: () => void }) {
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

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const svg = useMemo(() => {
    if (!dxf) return "";
    return renderDxfToSvg(dxf.entities, dxf.bbox, activeLayers);
  }, [dxf, activeLayers]);

  const onFile = async (f: File) => {
    setErr("");
    setName(f.name);
    setDxf(null);
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
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
      } finally {
        setBusy(false);
      }
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
    } else {
      setMode("none");
      setErr("未识别的文件类型");
    }
  };

  const toggleLayer = (n: string) => {
    setActiveLayers((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  };

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
      // 默认 1px = 1mm，用户可在场景中通过 scale 调整
      const widthMm = img.width;
      const heightMm = img.height;
      setBlueprint({
        imageUrl: dataUrl,
        widthMm,
        heightMm,
        offsetX: 0,
        offsetZ: 0,
        rotation: 0,
        scale: 1,
        visible: true,
        bbox: { minX: 0, minY: 0, maxX: widthMm, maxY: heightMm },
        endpoints: [],
        layers: [],
        activeLayers: [],
        snapEnabled: false,
        locked: false,
      });
      onClose();
    } catch (e: any) {
      setErr(`图片处理失败：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const sendToScene = async () => {
    if (mode === "image") {
      await sendImageToScene();
      return;
    }
    if (!dxf) return;
    setBusy(true);
    try {
      const { dataUrl } = await rasterizeSvg(svg, 2048);
      setBlueprint({
        imageUrl: dataUrl,
        widthMm: dxf.bbox.maxX - dxf.bbox.minX,
        heightMm: dxf.bbox.maxY - dxf.bbox.minY,
        offsetX: 0,
        offsetZ: 0,
        rotation: 0,
        scale: dxf.unitScale,
        visible: true,
        bbox: dxf.bbox,
        endpoints: dxf.endpoints,
        layers: dxf.layers.map((l) => l.name),
        activeLayers: Array.from(activeLayers),
        snapEnabled: true,
        locked: false,
      });
      onClose();
    } catch (e: any) {
      setErr(`栅格化失败：${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="panel w-[960px] h-[680px] p-4 shadow-xl flex flex-col">
        <div className="flex justify-between items-center mb-3">
          <div className="font-medium">图纸导入（DXF / PDF / PNG / JPG）</div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2 mb-3 items-center">
          <input ref={inputRef} type="file" accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg" className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className="btn-primary" onClick={() => inputRef.current?.click()}>
            <Upload className="w-4 h-4" />选择文件
          </button>
          <span className="text-xs text-eng-muted">{name}</span>
          <div className="flex-1" />
          {(mode === "dxf" && dxf) || mode === "image" ? (
            <button className="btn-primary" onClick={sendToScene}
              disabled={busy || (mode === "dxf" && activeLayers.size === 0)}>
              <Send className="w-4 h-4" />发送到 3D 场景
            </button>
          ) : mode === "pdf" ? (
            <span className="text-xs text-eng-muted">PDF 暂不支持直接导入，请先转换为图片</span>
          ) : null}
        </div>
        {err && <div className="text-xs text-eng-err mb-2">{err}</div>}
        {mode === "dxf" && dxf && (
          <div className="text-xs text-eng-muted mb-2 flex gap-3 items-center">
            <Layers className="w-3.5 h-3.5" />
            <span>尺寸：{((dxf.bbox.maxX - dxf.bbox.minX) * dxf.unitScale).toFixed(0)} × {((dxf.bbox.maxY - dxf.bbox.minY) * dxf.unitScale).toFixed(0)} mm（单位系数 {dxf.unitScale}）</span>
            <span>实体 {dxf.total} | 端点 {dxf.endpoints.length}</span>
            {Object.entries(dxf.counts).slice(0, 5).map(([k, v]) => <span key={k}>{k}: {v}</span>)}
          </div>
        )}
        {mode === "image" && (
          <div className="text-xs text-eng-muted mb-2">图片导入：默认 1 像素 = 1 mm，导入后可在工具栏调整缩放比例</div>
        )}
        <div className="flex-1 flex gap-3 min-h-0">
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
          <div className="flex-1 panel overflow-auto flex items-center justify-center bg-white min-h-0">
            {busy && <div className="text-slate-400 text-xs p-6">解析中...</div>}
            {!busy && mode === "none" && <div className="text-slate-400 text-xs p-6">尚未导入文件</div>}
            {!busy && mode === "image" && url && (
              <img src={url} alt="drawing" className="max-w-full max-h-full" />
            )}
            {!busy && mode === "pdf" && url && (
              <iframe src={url} className="w-full h-full bg-white" />
            )}
            {!busy && mode === "dxf" && dxf && (
              <div className="w-full h-full overflow-auto p-2"
                dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>
        </div>
        <div className="text-xs text-eng-muted mt-2">
          子集：LINE / LWPOLYLINE / POLYLINE / CIRCLE / ARC / TEXT / MTEXT；其余将忽略。建议 CAD 内 EXPLODE BLOCK 后另存。
        </div>
      </div>
    </div>
  );
}
