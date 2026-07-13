import { RotateCw, Check, X } from "lucide-react";
import { ShapeSVG, handleStyle, kbdStyle } from "../constants";

export default function CanvasArea({
  // Refs
  canvasContainerRef, canvasRef,
  // Canvas state
  canvasW, canvasH, zoom, bgImage, canvasColor,
  // Elements
  elements, selectedIds, selectedId,
  // Tools
  tool,
  // Text editing
  editingTextId, setEditingTextId,
  // Marquee
  marqueeRect,
  // Snap guides
  snapGuides,
  // Canvas resize
  canvasSizePreset,
  // Crop
  croppingElId, cropElRect,
  // Handlers
  onCanvasPointerDown,
  startMove, startResize, startRotate,
  startCanvasResize,
  startCropResize,
  applyElementCrop,
  cancelElementCrop,
  updateElements,
}) {
  return (
    <div ref={canvasContainerRef}
      onPointerDown={(e) => {
        if (e.button === 0 && e.target === e.currentTarget) {
          // Left-click outside canvas
          window.__deselectAll && window.__deselectAll();
          return;
        }
        if (e.button === 1) {
          e.preventDefault();
          const container = canvasContainerRef.current;
          const panRef = { startX: e.clientX, startY: e.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop };
          const onMove = (ev) => {
            const dx = ev.clientX - panRef.startX;
            const dy = ev.clientY - panRef.startY;
            container.scrollLeft = panRef.scrollLeft - dx;
            container.scrollTop = panRef.scrollTop - dy;
          };
          const onUp = () => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
          };
          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        }
      }}
      style={{
        flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start",
        padding: 32, background: "#f3f4f6", position: "relative",
      }}>
      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        style={{
          position: "relative", width: canvasW, height: canvasH,
          transform: `scale(${zoom})`, transformOrigin: "0 0",
          background: bgImage ? `url(${bgImage.src})` : canvasColor,
          backgroundSize: bgImage ? "cover" : "100% 100%",
          backgroundPosition: "0 0",
          boxShadow: selectedIds[0] === "__canvas__"
            ? "0 0 0 2px #3b82f6, 0 10px 30px rgba(0,0,0,.1)"
            : "0 0 0 1px #d1d5db, 0 10px 30px rgba(0,0,0,.1)",
          borderRadius: 4,
          cursor: tool === "select" ? "default" : tool === "pan" ? "grab" : "crosshair",
          flexShrink: 0,
        }}
      >
        {!bgImage && elements.length === 0 && (
          <div style={{ position: "absolute", color: "#9ca3af", fontSize: 14, textAlign: "center", bottom: 50, width: "100%" }}>
            Paste an image with <kbd style={kbdStyle}>Ctrl/Cmd+V</kbd> or upload one from the sidebar to start.
            <br />You can still draw shapes on a blank canvas below.
          </div>
        )}
        {elements.map((el) => {
          const isSelected = selectedIds.includes(el.id);
          const isPrimary = el.id === selectedId;
          return (
            <div key={el.id}
              onPointerDown={(e) => startMove(e, el)}
              onDoubleClick={() => el.type === "text" && setEditingTextId(el.id)}
              style={{
                position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height,
                transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: "center center",
                outline: isSelected ? (isPrimary ? "1px dashed #3b82f6" : "1px dashed #60a5fa") : "none",
                outlineOffset: isPrimary ? 0 : 1,
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
                <img src={el.src}
                  draggable={false} alt="shape"
                  style={{ width: "100%", height: "100%", objectFit: "fill", userSelect: "none", pointerEvents: "none" }} />
              ) : (
                <ShapeSVG el={el} />
              )}

              {isPrimary && isSelected && tool === "select" && !croppingElId && (
                <>
                  {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((h) => (
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
        {marqueeRect && marqueeRect.w > 0 && marqueeRect.h > 0 && (
          <div style={{
            position: "absolute", left: marqueeRect.x, top: marqueeRect.y,
            width: marqueeRect.w, height: marqueeRect.h,
            border: "1px dashed #3b82f6", background: "rgba(59,130,246,.08)",
            pointerEvents: "none", zIndex: 100,
          }} />
        )}
        {/* Alignment snap guide lines */}
        {snapGuides.map((g, i) => (
          <div key={i} style={{
            position: "absolute",
            background: "#3b82f6",
            pointerEvents: "none", zIndex: 99,
            ...(g.axis === "x"
              ? { left: g.pos, top: g.start, width: 1, height: g.end - g.start }
              : { top: g.pos, left: g.start, height: 1, width: g.end - g.start }),
          }} />
        ))}
        {selectedIds[0] === "__canvas__" && tool === "select" && canvasSizePreset === "Custom" && (
          <>
            <div className="no-canvas-drag" onPointerDown={(e) => startCanvasResize(e, "e")}
              style={{ position: "absolute", top: "50%", right: -6, width: 10, height: 36, marginTop: -18, background: "#3b82f6", borderRadius: 4, cursor: "ew-resize" }} />
            <div className="no-canvas-drag" onPointerDown={(e) => startCanvasResize(e, "s")}
              style={{ position: "absolute", left: "50%", bottom: -6, width: 36, height: 10, marginLeft: -18, background: "#3b82f6", borderRadius: 4, cursor: "ns-resize" }} />
            <div className="no-canvas-drag" onPointerDown={(e) => startCanvasResize(e, "se")}
              style={{ position: "absolute", right: -7, bottom: -7, width: 14, height: 14, background: "#3b82f6", border: "2px solid #fff", borderRadius: 3, cursor: "nwse-resize" }} />
          </>
        )}
        {croppingElId && (() => {
          const cropEl = elements.find((e) => e.id === croppingElId);
          if (!cropEl) return null;
          const r = cropElRect || { x: 0, y: 0, w: cropEl.width, h: cropEl.height };
          const cxp = cropEl.x + r.x;
          const cyp = cropEl.y + r.y;
          const cwp = r.w;
          const chp = r.h;
          const hh = 5;
          const hs = 9;
          const handlePositions = {
            nw: { left: cxp - hh, top: cyp - hh, cursor: "nwse-resize" },
            n:  { left: cxp + cwp/2 - hs/2, top: cyp - hh, cursor: "ns-resize" },
            ne: { left: cxp + cwp - hh, top: cyp - hh, cursor: "nesw-resize" },
            e:  { left: cxp + cwp - hh, top: cyp + chp/2 - hs/2, cursor: "ew-resize" },
            se: { left: cxp + cwp - hh, top: cyp + chp - hh, cursor: "nwse-resize" },
            s:  { left: cxp + cwp/2 - hs/2, top: cyp + chp - hh, cursor: "ns-resize" },
            sw: { left: cxp - hh, top: cyp + chp - hh, cursor: "nesw-resize" },
            w:  { left: cxp - hh, top: cyp + chp/2 - hs/2, cursor: "ew-resize" },
          };
          const handleBase = {
            position: "absolute", width: hs, height: hs,
            background: "#fff", border: "2px solid #3b82f6",
            borderRadius: 2, zIndex: 55,
          };
          const iconBtnS = {
            width: 26, height: 26, borderRadius: 6, border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 55,
          };
          return (
            <>
              <div style={{
                position: "absolute",
                left: cxp, top: cyp,
                width: cwp, height: chp,
                border: "2px dashed #fff",
                pointerEvents: "none", zIndex: 51,
                boxShadow: "0 0 0 4000px rgba(0,0,0,.55)",
              }} />
              {["nw","n","ne","e","se","s","sw","w"].map((h) => (
                <div key={h} className="no-canvas-drag"
                  onPointerDown={(e) => startCropResize(e, h)}
                  style={{ ...handleBase, ...handlePositions[h] }}
                />
              ))}
              <button onClick={applyElementCrop}
                style={{ ...iconBtnS, position: "absolute", left: cxp + cwp + 6, top: cyp - 18, background: "#16a34a", color: "#fff" }}
                title="Apply crop">
                <Check size={16} />
              </button>
              <button onClick={cancelElementCrop}
                style={{ ...iconBtnS, position: "absolute", left: cxp + cwp + 36, top: cyp - 18, background: "#dc2626", color: "#fff" }}
                title="Cancel crop">
                <X size={16} />
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}
