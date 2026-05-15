"use client";
import { useState, useEffect } from "react";
import { X, HardHat, Trash2, FolderOpen, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { genProjectId } from "@/lib/db";

interface Props {
  onClose: () => void;
}

export default function ProjectManager({ onClose }: Props) {
  const projectList = useStore((s) => s.projectList);
  const loadFromDB = useStore((s) => s.loadFromDB);
  const deleteFromDB = useStore((s) => s.deleteFromDB);
  const listFromDB = useStore((s) => s.listFromDB);
  const newProject = useStore((s) => s.newProject);

  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    listFromDB();
  }, [listFromDB]);

  const handleDelete = async (id: string) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async (id: string) => {
    await deleteFromDB(id);
    setDeleteConfirm(null);
  };

  const handleOpen = async (id: string) => {
    setLoading(true);
    const ok = await loadFromDB(id);
    setLoading(false);
    if (ok) onClose();
  };

  const handleNew = () => {
    newProject();
    onClose();
  };

  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "今天";
    if (diffDays === 1) return "昨天";
    if (diffDays < 7) return `${diffDays}天前`;
    return d.toLocaleDateString("zh-CN");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="panel w-[600px] max-h-[70vh] p-4 shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <HardHat className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface">项目管理</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">打开或管理已有项目</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* New Project Button */}
        <button
          onClick={handleNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-outline-variant/30 hover:border-primary/50 text-on-surface-variant hover:text-primary transition-colors mb-4"
        >
          <Plus className="w-5 h-5" />
          <span className="font-medium">新建项目</span>
        </button>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {projectList.length === 0 && (
            <div className="text-center py-12 text-on-surface-variant text-sm">
              暂无保存的项目<br />
              创建构件后，项目会自动保存到浏览器
            </div>
          )}

          {projectList.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-high/30 hover:bg-surface-container-high/60 border border-outline-variant/10 group transition-colors"
            >
              {/* Project Info */}
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(p.id)}>
                <div className="font-medium text-on-surface truncate">{p.name}</div>
                <div className="flex items-center gap-3 text-[11px] text-on-surface-variant mt-0.5">
                  <span>{p.componentCount} 个构件</span>
                  <span>修改于 {fmtDate(p.updatedAt)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1.5 rounded hover:bg-surface-container-high text-primary transition-colors"
                  onClick={() => handleOpen(p.id)}
                  title="打开项目"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
                {deleteConfirm === p.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      className="px-2 py-1 rounded bg-error/20 text-error text-xs font-medium hover:bg-error/30 transition-colors"
                      onClick={() => confirmDelete(p.id)}
                    >
                      确认删除
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-surface-container-high text-on-surface-variant text-xs hover:text-on-surface transition-colors"
                      onClick={() => setDeleteConfirm(null)}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    className="p-1.5 rounded hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                    onClick={() => handleDelete(p.id)}
                    title="删除项目"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center text-sm text-on-surface-variant mt-4">
            加载中...
          </div>
        )}
      </div>
    </div>
  );
}
