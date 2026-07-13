import { useEffect } from "react";
import useAppState from "./useAppState";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import CanvasArea from "./components/CanvasArea";
import Inspector from "./components/Inspector";
import ScreenshotCrop from "./components/ScreenshotCrop";

export default function App() {
  const S = useAppState();

  // Deselect all on outside click — expose as window global for CanvasArea
  useEffect(() => {
    window.__deselectAll = () => S.setSelectedIds([]);
    return () => { delete window.__deselectAll; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", background: "#f3f4f6", fontFamily: "Inter, system-ui, sans-serif", color: "#1f2937" }}>
      {/* Sidebar */}
      <Sidebar
        tool={S.tool} setTool={S.setTool}
        showImagePopover={S.showImagePopover} setShowImagePopover={S.setShowImagePopover}
        showBgImagePopover={S.showBgImagePopover} setShowBgImagePopover={S.setShowBgImagePopover}
        imagePopoverRef={S.imagePopoverRef} bgImagePopoverRef={S.bgImagePopoverRef}
        overlayFileInputRef={S.overlayFileInputRef} bgFileInputRef={S.bgFileInputRef}
        handleUpload={S.handleUpload} handleOverlayUpload={S.handleOverlayUpload}
        startScreenshot={S.startScreenshot}
      />

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {/* Top toolbar */}
        <TopBar
          color={S.color} setColor={S.setColor}
          strokeWidth={S.strokeWidth} setStrokeWidth={S.setStrokeWidth}
          undo={S.undo} redo={S.redo}
          history={S.history} future={S.future}
          duplicateSelected={S.duplicateSelected} deleteSelected={S.deleteSelected}
          zoom={S.zoom} setZoom={S.setZoom}
          copyAsImage={S.copyAsImage} copyStatus={S.copyStatus}
          exportPNG={S.exportPNG}
          updateElements={S.updateElements}
          selectedId={S.selectedId}
          changeSelectedColor={S.changeSelectedColor}
          hasSelection={S.hasSelection}
        />

        {/* Canvas area */}
        <CanvasArea
          canvasContainerRef={S.canvasContainerRef} canvasRef={S.canvasRef}
          canvasW={S.canvasW} canvasH={S.canvasH} zoom={S.zoom}
          bgImage={S.bgImage} canvasColor={S.canvasColor}
          elements={S.elements} selectedIds={S.selectedIds} selectedId={S.selectedId}
          tool={S.tool}
          editingTextId={S.editingTextId} setEditingTextId={S.setEditingTextId}
          marqueeRect={S.marqueeRect} setMarqueeRect={S.setMarqueeRect}
          snapGuides={S.snapGuides}
          canvasSizePreset={S.canvasSizePreset}
          croppingElId={S.croppingElId} cropElRect={S.cropElRect}
          onCanvasPointerDown={S.onCanvasPointerDown}
          startMove={S.startMove}
          startResize={S.startResize}
          startRotate={S.startRotate}
          startCanvasResize={S.startCanvasResize}
          startCropResize={S.startCropResize}
          applyElementCrop={S.applyElementCrop}
          cancelElementCrop={S.cancelElementCrop}
          updateElements={S.updateElements}
        />
      </div>

      {/* Right inspector */}
      <Inspector
        selectedIds={S.selectedIds} selectedEl={S.selectedEl} selectedId={S.selectedId}
        canvasSizePreset={S.canvasSizePreset} setCanvasSizePreset={S.setCanvasSizePreset}
        localCanvasSize={S.localCanvasSize} setLocalCanvasSize={S.setLocalCanvasSize}
        debouncedCommitCanvasSize={S.debouncedCommitCanvasSize}
        canvasColor={S.canvasColor} setCanvasColor={S.setCanvasColor}
        bgImage={S.bgImage} clearBackgroundImage={S.clearBackgroundImage}
        elements={S.elements} updateElements={S.updateElements}
        startElementCrop={S.startElementCrop}
        bringForward={S.bringForward} sendBackward={S.sendBackward}
        bringToFront={S.bringToFront} sendToBack={S.sendToBack}
        hasSelection={S.hasSelection}
        changeSelectedColor={S.changeSelectedColor}
      />

      {/* Screenshot crop modal */}
      <ScreenshotCrop
        screenshotData={S.screenshotData}
        cropRect={S.cropRect}
        onCropPointerDown={S.onCropPointerDown}
        saveScreenshot={S.saveScreenshot}
        cancelScreenshot={S.cancelScreenshot}
      />
    </div>
  );
}
