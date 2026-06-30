import { useState, useRef, useCallback, useEffect } from "react";
import {
  MousePointer2, Square, Circle, Minus, ArrowUpRight, Type as TypeIcon,
  Pencil, Image as ImageIcon, ImagePlus, Trash2, Copy, Download, Undo2, Redo2,
  ClipboardPaste, RotateCw, ClipboardCheck, Triangle,
} from "lucide-react";

// ---------- helpers ----------
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "ellipse", icon: Circle, label: "Ellipse" },
  { id: "triangle", icon: Triangle, label: "Triangle" },
  { id: "line", icon: Minus, label: "Line" },
  { id: "arrow", icon: ArrowUpRight, label: "Arrow" },
  { id: "pen", icon: Pencil, label: "Pen" },
  { id: "text", icon: TypeIcon, label: "Text" },
];

const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#111827", "#ffffff"];

function newShape(type, x, y) {
  const base = {
    id: uid(), type, x, y, width: 1, height: 1, rotation: 0,
    stroke: "#ef4444", strokeWidth: 3, fill: "transparent",
  };
  if (type === "text") {
    return { ...base, width: 160, height: 40, text: "Text", fontSize: 20, color: "#111827", stroke: "none" };
  }
  if (type === "pen") {
    return { ...base, points: [[x, y]], fill: "none" };
  }
  if (type === "line" || type === "arrow") {
    return {
      ...base, points: [[0, 0], [0, 0]], fill: "none",
      headType: type === "arrow" ? "arrow" : "none",
      tailType: "none",
    };
  }
  return base;
}

// ---------- shape rendering (each shape lives inside a div of width x height, rotated) ----------
function ShapeSVG({ el }) {
  const w = Math.max(Math.abs(el.width), 1);
  const h = Math.max(Math.abs(el.height), 1);
  const common = { stroke: el.stroke, strokeWidth: el.strokeWidth, fill: el.fill || "none", vectorEffect: "non-scaling-stroke" };

  if (el.type === "rect") {
    const rw = Math.max(w - el.strokeWidth, 0.01);
    const rh = Math.max(h - el.strokeWidth, 0.01);
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <rect x={el.strokeWidth / 2} y={el.strokeWidth / 2} width={rw} height={rh} rx={6} {...common} />
      </svg>
    );
  }
  if (el.type === "ellipse") {
    const rx = Math.max((w - el.strokeWidth) / 2, 0.01);
    const ry = Math.max((h - el.strokeWidth) / 2, 0.01);
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <ellipse cx={w / 2} cy={h / 2} rx={rx} ry={ry} {...common} />
      </svg>
    );
  }
  if (el.type === "triangle") {
    const sw = el.strokeWidth;
    const points = `${w / 2},${sw / 2} ${w - sw / 2},${h - sw / 2} ${sw / 2},${h - sw / 2}`;
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <polygon points={points} {...common} strokeLinejoin="round" />
      </svg>
    );
  }
  if (el.type === "line" || el.type === "arrow") {
    const startMarkerId = `arrow-start-${el.id}`;
    const endMarkerId = `arrow-end-${el.id}`;
    const headType = el.headType || (el.type === "arrow" ? "arrow" : "none");
    const tailType = el.tailType || "none";
    const pts = el.points && el.points.length === 2 ? el.points : [[0, 0], [1, 1]];
    const [[fx1, fy1], [fx2, fy2]] = pts;
    const x1 = fx1 * w, y1 = fy1 * h, x2 = fx2 * w, y2 = fy2 * h;
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
        <defs>
          {tailType === "arrow" && (
            <marker id={startMarkerId} markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M6,0 L0,3 L6,6 Z" fill={el.stroke} />
            </marker>
          )}
          {headType === "arrow" && (
            <marker id={endMarkerId} markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L6,3 L0,6 Z" fill={el.stroke} />
            </marker>
          )}
        </defs>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={el.stroke} strokeWidth={el.strokeWidth}
          markerStart={tailType === "arrow" ? `url(#${startMarkerId})` : undefined}
          markerEnd={headType === "arrow" ? `url(#${endMarkerId})` : undefined}
          vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  if (el.type === "pen") {
    const d = el.points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0] - el.x},${p[1] - el.y}`).join(" ");
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }} preserveAspectRatio="none">
        <path d={d} stroke={el.stroke} strokeWidth={el.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

export default function App() {
  const [bgImage, setBgImage] = useState(null); // {src, width, height}
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 560 });
  const [canvasColor, setCanvasColor] = useState("#ffffff");
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null); // null | "copied" | "failed"

  const canvasRef = useRef(null);
  const dragRef = useRef(null); // info about ongoing drag/draw/resize/rotate

  const pushHistory = useCallback((els) => {
    setHistory((h) => [...h.slice(-49), els]);
    setFuture([]);
  }, []);

  const updateElements = useCallback((updater, recordHistory = true) => {
    setElements((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (recordHistory) pushHistory(prev);
      return next;
    });
  }, [pushHistory]);

  // ---------- clipboard paste (image) ----------
  useEffect(() => {
    const onPaste = (e) => {
      if (editingTextId) return; // let text editing handle its own paste
      const items = e.clipboardData?.items || [];
      for (const item of items) {
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (!bgImage) {
            loadImageFile(file);
          } else {
            addOverlayImage(file);
          }
          e.preventDefault();
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editingTextId, bgImage, addOverlayImage]);

  function loadImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        setBgImage({ src: ev.target.result, width: img.width, height: img.height });
        setCanvasSize({ width: img.width, height: img.height });
        setElements([]);
        setHistory([]);
        setFuture([]);
        setSelectedId(null);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearBackgroundImage() {
    setBgImage(null);
    setSelectedId("__canvas__");
  }

  function addOverlayImage(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvasW = canvasSize.width;
        const canvasH = canvasSize.height;
        const maxDim = 300;
        const ratio = Math.min(maxDim / img.width, maxDim / img.height, 1);
        const w = img.width * ratio, h = img.height * ratio;
        const el = {
          id: uid(), type: "image", src: ev.target.result,
          x: (canvasW - w) / 2, y: (canvasH - h) / 2, width: w, height: h, rotation: 0,
        };
        updateElements((prev) => [...prev, el]);
        setSelectedId(el.id);
        setTool("select");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleUpload(e) {
    const file = e.target.files?.[0];
    loadImageFile(file);
    e.target.value = "";
  }

  function handleOverlayUpload(e) {
    const file = e.target.files?.[0];
    addOverlayImage(file);
    e.target.value = "";
  }

  // ---------- pointer logic on canvas ----------
  function getCanvasPoint(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onCanvasPointerDown(e) {
    if (e.target.closest(".no-canvas-drag")) return;
    const pt = getCanvasPoint(e);

    if (tool === "select") {
      setSelectedId("__canvas__");
      return;
    }

    const el = newShape(tool, pt.x, pt.y);
    el.stroke = color;
    el.strokeWidth = strokeWidth;
    if (tool === "text") el.color = color;

    updateElements((prev) => [...prev, el]);
    setSelectedId(el.id);

    dragRef.current = { mode: "draw", id: el.id, startX: pt.x, startY: pt.y, type: tool };
    if (tool !== "text") {
      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
    } else {
      setTool("select");
      setTimeout(() => setEditingTextId(el.id), 0);
    }
  }

  function onWindowPointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const pt = getCanvasPoint(e);

    if (drag.mode === "draw") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        if (el.type === "pen") {
          const allPts = [...el.points, [pt.x, pt.y]];
          const xs = allPts.map((p) => p[0]), ys = allPts.map((p) => p[1]);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minY = Math.min(...ys), maxY = Math.max(...ys);
          return {
            ...el, x: minX, y: minY,
            width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1),
            points: allPts,
          };
        }
        if (el.type === "line" || el.type === "arrow") {
          const w = Math.max(Math.abs(dx), 1), h = Math.max(Math.abs(dy), 1);
          const newX = Math.min(drag.startX, pt.x);
          const newY = Math.min(drag.startY, pt.y);
          const start = [(drag.startX - newX) / w, (drag.startY - newY) / h];
          const end = [(pt.x - newX) / w, (pt.y - newY) / h];
          return { ...el, x: newX, y: newY, width: w, height: h, points: [start, end] };
        }
        const x = dx < 0 ? drag.startX + dx : drag.startX;
        const y = dy < 0 ? drag.startY + dy : drag.startY;
        return { ...el, x, y, width: Math.abs(dx) || 1, height: Math.abs(dy) || 1 };
      }), false);
    } else if (drag.mode === "move") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        const moved = { ...el, x: drag.origX + dx, y: drag.origY + dy };
        if (el.type === "pen") {
          moved.points = drag.origPoints.map(([px, py]) => [px + dx, py + dy]);
        }
        return moved;
      }), false);
    } else if (drag.mode === "resize") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        let { x, y, width, height } = { x: drag.origX, y: drag.origY, width: drag.origW, height: drag.origH };
        if (drag.handle.includes("e")) width = Math.max(8, drag.origW + dx);
        if (drag.handle.includes("s")) height = Math.max(8, drag.origH + dy);
        if (drag.handle.includes("w")) { width = Math.max(8, drag.origW - dx); x = drag.origX + (drag.origW - width); }
        if (drag.handle.includes("n")) { height = Math.max(8, drag.origH - dy); y = drag.origY + (drag.origH - height); }
        return { ...el, x, y, width, height };
      }), false);
    } else if (drag.mode === "rotate") {
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
        const angle = Math.atan2(pt.y - cy, pt.x - cx) * (180 / Math.PI) + 90;
        return { ...el, rotation: Math.round(angle) };
      }), false);
    } else if (drag.mode === "canvas-resize") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      setCanvasSize(() => {
        let w = drag.origW, h = drag.origH;
        if (drag.handle.includes("e")) w = clamp(drag.origW + dx, 50, 4000);
        if (drag.handle.includes("s")) h = clamp(drag.origH + dy, 50, 4000);
        return { width: w, height: h };
      });
    }
  }

  function onWindowPointerUp() {
    const wasCanvasResize = dragRef.current?.mode === "canvas-resize";
    dragRef.current = null;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    if (wasCanvasResize) return;
    // commit final state into history (re-sync by pushing current as a checkpoint)
    setElements((prev) => {
      pushHistory(prev);
      return prev;
    });
  }

  function startMove(e, el) {
    if (tool !== "select") return;
    e.stopPropagation();
    setSelectedId(el.id);
    const pt = getCanvasPoint(e);
    dragRef.current = { mode: "move", id: el.id, startX: pt.x, startY: pt.y, origX: el.x, origY: el.y, origPoints: el.points };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  }

  function startResize(e, el, handle) {
    e.stopPropagation();
    const pt = getCanvasPoint(e);
    dragRef.current = { mode: "resize", id: el.id, handle, startX: pt.x, startY: pt.y, origX: el.x, origY: el.y, origW: el.width, origH: el.height };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  }

  function startRotate(e, el) {
    e.stopPropagation();
    dragRef.current = { mode: "rotate", id: el.id };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  }

  function startCanvasResize(e, handle) {
    e.stopPropagation();
    const pt = getCanvasPoint(e);
    dragRef.current = { mode: "canvas-resize", handle, startX: pt.x, startY: pt.y, origW: canvasSize.width, origH: canvasSize.height };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  }

  // ---------- actions ----------
  function deleteSelected() {
    if (!selectedId || selectedId === "__canvas__") return;
    updateElements((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!selectedId || selectedId === "__canvas__") return;
    updateElements((prev) => {
      const el = prev.find((e) => e.id === selectedId);
      if (!el) return prev;
      const copy = { ...el, id: uid(), x: el.x + 16, y: el.y + 16 };
      if (el.type === "pen") copy.points = el.points.map(([px, py]) => [px + 16, py + 16]);
      setSelectedId(copy.id);
      return [...prev, copy];
    });
  }

  function changeSelectedColor(c) {
    setColor(c);
    if (selectedId === "__canvas__") {
      if (!bgImage) setCanvasColor(c);
      return;
    }
    if (!selectedId) return;
    updateElements((prev) => prev.map((el) => el.id === selectedId
      ? { ...el, stroke: el.type === "text" ? el.stroke : c, color: el.type === "text" ? c : el.color }
      : el));
  }

  function undo() {
    if (!history.length) return;
    setFuture((f) => [elements, ...f]);
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setElements(prev);
  }

  function redo() {
    if (!future.length) return;
    setHistory((h) => [...h, elements]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    setElements(next);
  }

  useEffect(() => {
    const onKey = (e) => {
      if (editingTextId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { deleteSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedId) { e.preventDefault(); duplicateSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !window.getSelection()?.toString()) { e.preventDefault(); copyAsImage(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function buildExportCanvas() {
    const canvasEl = canvasRef.current;
    const rect = canvasEl.getBoundingClientRect();
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", rect.width);
    svg.setAttribute("height", rect.height);
    svg.setAttribute("xmlns", svgNS);

    if (bgImage) {
      const img = document.createElementNS(svgNS, "image");
      img.setAttributeNS("http://www.w3.org/1999/xlink", "href", bgImage.src);
      img.setAttribute("x", 0); img.setAttribute("y", 0);
      img.setAttribute("width", rect.width); img.setAttribute("height", rect.height);
      svg.appendChild(img);
    }
    elements.forEach((el) => {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", `translate(${el.x},${el.y}) rotate(${el.rotation || 0}, ${el.width / 2}, ${el.height / 2})`);
      if (el.type === "text") {
        const lines = (el.text || "").split("\n");
        const text = document.createElementNS(svgNS, "text");
        text.setAttribute("font-family", "Inter, Arial, sans-serif");
        text.setAttribute("font-weight", "600");
        text.setAttribute("font-size", el.fontSize);
        text.setAttribute("fill", el.color);
        text.setAttribute("x", 0);
        text.setAttribute("y", el.fontSize);
        lines.forEach((line, i) => {
          const tspan = document.createElementNS(svgNS, "tspan");
          tspan.setAttribute("x", 0);
          tspan.setAttribute("dy", i === 0 ? 0 : el.fontSize * 1.2);
          tspan.textContent = line;
          text.appendChild(tspan);
        });
        g.appendChild(text);
      } else if (el.type === "image") {
        const img = document.createElementNS(svgNS, "image");
        img.setAttributeNS("http://www.w3.org/1999/xlink", "href", el.src);
        img.setAttribute("x", 0); img.setAttribute("y", 0);
        img.setAttribute("width", el.width); img.setAttribute("height", el.height);
        img.setAttribute("preserveAspectRatio", "none");
        g.appendChild(img);
      } else {
        const inner = document.createElementNS(svgNS, "g");
        const w = Math.max(Math.abs(el.width), 1), h = Math.max(Math.abs(el.height), 1);
        if (el.type === "rect") {
          const r = document.createElementNS(svgNS, "rect");
          r.setAttribute("x", el.strokeWidth / 2); r.setAttribute("y", el.strokeWidth / 2);
          r.setAttribute("width", Math.max(w - el.strokeWidth, 0.01)); r.setAttribute("height", Math.max(h - el.strokeWidth, 0.01));
          r.setAttribute("rx", 6); r.setAttribute("stroke", el.stroke); r.setAttribute("stroke-width", el.strokeWidth); r.setAttribute("fill", el.fill || "none");
          inner.appendChild(r);
        } else if (el.type === "ellipse") {
          const c = document.createElementNS(svgNS, "ellipse");
          c.setAttribute("cx", w / 2); c.setAttribute("cy", h / 2);
          c.setAttribute("rx", Math.max((w - el.strokeWidth) / 2, 0.01)); c.setAttribute("ry", Math.max((h - el.strokeWidth) / 2, 0.01));
          c.setAttribute("stroke", el.stroke); c.setAttribute("stroke-width", el.strokeWidth); c.setAttribute("fill", el.fill || "none");
          inner.appendChild(c);
        } else if (el.type === "triangle") {
          const sw = el.strokeWidth;
          const poly = document.createElementNS(svgNS, "polygon");
          poly.setAttribute("points", `${w / 2},${sw / 2} ${w - sw / 2},${h - sw / 2} ${sw / 2},${h - sw / 2}`);
          poly.setAttribute("stroke", el.stroke); poly.setAttribute("stroke-width", el.strokeWidth);
          poly.setAttribute("fill", el.fill || "none"); poly.setAttribute("stroke-linejoin", "round");
          inner.appendChild(poly);
        } else if (el.type === "line" || el.type === "arrow") {
          const l = document.createElementNS(svgNS, "line");
          const pts = el.points && el.points.length === 2 ? el.points : [[0, 0], [1, 1]];
          const [[fx1, fy1], [fx2, fy2]] = pts;
          l.setAttribute("x1", fx1 * w); l.setAttribute("y1", fy1 * h);
          l.setAttribute("x2", fx2 * w); l.setAttribute("y2", fy2 * h);
          l.setAttribute("stroke", el.stroke); l.setAttribute("stroke-width", el.strokeWidth);
          const headType = el.headType || (el.type === "arrow" ? "arrow" : "none");
          const tailType = el.tailType || "none";
          if (headType === "arrow" || tailType === "arrow") {
            const defs = document.createElementNS(svgNS, "defs");
            if (headType === "arrow") {
              const endId = `export-arrow-end-${el.id}`;
              const marker = document.createElementNS(svgNS, "marker");
              marker.setAttribute("id", endId); marker.setAttribute("markerWidth", "10"); marker.setAttribute("markerHeight", "10");
              marker.setAttribute("refX", "6"); marker.setAttribute("refY", "3"); marker.setAttribute("orient", "auto"); marker.setAttribute("markerUnits", "strokeWidth");
              const p = document.createElementNS(svgNS, "path");
              p.setAttribute("d", "M0,0 L6,3 L0,6 Z"); p.setAttribute("fill", el.stroke);
              marker.appendChild(p); defs.appendChild(marker);
              l.setAttribute("marker-end", `url(#${endId})`);
            }
            if (tailType === "arrow") {
              const startId = `export-arrow-start-${el.id}`;
              const marker = document.createElementNS(svgNS, "marker");
              marker.setAttribute("id", startId); marker.setAttribute("markerWidth", "10"); marker.setAttribute("markerHeight", "10");
              marker.setAttribute("refX", "6"); marker.setAttribute("refY", "3"); marker.setAttribute("orient", "auto"); marker.setAttribute("markerUnits", "strokeWidth");
              const p = document.createElementNS(svgNS, "path");
              p.setAttribute("d", "M6,0 L0,3 L6,6 Z"); p.setAttribute("fill", el.stroke);
              marker.appendChild(p); defs.appendChild(marker);
              l.setAttribute("marker-start", `url(#${startId})`);
            }
            svg.appendChild(defs);
          }
          inner.appendChild(l);
        } else if (el.type === "pen") {
          const p = document.createElementNS(svgNS, "path");
          const d = el.points.map((pp, i) => `${i === 0 ? "M" : "L"}${pp[0] - el.x},${pp[1] - el.y}`).join(" ");
          p.setAttribute("d", d); p.setAttribute("stroke", el.stroke); p.setAttribute("stroke-width", el.strokeWidth);
          p.setAttribute("fill", "none"); p.setAttribute("stroke-linecap", "round");
          inner.appendChild(p);
        }
        g.appendChild(inner);
      }
      svg.appendChild(g);
    });

    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    return new Promise((resolve, reject) => {
      const tmpImg = new window.Image();
      tmpImg.onload = () => {
        const canvasOut = document.createElement("canvas");
        canvasOut.width = rect.width; canvasOut.height = rect.height;
        const ctx = canvasOut.getContext("2d");
        ctx.drawImage(tmpImg, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvasOut);
      };
      tmpImg.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      tmpImg.src = url;
    });
  }

  async function exportPNG() {
    const canvasOut = await buildExportCanvas();
    const link = document.createElement("a");
    link.download = "edited-image.png";
    link.href = canvasOut.toDataURL("image/png");
    link.click();
  }

  async function copyAsImage() {
    try {
      const canvasOut = await buildExportCanvas();
      canvasOut.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopyStatus("copied");
        } catch (err) {
          setCopyStatus("failed");
        }
        setTimeout(() => setCopyStatus(null), 1800);
      }, "image/png");
    } catch (err) {
      setCopyStatus("failed");
      setTimeout(() => setCopyStatus(null), 1800);
    }
  }

  const selectedEl = elements.find((e) => e.id === selectedId);
  const canvasW = canvasSize.width;
  const canvasH = canvasSize.height;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: "#1c1f26", fontFamily: "Inter, system-ui, sans-serif", color: "#e5e7eb" }}>
      {/* Sidebar */}
      <div style={{ width: 72, background: "#14161b", borderRight: "1px solid #262a33", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 6 }}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = tool === t.id;
          return (
            <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
              style={{
                width: 46, height: 46, borderRadius: 10, border: "none", cursor: "pointer",
                background: active ? "#3b82f6" : "transparent", color: active ? "#fff" : "#9ca3af",
                display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
              }}>
              <Icon size={20} />
            </button>
          );
        })}
        <div style={{ width: 32, height: 1, background: "#262a33", margin: "10px 0" }} />
        <label title="Set background image" style={{ width: 46, height: 46, borderRadius: 10, background: "transparent", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ImageIcon size={20} />
          <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
        </label>
        <label title="Add image overlay" style={{ width: 46, height: 46, borderRadius: 10, background: "transparent", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ImagePlus size={20} />
          <input type="file" accept="image/*" onChange={handleOverlayUpload} style={{ display: "none" }} />
        </label>
        <button title="Ctrl/Cmd+V pastes: sets background if empty, otherwise adds an overlay image" onClick={() => { }} style={{ width: 46, height: 46, borderRadius: 10, border: "none", background: "transparent", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
          <ClipboardPaste size={20} />
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Top toolbar */}
        <div style={{ height: 56, background: "#181b21", borderBottom: "1px solid #262a33", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
          <strong style={{ fontSize: 22, letterSpacing: 0.3, marginRight: 8 }}>Image&nbsp;Labeling</strong>
          <div style={{ width: 1, height: 24, background: "#262a33" }} />
          {COLORS.map((c) => (
            <button key={c} onClick={() => changeSelectedColor(c)}
              style={{
                width: 22, height: 22, borderRadius: "50%", border: color === c ? "2px solid #fff" : "1px solid #3a3f4a",
                background: c, cursor: "pointer",
              }} />
          ))}
          <input type="range" min={1} max={16} value={strokeWidth}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStrokeWidth(v);
              if (selectedId && selectedId !== "__canvas__") updateElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, strokeWidth: v } : el));
            }}
            style={{ width: 90 }} title="Stroke width" />
          <div style={{ width: 1, height: 24, background: "#262a33" }} />
          <button onClick={undo} disabled={!history.length} style={iconBtnStyle(!history.length)} title="Undo"><Undo2 size={18} /></button>
          <button onClick={redo} disabled={!future.length} style={iconBtnStyle(!future.length)} title="Redo"><Redo2 size={18} /></button>
          <button onClick={duplicateSelected} disabled={!selectedId || selectedId === "__canvas__"} style={iconBtnStyle(!selectedId || selectedId === "__canvas__")} title="Duplicate"><Copy size={18} /></button>
          <button onClick={deleteSelected} disabled={!selectedId || selectedId === "__canvas__"} style={iconBtnStyle(!selectedId || selectedId === "__canvas__")} title="Delete"><Trash2 size={18} /></button>
          <div style={{ flex: 1 }} />
          <button onClick={copyAsImage} style={{ ...iconBtnStyle(false), display: "flex", gap: 6, alignItems: "center", padding: "0 12px", width: "auto" }} title="Copy canvas to clipboard">
            <ClipboardCheck size={16} />
            {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy failed" : "Copy image"}
          </button>
          <button onClick={exportPNG} style={{ ...iconBtnStyle(false), background: "#3b82f6", color: "#fff", display: "flex", gap: 6, alignItems: "center", padding: "0 12px", width: "auto" }}>
            <Download size={16} /> Export PNG
          </button>
        </div>

        {/* Canvas area */}
        <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", padding: 32, background: "#1c1f26", position: "relative" }}>
          <div
            ref={canvasRef}
            onPointerDown={onCanvasPointerDown}
            style={{
              position: "relative", width: canvasW, height: canvasH,
              background: bgImage ? `url(${bgImage.src})` : canvasColor,
              backgroundSize: "100% 100%",
              boxShadow: selectedId === "__canvas__"
                ? "0 0 0 2px #3b82f6, 0 10px 30px rgba(0,0,0,.4)"
                : "0 0 0 1px #2c313b, 0 10px 30px rgba(0,0,0,.4)",
              borderRadius: 4, cursor: tool === "select" ? "default" : "crosshair", flexShrink: 0,
            }}
          >
            {!bgImage && elements.length === 0 && (
              <div style={{ position: "absolute", color: "#6b7280", fontSize: 14, textAlign: "center", bottom: 50, width: "100%" }}>
                Paste an image with <kbd style={kbdStyle}>Ctrl/Cmd+V</kbd> or upload one from the sidebar to start.
                <br />You can still draw shapes on a blank canvas below.
              </div>
            )}
            {elements.map((el) => {
              const isSelected = el.id === selectedId;
              return (
                <div key={el.id}
                  onPointerDown={(e) => startMove(e, el)}
                  onDoubleClick={() => el.type === "text" && setEditingTextId(el.id)}
                  style={{
                    position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height,
                    transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: "center center",
                    outline: isSelected ? "1px dashed #3b82f6" : "none",
                    cursor: tool === "select" ? "move" : "default",
                  }}>
                  {el.type === "text" ? (
                    editingTextId === el.id ? (
                      <textarea
                        autoFocus
                        className="no-canvas-drag"
                        defaultValue={el.text}
                        onBlur={(e) => {
                          updateElements((prev) => prev.map((p) => p.id === el.id ? { ...p, text: e.target.value } : p));
                          setEditingTextId(null);
                        }}
                        style={{
                          width: "100%", height: "100%", fontSize: el.fontSize, color: el.color,
                          fontWeight: 600, border: "1px dashed #3b82f6", background: "rgba(255,255,255,.85)",
                          resize: "none", outline: "none", fontFamily: "inherit", padding: 2,
                        }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", fontSize: el.fontSize, color: el.color, fontWeight: 600, whiteSpace: "pre-wrap", userSelect: "none", padding: 2 }}>
                        {el.text}
                      </div>
                    )
                  ) : el.type === "image" ? (
                    <img src={el.src} draggable={false} alt="shape"
                      style={{ width: "100%", height: "100%", objectFit: "fill", userSelect: "none", pointerEvents: "none" }} />
                  ) : (
                    <ShapeSVG el={el} />
                  )}

                  {isSelected && tool === "select" && (
                    <>
                      {["nw", "ne", "sw", "se"].map((h) => (
                        <div key={h} className="no-canvas-drag" onPointerDown={(e) => startResize(e, el, h)}
                          style={handleStyle(h)} />
                      ))}
                      <div className="no-canvas-drag" onPointerDown={(e) => startRotate(e, el)}
                        style={{
                          position: "absolute", left: "50%", top: -26, width: 16, height: 16, marginLeft: -8,
                          borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
                          cursor: "grab", color: "#fff",
                        }}>
                        <RotateCw size={10} />
                      </div>
                    </>
                  )}
                </div>
              );
            })}
            {selectedId === "__canvas__" && tool === "select" && (
              <>
                <div className="no-canvas-drag" onPointerDown={(e) => startCanvasResize(e, "e")}
                  style={{ position: "absolute", top: "50%", right: -6, width: 10, height: 36, marginTop: -18, background: "#3b82f6", borderRadius: 4, cursor: "ew-resize" }} />
                <div className="no-canvas-drag" onPointerDown={(e) => startCanvasResize(e, "s")}
                  style={{ position: "absolute", left: "50%", bottom: -6, width: 36, height: 10, marginLeft: -18, background: "#3b82f6", borderRadius: 4, cursor: "ns-resize" }} />
                <div className="no-canvas-drag" onPointerDown={(e) => startCanvasResize(e, "se")}
                  style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: "#3b82f6", border: "2px solid #fff", borderRadius: 3, cursor: "nwse-resize" }} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right inspector */}
      <div style={{ width: 300, minWidth: 300, background: "#14161b", borderLeft: "1px solid #262a33", padding: 16, fontSize: 13, boxSizing: "border-box" }}>
        <div style={{ color: "#9ca3af", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.6, marginBottom: 10 }}>Inspector</div>
        {selectedId === "__canvas__" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Row label="Type" value="canvas" />
            <div>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>Width (px)</div>
              <input type="number" min={50} max={4000} value={canvasSize.width}
                onChange={(e) => setCanvasSize((s) => ({ ...s, width: clamp(Number(e.target.value) || 1, 50, 4000) }))}
                style={selectStyle} />
            </div>
            <div>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>Height (px)</div>
              <input type="number" min={50} max={4000} value={canvasSize.height}
                onChange={(e) => setCanvasSize((s) => ({ ...s, height: clamp(Number(e.target.value) || 1, 50, 4000) }))}
                style={selectStyle} />
            </div>
            {!bgImage && (
              <div>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>Canvas color</div>
                <input type="color" value={canvasColor} onChange={(e) => setCanvasColor(e.target.value)}
                  style={{ width: "100%", height: 32, border: "1px solid #2c313b", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
              </div>
            )}
            {bgImage && (
              <button onClick={clearBackgroundImage}
                style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#fca5a5", border: "1px solid #3a2030" }}>
                <Trash2 size={14} /> Remove background image
              </button>
            )}
            <div style={{ color: "#6b7280", lineHeight: 1.5, marginTop: 4, fontSize: 12 }}>
              The canvas itself can't be deleted — only the background image and overlays on it.
            </div>
          </div>
        ) : selectedEl ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Row label="Type" value={selectedEl.type} />
            <Row label="X" value={Math.round(selectedEl.x)} />
            <Row label="Y" value={Math.round(selectedEl.y)} />
            <Row label="Width" value={Math.round(selectedEl.width)} />
            <Row label="Height" value={Math.round(selectedEl.height)} />
            <Row label="Rotation" value={`${Math.round(selectedEl.rotation || 0)}°`} />
            {selectedEl.type === "text" && (
              <div>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>Font size</div>
                <input type="range" min={10} max={64} value={selectedEl.fontSize}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, fontSize: v } : p));
                  }} style={{ width: "100%" }} />
              </div>
            )}
            {(selectedEl.type === "line" || selectedEl.type === "arrow") && (
              <>
                <div>
                  <div style={{ color: "#6b7280", marginBottom: 4 }}>Tail (start)</div>
                  <select value={selectedEl.tailType || "none"}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, tailType: v } : p));
                    }}
                    style={selectStyle}>
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                  </select>
                </div>
                <div>
                  <div style={{ color: "#6b7280", marginBottom: 4 }}>Head (end)</div>
                  <select value={selectedEl.headType || "none"}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, headType: v } : p));
                    }}
                    style={selectStyle}>
                    <option value="none">None</option>
                    <option value="arrow">Arrow</option>
                  </select>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ color: "#6b7280", lineHeight: 1.5 }}>
            Select an element to see and edit its properties.
            <br /><br />
            <strong style={{ color: "#9ca3af" }}>Shortcuts</strong>
            <br />Delete – remove
            <br />Ctrl/Cmd+D – duplicate
            <br />Ctrl/Cmd+Z – undo
            <br />Ctrl/Cmd+Shift+Z – redo
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function iconBtnStyle(disabled) {
  return {
    width: 34, height: 34, borderRadius: 8, border: "none", background: "#202430",
    color: disabled ? "#4b5563" : "#d1d5db", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function handleStyle(pos) {
  const base = {
    position: "absolute", width: 9, height: 9, background: "#fff", border: "2px solid #3b82f6",
    borderRadius: 2, zIndex: 5,
  };
  if (pos.includes("n")) base.top = -5; else base.bottom = -5;
  if (pos.includes("w")) base.left = -5; else base.right = -5;
  base.cursor = (pos === "nw" || pos === "se") ? "nwse-resize" : "nesw-resize";
  return base;
}

const kbdStyle = { background: "#262a33", padding: "1px 6px", borderRadius: 4, fontSize: 12 };

const selectStyle = {
  width: "100%", background: "#202430", color: "#e5e7eb", border: "1px solid #2c313b",
  borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box"
};