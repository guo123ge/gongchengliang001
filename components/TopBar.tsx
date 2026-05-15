"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HardHat, Save, FolderOpen, FileSpreadsheet, FileText, Sparkles, Settings,
  CheckCircle, Loader2, CircleDot, ChevronDown, Plus, FileImage, FileUp,
  RotateCcw, Eye,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { calcAll } from "@/lib/quantity/calc";
import { exportExcel } from "@/lib/export/excel";
import { exportWord } from "@/lib/export/word";
import { sceneCaptureRef } from "@/lib/sceneCapture";
import saveAs from "file-saver";
import SettingsDialog from "./SettingsDialog";
import DrawingImport from "./DrawingImport";
import ProjectManager from "./ProjectManager";

const AUTO_SAVE_DELAY = 3000;

function Dropdown({ label, active, children }: { label: string; active?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  return (
    <div ref={ref} className="relative h-full flex items-center">
      <button
        className={active
          ? "text-primary border-b-2 border-primary px-3 py-2 text-sm font-medium flex items-center gap-1"
          : "text-on-surface-variant hover:text-on-surface flex items-center h-full hover:bg-surface-container-high/50 px-3 py-2 rounded-md text-sm gap-1"
        }
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 min-w-[180px] bg-surface rounded-lg shadow-xl border border-outline-variant/30 py-1 z-50"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({ icon, label, onClick, divider }: { icon?: ReactNode; label?: string; onClick?: () => void; divider?: boolean }) {
  if (divider) return <div className="border-t border-outline-variant/20 my-1" />;
  return (
    <button
      className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-container-high flex items-center gap-2 text-on-surface"
      onClick={() => onClick?.()}
    >
      {icon && <span className="w-4 h-4 opacity-70">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

export default function TopBar() {
  const projectName = useStore((s) => s.projectName);
  const setProjectName = useStore((s) => s.setProjectName);
  const components = useStore((s) => s.components);
  const validations = useStore((s) => s.validations);
  const setAiOpen = useStore((s) => s.setAiOpen);
  const aiOpen = useStore((s) => s.aiOpen);
  const saveToDB = useStore((s) => s.saveToDB);
  const saveStatus = useStore((s) => s.saveStatus);
  const listFromDB = useStore((s) => s.listFromDB);
  const newProject = useStore((s) => s.newProject);
  const bottomPanelOpen = useStore((s) => s.bottomPanelOpen);
  const toggleBottomPanel = useStore((s) => s.toggleBottomPanel);
  const revalidate = useStore((s) => s.revalidate);
  const setCameraView = useStore((s) => s.setCameraView);

  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importAccept, setImportAccept] = useState<string | undefined>(undefined);
  const [showProjectMgr, setShowProjectMgr] = useState(false);
  const [busy, setBusy] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 自动保存 debounce
  useEffect(() => {
    if (saveStatus !== "unsaved" || components.length === 0) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { saveToDB(); }, AUTO_SAVE_DELAY);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [saveStatus, components.length, saveToDB]);

  // 初始化项目列表
  useEffect(() => { listFromDB(); }, [listFromDB]);

  // 快捷键
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveToDB(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); newProject(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "o") { e.preventDefault(); setShowProjectMgr(true); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveToDB, newProject]);

  const onExportExcel = async () => {
    setBusy(true);
    try {
      const results = calcAll(components);
      const blob = await exportExcel(components, results);
      saveAs(blob, `${projectName}-工程量.xlsx`);
    } finally { setBusy(false); }
  };

  const onExportWord = async () => {
    setBusy(true);
    try {
      const results = calcAll(components);
      const blob = await exportWord(projectName, results, validations);
      saveAs(blob, `${projectName}-计算书.docx`);
    } finally { setBusy(false); }
  };

  const exportImage = (format: "png" | "jpg") => {
    const dataUrl = sceneCaptureRef.current?.(format);
    if (!dataUrl) return;
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${projectName}-${Date.now()}.${format}`;
    link.click();
  };

  const exportPdf = () => {
    const dataUrl = sceneCaptureRef.current?.("png");
    if (!dataUrl) return;
    const html = `<html><head><title>${projectName}</title><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#0f172a}img{max-width:100%;max-height:100vh}</style></head><body><img src="${dataUrl}"/></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) setTimeout(() => w.print(), 600);
  };

  const openImport = (accept: string) => {
    setImportAccept(accept);
    setShowImport(true);
  };

  const statusIcon = () => {
    if (saveStatus === "saving") return <Loader2 className="w-3 h-3 animate-spin text-amber-400" />;
    if (saveStatus === "unsaved") return <CircleDot className="w-3 h-3 text-slate-500" />;
    return <CheckCircle className="w-3 h-3 text-emerald-400" />;
  };

  const statusLabel = () => {
    if (saveStatus === "saving") return "保存中...";
    if (saveStatus === "unsaved") return "未保存";
    return "已保存";
  };

  return (
    <header className="h-16 shrink-0 flex justify-between items-center px-gutter w-full z-50 border-b border-outline-variant/30 bg-surface-variant/70 backdrop-blur-xl flex-shrink-0">
      {/* Left: Brand + Nav */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <HardHat className="w-6 h-6 text-primary" />
          <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tighter">BIM.Core</h1>
          <span className="font-body-sm text-body-sm text-on-surface-variant ml-1">Reinforced</span>
        </div>
        <nav className="hidden md:flex gap-1 h-full items-center">
          {/* 文件 */}
          <Dropdown label="文件">
            <DropdownItem icon={<Plus className="w-4 h-4" />} label="新建项目" onClick={newProject} />
            <DropdownItem icon={<FolderOpen className="w-4 h-4" />} label="打开..." onClick={() => setShowProjectMgr(true)} />
            <DropdownItem icon={<Save className="w-4 h-4" />} label="保存" onClick={() => saveToDB()} />
            <DropdownItem icon={<Save className="w-4 h-4" />} label="另存为..." onClick={() => saveToDB()} />
          </Dropdown>

          {/* 视图 */}
          <Dropdown label="视图">
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="正视" onClick={() => setCameraView("front")} />
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="俯视" onClick={() => setCameraView("top")} />
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="侧视" onClick={() => setCameraView("side")} />
            <DropdownItem divider />
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="西北角" onClick={() => setCameraView("nw")} />
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="西南角" onClick={() => setCameraView("sw")} />
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="东北角" onClick={() => setCameraView("ne")} />
            <DropdownItem icon={<Eye className="w-4 h-4" />} label="东南角" onClick={() => setCameraView("se")} />
            <DropdownItem divider />
            <DropdownItem icon={<RotateCcw className="w-4 h-4" />} label="环游" onClick={() => setCameraView("tour")} />
          </Dropdown>

          {/* 计算分析 */}
          <button
            className="text-primary border-b-2 border-primary px-3 py-2 text-sm font-medium"
            onClick={() => { revalidate(); if (!bottomPanelOpen) toggleBottomPanel(); }}
          >
            计算分析
          </button>

          {/* 报表 */}
          <Dropdown label="报表">
            <DropdownItem icon={<FileSpreadsheet className="w-4 h-4" />} label="Excel" onClick={onExportExcel} />
            <DropdownItem icon={<FileText className="w-4 h-4" />} label="Word" onClick={onExportWord} />
            <DropdownItem divider />
            <DropdownItem icon={<FileImage className="w-4 h-4" />} label="PNG" onClick={() => exportImage("png")} />
            <DropdownItem icon={<FileImage className="w-4 h-4" />} label="JPG" onClick={() => exportImage("jpg")} />
            <DropdownItem icon={<FileUp className="w-4 h-4" />} label="PDF" onClick={exportPdf} />
          </Dropdown>

          {/* 图纸 */}
          <Dropdown label="图纸">
            <DropdownItem icon={<FileText className="w-4 h-4" />} label="DXF 导入" onClick={() => openImport(".dxf,.dwg")} />
            <DropdownItem icon={<FileImage className="w-4 h-4" />} label="PNG 导入" onClick={() => openImport(".png")} />
            <DropdownItem icon={<FileImage className="w-4 h-4" />} label="JPG 导入" onClick={() => openImport(".jpg,.jpeg")} />
            <DropdownItem icon={<FileUp className="w-4 h-4" />} label="PDF 导入" onClick={() => openImport(".pdf")} />
          </Dropdown>
        </nav>
      </div>

      {/* Center: Project Name + Save Status */}
      <div className="flex-1 flex justify-center items-center gap-2">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="input-eng w-64 text-center"
          placeholder="项目名称"
        />
        <span className="flex items-center gap-1 text-[10px] text-on-surface-variant" title={statusLabel()}>
          {statusIcon()}
          <span className="hidden sm:inline">{statusLabel()}</span>
        </span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          className={aiOpen ? "btn-primary" : "btn-secondary"}
          onClick={() => setAiOpen(!aiOpen)}
        >
          <Sparkles className="w-4 h-4" />AI
        </button>
        <button
          className="p-2 hover:bg-surface-container-high/50 rounded-full transition-colors text-on-surface-variant"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showImport && <DrawingImport onClose={() => setShowImport(false)} defaultAccept={importAccept} />}
      {showProjectMgr && <ProjectManager onClose={() => setShowProjectMgr(false)} />}
    </header>
  );
}
