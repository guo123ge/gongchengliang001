"use client";
import { Eye, EyeOff, Scissors, Move3d, RotateCw, Image as ImageIcon, Trash2, Magnet, Lock, Unlock, Ruler } from "lucide-react";
import { useStore } from "@/lib/store";

export default function SceneToolbar() {
  const showConcrete = useStore((s) => s.showConcrete);
  const showRebar = useStore((s) => s.showRebar);
  const showDimensions = useStore((s) => s.showDimensions);
  const toggleConcrete = useStore((s) => s.toggleConcrete);
  const toggleRebar = useStore((s) => s.toggleRebar);
  const toggleDimensions = useStore((s) => s.toggleDimensions);
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const setGizmoMode = useStore((s) => s.setGizmoMode);
  const selectedId = useStore((s) => s.selectedId);
  const blueprint = useStore((s) => s.blueprint);
  const updateBlueprint = useStore((s) => s.updateBlueprint);
  const setBlueprint = useStore((s) => s.setBlueprint);

  return (
    <div className="absolute top-4 left-4 glass-panel rounded-lg p-2 flex items-center gap-1.5 text-xs z-10">
      {/* Visibility Controls */}
      <button
        className={showConcrete ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
        onClick={toggleConcrete}
        title="切换混凝土显隐"
      >
        {showConcrete ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">混凝土</span>
      </button>
      <button
        className={showRebar ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
        onClick={toggleRebar}
        title="切换钢筋显隐"
      >
        {showRebar ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">钢筋</span>
      </button>
      <button
        className={showDimensions ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
        onClick={toggleDimensions}
        title="切换尺寸标注显隐"
      >
        <Ruler className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">尺寸</span>
      </button>

      <div className="h-5 w-px bg-outline-variant/30 mx-1" />

      {/* Gizmo Controls */}
      <button
        className={gizmoMode === "translate" ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
        disabled={!selectedId}
        onClick={() => setGizmoMode("translate")}
        title="拖拽箭头平移构件（50mm 吸附）"
      >
        <Move3d className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">平移</span>
      </button>
      <button
        className={gizmoMode === "rotate" ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
        disabled={!selectedId}
        onClick={() => setGizmoMode("rotate")}
        title="拖拽圆环旋转构件"
      >
        <RotateCw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">旋转</span>
      </button>

      <div className="h-5 w-px bg-outline-variant/30 mx-1" />

      {/* Clip Controls */}
      <button
        className={clip.enabled ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
        onClick={() => setClip({ enabled: !clip.enabled })}
        title="切换剖切面"
      >
        <Scissors className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">剖切</span>
      </button>
      {clip.enabled && (
        <>
          <select
            className="bg-surface border border-outline-variant/50 rounded px-1 py-0.5 text-xs text-on-surface focus:border-primary outline-none w-12"
            value={clip.axis}
            onChange={(e) => setClip({ axis: e.target.value as any })}
          >
            <option value="x">X</option>
            <option value="y">Y</option>
            <option value="z">Z</option>
          </select>
          <ClipSlider />
        </>
      )}

      {/* Blueprint Controls */}
      {blueprint && (
        <>
          <div className="h-5 w-px bg-outline-variant/30 mx-1" />
          <button
            className={blueprint.visible ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
            onClick={() => updateBlueprint({ visible: !blueprint.visible })}
            title="切换底图显隐"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">底图</span>
          </button>
          <input
            type="number"
            step={0.1}
            className="bg-surface border border-outline-variant/50 rounded px-1 py-0.5 text-xs text-on-surface focus:border-primary outline-none w-14 font-mono"
            value={blueprint.scale}
            onChange={(e) => updateBlueprint({ scale: +e.target.value || 1 })}
            title="缩放"
          />
          <input
            type="number"
            step={5}
            className="bg-surface border border-outline-variant/50 rounded px-1 py-0.5 text-xs text-on-surface focus:border-primary outline-none w-14 font-mono"
            value={blueprint.rotation}
            onChange={(e) => updateBlueprint({ rotation: +e.target.value })}
            title="旋转（度）"
          />
          <button
            className={blueprint.snapEnabled ? "btn-glass bg-primary/10 text-primary" : "btn-glass"}
            onClick={() => updateBlueprint({ snapEnabled: !blueprint.snapEnabled })}
            title="构件拖拽时吸附到 DXF 端点"
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn-glass"
            onClick={() => updateBlueprint({ locked: !blueprint.locked })}
            title={blueprint.locked ? "解锁底图" : "锁定底图"}
          >
            {blueprint.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button className="btn-glass text-error hover:text-error-container" onClick={() => setBlueprint(null)} title="移除底图">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function ClipSlider() {
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const components = useStore((s) => s.components);

  // 根据构件包围盒计算滑移条范围
  const ranges = components.map((c) => {
    const p = c.placement;
    const g = c.geometry;
    let min = 0, max = 0;
    if (clip.axis === "x") {
      const hw = (g.b ?? g.Lx ?? g.D ?? 0) / 2;
      min = p.x - hw; max = p.x + hw;
    } else if (clip.axis === "y") {
      const hh = (g.h ?? g.t ?? g.L ?? 0) / 2;
      min = p.y - hh; max = p.y + hh;
    } else {
      const hd = (g.Ly ?? g.L ?? g.h ?? 0) / 2;
      min = p.z - hd; max = p.z + hd;
    }
    return { min, max };
  });

  const globalMin = ranges.length > 0 ? Math.min(...ranges.map((r) => r.min)) : -5000;
  const globalMax = ranges.length > 0 ? Math.max(...ranges.map((r) => r.max)) : 5000;
  const pos = Math.min(Math.max(clip.position, globalMin), globalMax);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="range"
        className="w-20 h-1 appearance-none rounded-full bg-outline-variant/30 accent-primary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
        min={globalMin}
        max={globalMax}
        step={10}
        value={pos}
        onChange={(e) => setClip({ position: +e.target.value })}
        title="拖拽调整剖切面位置"
      />
      <span className="text-label-code text-on-surface-variant w-10 text-right tabular">{pos}</span>
    </div>
  );
}
