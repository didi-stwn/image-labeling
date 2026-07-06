# Image Labeling

A browser-based image annotation and editing tool built with React. Draw shapes, add text, overlay images, take screenshots, and export your work — all in a single-page app.

## Features

### Canvas
- Resizable canvas with custom **width** and **height** (50–4000px)
- Configurable **background color** or **background image** (upload or screenshot)
- Background images are cropped to fit the canvas (top-left anchored)

### Drawing Tools
| Tool | Description |
|------|-------------|
| Select | Select, move, resize, and rotate elements on the canvas |
| Pan | Drag to pan the canvas viewport |
| Rectangle | Draw a rounded rectangle |
| Ellipse | Draw an ellipse / circle |
| Triangle | Draw a triangle |
| Line | Draw a straight line |
| Arrow | Draw an arrow (configurable head/tail) |
| Pen | Freehand drawing |
| Text | Add editable text labels |

### Color & Stroke
- Predefined **color palette** (7 colors)
- **Custom color picker** for any color
- **Stroke width** slider (1–16px)
- **Fill color** toggle with custom color picker for Rectangle, Ellipse, and Triangle

### Image Overlay
- Upload images from file and place them as overlays on the canvas
- **Keep aspect ratio** toggle when resizing overlay images
- Adjustable position, size, and rotation via the inspector

### Screenshot Capture
- **Picture-in-Picture (PiP)** capture flow:
  1. Click "Take screenshot" in the sidebar popover
  2. Click "Capture" in the PiP window
  3. Select a screen / window / tab in the browser dialog
  4. The screenshot is captured and opened in a **crop modal**
- Crop modal: drag to select the area you want to keep, then **Save**
- Screenshots can be added as either **background image** or **overlay image**

### Clipboard
- **Ctrl/Cmd+V** – Paste an image from the clipboard (sets as background if empty, otherwise adds as overlay)
- **Ctrl/Cmd+C** – Copy the entire canvas as an image to the clipboard
- Dedicated paste status indicator icon in the sidebar

### Export
- **Export PNG** – Download the full canvas (with all elements) as a PNG file
- **Copy Image** – Copy the full canvas to the clipboard as an image

### Zoom & Pan
- **Ctrl + Scroll** – Zoom in/out on the canvas
- **Zoom buttons** in toolbar: Zoom Out, zoom percentage, Zoom In, Fit (reset to 100%)
- **Middle mouse button** – Pan the canvas viewport
- **Pan tool** – Dedicated hand tool for dragging the viewport

### Inspector (Right Panel)
- **Canvas inspector**: Edit width, height, background color, or remove the background image
- **Element inspector**: Edit X, Y, Width, Height, Rotation, Stroke width, Stroke color, Fill color, Font size (text), Arrow head/tail types
- Keyboard shortcuts reference when nothing is selected

### Undo / Redo
- **Undo** (Ctrl/Cmd+Z) – step back through up to 50 previous states
- **Redo** (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y) – step forward
- **Duplicate** (Ctrl/Cmd+D) – duplicate the selected element

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Delete / Backspace | Remove selected element |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Ctrl/Cmd + Y | Redo |
| Ctrl/Cmd + D | Duplicate selected element |
| Ctrl/Cmd + C | Copy canvas as image |
| Ctrl/Cmd + V | Paste image from clipboard |

### Theme
Clean **light theme** UI with light gray backgrounds, white panels, and subtle borders.

## Getting Started

### Prerequisites
- Node.js 16+ and npm

### Install

```bash
npm install
```

### Run (development)

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build (production)

```bash
npm run build
```

Produces an optimized build in the `build/` folder.

## Tech Stack

- **React** (Create React App)
- **lucide-react** – icon library
- Pure CSS-in-JS (inline styles) – no external CSS framework

## Browser Support

Requires a browser that supports:
- [Document Picture-in-Picture API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API) (Chrome 116+) – for screenshot capture
- [Screen Capture API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Capture_API) (getDisplayMedia)
- [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) (write / read)

The app will gracefully degrade on browsers missing PiP support (screenshot capture will be unavailable, other features work normally).
