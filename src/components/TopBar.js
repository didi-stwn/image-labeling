import { Undo2, Redo2, Copy, Trash2, ZoomOut, ZoomIn, ClipboardCheck, Download } from "lucide-react";
import { COLORS, clamp, iconBtnStyle } from "../constants";

export default function TopBar({
  color, setColor,
  strokeWidth, setStrokeWidth,
  undo, redo,
  history, future,
  duplicateSelected, deleteSelected,
  zoom, setZoom,
  copyAsImage, copyStatus,
  exportPNG,
  updateElements,
  selectedId,
  changeSelectedColor,
  hasSelection,
}) {
  return (
    <div style={{
      height: 56, background: "#ffffff", borderBottom: "1px solid #e5e7eb",
      display: "flex", alignItems: "center", padding: "0 16px", gap: 10,
    }}>
      <strong style={{ fontSize: 22, letterSpacing: 0.3, marginRight: 8, color: "#1f2937" }}>Image&nbsp;Labeling</strong>
      <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
      {COLORS.map((c) => (
        <button key={c} onClick={() => changeSelectedColor(c)}
          style={{
            width: 22, height: 22, borderRadius: "50%", border: color === c ? "2px solid #1f2937" : "1px solid #d1d5db",
            background: c, cursor: "pointer",
          }} />
      ))}
      <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
      <label
        style={{
          width: 22, height: 22, borderRadius: "50%",
          border: "1px solid #d1d5db", background: color,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, color: "#fff",
        }}
        title="Pick custom color">
        <input type="color" value={color} onChange={(e) => changeSelectedColor(e.target.value)}
          style={{ width: 0, height: 0, border: "none", padding: 0, opacity: 0, position: "absolute" }} />
      </label>
      <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
      <input type="range" min={1} max={32} value={strokeWidth}
        onChange={(e) => {
          const v = Number(e.target.value);
          setStrokeWidth(v);
          if (selectedId && selectedId !== "__canvas__") updateElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, strokeWidth: v } : el));
        }}
        style={{ width: 90 }} title="Stroke width" />
      <span style={{ fontSize: 12, color: "#6b7280", minWidth: 20, textAlign: "center" }}>{strokeWidth}px</span>
      <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
      <button onClick={undo} disabled={!history.length} style={iconBtnStyle(!history.length)} title="Undo"><Undo2 size={18} /></button>
      <button onClick={redo} disabled={!future.length} style={iconBtnStyle(!future.length)} title="Redo"><Redo2 size={18} /></button>
      <button onClick={duplicateSelected} disabled={!hasSelection} style={iconBtnStyle(!hasSelection)} title="Duplicate (Ctrl/Cmd+D)"><Copy size={18} /></button>
      <button onClick={deleteSelected} disabled={!hasSelection} style={iconBtnStyle(!hasSelection)} title="Delete"><Trash2 size={18} /></button>
      <div style={{ flex: 1 }} />
      <div style={{ width: 1, height: 24, background: "#e5e7eb" }} />
      <button onClick={() => setZoom((z) => clamp(z - 0.1, 0.1, 5))} style={iconBtnStyle(false)} title="Zoom out">
        <ZoomOut size={18} />
      </button>
      <span style={{ fontSize: 12, color: "#6b7280", minWidth: 44, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom((z) => clamp(z + 0.1, 0.1, 5))} style={iconBtnStyle(false)} title="Zoom in">
        <ZoomIn size={18} />
      </button>
      <button onClick={() => setZoom(1)} style={{ ...iconBtnStyle(false), fontSize: 11, padding: "0 8px", width: "auto" }} title="Reset zoom">
        Fit
      </button>
      <button onClick={copyAsImage} style={{ ...iconBtnStyle(false), display: "flex", gap: 6, alignItems: "center", padding: "0 12px", width: "auto" }} title="Copy canvas to clipboard">
        <ClipboardCheck size={16} />
        {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy failed" : "Copy image"}
      </button>
      <button onClick={exportPNG} style={{ ...iconBtnStyle(false), background: "#3b82f6", color: "#fff", display: "flex", gap: 6, alignItems: "center", padding: "0 12px", width: "auto" }}>
        <Download size={16} /> Export PNG
      </button>
    </div>
  );
}
