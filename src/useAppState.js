import { useState, useRef, useCallback, useEffect } from "react";
import {
  CLIPBOARD_MARKER, uid, clamp, SIZE_PRESETS, newShape,
} from "./constants";

export default function useAppState() {
  // ---------- canvas ----------
  const [bgImage, setBgImage] = useState(null); // {src, width, height}
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 560 });
  const [localCanvasSize, setLocalCanvasSize] = useState({ width: 900, height: 560 });
  const [canvasColor, setCanvasColor] = useState("#ffffff");
  const [zoom, setZoom] = useState(1);
  const [canvasSizePreset, setCanvasSizePreset] = useState("Custom");
  const canvasSizeTimerRef = useRef(null);

  // Keep localCanvasSize in sync when canvasSize changes externally (e.g. preset selection)
  useEffect(() => { setLocalCanvasSize(canvasSize); }, [canvasSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive default preset on mount (intentionally only runs once)
  useEffect(() => {
    const match = SIZE_PRESETS.find((p) => p.width === canvasSize.width && p.height === canvasSize.height);
    setCanvasSizePreset(match ? match.label : "Custom");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function debouncedCommitCanvasSize(nextSize) {
    if (canvasSizeTimerRef.current) clearTimeout(canvasSizeTimerRef.current);
    canvasSizeTimerRef.current = setTimeout(() => { setCanvasSize(nextSize); }, 300);
  }
  useEffect(() => () => {
    if (canvasSizeTimerRef.current) clearTimeout(canvasSizeTimerRef.current);
  }, []);

  function resolvePreset(w, h) {
    const match = SIZE_PRESETS.find((p) => p.width === w && p.height === h);
    return match ? match.label : "Custom";
  }

  // ---------- elements & selection ----------
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedId = selectedIds[0] || null;
  const selectedEl = elements.find((e) => e.id === selectedId);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const hasSelection = selectedIds.length > 0 && selectedIds[0] !== "__canvas__";

  // ---------- tools ----------
  const [tool, setTool] = useState("select");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);

  // ---------- history ----------
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
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

  // ---------- clipboard ----------
  const [clipboardElements, setClipboardElements] = useState(null);
  const clipboardRef = useRef(null);
  clipboardRef.current = clipboardElements;
  const [copyStatus, setCopyStatus] = useState(null);

  // ---------- text editing ----------
  const [editingTextId, setEditingTextId] = useState(null);

  // ---------- marquee ----------
  const [marqueeRect, setMarqueeRect] = useState(null);
  const [snapGuides, setSnapGuides] = useState([]);

  // ---------- element crop ----------
  const [croppingElId, setCroppingElId] = useState(null);
  const [cropElRect, setCropElRect] = useState(null);
  const cropElDragRef = useRef(null);
  const preCropRef = useRef(null);

  // ---------- screenshot ----------
  const [showImagePopover, setShowImagePopover] = useState(false);
  const [showBgImagePopover, setShowBgImagePopover] = useState(false);
  const [screenshotData, setScreenshotData] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [screenshotMode, setScreenshotMode] = useState("overlay");
  const cropDragRef = useRef(null);

  // ---------- refs ----------
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const dragRef = useRef(null);
  const panRef = useRef(null);
  const imagePopoverRef = useRef(null);
  const bgImagePopoverRef = useRef(null);
  const overlayFileInputRef = useRef(null);
  const bgFileInputRef = useRef(null);
  const pipWindowRef = useRef(null);

  // ---------- computed ----------
  const canvasW = canvasSize.width;
  const canvasH = canvasSize.height;

  // ---------- screenshot capture via PiP ----------
  async function startScreenshot(mode = "overlay") {
    setShowImagePopover(false);
    setShowBgImagePopover(false);
    setScreenshotMode(mode);
    try {
      const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 420, height: 300 });
      pipWindowRef.current = pipWindow;
      const doc = pipWindow.document;

      function setPipContent(html) { doc.body.innerHTML = html; }

      setPipContent(`
        <div style="display:flex;align-items:center;justify-content:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <button id="capture-btn" style="padding:14px 40px;font-size:18px;font-weight:600;border:none;border-radius:12px;cursor:pointer;background:#3b82f6;color:#fff;box-shadow:0 4px 16px rgba(59,130,246,.3);">Capture</button>
        </div>
      `);

      doc.getElementById('capture-btn').addEventListener('click', async () => {
        try {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          pipWindow.close();
          pipWindowRef.current = null;
          await new Promise((r) => setTimeout(r, 400));

          const video = document.createElement("video");
          video.srcObject = stream;
          await video.play();

          const captureCanvas = document.createElement("canvas");
          captureCanvas.width = video.videoWidth;
          captureCanvas.height = video.videoHeight;
          const ctx = captureCanvas.getContext("2d");
          ctx.drawImage(video, 0, 0);

          stream.getTracks().forEach((t) => t.stop());

          const dataUrl = captureCanvas.toDataURL("image/png");
          setScreenshotData({ src: dataUrl, width: video.videoWidth, height: video.videoHeight });
          setCropRect(null);
          setIsCropping(true);
        } catch (err) {
          try { pipWindow.close(); } catch (_) { }
          pipWindowRef.current = null;
        }
      });

      pipWindow.addEventListener('pagehide', () => { pipWindowRef.current = null; });
    } catch (err) { /* PiP not supported */ }
  }

  // ---------- screenshot crop helpers ----------
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
        setBgImage({ src: croppedSrc, width: sw, height: sh });
        setCanvasSize({ width: sw, height: sh });
        setElements([]);
        setHistory([]);
        setFuture([]);
        setSelectedIds([]);
      } else {
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
    preCropRef.current = {
      src: selectedEl.src,
      width: selectedEl.width,
      height: selectedEl.height,
      x: selectedEl.x,
      y: selectedEl.y,
    };
    const origSrc = selectedEl.originalSrc || selectedEl.src;
    const origW = selectedEl.originalWidth || selectedEl.width;
    const origH = selectedEl.originalHeight || selectedEl.height;
    if (!selectedEl.originalSrc) {
      updateElements((prev) => prev.map((p) =>
        p.id === selectedEl.id ? { ...p, originalSrc: origSrc, originalWidth: origW, originalHeight: origH } : p
      ));
    }
    updateElements((prev) => prev.map((p) =>
      p.id === selectedEl.id ? { ...p, src: origSrc, width: origW, height: origH } : p
    ));
    if (selectedEl.cropData) {
      setCropElRect({ ...selectedEl.cropData });
    } else {
      setCropElRect({ x: 0, y: 0, w: origW, h: origH });
    }
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
    const sourceSrc = el.originalSrc || el.src;
    const img = new window.Image();
    img.onload = () => {
      const outCanvas = document.createElement("canvas");
      outCanvas.width = w;
      outCanvas.height = h;
      const ctx = outCanvas.getContext("2d");
      const elemAspect = el.width / el.height;
      const natAspect = img.width / img.height;
      let sx, sy, sw, sh;
      if (natAspect > elemAspect) {
        sh = img.height;
        sw = img.height * elemAspect;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        sw = img.width;
        sh = img.width / elemAspect;
        sx = 0;
        sy = (img.height - sh) / 2;
      }
      const scaleX = sw / el.width;
      const scaleY = sh / el.height;
      ctx.drawImage(img, sx + x * scaleX, sy + y * scaleY, w * scaleX, h * scaleY, 0, 0, w, h);
      const croppedSrc = outCanvas.toDataURL("image/png");
      const cropData = { x, y, w, h };
      updateElements((prev) => prev.map((p) => p.id === croppingElId
        ? { ...p, src: croppedSrc, width: w, height: h, keepAspectRatio: true,
            cropData,
            originalSrc: p.originalSrc || sourceSrc,
            originalWidth: p.originalWidth || el.width,
            originalHeight: p.originalHeight || el.height }
        : p
      ));
      cancelElementCrop();
    };
    img.src = sourceSrc;
  }

  function cancelElementCrop() {
    if (preCropRef.current && croppingElId) {
      updateElements((prev) => prev.map((p) =>
        p.id === croppingElId ? { ...p, ...preCropRef.current } : p
      ));
    }
    setCroppingElId(null);
    setCropElRect(null);
    cropElDragRef.current = null;
    preCropRef.current = null;
    if (dragRef.current?.mode === "crop-resize") {
      dragRef.current = null;
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
    }
  }

  // ---------- clipboard paste ----------
  useEffect(() => {
    const onPaste = async (e) => {
      if (editingTextId) return;
      const items = e.clipboardData?.items || [];

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

      if (imageFile) {
        if (elements.length === 0 && !bgImage) {
          loadImageFile(imageFile);
        } else {
          addOverlayImage(imageFile);
        }
        e.preventDefault();
        return;
      }

      if (markerElements) {
        internalPasteElements(markerElements);
        e.preventDefault();
        return;
      }

      if (clipboardRef.current && clipboardRef.current.length) {
        e.preventDefault();
        pasteElements();
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [editingTextId, bgImage, elements]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- image file loading ----------
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

      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) { dy = 0; } else { dx = 0; }
      }

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

      function checkSnap(dv, tv) {
        const diff = dv - tv;
        return Math.abs(diff) < snapThreshold ? diff : null;
      }

      for (const edge of ["left", "right", "centerX"]) {
        const dv = edge === "left" ? dragEdges.left : edge === "right" ? dragEdges.right : dragCenter.x;
        const snap = checkSnap(dv, centers.x);
        if (snap !== null) { snapDx = -snap; newGuides.push({ axis: "x", pos: centers.x, start: 0, end: canvasH }); break; }
      }
      for (const edge of ["top", "bottom", "centerY"]) {
        const dv = edge === "top" ? dragEdges.top : edge === "bottom" ? dragEdges.bottom : dragCenter.y;
        const snap = checkSnap(dv, centers.y);
        if (snap !== null) { snapDy = -snap; newGuides.push({ axis: "y", pos: centers.y, start: 0, end: canvasW }); break; }
      }

      if (newGuides.length === 0) {
        for (const other of elementsRef.current) {
          if (other.id === drag.id || (drag.multiIds && drag.multiIds.includes(other.id))) continue;
          const o = { left: other.x, right: other.x + other.width, top: other.y, bottom: other.y + other.height, centerX: other.x + other.width / 2, centerY: other.y + other.height / 2 };
          for (const de of ["left", "right", "centerX"]) {
            for (const oe of ["left", "right", "centerX"]) {
              const dv = de === "left" ? dragEdges.left : de === "right" ? dragEdges.right : dragCenter.x;
              const snap = checkSnap(dv, o[oe]);
              if (snap !== null) { snapDx = -snap; newGuides.push({ axis: "x", pos: o[oe], start: Math.min(dragEdges.top, o.top), end: Math.max(dragEdges.bottom, o.bottom) }); break; }
            }
            if (snapDx !== 0) break;
          }
          for (const de of ["top", "bottom", "centerY"]) {
            for (const oe of ["top", "bottom", "centerY"]) {
              const dv = de === "top" ? dragEdges.top : de === "bottom" ? dragEdges.bottom : dragCenter.y;
              const snap = checkSnap(dv, o[oe]);
              if (snap !== null) { snapDy = -snap; newGuides.push({ axis: "y", pos: o[oe], start: Math.min(dragEdges.left, o.left), end: Math.max(dragEdges.right, o.right) }); break; }
            }
            if (snapDy !== 0) break;
          }
          if (snapDx !== 0 || snapDy !== 0) break;
        }
      }

      setSnapGuides(newGuides);
      dx += snapDx;
      dy += snapDy;

      updateElements((prev) => prev.map((el) => {
        const isMulti = drag.multiIds && drag.multiIds.includes(el.id);
        if (!isMulti && el.id !== drag.id) return el;
        if (el.id === drag.id) {
          const moved = { ...el, x: drag.origX + dx, y: drag.origY + dy };
          if (el.type === "pen") { moved.points = drag.origPoints.map(([px, py]) => [px + dx, py + dy]); }
          return moved;
        }
        const orig = drag.origPositions?.[el.id];
        if (orig) {
          const moved = { ...el, x: orig.x + dx, y: orig.y + dy };
          if (el.type === "pen") { moved.points = orig.points.map(([px, py]) => [px + dx, py + dy]); }
          return moved;
        }
        return el;
      }), false);
    } else if (drag.mode === "resize") {
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      const origX = drag.origX, origY = drag.origY, origW = drag.origW, origH = drag.origH;
      let targetX = origX, targetY = origY, targetW = origW, targetH = origH;
      if (drag.handle.includes("e")) targetW = Math.max(8, origW + dx);
      if (drag.handle.includes("s")) targetH = Math.max(8, origH + dy);
      if (drag.handle.includes("w")) { targetW = Math.max(8, origW - dx); targetX = origX + (origW - targetW); }
      if (drag.handle.includes("n")) { targetH = Math.max(8, origH - dy); targetY = origY + (origH - targetH); }

      const newGuides = [];
      const snapThreshold = 5;
      const canvasCenterX = canvasW / 2, canvasCenterY = canvasH / 2;
      const resizeEdges = { left: targetX, right: targetX + targetW, top: targetY, bottom: targetY + targetH, centerX: targetX + targetW / 2, centerY: targetY + targetH / 2 };
      let snapDx = 0, snapDy = 0;
      function checkSnap(dv, tv) { const d = dv - tv; return Math.abs(d) < snapThreshold ? d : null; }

      for (const e of ["left", "right", "centerX"]) {
        const s = checkSnap(resizeEdges[e], canvasCenterX);
        if (s !== null) { snapDx = -s; newGuides.push({ axis: "x", pos: canvasCenterX, start: 0, end: canvasH }); break; }
      }
      for (const e of ["top", "bottom", "centerY"]) {
        const s = checkSnap(resizeEdges[e], canvasCenterY);
        if (s !== null) { snapDy = -s; newGuides.push({ axis: "y", pos: canvasCenterY, start: 0, end: canvasW }); break; }
      }

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
      const snapDxLocal = snapDx, snapDyLocal = snapDy;
      updateElements((prev) => prev.map((el) => {
        if (el.id !== drag.id) return el;
        let { x, y, width, height } = { x: origX, y: origY, width: origW, height: origH };
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
    if (wasMarqueePending) { return; }
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
    setElements((prev) => { pushHistory(prev); return prev; });
  }

  function startMove(e, el) {
    if (tool !== "select") return;
    e.stopPropagation();
    const pt = getCanvasPoint(e);

    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const isSelected = prev.includes(el.id);
        if (isSelected) { return prev.filter((id) => id !== el.id); }
        else { return [...prev, el.id]; }
      });
      return;
    }

    if (!selectedIds.includes(el.id)) { setSelectedIds([el.id]); }

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

  // ---------- wheel zoom ----------
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
      if (imagePopoverRef.current && !imagePopoverRef.current.contains(e.target)) { setShowImagePopover(false); }
      if (bgImagePopoverRef.current && !bgImagePopoverRef.current.contains(e.target)) { setShowBgImagePopover(false); }
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
    clipboardRef.current = serialized;
    const payload = JSON.stringify({ __marker: CLIPBOARD_MARKER, elements: serialized });
    navigator.clipboard.write([new ClipboardItem({ "text/plain": new Blob([payload], { type: "text/plain" }) })]).catch(() => {});
  }

  function pasteElements() {
    const src = clipboardRef.current;
    if (!src || !src.length) return;
    updateElements((prev) => {
      const newEls = src.map((el) => {
        const copy = { ...el, id: uid(), x: el.x + 20, y: el.y + 20 };
        if (el.type === "pen" && el.points) { copy.points = el.points.map(([px, py]) => [px + 20, py + 20]); }
        return copy;
      });
      setSelectedIds(newEls.map((c) => c.id));
      return [...prev, ...newEls];
    });
  }

  function internalPasteElements(src) {
    if (!src || !src.length) return;
    updateElements((prev) => {
      const newEls = src.map((el) => {
        const copy = { ...el, id: uid(), x: el.x + 20, y: el.y + 20 };
        if (el.type === "pen" && el.points) { copy.points = el.points.map(([px, py]) => [px + 20, py + 20]); }
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

  // ---------- z-index ----------
  function bringForward() {
    if (!selectedIds.length || selectedIds[0] === "__canvas__") return;
    updateElements((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (selectedIds.includes(arr[i].id) && i < arr.length - 1) {
          const next = arr.findIndex((e, idx) => idx > i && !selectedIds.includes(e.id));
          if (next !== -1) { [arr[i], arr[next]] = [arr[next], arr[i]]; break; }
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
          if (prevIdx !== -1) { [arr[i], arr[prevIdx]] = [arr[prevIdx], arr[i]]; break; }
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

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e) => {
      if (editingTextId) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedIds.length) { e.preventDefault(); deleteSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedIds.length) { e.preventDefault(); duplicateSelected(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !window.getSelection()?.toString()) {
        e.preventDefault();
        if (selectedId && selectedId !== "__canvas__") { copySelectedElements(); }
        else { copyAsImage(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- export ----------
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
        const text = (el.text || "");
        const fontSize = el.fontSize;
        const maxW = Math.max(el.width - 4, 1);
        const lines = [];
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
            } else { current = test; }
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
      tmpImg.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
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
      clipboardRef.current = null;
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

  // ---------- return all state and handlers ----------
  return {
    // state
    bgImage, setBgImage,
    canvasSize, setCanvasSize,
    localCanvasSize, setLocalCanvasSize,
    canvasColor, setCanvasColor,
    zoom, setZoom,
    canvasSizePreset, setCanvasSizePreset,
    canvasSizeTimerRef,
    debouncedCommitCanvasSize,
    resolvePreset,
    elements, setElements,
    selectedIds, setSelectedIds,
    selectedId, selectedEl,
    tool, setTool,
    color, setColor,
    strokeWidth, setStrokeWidth,
    history, setHistory,
    future, setFuture,
    pushHistory,
    clipboardElements, setClipboardElements,
    clipboardRef,
    copyStatus, setCopyStatus,
    editingTextId, setEditingTextId,
    marqueeRect, setMarqueeRect,
    snapGuides, setSnapGuides,
    croppingElId, setCroppingElId,
    cropElRect, setCropElRect,
    cropElDragRef, preCropRef,
    showImagePopover, setShowImagePopover,
    showBgImagePopover, setShowBgImagePopover,
    screenshotData, setScreenshotData,
    cropRect, setCropRect,
    isCropping, setIsCropping,
    screenshotMode, setScreenshotMode,
    cropDragRef,
    canvasRef, canvasContainerRef,
    dragRef, panRef,
    imagePopoverRef, bgImagePopoverRef,
    overlayFileInputRef, bgFileInputRef,
    pipWindowRef,
    elementsRef,
    hasSelection,
    canvasW, canvasH,

    // handlers
    updateElements,
    startScreenshot,
    getCropClientPoint,
    onCropPointerDown,
    onCropPointerMove,
    onCropPointerUp,
    saveScreenshot,
    cancelScreenshot,
    startElementCrop,
    startCropResize,
    applyElementCrop,
    cancelElementCrop,
    loadImageFile,
    clearBackgroundImage,
    addOverlayImage,
    handleUpload,
    handleOverlayUpload,
    getCanvasPoint,
    onCanvasPointerDown,
    onWindowPointerMove,
    onWindowPointerUp,
    startMove,
    startResize,
    startRotate,
    startCanvasResize,
    deleteSelected,
    duplicateSelected,
    copySelectedElements,
    pasteElements,
    internalPasteElements,
    changeSelectedColor,
    bringForward,
    sendBackward,
    bringToFront,
    sendToBack,
    undo,
    redo,
    buildExportCanvas,
    exportPNG,
    copyAsImage,
  };
}
