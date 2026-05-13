"use client";
import { useState } from "react";
import {
  HardHat, Save, FolderOpen, FileSpreadsheet, FileText, Sparkles, Settings, Image as ImageIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { calcAll } from "@/lib/quantity/calc";
import { exportExcel } from "@/lib/export/excel";
import { exportWord } from "@/lib/export/word";
import saveAs from "file-saver";
import SettingsDialog from "./SettingsDialog";
import DrawingImport from "./DrawingImport";

export default function TopBar() {
  const projectName = useStore((s) => s.projectName);
  const setProjectName = useStore((s) => s.setProjectName);
  const components = useStore((s) => s.components);
  const validations = useStore((s) => s.validations);
  const loadAll = useStore((s) => s.loadAll);
  const setAiOpen = useStore((s) => s.setAiOpen);
  const aiOpen = useStore((s) => s.aiOpen);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [busy, setBusy] = useState(false);

  const saveProject = async () => {
    setBusy(true);
    try {
      await Promise.all(
        components.map((c) =>
          fetch("/api/components", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(c),
          }),
        ),
      );
      alert("已保存全部构件到数据库");
    } finally {
      setBusy(false);
    }
  };

  const loadProject = async () => {
    const r = await fetch("/api/components");
    const { items } = await r.json();
    loadAll(items);
  };

  const onExportExcel = async () => {
    const results = calcAll(components);
    const blob = await exportExcel(components, results);
    saveAs(blob, `${projectName}-工程量.xlsx`);
  };

  const onExportWord = async () => {
    const results = calcAll(components);
    const blob = await exportWord(projectName, results, validations);
    saveAs(blob, `${projectName}-计算书.docx`);
  };

  return (
    <header className="h-16 shrink-0 flex justify-between items-center px-gutter w-full z-50 border-b border-outline-variant/30 bg-surface-variant/70 backdrop-blur-xl flex-shrink-0">
      {/* Left: Brand + Nav */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <HardHat className="w-6 h-6 text-primary" />
          <h1 className="font-display-lg text-display-lg font-bold text-primary tracking-tighter">
            BIM.Core
          </h1>
          <span className="font-body-sm text-body-sm text-on-surface-variant ml-1">Reinforced</span>
        </div>
        <nav className="hidden md:flex gap-1 h-full items-center">
          <button className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center h-full hover:bg-surface-container-high/50 px-3 py-2 rounded-md text-sm">
            文件
          </button>
          <button className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center h-full hover:bg-surface-container-high/50 px-3 py-2 rounded-md text-sm">
            编辑
          </button>
          <button className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center h-full hover:bg-surface-container-high/50 px-3 py-2 rounded-md text-sm">
            视图
          </button>
          <button className="text-primary border-b-2 border-primary px-3 py-2 text-sm font-medium">
            计算分析
          </button>
          <button className="text-on-surface-variant hover:text-on-surface transition-colors flex items-center h-full hover:bg-surface-container-high/50 px-3 py-2 rounded-md text-sm">
            报表
          </button>
        </nav>
      </div>

      {/* Center: Project Name */}
      <div className="flex-1 flex justify-center">
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="input-eng w-64 text-center"
          placeholder="项目名称"
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button className="btn-secondary" disabled={busy} onClick={saveProject}>
          <Save className="w-4 h-4" />保存
        </button>
        <button className="btn-secondary" onClick={loadProject}>
          <FolderOpen className="w-4 h-4" />加载
        </button>
        <button className="btn-secondary" onClick={() => setShowImport(true)}>
          <ImageIcon className="w-4 h-4" />导入图纸
        </button>
        <button className="btn-secondary" onClick={onExportExcel}>
          <FileSpreadsheet className="w-4 h-4" />Excel
        </button>
        <button className="btn-secondary" onClick={onExportWord}>
          <FileText className="w-4 h-4" />Word
        </button>
        <button
          className={aiOpen ? "btn-primary" : "btn-secondary"}
          onClick={() => setAiOpen(!aiOpen)}
        >
          <Sparkles className="w-4 h-4" />AI 助手
        </button>
        <button
          className="p-2 hover:bg-surface-container-high/50 rounded-full transition-colors text-on-surface-variant"
          onClick={() => setShowSettings(true)}
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showImport && <DrawingImport onClose={() => setShowImport(false)} />}
    </header>
  );
}
