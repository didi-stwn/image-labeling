import { useState, useRef, useCallback, useEffect } from "react";
import {
  MousePointer2, Square, Circle, Minus, ArrowUpRight, Type as TypeIcon,
  Pencil, Image as ImageIcon, ImagePlus, Trash2, Copy, Download, Undo2, Redo2,
  ClipboardPaste, RotateCw, ClipboardCheck, Triangle, Camera, ZoomIn, ZoomOut, Hand,
  ChevronUp, ChevronDown, ArrowUpToLine, ArrowDownToLine, Check, X,
} from "lucide-react";

// ---------- helpers ----------
const CLIPBOARD_MARKER = "##IMAGE_LABELING_ELS##";
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const TOOLS = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "pan", icon: Hand, label: "Pan" },
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
  const [zoom, setZoom] = useState(1);
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]); // array for multi-select, first is primary
  const selectedId = selectedIds[0] || null; // primary selection for inspector
  const [clipboardElements, setClipboardElements] = useState(null); // serialized JSON for copy/paste
  const clipboardRef = useRef(null); // mirror ref for synchronous access in event handlers
  clipboardRef.current = clipboardElements;
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [editingTextId, setEditingTextId] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null); // null | "copied" | "failed"
  const [marqueeRect, setMarqueeRect] = useState(null); // {x, y, w, h} for rubber-band selection
  const [snapGuides, setSnapGuides] = useState([]); // [{axis, pos, start, end}] for alignment guide lines
  const [croppingElId, setCroppingElId] = useState(null); // id of image element being cropped
  const [cropElRect, setCropElRect] = useState(null); // {x, y, w, h} crop rect relative to element coords

  // Image overlay popover & screenshot states
  const [showImagePopover, setShowImagePopover] = useState(false);
  const [showBgImagePopover, setShowBgImagePopover] = useState(false);
  const [screenshotData, setScreenshotData] = useState(null); // {src, width, height} of captured screenshot
  const [cropRect, setCropRect] = useState(null); // {x, y, w, h} relative to the screenshot natural size
  const [isCropping, setIsCropping] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState("overlay"); // "overlay" | "background"
  const cropDragRef = useRef(null);

  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const dragRef = useRef(null); // info about ongoing drag/draw/resize/rotate
  const cropElDragRef = useRef(null); // {startX, startY, startRect} for element crop
  const panRef = useRef(null); // {startX, startY, scrollLeft, scrollTop} for middle-button pan
  const elementsRef = useRef(elements);
  elementsRef.current = elements; // always up-to-date for use in closures
  const imagePopoverRef = useRef(null);
  const bgImagePopoverRef = useRef(null);
  const overlayFileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const pipWindowRef = useRef(null);
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

  // ---------- screenshot capture via PiP window ----------
  async function startScreenshot(mode = "overlay") {
    setShowImagePopover(false);
    setShowBgImagePopover(false);
    setScreenshotMode(mode);
    try {
      // 1. Open a Document Picture-in-Picture window with a "Capture" button
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 420,
        height: 300,
      });
      pipWindowRef.current = pipWindow;
      const doc = pipWindow.document;

      // Helper to update the PiP body content
      function setPipContent(html) {
        doc.body.innerHTML = html;
      }

      // Initial content: simple Capture button
      setPipContent(`
        <div style="display:flex;align-items:center;justify-content:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <button id="capture-btn" style="padding:14px 40px;font-size:18px;font-weight:600;border:none;border-radius:12px;cursor:pointer;background:#3b82f6;color:#fff;box-shadow:0 4px 16px rgba(59,130,246,.3);">Capture</button>
        </div>
      `);

      // 2. When "Capture" is clicked, request screen share
      doc.getElementById('capture-btn').addEventListener('click', async () => {
        try {
          // Request screen share – browser shows native dialog
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });

          // 4. Close PiP window so it doesn't appear in the screenshot
          pipWindow.close();
          pipWindowRef.current = null;

          // Wait a moment for the OS to remove the PiP overlay from the screen
          await new Promise((r) => setTimeout(r, 400));

          // 5. Capture a single frame from the stream
          const video = document.createElement("video");
          video.srcObject = stream;
          await video.play();

          const captureCanvas = document.createElement("canvas");
          captureCanvas.width = video.videoWidth;
          captureCanvas.height = video.videoHeight;
          const ctx = captureCanvas.getContext("2d");
          ctx.drawImage(video, 0, 0);

          // Stop the stream
          stream.getTracks().forEach((t) => t.stop());

          const dataUrl = captureCanvas.toDataURL("image/png");
          setScreenshotData({ src: dataUrl, width: video.videoWidth, height: video.videoHeight });
          setCropRect(null);
          setIsCropping(true);
        } catch (err) {
          // User cancelled the screen picker, or PiP closed
          try { pipWindow.close(); } catch (_) { }
          pipWindowRef.current = null;
        }
      });

      // Handle PiP window close (user closed it without capturing)
      pipWindow.addEventListener('pagehide', () => {
        pipWindowRef.current = null;
      });
    } catch (err) {
      // PiP API not supported – silently ignore
    }
  }

  function getCropClientPoint(e) {
    const rect = document.getElementById("crop-image")?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onCropPointerDown(e) {
    if (e.button !== 0) return;
    const pt = getCropClientPoint(e);
    cropDragRef.current = { startX: pt.x, startY: pt.y };
    window.addEventListener("pointermove", onCropPointerMove);
    window.addEventListener("pointerup", onCropPointerUp);
  }

  function onCropPointerMove(e) {
    const drag = cropDragRef.current;
    if (!drag) return;
    const pt = getCropClientPoint(e);
    const imgEl = document.getElementById("crop-image");
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    // Clamp to image bounds
    const cx = Math.max(0, Math.min(pt.x, rect.width));
    const cy = Math.max(0, Math.min(pt.y, rect.height));
    const x = Math.min(drag.startX, cx);
    const y = Math.min(drag.startY, cy);
    const w = Math.abs(cx - drag.startX);
    const h = Math.abs(cy - drag.startY);
    setCropRect({ x, y, w, h });
  }

  function onCropPointerUp() {
    cropDragRef.current = null;
    window.removeEventListener("pointermove", onCropPointerMove);
    window.removeEventListener("pointerup", onCropPointerUp);
  }

  function saveScreenshot() {
    if (!screenshotData) return;
    const img = new window.Image();
    img.onload = () => {
      const imgEl = document.getElementById("crop-image");
      if (!imgEl) return;
      const displayRect = imgEl.getBoundingClientRect();
      const scaleX = screenshotData.width / displayRect.width;
      const scaleY = screenshotData.height / displayRect.height;

      // If user dragged a crop area, use it; otherwise use the full image
      let sx, sy, sw, sh;
      if (cropRect && cropRect.w > 0 && cropRect.h > 0) {
        sx = cropRect.x * scaleX;
        sy = cropRect.y * scaleY;
        sw = cropRect.w * scaleX;
        sh = cropRect.h * scaleY;
      } else {
        sx = 0; sy = 0;
        sw = screenshotData.width;
        sh = screenshotData.height;
      }

      const outCanvas = document.createElement("canvas");
      outCanvas.width = sw;
      outCanvas.height = sh;
      const ctx = outCanvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      const croppedSrc = outCanvas.toDataURL("image/png");

      if (screenshotMode === "background") {
        // Set as background image
        setBgImage({ src: croppedSrc, width: sw, height: sh });
        setCanvasSize({ width: sw, height: sh });
        setElements([]);
        setHistory([]);
        setFuture([]);
        setSelectedIds([]);
      } else {
        // Add as overlay image on the current canvas
        const canvasW = canvasSize.width;
        const canvasH = canvasSize.height;
        const maxDim = 300;
        const ratio = Math.min(maxDim / sw, maxDim / sh, 1);
        const w = sw * ratio;
        const h = sh * ratio;
        const el = {
          id: uid(), type: "image", src: croppedSrc,
          x: (canvasW - w) / 2, y: (canvasH - h) / 2, width: w, height: h, rotation: 0,
          keepAspectRatio: true,
        };
        updateElements((prev) => [...prev, el]);
        setSelectedIds([el.id]);
        setTool("select");
      }

      setIsCropping(false);
      setScreenshotData(null);
      setCropRect(null);
    };
    img.src = screenshotData.src;
  }

  function cancelScreenshot() {
    // Close PiP if still open
    if (pipWindowRef.current) {
      try { pipWindowRef.current.close(); } catch (_) { }
      pipWindowRef.current = null;
    }
    setIsCropping(false);
    setScreenshotData(null);
    setCropRect(null);
  }

  // ---------- element image crop ----------
  function startElementCrop() {
    if (!selectedEl || selectedEl.type !== "image") return;
    setCroppingElId(selectedEl.id);
    // Start with full element bounds as initial crop rect
    setCropElRect({ x: 0, y: 0, w: selectedEl.width, h: selectedEl.height });
  }

  function startCropResize(e, handle) {
    if (!croppingElId) return;
    e.stopPropagation();
    const pt = getCanvasPoint(e);
    const el = elements.find((x) => x.id === croppingElId);
    if (!el) return;
    const rect = cropElRect || { x: 0, y: 0, w: el.width, h: el.height };
    dragRef.current = {
      mode: "crop-resize", handle,
      startX: pt.x, startY: pt.y,
      origX: rect.x, origY: rect.y, origW: rect.w, origH: rect.h,
      elX: el.x, elY: el.y, elW: el.width, elH: el.height,
    };
    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerUp);
  }

  function applyElementCrop() {
    if (!croppingElId || !cropElRect) return;
    const el = elements.find((x) => x.id === croppingElId);
    if (!el || el.type !== "image") return;
    const { x, y, w, h } = cropElRect;
    if (w < 5 || h < 5) { cancelElementCrop(); return; }
    const img = new window.Image();
    img.onload = () => {
      const outCanvas = document.createElement("canvas");
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext("2d");
      // Determine the natural image scale within the element
      const elemAspect = el.width / el.height;
      const natAspect = img.width / img.height;
      let sx, sy, sw, sh;
      if (natAspect > elemAspect) {
        // Image is wider than element → crop left/right
        sh = img.height;
        sw = img.height * elemAspect;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        // Image is taller → crop top/bottom
        sw = img.width;
        sh = img.width / elemAspect;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      const scaleX = sw / el.width;
      const scaleY = sh / el.height;
      ctx.drawImage(img, sx + x * scaleX, sy + y * scaleY, w * scaleX, h * scaleY, 0, 0, w, h);
      const croppedSrc = outCanvas.toDataURL("image/png");
      updateElements((prev) => prev.map((p) => p.id === croppingElId
        ? { ...p, src: croppedSrc, width: w, height: h, keepAspectRatio: true }
        : p
      ));
      cancelElementCrop();
    };
    img.src = el.src;
  }

  function cancelElementCrop() {
    setCroppingElId(null);
    setCropElRect(null);
    cropElDragRef.current = null;
    if (dragRef.current?.mode === "crop-resize") {
      dragRef.current = null;
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
    }
  }

  // ---------- clipboard paste (elements + image) ----------
  useEffect(() => {
    const onPaste = async (e) => {
      if (editingTextId) return;
      const items = e.clipboardData?.items || [];

      // Helper: try to read our element marker from text/plain on system clipboard
      async function readMarker() {
        for (const item of items) {
          if (item.type === "text/plain") {
            const text = await new Promise((resolve) => item.getAsString(resolve));
            try {
              const parsed = JSON.parse(text);
              if (parsed && parsed.__marker === CLIPBOARD_MARKER && Array.isArray(parsed.elements)) {
                return parsed.elements;
              }
            } catch (_) {}
          }
        }
        return null;
      }
      // Helper: try to extract an image from the system clipboard
      function findImage() {
        for (const item of items) {
          if (item.type.indexOf("image") !== -1) {
            return item.getAsFile();
          }
        }
        return null;
      }

      const imageFile = findImage();
      const markerElements = await readMarker();

      // "Last copy wins" — the system clipboard is the single source of truth.
      // `navigator.clipboard.write()` replaces ALL clipboard content, so:
      //   - If elements were copied last (our Ctrl+C) → clipboard has marker text, no image
      //   - If image was copied last (browser or our "Copy Image") → clipboard has image, marker may or may not persist
      //
      // Order: image FIRST (because browser "Copy Image" may not clear marker text),
      // then marker, then internal clipboard fallback.

      if (imageFile) {
        // System clipboard has an image → use it (works for both browser and our "Copy Image")
        if (elements.length === 0 && !bgImage) {
          loadImageFile(imageFile);
        } else {
          addOverlayImage(imageFile);
        }
        e.preventDefault();
        return;
      }

      if (markerElements) {
        // System clipboard has our marker → paste as elements
        internalPasteElements(markerElements);
        e.preventDefault();
        return;
      }

      // Fallback: internal clipboard elements
      if (clipboardRef.current && clipboardRef.current.length) {
        e.preventDefault();
        pasteElements();
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editingTextId, bgImage, elements]);

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
        setSelectedIds([]);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  function clearBackgroundImage() {
    setBgImage(null);
    setSelectedIds(["__canvas__"]);
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
          keepAspectRatio: true,
        };
        updateElements((prev) => [...prev, el]);
        setSelectedIds([el.id]);
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
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  function onCanvasPointerDown(e) {
    if (e.target.closest(".no-canvas-drag")) return;
    const pt = getCanvasPoint(e);

    if (tool === "select") {
      // Click selects canvas; drag (movement > 5px) starts marquee
      setSelectedIds(["__canvas__"]);
      dragRef.current = { mode: "marquee-pending", startX: pt.x, startY: pt.y };
      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      return;
    }

    if (tool === "pan") {
      const container = canvasContainerRef.current;
      if (!container) return;
      panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop };
      const onMove = (ev) => {
        if (!panRef.current) return;
        const dx = ev.clientX - panRef.current.startX;
        const dy = ev.clientY - panRef.current.startY;
        container.scrollLeft = panRef.current.scrollLeft - dx;
        container.scrollTop = panRef.current.scrollTop - dy;
      };
      const onUp = () => {
        panRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    const el = newShape(tool, pt.x, pt.y);
    el.stroke = color;
    el.strokeWidth = strokeWidth;
    if (tool === "text") el.color = color;

    updateElements((prev) => [...prev, el]);
    setSelectedIds([el.id]);

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
      let dx = pt.x - drag.startX;
      let dy = pt.y - drag.startY;

      // Shift key → constrain to horizontal or vertical
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) {
          dy = 0;
        } else {
          dx = 0;
        }
      }

      // Snap guide computation — use the primary element being dragged
      const snapThreshold = 5;
      const newGuides = [];
      const rawX = drag.origX + dx;
      const rawY = drag.origY + dy;
      const dragW = drag.origW || 100;
      const dragH = drag.origH || 40;
      const centers = { x: canvasW / 2, y: canvasH / 2 };
      const dragEdges = { left: rawX, right: rawX + dragW, top: rawY, bottom: rawY + dragH };
      const dragCenter = { x: rawX + dragW / 2, y: rawY + dragH / 2 };

      let snapDx = 0, snapDy = 0;

      // Helper to check snap for a target value against drag edges/center
      function checkSnap(dragValue, targetValue, axis) {
        const diff = dragValue - targetValue;
        if (Math.abs(diff) < snapThreshold) {
          return diff;
        }
        return null;
      }

      // Check against canvas center
      for (const edge of ["left", "right", "centerX"]) {
        const dv = edge === "left" ? dragEdges.left : edge === "right" ? dragEdges.right : dragCenter.x;
        const snap = checkSnap(dv, centers.x);
        if (snap !== null) {
          snapDx = -snap;
          newGuides.push({ axis: "x", pos: centers.x, start: 0, end: canvasH });
          break;
        }
      }
      for (const edge of ["top", "bottom", "centerY"]) {
        const dv = edge === "top" ? dragEdges.top : edge === "bottom" ? dragEdges.bottom : dragCenter.y;
        const snap = checkSnap(dv, centers.y);
        if (snap !== null) {
          snapDy = -snap;
          newGuides.push({ axis: "y", pos: centers.y, start: 0, end: canvasW });
          break;
        }
      }

      // Check against other element edges
      if (newGuides.length === 0) {
        for (const other of elementsRef.current) {
          if (other.id === drag.id || (drag.multiIds && drag.multiIds.includes(other.id))) continue;
          const o = { left: other.x, right: other.x + other.width, top: other.y, bottom: other.y + other.height, centerX: other.x + other.width / 2, centerY: other.y + other.height / 2 };
          // Try snapping each drag edge to each other element edge
          for (const de of ["left", "right", "centerX"]) {
            for (const oe of ["left", "right", "centerX"]) {
              const dv = de === "left" ? dragEdges.left : de === "right" ? dragEdges.right : dragCenter.x;
              const ov = o[oe];
              const snap = checkSnap(dv, ov);
              if (snap !== null) {
                snapDx = -snap;
                newGuides.push({ axis: "x", pos: ov, start: Math.min(dragEdges.top, o.top), end: Math.max(dragEdges.bottom, o.bottom) });
                break;
              }
            }
            if (snapDx !== 0) break;
          }
          for (const de of ["top", "bottom", "centerY"]) {
            for (const oe of ["top", "bottom", "centerY"]) {
              const dv = de === "top" ? dragEdges.top : de === "bottom" ? dragEdges.bottom : dragCenter.y;
              const ov = o[oe];
              const snap = checkSnap(dv, ov);
              if (snap !== null) {
                snapDy = -snap;
                newGuides.push({ axis: "y", pos: ov, start: Math.min(dragEdges.left, o.left), end: Math.max(dragEdges.right, o.right) });
                break;
              }
            }
            if (snapDy !== 0) break;
          }
          if (snapDx !== 0 || snapDy !== 0) break;
        }
      }

      setSnapGuides(newGuides);

      // Apply snap offset and shift-constrain
      dx += snapDx;
      dy += snapDy;

      updateElements((prev) => prev.map((el) => {
        const isMulti = drag.multiIds && drag.multiIds.includes(el.id);
        if (!isMulti && el.id !== drag.id) return el;
        if (el.id === drag.id) {
          const moved = { ...el, x: drag.origX + dx, y: drag.origY + dy };
          if (el.type === "pen") {
            moved.points = drag.origPoints.map(([px, py]) => [px + dx, py + dy]);
          }
          return moved;
        }
        // Multi-select move: use stored orig positions
        const orig = drag.origPositions?.[el.id];
        if (orig) {
          const moved = { ...el, x: orig.x + dx, y: orig.y + dy };
          if (el.type === "pen") {
            moved.points = orig.points.map(([px, py]) => [px + dx, py + dy]);
          }
          return moved;
        }
        return el;
      }), false);
    } else if (drag.mode === "resize") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      // Compute target edges for snap guide lines
      const origX = drag.origX, origY = drag.origY, origW = drag.origW, origH = drag.origH;
      let targetX = origX, targetY = origY, targetW = origW, targetH = origH;
      if (drag.handle.includes("e")) targetW = Math.max(8, origW + dx);
      if (drag.handle.includes("s")) targetH = Math.max(8, origH + dy);
      if (drag.handle.includes("w")) { targetW = Math.max(8, origW - dx); targetX = origX + (origW - targetW); }
      if (drag.handle.includes("n")) { targetH = Math.max(8, origH - dy); targetY = origY + (origH - targetH); }
      // Snap guide computation
      const newGuides = [];
      const snapThreshold = 5;
      const canvasCenterX = canvasW / 2, canvasCenterY = canvasH / 2;
      const resizeEdges = { left: targetX, right: targetX + targetW, top: targetY, bottom: targetY + targetH, centerX: targetX + targetW / 2, centerY: targetY + targetH / 2 };
      let snapDx = 0, snapDy = 0;
      function checkSnap(dv, tv) { const d = dv - tv; return Math.abs(d) < snapThreshold ? d : null; }
      // Check canvas center
      for (const e of ["left", "right", "centerX"]) {
        const s = checkSnap(resizeEdges[e], canvasCenterX);
        if (s !== null) { snapDx = -s; newGuides.push({ axis: "x", pos: canvasCenterX, start: 0, end: canvasH }); break; }
      }
      for (const e of ["top", "bottom", "centerY"]) {
        const s = checkSnap(resizeEdges[e], canvasCenterY);
        if (s !== null) { snapDy = -s; newGuides.push({ axis: "y", pos: canvasCenterY, start: 0, end: canvasW }); break; }
      }
      // Check other elements
      if (newGuides.length === 0) {
        for (const other of elementsRef.current) {
          if (other.id === drag.id) continue;
          const o = { left: other.x, right: other.x + other.width, top: other.y, bottom: other.y + other.height, centerX: other.x + other.width / 2, centerY: other.y + other.height / 2 };
          let found = false;
          for (const de of ["left", "right", "centerX"]) {
            for (const oe of ["left", "right", "centerX"]) {
              const s = checkSnap(resizeEdges[de], o[oe]);
              if (s !== null) { snapDx = -s; newGuides.push({ axis: "x", pos: o[oe], start: Math.min(resizeEdges.top, o.top), end: Math.max(resizeEdges.bottom, o.bottom) }); found = true; break; }
            }
            if (found) break;
          }
          for (const de of ["top", "bottom", "centerY"]) {
            for (const oe of ["top", "bottom", "centerY"]) {
              const s = checkSnap(resizeEdges[de], o[oe]);
              if (s !== null) { snapDy = -s; newGuides.push({ axis: "y", pos: o[oe], start: Math.min(resizeEdges.left, o.left), end: Math.max(resizeEdges.right, o.right) }); found = true; break; }
            }
            if (found) break;
          }
          if (found) break;
        }
      }
      setSnapGuides(newGuides);
      // Recompute with snap offset
      const snapDxLocal = snapDx, snapDyLocal = snapDy;
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        let { x, y, width, height } = { x: origX, y: origY, width: origW, height: origH };
        // Apply both mouse delta and snap offset
        const sdx = dx + snapDxLocal, sdy = dy + snapDyLocal;
        if (el.keepAspectRatio && (el.type === "image")) {
          const aspect = origW / origH;
          if (drag.handle.includes("e") || drag.handle.includes("w")) {
            width = Math.max(8, origW + (drag.handle.includes("w") ? -sdx : sdx));
            height = Math.round(width / aspect);
            if (drag.handle.includes("w")) { x = origX + (origW - width); }
          } else {
            height = Math.max(8, origH + (drag.handle.includes("n") ? -sdy : sdy));
            width = Math.round(height * aspect);
            if (drag.handle.includes("n")) { y = origY + (origH - height); }
          }
        } else {
          if (drag.handle.includes("e")) width = Math.max(8, origW + sdx);
          if (drag.handle.includes("s")) height = Math.max(8, origH + sdy);
          if (drag.handle.includes("w")) { width = Math.max(8, origW - sdx); x = origX + (origW - width); }
          if (drag.handle.includes("n")) { height = Math.max(8, origH - sdy); y = origY + (origH - height); }
        }
        return { ...el, x, y, width, height };
      }), false);
    } else if (drag.mode === "rotate") {
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        const cx = el.x + el.width / 2, cy = el.y + el.height / 2;
        const angle = Math.atan2(pt.y - cy, pt.x - cx) * (180 / Math.PI) + 90;
        return { ...el, rotation: Math.round(angle) };
      }), false);
    } else if (drag.mode === "marquee-pending") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        // Transition to full marquee mode
        setSelectedIds([]);
        const rect = { x: Math.min(drag.startX, pt.x), y: Math.min(drag.startY, pt.y), w: Math.abs(dx), h: Math.abs(dy) };
        setMarqueeRect(rect);
        dragRef.current = { mode: "marquee", startX: drag.startX, startY: drag.startY, rect };
      }
      return;
    } else if (drag.mode === "marquee") {
      const x = Math.min(drag.startX, pt.x);
      const y = Math.min(drag.startY, pt.y);
      const w = Math.abs(pt.x - drag.startX);
      const h = Math.abs(pt.y - drag.startY);
      const rect = { x, y, w, h };
      dragRef.current.rect = rect;
      setMarqueeRect(rect);
      return;
    } else if (drag.mode === "canvas-resize") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      setCanvasSize(() => {
        let w = drag.origW, h = drag.origH;
        if (drag.handle.includes("e")) w = clamp(drag.origW + dx, 50, 4000);
        if (drag.handle.includes("s")) h = clamp(drag.origH + dy, 50, 4000);
        return { width: w, height: h };
      });
    } else if (drag.mode === "crop-resize") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      let { origX, origY, origW, origH } = drag;
      let x = origX, y = origY, w = origW, h = origH;
      if (drag.handle.includes("e")) w = Math.max(8, origW + dx);
      if (drag.handle.includes("s")) h = Math.max(8, origH + dy);
      if (drag.handle.includes("w")) { w = Math.max(8, origW - dx); x = origX + (origW - w); }
      if (drag.handle.includes("n")) { h = Math.max(8, origH - dy); y = origY + (origH - h); }
      // Clamp to element bounds
      const elW = drag.elW, elH = drag.elH;
      x = clamp(x, 0, elW);
      y = clamp(y, 0, elH);
      if (x + w > elW) w = elW - x;
      if (y + h > elH) h = elH - y;
      setCropElRect({ x, y, w: Math.max(w, 1), h: Math.max(h, 1) });
    }
  }

  function onWindowPointerUp() {
    const mode = dragRef.current?.mode;
    const marqueeRectFromRef = dragRef.current?.rect;
    const wasCanvasResize = mode === "canvas-resize" || mode === "crop-resize";
    const wasMarqueePending = mode === "marquee-pending";
    const wasMarquee = mode === "marquee";
    dragRef.current = null;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    if (wasMarqueePending) {
      // Click (no drag) — canvas already selected, nothing more to do
      return;
    }
    if (wasMarquee) {
      setMarqueeRect(null);
      if (marqueeRectFromRef && marqueeRectFromRef.w > 5 && marqueeRectFromRef.h > 5) {
        const ids = elementsRef.current
          .filter((el) => {
            const overlapX = el.x < marqueeRectFromRef.x + marqueeRectFromRef.w && el.x + el.width > marqueeRectFromRef.x;
            const overlapY = el.y < marqueeRectFromRef.y + marqueeRectFromRef.h && el.y + el.height > marqueeRectFromRef.y;
            return overlapX && overlapY;
          })
          .map((el) => el.id);
        if (ids.length) setSelectedIds(ids);
      }
      return;
    }
    if (wasCanvasResize) return;
    setSnapGuides([]);
    // commit final state into history (re-sync by pushing current as a checkpoint)
    setElements((prev) => {
      pushHistory(prev);
      return prev;
    });
  }

  function startMove(e, el) {
    if (tool !== "select") return;
    e.stopPropagation();
    const pt = getCanvasPoint(e);

    // Multi-select: if shift is held, toggle selection
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const isSelected = prev.includes(el.id);
        if (isSelected) {
          return prev.filter((id) => id !== el.id);
        } else {
          return [...prev, el.id];
        }
      });
      return;
    }

    // If clicking and not already selected, select only this one
    if (!selectedIds.includes(el.id)) {
      setSelectedIds([el.id]);
    }

    // Build drag state - include all selected elements for multi-move
    const idsToMove = selectedIds.includes(el.id) ? selectedIds : [el.id];
    const origPositions = {};
    elements.forEach((e) => {
      if (idsToMove.includes(e.id)) {
        origPositions[e.id] = { x: e.x, y: e.y, points: e.points ? [...e.points.map((p) => [...p])] : null };
      }
    });
    dragRef.current = {
      mode: "move", id: el.id, multiIds: idsToMove, multi: idsToMove.length > 1,
      startX: pt.x, startY: pt.y, origX: el.x, origY: el.y, origW: el.width, origH: el.height,
      origPoints: el.points, origPositions,
    };
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

  // ---------- wheel zoom on canvas (non-passive listener so preventDefault works) ----------
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => clamp(z + delta, 0.1, 5));
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, []);

  // ---------- click outside to close popovers ----------
  useEffect(() => {
    function onDown(e) {
      if (imagePopoverRef.current && !imagePopoverRef.current.contains(e.target)) {
        setShowImagePopover(false);
      }
      if (bgImagePopoverRef.current && !bgImagePopoverRef.current.contains(e.target)) {
        setShowBgImagePopover(false);
      }
    }
    if (showImagePopover || showBgImagePopover) {
      window.addEventListener("pointerdown", onDown);
      return () => window.removeEventListener("pointerdown", onDown);
    }
  }, [showImagePopover, showBgImagePopover]);

  // ---------- actions ----------
  function deleteSelected() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
    setSelectedIds([]);
  }

  function duplicateSelected() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => {
      const copies = [];
      selectedIds.forEach((id) => {
        const el = prev.find((e) => e.id === id);
        if (!el) return;
        const copy = { ...el, id: uid(), x: el.x + 16, y: el.y + 16 };
        if (el.type === "pen") copy.points = el.points.map(([px, py]) => [px + 16, py + 16]);
        copies.push(copy);
      });
      if (!copies.length) return prev;
      setSelectedIds(copies.map((c) => c.id));
      return [...prev, ...copies];
    });
  }

  function copySelectedElements() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    const els = elements.filter((e) => selectedIds.includes(e.id));
    const serialized = JSON.parse(JSON.stringify(els));
    setClipboardElements(serialized);
    clipboardRef.current = serialized; // sync ref synchronously
    // Also write to the system clipboard as text/plain so "last copy wins" works
    const payload = JSON.stringify({ __marker: CLIPBOARD_MARKER, elements: serialized });
    navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([payload], { type: "text/plain" }) })]).catch(() => {});
  }

  function pasteElements() {
    const src = clipboardRef.current;
    if (!src || !src.length) return;
    updateElements((prev) => {
      const newEls = src.map((el) => {
        const copy = { ...el, id: uid(), x: el.x + 20, y: el.y + 20 };
        if (el.type === "pen" && el.points) {
          copy.points = el.points.map(([px, py]) => [px + 20, py + 20]);
        }
        return copy;
      });
      setSelectedIds(newEls.map((c) => c.id));
      return [...prev, ...newEls];
    });
  }

  /** paste data that came from the system clipboard (already parsed) */
  function internalPasteElements(src) {
    if (!src || !src.length) return;
    updateElements((prev) => {
      const newEls = src.map((el) => {
        const copy = { ...el, id: uid(), x: el.x + 20, y: el.y + 20 };
        if (el.type === "pen" && el.points) {
          copy.points = el.points.map(([px, py]) => [px + 20, py + 20]);
        }
        return copy;
      });
      setSelectedIds(newEls.map((c) => c.id));
      return [...prev, ...newEls];
    });
  }

  function changeSelectedColor(c) {
    setColor(c);
    if (selectedIds[0] === "__canvas__") {
      if (!bgImage) setCanvasColor(c);
      return;
    }
    if (!selectedIds.length) return;
    updateElements((prev) => prev.map((el) =>
      selectedIds.includes(el.id)
        ? { ...el, stroke: el.type === "text" ? el.stroke : c, color: el.type === "text" ? c : el.color }
        : el
    ));
  }

  // ---------- z-index reorder ----------
  function bringForward() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (selectedIds.includes(arr[i].id) && i < arr.length - 1) {
          const next = arr.findIndex((e, idx) => idx > i && !selectedIds.includes(e.id));
          if (next !== -1) {
            [arr[i], arr[next]] = [arr[next], arr[i]];
            break;
          }
        }
      }
      return arr;
    });
  }

  function sendBackward() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => {
      const arr = [...prev];
      for (let i = 0; i < arr.length; i++) {
        if (selectedIds.includes(arr[i].id) && i > 0) {
          const prevIdx = arr.findLastIndex((e, idx) => idx < i && !selectedIds.includes(e.id));
          if (prevIdx !== -1) {
            [arr[i], arr[prevIdx]] = [arr[prevIdx], arr[i]];
            break;
          }
        }
      }
      return arr;
    });
  }

  function bringToFront() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => {
      const selected = prev.filter((e) => selectedIds.includes(e.id));
      const others = prev.filter((e) => !selectedIds.includes(e.id));
      return [...others, ...selected];
    });
  }

  function sendToBack() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => {
      const selected = prev.filter((e) => selectedIds.includes(e.id));
      const others = prev.filter((e) => !selectedIds.includes(e.id));
      return [...selected, ...others];
    });
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
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) { e.preventDefault(); deleteSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedIds.length) { e.preventDefault(); duplicateSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        if (selectedId && selectedId !== "__canvas__") {
          copySelectedElements();
        } else {
          copyAsImage();
        }
      }
      // Ctrl+V is handled by the global paste event listener (elements + images)
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function buildExportCanvas() {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", canvasW);
    svg.setAttribute("height", canvasH);
    svg.setAttribute("xmlns", svgNS);

    if (bgImage) {
      const img = document.createElementNS(svgNS, "image");
      img.setAttributeNS("http://www.w3.org/1999/xlink", "href", bgImage.src);
      img.setAttribute("x", 0); img.setAttribute("y", 0);
      img.setAttribute("width", canvasW); img.setAttribute("height", canvasH);
      img.setAttribute("preserveAspectRatio", "xMinYMin slice");
      svg.appendChild(img);
    }
    elements.forEach((el) => {
      const g = document.createElementNS(svgNS, "g");
      g.setAttribute("transform", `translate(${el.x},${el.y}) rotate(${el.rotation || 0}, ${el.width / 2}, ${el.height / 2})`);
      if (el.type === "text") {
        // Measure text and wrap to element width using canvas measureText
        const text = (el.text || "");
        const fontSize = el.fontSize;
        const maxW = Math.max(el.width - 4, 1); // account for padding
        const lines = [];
        // Use a temporary canvas context for text measurement
        const tmpC = document.createElement("canvas").getContext("2d");
        tmpC.font = `600 ${fontSize}px Inter, Arial, sans-serif`;
        for (const paragraph of text.split("\n")) {
          const words = paragraph.split(/(?<=\s)|(?=\s)/);
          let current = "";
          for (const word of words) {
            const test = current + word;
            if (tmpC.measureText(test).width > maxW && current !== "") {
              lines.push(current);
              current = word;
            } else {
              current = test;
            }
          }
          if (current) lines.push(current);
        }
        const svgText = document.createElementNS(svgNS, "text");
        svgText.setAttribute("font-family", "Inter, Arial, sans-serif");
        svgText.setAttribute("font-weight", "600");
        svgText.setAttribute("font-size", fontSize);
        svgText.setAttribute("fill", el.color);
        svgText.setAttribute("x", 2);
        svgText.setAttribute("y", fontSize);
        lines.forEach((line, i) => {
          const tspan = document.createElementNS(svgNS, "tspan");
          tspan.setAttribute("x", 2);
          tspan.setAttribute("dy", i === 0 ? 0 : fontSize * 1.2);
          tspan.textContent = line;
          svgText.appendChild(tspan);
        });
        g.appendChild(svgText);
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
        canvasOut.width = canvasW; canvasOut.height = canvasH;
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
      setCopyStatus(null);
      clipboardRef.current = null; // clear ref synchronously so keydown handler sees it
      setClipboardElements(null);
      const canvasOut = await buildExportCanvas();
      const dataUrl = canvasOut.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopyStatus("copied");
    } catch (err) {
      console.error("copyAsImage failed:", err);
      setCopyStatus("failed");
    }
    setTimeout(() => setCopyStatus(null), 1800);
  }

  const selectedEl = elements.find((e) => e.id === selectedId);
  const canvasW = canvasSize.width;
  const canvasH = canvasSize.height;
  const hasSelection = selectedIds.length > 0 && selectedIds[0] !== "__canvas__";

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: "#f3f4f6", fontFamily: "Inter, system-ui, sans-serif", color: "#1f2937" }}>
      {/* Sidebar */}
      <div style={{ width: 72, background: "#ffffff", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 6 }}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
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
        <button title="Ctrl/Cmd+V pastes: sets background if empty, otherwise adds an overlay image" onClick={() => { }} style={{ width: 46, height: 46, borderRadius: 10, border: "none", background: "transparent", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", cursor: "default" }}>
          <ClipboardPaste size={20} />
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Top toolbar */}
        <div style={{ height: 56, background: "#ffffff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", padding: "0 16px", gap: 10 }}>
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

        {/* Canvas area */}
        <div ref={canvasContainerRef}
          onPointerDown={(e) => {
            // Left-click outside canvas → deselect all
            if (e.button === 0 && e.target === e.currentTarget) {
              setSelectedIds([]);
              return;
            }
            // Middle-button pan
            if (e.button === 1) {
              e.preventDefault();
              const container = canvasContainerRef.current;
              panRef.current = { startX: e.clientX, startY: e.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop };
              const onMove = (ev) => {
                if (!panRef.current) return;
                const dx = ev.clientX - panRef.current.startX;
                const dy = ev.clientY - panRef.current.startY;
                container.scrollLeft = panRef.current.scrollLeft - dx;
                container.scrollTop = panRef.current.scrollTop - dy;
              };
              const onUp = () => {
                panRef.current = null;
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointermove", onMove);
              window.addEventListener("pointerup", onUp);
            }
          }}
          style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "flex-start", padding: 32, background: "#f3f4f6", position: "relative" }}>
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
              borderRadius: 4, cursor: tool === "select" ? "default" : tool === "pan" ? "grab" : "crosshair", flexShrink: 0,
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
                    <img src={el.src} draggable={false} alt="shape"
                      style={{ width: "100%", height: "100%", objectFit: "fill", userSelect: "none", pointerEvents: "none" }} />
                  ) : (
                    <ShapeSVG el={el} />
                  )}

                  {isPrimary && isSelected && tool === "select" && (
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
            {selectedIds[0] === "__canvas__" && tool === "select" && (
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
              const hh = 5; // handle half-offset so 9px handle centers on edge/corner
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
              const iconBtnStyle = {
                width: 26, height: 26, borderRadius: 6, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", zIndex: 55,
              };
              return (
                <>
                  <div style={{
                    position: "absolute", inset: 0, background: "rgba(0,0,0,.45)",
                    zIndex: 50, pointerEvents: "none",
                  }} />
                  <div style={{
                    position: "absolute",
                    left: cxp, top: cyp,
                    width: cwp, height: chp,
                    border: "2px dashed #fff",
                    pointerEvents: "none", zIndex: 51,
                    boxShadow: "0 0 0 4000px rgba(0,0,0,.45)",
                  }} />
                  {/* Crop resize handles (8-direction) */}
                  {["nw","n","ne","e","se","s","sw","w"].map((h) => (
                    <div key={h} className="no-canvas-drag"
                      onPointerDown={(e) => startCropResize(e, h)}
                      style={{ ...handleBase, ...handlePositions[h] }}
                    />
                  ))}
                  {/* ✓ (apply) button at top-right corner of crop rect */}
                  <button onClick={applyElementCrop}
                    style={{ ...iconBtnStyle, position: "absolute", left: cxp + cwp + 6, top: cyp - 18, background: "#16a34a", color: "#fff" }}
                    title="Apply crop">
                    <Check size={16} />
                  </button>
                  {/* ✗ (cancel) button next to ✓ */}
                  <button onClick={cancelElementCrop}
                    style={{ ...iconBtnStyle, position: "absolute", left: cxp + cwp + 36, top: cyp - 18, background: "#dc2626", color: "#fff" }}
                    title="Cancel crop">
                    <X size={16} />
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Right inspector */}
      <div style={{ width: 300, minWidth: 300, background: "#ffffff", borderLeft: "1px solid #e5e7eb", padding: 16, fontSize: 13, boxSizing: "border-box" }}>
        <div style={{ color: "#6b7280", textTransform: "uppercase", fontSize: 11, letterSpacing: 0.6, marginBottom: 10 }}>
          Inspector{selectedIds.length > 1 ? ` (${selectedIds.length} selected)` : ""}
        </div>
        {selectedIds[0] === "__canvas__" ? (
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
                    onChange={(e) => {
                      updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, stroke: e.target.value } : p));
                    }}
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
                    onChange={(e) => {
                      updateElements((prev) => prev.map((p) => p.id === selectedEl.id ? { ...p, fill: e.target.value } : p));
                    }}
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

        {/* Crop modal for screenshot */}
        {isCropping && screenshotData && (
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
                    <div style={{
                      position: "absolute", left: 0, top: 0, width: "100%", height: cropRect.y,
                      background: "rgba(0,0,0,.4)", pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", left: 0, top: cropRect.y + cropRect.h, width: "100%",
                      height: `calc(100% - ${cropRect.y + cropRect.h}px)`,
                      background: "rgba(0,0,0,.4)", pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", left: 0, top: cropRect.y, width: cropRect.x, height: cropRect.h,
                      background: "rgba(0,0,0,.4)", pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", left: cropRect.x + cropRect.w, top: cropRect.y,
                      width: `calc(100% - ${cropRect.x + cropRect.w}px)`, height: cropRect.h,
                      background: "rgba(0,0,0,.4)", pointerEvents: "none",
                    }} />
                    {/* Selection border */}
                    <div style={{
                      position: "absolute", left: cropRect.x, top: cropRect.y, width: cropRect.w, height: cropRect.h,
                      border: "2px dashed #fff", pointerEvents: "none", boxSizing: "border-box",
                    }} />
                    {/* Corner handles */}
                    <div style={{
                      position: "absolute", left: cropRect.x - 4, top: cropRect.y - 4, width: 8, height: 8,
                      background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", left: cropRect.x + cropRect.w - 4, top: cropRect.y - 4, width: 8, height: 8,
                      background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", left: cropRect.x - 4, top: cropRect.y + cropRect.h - 4, width: 8, height: 8,
                      background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none",
                    }} />
                    <div style={{
                      position: "absolute", left: cropRect.x + cropRect.w - 4, top: cropRect.y + cropRect.h - 4, width: 8, height: 8,
                      background: "#fff", borderRadius: "50%", border: "2px solid #3b82f6", pointerEvents: "none",
                    }} />
                  </>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={cancelScreenshot}
                  style={{
                    padding: "8px 20px", borderRadius: 8, border: "1px solid #d1d5db",
                    background: "transparent", color: "#6b7280", cursor: "pointer", fontSize: 13,
                  }}>Cancel</button>
                <button onClick={saveScreenshot}
                  style={{
                    padding: "8px 20px", borderRadius: 8, border: "none",
                    background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  }}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#9ca3af" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function iconBtnStyle(disabled) {
  return {
    width: 34, height: 34, borderRadius: 8, border: "none", background: "#f3f4f6",
    color: disabled ? "#9ca3af" : "#374151", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function handleStyle(pos) {
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

const kbdStyle = { background: "#e5e7eb", padding: "1px 6px", borderRadius: 4, fontSize: 12 };

const selectStyle = {
  width: "100%", background: "#ffffff", color: "#1f2937", border: "1px solid #d1d5db",
  borderRadius: 6, padding: "6px 8px", fontSize: 13, boxSizing: "border-box"
};
