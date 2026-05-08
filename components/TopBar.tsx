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
    <header className="h-12 shrink-0 flex items-center gap-3 px-3 border-b border-eng-border bg-eng-panel">
      <div className="flex items-center gap-2 font-semibold text-eng-text">
        <HardHat className="w-5 h-5 text-eng-accent" />
        <span>Rebar Quant</span>
        <span className="text-eng-muted text-xs ml-1">钢筋混凝土工程量计算</span>
      </div>
      <div className="mx-3 h-6 w-px bg-eng-border" />
      <input
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        className="input-eng w-52"
        placeholder="项目名称"
      />
      <div className="flex-1" />
      <button className="btn-eng" disabled={busy} onClick={saveProject}>
        <Save className="w-4 h-4" />保存
      </button>
      <button className="btn-eng" onClick={loadProject}>
        <FolderOpen className="w-4 h-4" />加载
      </button>
      <button className="btn-eng" onClick={() => setShowImport(true)}>
        <ImageIcon className="w-4 h-4" />导入图纸
      </button>
      <button className="btn-eng" onClick={onExportExcel}>
        <FileSpreadsheet className="w-4 h-4" />Excel
      </button>
      <button className="btn-eng" onClick={onExportWord}>
        <FileText className="w-4 h-4" />Word
      </button>
      <button
        className={aiOpen ? "btn-primary" : "btn-eng"}
        onClick={() => setAiOpen(!aiOpen)}
      >
        <Sparkles className="w-4 h-4" />AI 助手
      </button>
      <button className="btn-eng" onClick={() => setShowSettings(true)}>
        <Settings className="w-4 h-4" />
      </button>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showImport && <DrawingImport onClose={() => setShowImport(false)} />}
    </header>
  );
}
