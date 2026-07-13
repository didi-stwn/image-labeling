// ---------- helpers ----------
export const CLIPBOARD_MARKER = "##IMAGE_LABELING_ELS##";
export const uid = () => Math.random().toString(36).slice(2, 10);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const TOOLS = [
  { id: "select", icon: "MousePointer2", label: "Select" },
  { id: "pan", icon: "Hand", label: "Pan" },
  { id: "rect", icon: "Square", label: "Rectangle" },
  { id: "ellipse", icon: "Circle", label: "Ellipse" },
  { id: "triangle", icon: "Triangle", label: "Triangle" },
  { id: "line", icon: "Minus", label: "Line" },
  { id: "arrow", icon: "ArrowUpRight", label: "Arrow" },
  { id: "pen", icon: "Pencil", label: "Pen" },
  { id: "text", icon: "TypeIcon", label: "Text" },
];

export const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#111827", "#ffffff"];

export const SIZE_PRESETS = [
  { label: "FHD (1920×1080)", width: 1920, height: 1080 },
  { label: "HD (1280×720)", width: 1280, height: 720 },
  { label: "Square (1080×1080)", width: 1080, height: 1080 },
  { label: "Square (1:1)", width: 900, height: 900 },
  { label: "4:3 (1024×768)", width: 1024, height: 768 },
  { label: "A4 portrait (2480×3508)", width: 2480, height: 3508 },
  { label: "Custom", width: null, height: null },
];

export function newShape(type, x, y) {
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
export function ShapeSVG({ el }) {
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

// ---------- shared style helpers ----------
export function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function iconBtnStyle(disabled) {
  return {
    width: 34, height: 34, borderRadius: 8, border: "none", background: "#f3f4f6",
    color: disabled ? "#9ca3af" : "#374151", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

export function handleStyle(pos) {
  const base = {
    position: "absolute", width: 9, height: 9, background: "#fff", border: "2px solid #3b82f6",
    borderRadius: 2, zIndex: 5,
  };
  if (pos === "n") {
    base.top = -5; base.left = "50%"; base.marginLeft = -4.5; base.cursor = "ns-resize";
  } else if (pos === "s") {
    base.bottom = -5; base.left = "50%"; base.marginLeft = -4.5; base.cursor = "ns-resize";
  } else if (pos === "e") {
    base.right = -5; base.top = "50%"; base.marginTop = -4.5; base.cursor = "ew-resize";
  } else if (pos === "w") {
    base.left = -5; base.top = "50%"; base.marginTop = -4.5; base.cursor = "ew-resize";
  } else {
    // Corners: nw, ne, sw, se
    if (pos.includes("n")) base.top = -5; else base.bottom = -5;
    if (pos.includes("w")) base.left = -5; else base.right = -5;
    base.cursor = (pos === "nw" || pos === "se") ? "nwse-resize" : "nesw-resize";
  }
  return base;
}

export const kbdStyle = { background: "#e5e7eb", padding: "1px 6px", borderRadius: 4, fontSize: 12 };

export const selectStyle = {
  width: "100%", background: "#ffffff", color: "#1f2937", border: "1px solid #d1d5db",
  borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box"
};
