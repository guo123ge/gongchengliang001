"use client";
import { Eye, EyeOff, Scissors, Move3d, RotateCw, Image as ImageIcon, Trash2, Magnet, Lock, Unlock } from "lucide-react";
import { useStore } from "@/lib/store";

export default function SceneToolbar() {
  const showConcrete = useStore((s) => s.showConcrete);
  const showRebar = useStore((s) => s.showRebar);
  const toggleConcrete = useStore((s) => s.toggleConcrete);
  const toggleRebar = useStore((s) => s.toggleRebar);
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const setGizmoMode = useStore((s) => s.setGizmoMode);
  const selectedId = useStore((s) => s.selectedId);
  const blueprint = useStore((s) => s.blueprint);
  const updateBlueprint = useStore((s) => s.updateBlueprint);
  const setBlueprint = useStore((s) => s.setBlueprint);

  return (
    <div className="absolute top-3 left-3 panel p-2 flex items-center gap-2 text-xs">
      <button className="btn-eng text-xs" onClick={toggleConcrete}>
        {showConcrete ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} 混凝土
      </button>
      <button className="btn-eng text-xs" onClick={toggleRebar}>
        {showRebar ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />} 钢筋
      </button>
      <div className="h-4 w-px bg-eng-border" />
      <button
        className={gizmoMode === "translate" ? "btn-primary text-xs" : "btn-eng text-xs"}
        disabled={!selectedId}
        onClick={() => setGizmoMode("translate")}
        title="拖拽箭头平移构件（50mm 吸附）"
      >
        <Move3d className="w-3.5 h-3.5" />平移
      </button>
      <button
        className={gizmoMode === "rotate" ? "btn-primary text-xs" : "btn-eng text-xs"}
        disabled={!selectedId}
        onClick={() => setGizmoMode("rotate")}
        title="拖拽圆环旋转构件"
      >
        <RotateCw className="w-3.5 h-3.5" />旋转
      </button>
      <div className="h-4 w-px bg-eng-border" />
      <button
        className={clip.enabled ? "btn-primary text-xs" : "btn-eng text-xs"}
        onClick={() => setClip({ enabled: !clip.enabled })}
      >
        <Scissors className="w-3.5 h-3.5" />剖切
      </button>
      {clip.enabled && (
        <>
          <select className="input-eng !py-0.5 !px-1 text-xs w-16" value={clip.axis}
            onChange={(e) => setClip({ axis: e.target.value as any })}>
            <option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
          </select>
          <input type="number" className="input-eng !py-0.5 !px-1 text-xs w-24" value={clip.position}
            onChange={(e) => setClip({ position: +e.target.value })} placeholder="位置 mm" />
        </>
      )}
      {blueprint && (
        <>
          <div className="h-4 w-px bg-eng-border" />
          <button
            className={blueprint.visible ? "btn-primary text-xs" : "btn-eng text-xs"}
            onClick={() => updateBlueprint({ visible: !blueprint.visible })}
            title="切换底图显隐"
          >
            <ImageIcon className="w-3.5 h-3.5" />底图
          </button>
          <input
            type="number"
            step={0.1}
            className="input-eng !py-0.5 !px-1 text-xs w-16"
            value={blueprint.scale}
            onChange={(e) => updateBlueprint({ scale: +e.target.value || 1 })}
            title="缩放"
          />
          <input
            type="number"
            step={5}
            className="input-eng !py-0.5 !px-1 text-xs w-16"
            value={blueprint.rotation}
            onChange={(e) => updateBlueprint({ rotation: +e.target.value })}
            title="旋转（度）"
          />
          <button
            className={blueprint.snapEnabled ? "btn-primary text-xs" : "btn-eng text-xs"}
            onClick={() => updateBlueprint({ snapEnabled: !blueprint.snapEnabled })}
            title="构件拖拽时吸附到 DXF 端点（300mm 半径）"
          >
            <Magnet className="w-3.5 h-3.5" />吸附
          </button>
          <button
            className="btn-eng text-xs"
            onClick={() => updateBlueprint({ locked: !blueprint.locked })}
            title={blueprint.locked ? "解锁底图（可拖动）" : "锁定底图（防止误拖）"}
          >
            {blueprint.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button className="btn-eng text-xs" onClick={() => setBlueprint(null)} title="移除底图">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
