import { MousePointer2, Square, Circle, Minus, ArrowUpRight, Type as TypeIcon,
  Pencil, Image as ImageIcon, ImagePlus, Trash2, Hand, Triangle, Camera, ClipboardPaste,
} from "lucide-react";
import { TOOLS } from "../constants";

export default function Sidebar({
  tool, setTool,
  showImagePopover, setShowImagePopover,
  showBgImagePopover, setShowBgImagePopover,
  imagePopoverRef, bgImagePopoverRef,
  overlayFileInputRef, bgFileInputRef,
  handleUpload, handleOverlayUpload,
  startScreenshot,
}) {
  return (
    <div style={{
      width: 72, background: "#ffffff", borderRight: "1px solid #e5e7eb",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 6,
    }}>
      {TOOLS.map((t) => {
        const Icon = getIcon(t.icon);
        const active = tool === t.id;
        return (
          <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
            style={{
              width: 46, height: 46, borderRadius: 10, border: "none", cursor: "pointer",
              background: active ? "#3b82f6" : "transparent", color: active ? "#fff" : "#6b7280",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
            }}>
            <Icon size={20} />
          </button>
        );
      })}
      <div style={{ width: 32, height: 1, background: "#e5e7eb", margin: "10px 0" }} />
      <div ref={bgImagePopoverRef} style={{ position: "relative" }}>
        <button title="Set background image" onClick={() => setShowBgImagePopover((p) => !p)}
          style={{
            width: 46, height: 46, borderRadius: 10, border: "none", cursor: "pointer",
            background: showBgImagePopover ? "#3b82f6" : "transparent",
            color: showBgImagePopover ? "#fff" : "#6b7280",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
          }}>
          <ImageIcon size={20} />
        </button>
        {showBgImagePopover && (
          <div style={{
            position: "absolute", left: 56, top: 0, background: "#ffffff",
            border: "1px solid #e5e7eb", borderRadius: 10, padding: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 100, minWidth: 160,
          }}>
            <button onClick={() => { bgFileInputRef.current?.click(); setShowBgImagePopover(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent",
                color: "#1f2937", cursor: "pointer", fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <ImageIcon size={16} /> From file
            </button>
            <button onClick={() => startScreenshot("background")}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent",
                color: "#1f2937", cursor: "pointer", fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <Camera size={16} /> Take screenshot
            </button>
          </div>
        )}
        <input ref={bgFileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
      </div>
      <div ref={imagePopoverRef} style={{ position: "relative" }}>
        <button title="Add image overlay" onClick={() => setShowImagePopover((p) => !p)}
          style={{
            width: 46, height: 46, borderRadius: 10, border: "none", cursor: "pointer",
            background: showImagePopover ? "#3b82f6" : "transparent",
            color: showImagePopover ? "#fff" : "#6b7280",
            display: "flex", alignItems: "center", justifyContent: "center", transition: "background .15s",
          }}>
          <ImagePlus size={20} />
        </button>
        {showImagePopover && (
          <div style={{
            position: "absolute", left: 56, top: 0, background: "#ffffff",
            border: "1px solid #e5e7eb", borderRadius: 10, padding: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,.1)", zIndex: 100, minWidth: 160,
          }}>
            <button onClick={() => { overlayFileInputRef.current?.click(); setShowImagePopover(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent",
                color: "#1f2937", cursor: "pointer", fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <ImagePlus size={16} /> From file
            </button>
            <button onClick={() => startScreenshot("overlay")}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "8px 12px", borderRadius: 8, border: "none", background: "transparent",
                color: "#1f2937", cursor: "pointer", fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f3f4f6"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <Camera size={16} /> Take screenshot
            </button>
          </div>
        )}
        <input ref={overlayFileInputRef} type="file" accept="image/*" onChange={handleOverlayUpload} style={{ display: "none" }} />
      </div>
      <button title="Ctrl/Cmd+V pastes: sets background if empty, otherwise adds an overlay image" onClick={() => {}}
        style={{
          width: 46, height: 46, borderRadius: 10, border: "none", background: "transparent",
          color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default",
        }}>
        <ClipboardPaste size={20} />
      </button>
    </div>
  );
}

function getIcon(name) {
  const icons = {
    MousePointer2, Square, Circle, Minus, ArrowUpRight, TypeIcon,
    Pencil, ImageIcon, ImagePlus, Trash2, Hand, Triangle, Camera, ClipboardPaste,
  };
  return icons[name] || Square;
}
