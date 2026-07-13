import { Trash2, ImagePlus, ArrowDownToLine, ChevronDown, ChevronUp, ArrowUpToLine } from "lucide-react";
import { Row, clamp, SIZE_PRESETS, selectStyle, iconBtnStyle } from "../constants";

export default function Inspector({
  // Canvas
  selectedIds, selectedEl, selectedId,
  // Canvas size
  canvasSizePreset, setCanvasSizePreset,
  localCanvasSize, setLocalCanvasSize,
  debouncedCommitCanvasSize,
  // Canvas bg
  canvasColor, setCanvasColor,
  bgImage, clearBackgroundImage,
  // Elements
  elements, updateElements,
  // Image crop
  startElementCrop,
  // Z-index
  bringForward, sendBackward, bringToFront, sendToBack,
  hasSelection,
  // Colors
  changeSelectedColor,
}) {
  return (
    <div style={{ width: 300, minWidth: 300, background: "#ffffff", borderLeft: "1px solid #e5e7eb", padding: 16, fontSize: 13, boxSizing: "border-box" }}>
      <div style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.6, marginBottom: 10 }}>
        Inspector{selectedIds.length > 1 ? ` (${selectedIds.length} selected)` : ""}
      </div>
      {selectedIds[0] === "__canvas__" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="Type" value="canvas" />
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Size</div>
            <select value={canvasSizePreset}
              onChange={(e) => {
                const label = e.target.value;
                setCanvasSizePreset(label);
                if (label !== "Custom") {
                  const preset = SIZE_PRESETS.find((p) => p.label === label);
                  if (preset) {
                    const next = { width: preset.width, height: preset.height };
                    setLocalCanvasSize(next);
                    debouncedCommitCanvasSize(next);
                  }
                }
              }}
              style={selectStyle}>
              {SIZE_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Width (px)</div>
            <input type="number" min={0} value={localCanvasSize.width}
              onChange={(e) => {
                const w = clamp(Number(e.target.value) || 1, 50, 4000);
                const next = { ...localCanvasSize, width: w };
                setLocalCanvasSize(next);
                debouncedCommitCanvasSize(next);
                setCanvasSizePreset("Custom");
              }}
              style={{ ...selectStyle, opacity: canvasSizePreset === "Custom" ? 1 : 0.6 }} />
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Height (px)</div>
            <input type="number" min={0} value={localCanvasSize.height}
              onChange={(e) => {
                const h = clamp(Number(e.target.value) || 1, 50, 4000);
                const next = { ...localCanvasSize, height: h };
                setLocalCanvasSize(next);
                debouncedCommitCanvasSize(next);
                setCanvasSizePreset("Custom");
              }}
              style={{ ...selectStyle, opacity: canvasSizePreset === "Custom" ? 1 : 0.6 }} />
          </div>
          {!bgImage && (
            <div>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>Canvas color</div>
              <input type="color" value={canvasColor} onChange={(e) => setCanvasColor(e.target.value)}
                style={{ width: "100%", height: 32, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
            </div>
          )}
          {bgImage && (
            <button onClick={clearBackgroundImage}
              style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#dc2626", border: "1px solid #fecaca" }}>
              <Trash2 size={14} /> Remove background image
            </button>
          )}
          <div style={{ color: "#6b7280", lineHeight: 1.5, marginTop: 4, fontSize: 12 }}>
            The canvas itself can't be deleted — only the background image and overlays on it.
          </div>
        </div>
      ) : selectedEl ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Row label="Type" value={selectedIds.length > 1 ? `multi (${selectedIds.length})` : selectedEl.type} />
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>X</div>
            <input type="number" value={Math.round(selectedEl.x)}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, x: v } : p));
              }}
              style={selectStyle} />
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Y</div>
            <input type="number" value={Math.round(selectedEl.y)}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, y: v } : p));
              }}
              style={selectStyle} />
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Width</div>
            <input type="number" min={1} value={Math.round(selectedEl.width)}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value));
                if (selectedEl.keepAspectRatio && selectedEl.type === "image") {
                  const aspect = selectedEl.width / selectedEl.height;
                  updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, width: v, height: Math.round(v / aspect) } : p));
                } else {
                  updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, width: v } : p));
                }
              }}
              style={selectStyle} />
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Height</div>
            <input type="number" min={1} value={Math.round(selectedEl.height)}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value));
                if (selectedEl.keepAspectRatio && selectedEl.type === "image") {
                  const aspect = selectedEl.width / selectedEl.height;
                  updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, height: v, width: Math.round(v * aspect) } : p));
                } else {
                  updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, height: v } : p));
                }
              }}
              style={selectStyle} />
          </div>
          <div>
            <div style={{ color: "#6b7280", marginBottom: 4 }}>Rotation</div>
            <input type="number" value={Math.round(selectedEl.rotation || 0)}
              onChange={(e) => {
                const v = Number(e.target.value);
                updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, rotation: v } : p));
              }}
              style={selectStyle} />
          </div>
          {(["rect", "ellipse", "triangle", "line", "arrow", "pen"].includes(selectedEl.type)) && (
            <>
              <div>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>Stroke width</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="range" min={1} max={16} value={selectedEl.strokeWidth}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, strokeWidth: v } : p));
                    }}
                    style={{ width: "100%" }} />
                  <span style={{ fontSize: 12, color: "#6b7280", minWidth: 20, textAlign: "center" }}>{selectedEl.strokeWidth}px</span>
                </div>
              </div>
              <div>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>Stroke color</div>
                <input type="color" value={selectedEl.stroke}
                  onChange={(e) => { updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, stroke: e.target.value } : p)); }}
                  style={{ width: "100%", height: 32, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
              </div>
            </>
          )}
          {(["rect", "ellipse", "triangle"].includes(selectedEl.type)) && (
            <div>
              <div style={{ color: "#6b7280", marginBottom: 4 }}>Fill color</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="color"
                  value={selectedEl.fill && selectedEl.fill !== "transparent" ? selectedEl.fill : "#000000"}
                  onChange={(e) => { updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, fill: e.target.value } : p)); }}
                  style={{ flex: 1, height: 32, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", background: "none", padding: 2 }} />
                <button onClick={() => {
                  const isFilled = selectedEl.fill && selectedEl.fill !== "transparent";
                  updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, fill: isFilled ? "transparent" : "#ef4444" } : p));
                }}
                  style={{
                    padding: "4px 10px", borderRadius: 6, border: "1px solid #d1d5db",
                    background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap",
                  }}>
                  {selectedEl.fill && selectedEl.fill !== "transparent" ? "No fill" : "Fill"}
                </button>
              </div>
            </div>
          )}
          {selectedEl.type === "image" && (
            <>
              <div>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>Keep aspect ratio</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#1f2937", fontSize: 13 }}>
                  <input type="checkbox" checked={selectedEl.keepAspectRatio !== false}
                    onChange={(e) => {
                      const v = e.target.checked;
                      updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, keepAspectRatio: v } : p));
                    }}
                    style={{ accentColor: "#3b82f6", width: 16, height: 16 }} />
                  Lock aspect ratio
                </label>
              </div>
              <button onClick={startElementCrop}
                style={{ ...selectStyle, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, color: "#3b82f6", border: "1px solid #bfdbfe", background: "#eff6ff" }}>
                <ImagePlus size={14} /> Crop Image
              </button>
            </>
          )}
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
                  onChange={(e) => { updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, tailType: e.target.value } : p)); }}
                  style={selectStyle}>
                  <option value="none">None</option>
                  <option value="arrow">Arrow</option>
                </select>
              </div>
              <div>
                <div style={{ color: "#6b7280", marginBottom: 4 }}>Head (end)</div>
                <select value={selectedEl.headType || "none"}
                  onChange={(e) => { updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, headType: e.target.value } : p)); }}
                  style={selectStyle}>
                  <option value="none">None</option>
                  <option value="arrow">Arrow</option>
                </select>
              </div>
            </>
          )}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 10, marginTop: 4 }}>
            <div style={{ color: "#6b7280", marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>Z-Index</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={sendToBack} disabled={!hasSelection} style={{ ...iconBtnStyle(!hasSelection), flex: 1 }} title="Send to back">
                <ArrowDownToLine size={16} />
              </button>
              <button onClick={sendBackward} disabled={!hasSelection} style={{ ...iconBtnStyle(!hasSelection), flex: 1 }} title="Send backward">
                <ChevronDown size={16} />
              </button>
              <button onClick={bringForward} disabled={!hasSelection} style={{ ...iconBtnStyle(!hasSelection), flex: 1 }} title="Bring forward">
                <ChevronUp size={16} />
              </button>
              <button onClick={bringToFront} disabled={!hasSelection} style={{ ...iconBtnStyle(!hasSelection), flex: 1 }} title="Bring to front">
                <ArrowUpToLine size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: "#6b7280", lineHeight: 1.5 }}>
          Select an element to see and edit its properties.
          <br /><br />
          <strong style={{ color: "#6b7280" }}>Shortcuts</strong>
          <br />Delete – remove
          <br />Shift+click – multi-select
          <br />Ctrl/Cmd+Shift+Z – redo
          <br />Ctrl/Cmd+Z – undo
          <br />Ctrl/Cmd+D – duplicate
          <br />Ctrl/Cmd+C – copy element(s) or canvas
          <br />Ctrl/Cmd+V – paste element(s)
        </div>
      )}
    </div>
  );
}
