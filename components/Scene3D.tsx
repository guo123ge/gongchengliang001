"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { useStore } from "@/lib/store";
import { sceneCaptureRef } from "@/lib/sceneCapture";
import type { Component } from "@/lib/types";
import { buildComponentObject } from "@/lib/three/geometry";
import { buildInstancedScene, getComponentIdFromHit } from "@/lib/three/instanced";
import { endpointsToScene } from "@/lib/dxf/parser";
import { detectCollisions, collisionsToVisuals } from "@/lib/g101/collision";
import { phaseBToVisuals } from "@/lib/g101/phaseBVisuals";
import { phaseCToVisuals } from "@/lib/g101/phaseCVisuals";
import type { CollisionVisual } from "@/lib/g101/collision";
import type { ValidationFocus } from "@/lib/store";

export default function Scene3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const tcompRef = useRef<TransformControls | null>(null);
  const tclipRef = useRef<TransformControls | null>(null);
  const clipMeshRef = useRef<THREE.Mesh | null>(null);

  const components = useStore((s) => s.components);
  const showConcrete = useStore((s) => s.showConcrete);
  const concreteOpacity = useStore((s) => s.concreteOpacity);
  const showRebar = useStore((s) => s.showRebar);
  const showCollisions = useStore((s) => s.showCollisions);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const updateComponent = useStore((s) => s.updateComponent);
  const clip = useStore((s) => s.clip);
  const setClip = useStore((s) => s.setClip);
  const selectedRebarId = useStore((s) => s.selectedRebarId);
  const setSelectedRebar = useStore((s) => s.setSelectedRebar);
  const focusedValidation = useStore((s) => s.focusedValidation);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const cameraView = useStore((s) => s.cameraView);
  const setCameraView = useStore((s) => s.setCameraView);
  const blueprint = useStore((s) => s.blueprint);
  const updateBlueprint = useStore((s) => s.updateBlueprint);
  const blueprintMeshRef = useRef<THREE.Mesh | null>(null);
  const tbpRef = useRef<TransformControls | null>(null);
  const snapPointsRef = useRef<{ x: number; z: number }[]>([]);
  const snapMarkerRef = useRef<THREE.Mesh | null>(null);
  const dimGroupRef = useRef<THREE.Group | null>(null);
  const collisionGroupRef = useRef<THREE.Group | null>(null);

  // 初始化
  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 30, 200);

    const w = mount.clientWidth, h = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(10, 8, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.localClippingEnabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(10, 20, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xc8d8f0, 0.5);
    fill.position.set(-8, 5, -12);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff0e0, 0.3);
    rim.position.set(0, -10, 8);
    scene.add(rim);

    const grid = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.5;
    scene.add(grid);
    scene.add(new THREE.AxesHelper(3));

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;

    const group = new THREE.Group();
    scene.add(group);

    const dimGroup = new THREE.Group();
    dimGroup.name = "dimensions";
    scene.add(dimGroup);
    dimGroupRef.current = dimGroup;

    const collisionGroup = new THREE.Group();
    collisionGroup.name = "collisions";
    scene.add(collisionGroup);
    collisionGroupRef.current = collisionGroup;

    // 构件 TransformControls
    const tcomp = new TransformControls(camera, renderer.domElement);
    tcomp.setMode("translate");
    tcomp.setTranslationSnap(50 / 1000); // 50mm 吸附
    tcomp.addEventListener("dragging-changed", (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value) {
        // 拖拽结束：写回 store
        const obj = tcomp.object as THREE.Object3D | undefined;
        if (obj && obj.userData.componentId) {
          updateComponent(obj.userData.componentId, {
            placement: {
              x: Math.round(obj.position.x * 1000),
              y: Math.round(obj.position.y * 1000),
              z: Math.round(obj.position.z * 1000),
              rot: (obj.rotation.y * 180) / Math.PI,
            },
          });
        }
        // 隐藏吸附标记
        if (snapMarkerRef.current) snapMarkerRef.current.visible = false;
      }
    });
    // 拖拽过程中吸附到最近端点
    tcomp.addEventListener("objectChange", () => {
      const obj = tcomp.object as THREE.Object3D | undefined;
      if (!obj || !(tcomp as any).dragging) return;
      const bp = useStore.getState().blueprint;
      if (!bp || !bp.snapEnabled || snapPointsRef.current.length === 0) return;
      const SNAP = 0.3; // 米
      let best: { x: number; z: number; d: number } | null = null;
      for (const p of snapPointsRef.current) {
        const dx = p.x - obj.position.x, dz = p.z - obj.position.z;
        const d = Math.hypot(dx, dz);
        if (d < SNAP && (!best || d < best.d)) best = { ...p, d };
      }
      const marker = snapMarkerRef.current;
      if (best) {
        obj.position.x = best.x;
        obj.position.z = best.z;
        if (marker) {
          marker.position.set(best.x, 0.05, best.z);
          marker.visible = true;
        }
      } else if (marker) {
        marker.visible = false;
      }
    });
    scene.add((tcomp as any).getHelper ? (tcomp as any).getHelper() : (tcomp as any));
    tcompRef.current = tcomp;

    // 剖切面可视化 + TransformControls（淡化面 + 边框线）
    const _clipPlaneGeo = new THREE.PlaneGeometry(6, 6);
    const clipMesh = new THREE.Mesh(
      _clipPlaneGeo,
      new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    // 边框线（同平面几何体，跟随父对象变换）
    const clipEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(_clipPlaneGeo),
      new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.35 }),
    );
    clipMesh.add(clipEdge);
    clipMesh.userData.kind = "clip";
    clipMesh.visible = false;
    scene.add(clipMesh);
    clipMeshRef.current = clipMesh;

    const tclip = new TransformControls(camera, renderer.domElement);
    tclip.setMode("translate");
    tclip.setTranslationSnap(50 / 1000);
    tclip.addEventListener("dragging-changed", (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value) {
        const c = useStore.getState().clip;
        const pos =
          c.axis === "x" ? clipMesh.position.x :
          c.axis === "y" ? clipMesh.position.y :
          clipMesh.position.z;
        setClip({ position: Math.round(pos * 1000) });
      }
    });
    tclip.attach(clipMesh);
    (tclip as any).visible = false;
    tclip.enabled = false;
    scene.add((tclip as any).getHelper ? (tclip as any).getHelper() : (tclip as any));
    tclipRef.current = tclip;

    // 蓝图 TransformControls（仅在底图存在且未锁定时启用）
    const tbp = new TransformControls(camera, renderer.domElement);
    tbp.setMode("translate");
    tbp.setTranslationSnap(50 / 1000);
    tbp.addEventListener("dragging-changed", (e: any) => {
      orbit.enabled = !e.value;
      if (!e.value) {
        const obj = tbp.object as THREE.Object3D | undefined;
        if (obj) {
          useStore.getState().updateBlueprint({
            offsetX: Math.round(obj.position.x * 1000),
            offsetZ: Math.round(obj.position.z * 1000),
            rotation: Math.round(((obj.rotation.z * 180) / Math.PI) * 10) / 10,
          });
        }
      }
    });
    (tbp as any).visible = false;
    tbp.enabled = false;
    scene.add((tbp as any).getHelper ? (tbp as any).getHelper() : (tbp as any));
    tbpRef.current = tbp;

    // 吸附标记（黄色十字小圆）
    const snapMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.1, 24),
      new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }),
    );
    snapMarker.rotation.x = -Math.PI / 2;
    snapMarker.visible = false;
    snapMarker.renderOrder = 999;
    scene.add(snapMarker);
    snapMarkerRef.current = snapMarker;

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    groupRef.current = group;
    orbitRef.current = orbit;

    const onResize = () => {
      const W = mount.clientWidth, H = mount.clientHeight;
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // 点击拾取构件
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downX = 0, downY = 0;
    const onDown = (e: MouseEvent) => { downX = e.clientX; downY = e.clientY; };
    // 钢筋线的射线检测灵敏度
    ray.params.Line = { threshold: 0.04 };
    const onUp = (e: MouseEvent) => {
      // 拖动则不触发选择
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) return;
      // 当 TransformControls 正在交互时不处理
      if ((tcomp as any).dragging || (tclip as any).dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      const markerHits = collisionGroupRef.current ? ray.intersectObjects(collisionGroupRef.current.children, true) : [];
      if (markerHits.length > 0) {
        let markerTarget: THREE.Object3D | null = markerHits[0].object;
        while (markerTarget && markerTarget.userData.kind !== "collision") markerTarget = markerTarget.parent;
        if (markerTarget?.userData.componentId) {
          const componentId = markerTarget.userData.componentId as string;
          const label = typeof markerTarget.userData.label === "string" ? markerTarget.userData.label : "";
          useStore.getState().setSelectedRebar(null);
          select(componentId);
          useStore.getState().setFocusedValidation({
            componentId,
            message: label,
          });
          useStore.getState().setRightPanelTab("validate");
          return;
        }
      }

      const hits = ray.intersectObjects(group.children, true);
      if (hits.length > 0) {
        const first = hits[0];
        const obj = first.object;

        // 1. 优先检测钢筋线命中（向上遍历找 kind=="rebar" 的 Group）
        let rebarTarget: THREE.Object3D | null = first.object;
        while (rebarTarget && rebarTarget.userData.kind !== "rebar") rebarTarget = rebarTarget.parent;
        if (rebarTarget?.userData.kind === "rebar") {
          const rid = rebarTarget.userData.rebarId as string;
          const cid = rebarTarget.userData.componentId as string;
          const cur = useStore.getState().selectedRebarId;
          useStore.getState().setSelectedRebar(cur === rid ? null : rid, cur === rid ? null : cid);
          return;
        }

        // 2. InstancedMesh 混凝土命中
        if (obj.userData.kind === "instanced-concrete" && obj.userData.componentIds) {
          const ids = obj.userData.componentIds as string[];
          const idx = first.instanceId;
          if (idx != null && ids[idx]) {
            useStore.getState().setSelectedRebar(null);
            select(ids[idx]);
            return;
          }
        }
        // 3. 传统 Object3D 遍历查找构件
        let target: THREE.Object3D | null = first.object;
        while (target && !target.userData.componentId) target = target.parent;
        if (target?.userData.componentId) {
          useStore.getState().setSelectedRebar(null);
          select(target.userData.componentId);
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // 注册截图函数
    sceneCaptureRef.current = (format) => {
      if (!rendererRef.current) return null;
      rendererRef.current.render(scene, camera);
      const mime = format === "jpg" ? "image/jpeg" : "image/png";
      return rendererRef.current.domElement.toDataURL(mime, 0.92);
    };

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      orbit.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      try { tcomp.detach(); (tcomp as any).dispose?.(); } catch {}
      try { tclip.detach(); (tclip as any).dispose?.(); } catch {}
      try { tbp.detach(); (tbp as any).dispose?.(); } catch {}
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [select, updateComponent, setClip]);

  // 重建构件（使用 InstancedMesh 提高性能）
  useEffect(() => {
    const group = groupRef.current;
    const tcomp = tcompRef.current;
    if (!group || !tcomp) return;
    // 拖拽时不重建
    if ((tcomp as any).dragging) return;

    // 清空
    while (group.children.length) {
      const obj = group.children[0];
      group.remove(obj);
      obj.traverse((o: any) => {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
        else o.material?.dispose?.();
      });
    }

    // 选择策略：当构件数 < 20 时用传统方式（保留 TransformControls 精确拾取）
    // 当构件数 >= 20 时用 InstancedMesh（高性能，但 TransformControls 降级）
    const USE_INSTANCED = components.length >= 20;

    if (USE_INSTANCED) {
      // ═══ InstancedMesh 模式 ═══
      const { concreteInstances, rebarObjects } = buildInstancedScene(components, selectedId, {
        showConcrete,
        showRebar,
        concreteOpacity,
      });

        for (const im of concreteInstances) {
        group.add(im);
      }

      for (const ro of rebarObjects) {
        group.add(ro);
      }

      // InstancedMesh 模式下 TransformControls 仅能控制整组，不精确附加到单体
      tcomp.detach();
      (tcomp as any).visible = false;
      tcomp.enabled = false;
    } else {
      // ═══ 传统模式（<20 构件，保留 TransformControls） ═══
      let selectedObj: THREE.Object3D | null = null;
      for (const c of components) {
        const obj = buildComponentObject(c, { showConcrete, showRebar, concreteOpacity });
        if (c.id === selectedId) {
          selectedObj = obj;
          obj.traverse((o: any) => {
            if (o.isMesh && o.material) {
              o.material = o.material.clone();
              o.material.emissive = new THREE.Color(0x2563eb);
              o.material.emissiveIntensity = 0.4;
            }
          });
        }
        group.add(obj);
      }

      // 附加变换控制器到选中构件
      if (selectedObj) {
        tcomp.attach(selectedObj);
        tcomp.setMode(gizmoMode);
        (tcomp as any).visible = true;
        tcomp.enabled = true;
      } else {
        tcomp.detach();
        (tcomp as any).visible = false;
        tcomp.enabled = false;
      }
    }

    // ═══ 碰撞区域可视化（22G101）═══
    const collisionGroup = collisionGroupRef.current;
    if (collisionGroup) {
      // 清空旧的碰撞标记
      while (collisionGroup.children.length) {
        const obj = collisionGroup.children[0];
        collisionGroup.remove(obj);
        obj.traverse((o: any) => {
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
          else o.material?.dispose?.();
        });
      }

      if (showCollisions && components.length > 0) {
        const collisions = components.length >= 2 ? detectCollisions(components) : [];
        const visuals = [...collisionsToVisuals(collisions), ...phaseBToVisuals(components), ...phaseCToVisuals(components)];
        for (const v of visuals) {
          const isFocused = isFocusedIssueVisual(v, focusedValidation);
          const geo = new THREE.BoxGeometry(v.size[0], v.size[1], v.size[2]);
          const mat = new THREE.MeshBasicMaterial({
            color: v.color,
            transparent: true,
            opacity: isFocused ? Math.min(v.opacity + 0.28, 0.78) : v.opacity,
            depthWrite: false,
          });
          const mesh = new THREE.Mesh(geo, mat);
          if (isFocused) mesh.scale.setScalar(1.18);
          mesh.position.set(v.center[0], v.center[1], v.center[2]);
          mesh.userData = { kind: "collision", label: v.label, componentId: v.componentId };
          collisionGroup.add(mesh);

          // 添加边框线
          const edges = new THREE.EdgesGeometry(geo);
          const lineMat = new THREE.LineBasicMaterial({ color: isFocused ? 0xffffff : v.color, transparent: true, opacity: isFocused ? 1 : 0.7 });
          const line = new THREE.LineSegments(edges, lineMat);
          if (isFocused) line.scale.setScalar(1.22);
          line.position.copy(mesh.position);
          line.userData = { kind: "collision", label: v.label, componentId: v.componentId };
          collisionGroup.add(line);

          const label = makeIssueLabelSprite(v.label, isFocused ? 0xffffff : v.color, isFocused);
          label.position.set(v.center[0], v.center[1] + v.size[1] / 2 + (isFocused ? 0.32 : 0.22), v.center[2]);
          label.userData = { kind: "collision", label: v.label, componentId: v.componentId };
          collisionGroup.add(label);
        }
      }
    }
  }, [components, showConcrete, concreteOpacity, showRebar, selectedId, clip, gizmoMode, showCollisions, focusedValidation]);

  // 同步 DXF 蓝图底图（地面平面贴图） + 蓝图 TransformControls + 吸附端点
  useEffect(() => {
    const scene = sceneRef.current;
    const tbp = tbpRef.current;
    if (!scene || !tbp) return;

    // 清理旧的
    if (blueprintMeshRef.current) {
      tbp.detach();
      scene.remove(blueprintMeshRef.current);
      const m = blueprintMeshRef.current;
      m.geometry.dispose();
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map?.dispose();
      mat.dispose();
      blueprintMeshRef.current = null;
    }
    snapPointsRef.current = [];
    (tbp as any).visible = false;
    tbp.enabled = false;

    if (!blueprint || !blueprint.visible) return;

    // eslint-disable-next-line no-console
    console.log("开始加载蓝图:", { widthMm: blueprint.widthMm, heightMm: blueprint.heightMm, scale: blueprint.scale });

    const loader = new THREE.TextureLoader();
    loader.load(
      blueprint.imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const W = (blueprint.widthMm * blueprint.scale) / 1000;
        const H = (blueprint.heightMm * blueprint.scale) / 1000;
        // eslint-disable-next-line no-console
        console.log("蓝图尺寸 (米):", { W, H });
        const geo = new THREE.PlaneGeometry(W, H);
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = (blueprint.rotation * Math.PI) / 180;
        mesh.position.set(blueprint.offsetX / 1000, 0.005, blueprint.offsetZ / 1000);
        mesh.userData.kind = "blueprint";
        mesh.renderOrder = 1;
        scene.add(mesh);
        blueprintMeshRef.current = mesh;
        // eslint-disable-next-line no-console
        console.log("蓝图 mesh 已添加到场景");

        // 蓝图 TransformControls
        if (!blueprint.locked) {
          tbp.attach(mesh);
          (tbp as any).visible = true;
          tbp.enabled = true;
        }
      },
      undefined,
      (err) => {
        // eslint-disable-next-line no-console
        console.error("蓝图贴图加载失败:", err);
      },
    );

    // 计算端点（场景坐标，米）
    if (blueprint.snapEnabled && blueprint.endpoints && blueprint.endpoints.length > 0) {
      snapPointsRef.current = endpointsToScene(blueprint.endpoints, blueprint.bbox, {
        offsetX: blueprint.offsetX,
        offsetZ: blueprint.offsetZ,
        rotation: blueprint.rotation,
        scale: blueprint.scale,
      });
    }
  }, [blueprint]);

  // 同步剖切面可视化与控制器
  useEffect(() => {
    const mesh = clipMeshRef.current;
    const tclip = tclipRef.current;
    if (!mesh || !tclip) return;
    if (!clip.enabled) {
      mesh.visible = false;
      (tclip as any).visible = false;
      tclip.enabled = false;
      return;
    }
    mesh.visible = true;
    (tclip as any).visible = true;
    tclip.enabled = true;
    const pos = clip.position / 1000;
    // 重置朝向
    mesh.rotation.set(0, 0, 0);
    mesh.position.set(0, 0, 0);
    if (clip.axis === "x") {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.x = pos;
      tclip.showX = true; tclip.showY = false; tclip.showZ = false;
    } else if (clip.axis === "y") {
      mesh.rotation.x = Math.PI / 2;
      mesh.position.y = pos;
      tclip.showX = false; tclip.showY = true; tclip.showZ = false;
    } else {
      mesh.position.z = pos;
      tclip.showX = false; tclip.showY = false; tclip.showZ = true;
    }
  }, [clip]);

  // 同步尺寸标注
  const showDimensions = useStore((s) => s.showDimensions);
  useEffect(() => {
    const dimGroup = dimGroupRef.current;
    if (!dimGroup) return;
    // 清除旧标注
    while (dimGroup.children.length) {
      const child = dimGroup.children[0];
      dimGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        const mat = (child as any).material;
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    }
    if (!showDimensions || !selectedId) return;
    const c = components.find((x) => x.id === selectedId);
    if (!c) return;
    const dims = buildDimensionLabels(c);
    for (const d of dims) dimGroup.add(d);
  }, [components, selectedId, showDimensions]);

  // 相机视角切换
  useEffect(() => {
    if (!cameraRef.current || !orbitRef.current || !cameraView) return;
    const cam = cameraRef.current;
    const orbit = orbitRef.current;

    if (cameraView === "tour") {
      orbit.autoRotate = true;
      orbit.autoRotateSpeed = 2.0;
      setCameraView(null);
      return;
    }

    orbit.autoRotate = false;

    const views: Record<string, [number, number, number]> = {
      front: [0, 0, 20],
      top: [0, 20, 0.001],
      side: [-20, 0, 0],
      nw: [-10, 10, -10],
      sw: [-10, 10, 10],
      ne: [10, 10, -10],
      se: [10, 10, 10],
    };

    const pos = views[cameraView];
    if (pos) {
      cam.position.set(pos[0], pos[1], pos[2]);
      orbit.target.set(0, 0, 0);
      orbit.update();
    }
    setCameraView(null);
  }, [cameraView, setCameraView]);

  return <div ref={mountRef} className="absolute inset-0" />;
}

function getClipPlane(axis: "x" | "y" | "z", pos: number): THREE.Plane {
  const n = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  return new THREE.Plane(n, -pos / 1000);
}

function isFocusedIssueVisual(v: CollisionVisual, focus: ValidationFocus | null): boolean {
  if (!focus || focus.componentId !== v.componentId) return false;
  const text = `${v.label} ${focus.rule ?? ""} ${focus.message ?? ""}`.toLowerCase();
  if (!focus.rule && !focus.message) return true;
  if (focus.rule?.includes("洞口")) return text.includes("洞口");
  if (focus.rule?.includes("变截面")) return text.includes("变截面");
  if (focus.rule?.includes("特殊抗震节点")) return text.includes("特殊抗震节点") || text.includes("抗震节点");
  if (focus.rule?.includes("碰撞")) return true;
  if (focus.message && v.label.includes(focus.message)) return true;
  return Boolean(focus.message && focus.message.includes(v.label));
}

function makeIssueLabelSprite(text: string, color: number, focused = false): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontSize = focused ? 30 : 28;
  const maxLength = focused ? 40 : 34;
  const shortText = text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  const width = Math.ceil(ctx.measureText(shortText).width + (focused ? 36 : 28));
  canvas.width = Math.max(width, focused ? 220 : 180);
  canvas.height = focused ? 56 : 48;
  ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = focused ? "rgba(2,12,28,0.94)" : "rgba(5,20,36,0.86)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.lineWidth = focused ? 5 : 3;
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(shortText, focused ? 18 : 14, focused ? 38 : 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const height = focused ? 0.4 : 0.32;
  sprite.scale.set((canvas.width / canvas.height) * height, height, 1);
  sprite.renderOrder = 1001;
  return sprite;
}

function buildDimensionLabels(c: Component): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const g = c.geometry;
  const p = c.placement;
  const rot = ((p.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const px = (p.x || 0) / 1000, py = (p.y || 0) / 1000, pz = (p.z || 0) / 1000;

  const toWorld = (lx: number, ly: number, lz: number) => new THREE.Vector3(
    px + lx * cos - lz * sin,
    py + ly,
    pz + lx * sin + lz * cos
  );

  const textSprite = (text: string, pos: THREE.Vector3, scale = 0.22) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const fontSize = 40;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    const w = ctx.measureText(text).width + 24;
    canvas.width = w;
    canvas.height = fontSize + 16;
    ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillText(text, 12, fontSize + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set((w / (fontSize + 16)) * scale, scale, 1);
    sprite.position.copy(pos);
    sprite.renderOrder = 1000;
    return sprite;
  };

  const _line = (a: THREE.Vector3, b: THREE.Vector3, color = 0xfacc15) => {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 });
    const l = new THREE.Line(geo, mat);
    l.renderOrder = 999;
    return l;
  };

  // 通用施工图纸式尺寸标注：a,b 为局部端点，normal 为偏移方向
  const drawDim = (
    a: THREE.Vector3, b: THREE.Vector3, label: string,
    normal: THREE.Vector3, offset: number
  ) => {
    const n = normal.clone().normalize();
    const a1 = a.clone().add(n.clone().multiplyScalar(offset));
    const b1 = b.clone().add(n.clone().multiplyScalar(offset));
    out.push(_line(a1, b1));          // 标注线
    out.push(_line(a, a1));           // 延伸线 1
    out.push(_line(b, b1));           // 延伸线 2
    const mid = new THREE.Vector3().addVectors(a1, b1).multiplyScalar(0.5);
    mid.add(n.clone().multiplyScalar(0.1));
    out.push(textSprite(label, mid));
  };

  // 统一半尺寸（米）
  let hx = 0, hy = 0, hz = 0;
  if (c.type === "BEAM" || c.type === "COLUMN" || c.type === "STRIP_FOUND" || c.type === "SHEAR_WALL" || c.type === "STAIR") {
    const b = (g.b ?? 0) / 1000, h = (g.h ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    if (c.type === "BEAM" || c.type === "STRIP_FOUND" || c.type === "STAIR") { hx = L / 2; hy = h / 2; hz = b / 2; }
    else { hx = b / 2; hy = L / 2; hz = h / 2; }
  } else if (c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT") {
    const Lx = (g.Lx ?? 0) / 1000, Ly = (g.Ly ?? 0) / 1000, t = (g.t ?? 0) / 1000;
    hx = Lx / 2; hy = t / 2; hz = Ly / 2;
  } else if (c.type === "PILE") {
    const D = (g.D ?? 0) / 1000, L = (g.L ?? 0) / 1000;
    hx = D / 2; hy = L / 2; hz = D / 2;
  }

  const o = 0.5;

  // X 方向（长度 / Lx）：底面后侧边，向后偏移
  const xLabel = c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT"
    ? `${g.Lx}mm` : c.type === "PILE" ? `Φ${g.D}` : `${g.L}mm`;
  drawDim(toWorld(-hx, -hy, -hz), toWorld(hx, -hy, -hz), xLabel, new THREE.Vector3(0, 0, -1), o);

  // Y 方向（高度 / 厚度 / L）：左前侧边，向左偏移
  const yLabel = c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT"
    ? `${g.t}mm` : c.type === "PILE" ? `${g.L}mm` : `${g.h}mm`;
  drawDim(toWorld(-hx, -hy, hz), toWorld(-hx, hy, hz), yLabel, new THREE.Vector3(-1, 0, 0), o);

  // Z 方向（宽度 / Ly / D）：底面右侧边，向下偏移
  const zLabel = c.type === "SLAB" || c.type === "FOUND" || c.type === "PILE_CAP" || c.type === "RAFT"
    ? `${g.Ly}mm` : c.type === "PILE" ? `Φ${g.D}` : `${g.b}mm`;
  drawDim(toWorld(hx, -hy, -hz), toWorld(hx, -hy, hz), zLabel, new THREE.Vector3(0, -1, 0), o);

  return out;
}
