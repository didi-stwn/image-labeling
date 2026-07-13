export default function ScreenshotCrop({
  screenshotData, cropRect, onCropPointerDown, saveScreenshot, cancelScreenshot,
}) {
  if (!screenshotData) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#ffffff", borderRadius: 12, padding: 20,
        boxShadow: "0 20px 60px rgba(0,0,0,.15)", maxWidth: "90vw", maxHeight: "90vh",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          Drag to select the area you want to keep, then click <strong>Save</strong>.
        </div>
        <div style={{
          position: "relative", overflow: "hidden", cursor: "crosshair",
          maxWidth: "80vw", maxHeight: "65vh",
        }} onPointerDown={onCropPointerDown}>
          <img id="crop-image" src={screenshotData.src} draggable={false} alt="Screenshot"
            style={{ display: "block", maxWidth: "80vw", maxHeight: "65vh", objectFit: "contain", userSelect: "none" }} />
          {cropRect && cropRect.w > 0 && cropRect.h > 0 && (
            <>
              {/* Dark overlay areas */}
              <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: cropRect.y, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 0, top: cropRect.y + cropRect.h, width: "100%", height: `calc(100% - ${cropRect.y + cropRect.h}px)`, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 0, top: cropRect.y, width: cropRect.x, height: cropRect.h, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: cropRect.x + cropRect.w, top: cropRect.y, width: `calc(100% - ${cropRect.x + cropRect.w}px)`, height: cropRect.h, background: "rgba(0,0,0,.4)", pointerEvents: "none" }} />
              {/* Selection border */}
              <div style={{ position: "absolute", left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h, border: "2px dashed #fff", pointerEvents: "none", boxSizing: "border-box" }} />
              {/* Corner handles */}
              <div style={{ position: "absolute", left: cropRect.x - 4, top: cropRect.y - 4, width: 8, height: 8, background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: cropRect.x + cropRect.w - 4, top: cropRect.y - 4, width: 8, height: 8, background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: cropRect.x - 4, top: cropRect.y + cropRect.h - 4, width: 8, height: 8, background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: cropRect.x + cropRect.w - 4, top: cropRect.y + cropRect.h - 4, width: 8, height: 8, background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none" }} />
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={cancelScreenshot}
            style={{ padding: "8px 20px", borderRadius: 8, border: "1px solid #d1d5db", background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 13 }}>
            Cancel
          </button>
          <button onClick={saveScreenshot}
            style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
