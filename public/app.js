/**
 * Blurrise — Local Privacy Image Blur & Redaction Studio
 * 100% Client-Side HTML5 Canvas Engine (Zero Network / Zero Telemetry)
 */
(function () {
  'use strict';

  // --- DOM Elements ---
  const fileInput = document.getElementById('fileInput');
  const uploadTopBtn = document.getElementById('uploadTopBtn');
  const uploadHeroBtn = document.getElementById('uploadHeroBtn');
  const sampleTopBtn = document.getElementById('sampleTopBtn');
  const sampleHeroBtn = document.getElementById('sampleHeroBtn');

  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const compareBtn = document.getElementById('compareBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const removeImageBtn = document.getElementById('removeImageBtn');
  const exportFormatSelect = document.getElementById('exportFormatSelect');
  const exportBtn = document.getElementById('exportBtn');

  const emptyDropZone = document.getElementById('emptyDropZone');
  const globalDropOverlay = document.getElementById('globalDropOverlay');
  const canvasViewport = document.getElementById('canvasViewport');
  const editorCanvas = document.getElementById('editorCanvas');
  const ctx = editorCanvas.getContext('2d');

  const imageDimensionsLabel = document.getElementById('imageDimensionsLabel');
  const activeToolBadge = document.getElementById('activeToolBadge');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  const zoomInBtn = document.getElementById('zoomInBtn');

  const toolCards = document.querySelectorAll('.tool-card');
  const effectOptions = document.querySelectorAll('.effect-option');
  const intensitySlider = document.getElementById('intensitySlider');
  const intensityValue = document.getElementById('intensityValue');
  const brushSizeSlider = document.getElementById('brushSizeSlider');
  const brushSizeValue = document.getElementById('brushSizeValue');
  const cornerRadiusSlider = document.getElementById('cornerRadiusSlider');
  const cornerRadiusValue = document.getElementById('cornerRadiusValue');
  const redactColorBlock = document.getElementById('redactColorBlock');
  const colorSwatches = document.querySelectorAll('.color-swatch');

  const layerCountBadge = document.getElementById('layerCountBadge');
  const layersEmptyState = document.getElementById('layersEmptyState');
  const layersList = document.getElementById('layersList');
  const selectedLayerActions = document.getElementById('selectedLayerActions');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const toastContainer = document.getElementById('toastContainer');

  // --- Application State ---
  const state = {
    sourceCanvas: null, // Offscreen full-resolution original image canvas
    imageName: 'blurrise-image',
    naturalWidth: 0,
    naturalHeight: 0,
    zoom: 1,

    // Active tool & parameters
    tool: 'rect', // 'rect' | 'ellipse' | 'brush' | 'select'
    effect: 'gaussian', // 'gaussian' | 'pixelate' | 'redact'
    intensity: 40, // 5..100
    brushSize: 48, // 8..180 (in image pixels)
    cornerRadius: 8, // 0..60
    redactColor: '#0B0F19',

    // Non-destructive blur regions stack
    regions: [],
    selectedId: null,
    undoStack: [],
    redoStack: [],

    // Pointer interaction state
    interaction: null, // { mode: 'draw-shape'|'draw-brush'|'move'|'resize', handle, startX, startY, origRegion, currentRegion }
    pointerPos: null, // { x, y } in image coordinates
    isComparingOriginal: false,
    nextId: 1
  };

  // Offscreen reusable buffers for compositing effects
  const effectBufferCanvas = document.createElement('canvas');
  const effectBufferCtx = effectBufferCanvas.getContext('2d');
  const maskBufferCanvas = document.createElement('canvas');
  const maskBufferCtx = maskBufferCanvas.getContext('2d');
  const pixelateTempCanvas = document.createElement('canvas');
  const pixelateTempCtx = pixelateTempCanvas.getContext('2d');

  // --- Toast Helper ---
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.25s ease';
      setTimeout(() => toast.remove(), 260);
    }, 2600);
  }

  // --- Deep Clone for Undo/Redo History ---
  function cloneRegions(regions) {
    return regions.map((r) => ({
      ...r,
      points: r.points ? r.points.map((p) => ({ x: p.x, y: p.y })) : undefined
    }));
  }

  function pushUndoSnapshot() {
    state.undoStack.push(cloneRegions(state.regions));
    if (state.undoStack.length > 50) {
      state.undoStack.shift();
    }
    state.redoStack = [];
    updateHistoryButtons();
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    state.redoStack.push(cloneRegions(state.regions));
    state.regions = state.undoStack.pop();
    if (!state.regions.some((r) => r.id === state.selectedId)) {
      state.selectedId = null;
    }
    if (state.pointerPos) {
      updateCanvasCursor(state.pointerPos);
    }
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    state.undoStack.push(cloneRegions(state.regions));
    state.regions = state.redoStack.pop();
    if (!state.regions.some((r) => r.id === state.selectedId)) {
      state.selectedId = null;
    }
    if (state.pointerPos) {
      updateCanvasCursor(state.pointerPos);
    }
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
  }

  function updateHistoryButtons() {
    const hasImage = Boolean(state.sourceCanvas);
    undoBtn.disabled = !hasImage || state.undoStack.length === 0;
    redoBtn.disabled = !hasImage || state.redoStack.length === 0;
    compareBtn.disabled = !hasImage || state.regions.length === 0;
    clearAllBtn.disabled = !hasImage || state.regions.length === 0;
    removeImageBtn.disabled = !hasImage;
    exportBtn.disabled = !hasImage;
    exportFormatSelect.disabled = !hasImage;
  }

  function removeCurrentImage() {
    if (!state.sourceCanvas) return;
    state.sourceCanvas = null;
    state.imageName = 'blurrise-image';
    state.naturalWidth = 0;
    state.naturalHeight = 0;
    state.regions = [];
    state.selectedId = null;
    state.undoStack = [];
    state.redoStack = [];
    state.interaction = null;
    state.pointerPos = null;
    state.isComparingOriginal = false;

    ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
    editorCanvas.width = 1;
    editorCanvas.height = 1;

    canvasViewport.classList.add('hidden');
    emptyDropZone.classList.remove('hidden');
    imageDimensionsLabel.textContent = '0 × 0 px';
    fileInput.value = '';

    updateHistoryButtons();
    renderLayersPanel();
    showToast('Removed image.');
  }

  // --- Image Loading (Upload Button, Drag-and-Drop, Paste, Demo Scene) ---
  function loadFromImageSource(imgElementOrCanvas, filename) {
    const w = imgElementOrCanvas.naturalWidth || imgElementOrCanvas.width;
    const h = imgElementOrCanvas.naturalHeight || imgElementOrCanvas.height;
    if (!w || !h) {
      showToast('Could not read image dimensions.');
      return;
    }

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = w;
    srcCanvas.height = h;
    const sCtx = srcCanvas.getContext('2d');
    sCtx.drawImage(imgElementOrCanvas, 0, 0, w, h);

    state.sourceCanvas = srcCanvas;
    state.naturalWidth = w;
    state.naturalHeight = h;
    state.imageName = (filename || 'blurrise-image').replace(/\.[^/.]+$/, '');
    state.regions = [];
    state.selectedId = null;
    state.undoStack = [];
    state.redoStack = [];
    state.nextId = 1;

    editorCanvas.width = w;
    editorCanvas.height = h;
    effectBufferCanvas.width = w;
    effectBufferCanvas.height = h;
    maskBufferCanvas.width = w;
    maskBufferCanvas.height = h;

    emptyDropZone.classList.add('hidden');
    canvasViewport.classList.remove('hidden');
    imageDimensionsLabel.textContent = `${w} × ${h} px`;

    fitCanvasToViewport();
    if (state.pointerPos) {
      updateCanvasCursor(state.pointerPos);
    }
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
  }

  function handleFileObject(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, WebP, GIF, BMP, SVG).');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      loadFromImageSource(img, file.name);
      showToast(`Loaded "${file.name}" (${img.naturalWidth}×${img.naturalHeight})`);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      showToast('Failed to decode image file.');
    };
    img.src = objectUrl;
  }

  // Generate 100% Local Offline Sample Scene for Instant Testing
  function loadDemoScene() {
    const w = 1200;
    const h = 760;
    const demo = document.createElement('canvas');
    demo.width = w;
    demo.height = h;
    const d = demo.getContext('2d');

    // 1. Warm Dusk / Sunrise Sky Backdrop
    const sky = d.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#131836');
    sky.addColorStop(0.45, '#3b2454');
    sky.addColorStop(0.78, '#c95950');
    sky.addColorStop(1, '#f4a259');
    d.fillStyle = sky;
    d.fillRect(0, 0, w, h);

    // Glowing Sun
    const sunGrad = d.createRadialGradient(880, 260, 20, 880, 260, 180);
    sunGrad.addColorStop(0, '#fff3b0');
    sunGrad.addColorStop(0.4, '#ff9f1c');
    sunGrad.addColorStop(1, 'rgba(255, 94, 91, 0)');
    d.fillStyle = sunGrad;
    d.beginPath();
    d.arc(880, 260, 180, 0, Math.PI * 2);
    d.fill();

    // City Silhouette Buildings
    const buildings = [
      [40, 280, 130, 480],
      [160, 220, 150, 540],
      [300, 310, 120, 450],
      [410, 190, 170, 570],
      [570, 270, 140, 490],
      [700, 330, 130, 430],
      [960, 230, 180, 530]
    ];
    d.fillStyle = '#0d1322';
    buildings.forEach(([bx, by, bw, bh]) => {
      d.fillRect(bx, by, bw, bh);
      // Warm city windows
      d.fillStyle = 'rgba(255, 209, 102, 0.45)';
      for (let wy = by + 24; wy < h - 180; wy += 34) {
        for (let wx = bx + 18; wx < bx + bw - 22; wx += 28) {
          if (((wx * wy) % 7) > 2) {
            d.fillRect(wx, wy, 12, 18);
          }
        }
      }
      d.fillStyle = '#0d1322';
    });

    // Desk / Street Foreground Surface
    d.fillStyle = '#161f33';
    d.fillRect(0, 540, w, 220);

    // 2. Press / Employee Credential Card (Left - Great for blurring face, name, ID number)
    d.save();
    d.shadowColor = 'rgba(0,0,0,0.45)';
    d.shadowBlur = 28;
    d.shadowOffsetY = 12;
    roundRectPath(d, 70, 110, 500, 320, 20);
    d.fillStyle = '#f8fafc';
    d.fill();
    d.restore();

    // Card Top Header Strip
    d.save();
    roundRectPath(d, 70, 110, 500, 68, { tl: 20, tr: 20, br: 0, bl: 0 });
    const headerGrad = d.createLinearGradient(70, 110, 570, 178);
    headerGrad.addColorStop(0, '#ff5e5b');
    headerGrad.addColorStop(1, '#ff9f1c');
    d.fillStyle = headerGrad;
    d.fill();
    d.fillStyle = '#ffffff';
    d.font = 'bold 20px sans-serif';
    d.fillText('BLURRISE LABS — SECURITY CREDENTIAL', 96, 152);
    d.restore();

    // Avatar Portrait inside ID Card
    d.fillStyle = '#cbd5e1';
    roundRectPath(d, 96, 202, 130, 156, 12);
    d.fill();
    // Stylized Face inside Portrait
    d.fillStyle = '#334155';
    d.beginPath();
    d.arc(161, 255, 32, 0, Math.PI * 2);
    d.fill();
    d.beginPath();
    d.arc(161, 342, 52, Math.PI, 0);
    d.fill();

    // Sensitive Personal Details Text on Card
    d.fillStyle = '#0f172a';
    d.font = 'bold 22px sans-serif';
    d.fillText('ALEXANDER V. MERCER', 250, 228);
    d.fillStyle = '#475569';
    d.font = '600 15px sans-serif';
    d.fillText('Principal Optical Engineer', 250, 254);

    d.fillStyle = '#0f172a';
    d.font = 'bold 16px monospace';
    d.fillText('ID NO:  948-204-7719', 250, 294);
    d.fillText('ACCESS: LEVEL-4 CLEARANCE', 250, 320);
    d.fillText('EMAIL:  a.mercer@blurrise.local', 250, 346);

    // Barcode strip at bottom of ID Card
    d.fillStyle = '#0f172a';
    for (let bx = 98; bx < 540; bx += 6) {
      const bw = ((bx * 13) % 4) + 1.5;
      d.fillRect(bx, 378, bw, 32);
    }

    // 3. Vehicle License Plate Mockup (Bottom Right - Classic blur target)
    d.save();
    d.shadowColor = 'rgba(0,0,0,0.5)';
    d.shadowBlur = 24;
    roundRectPath(d, 650, 430, 460, 220, 18);
    d.fillStyle = '#fef08a';
    d.fill();
    d.lineWidth = 6;
    d.strokeStyle = '#1e293b';
    d.stroke();
    d.restore();

    d.fillStyle = '#dc2626';
    d.font = 'bold 20px sans-serif';
    d.textAlign = 'center';
    d.fillText('SUNRISE STATE • PRIVACY DEMO', 880, 472);

    d.fillStyle = '#0f172a';
    d.font = 'bold 74px monospace';
    d.fillText('BLR-2026', 880, 560);

    d.fillStyle = '#334155';
    d.font = 'bold 16px sans-serif';
    d.fillText('EXP 10/2028 • REGISTERED VEHICLE', 880, 616);
    d.textAlign = 'left';

    // 4. Credit Card Mockup (Top Right)
    d.save();
    d.shadowColor = 'rgba(0,0,0,0.45)';
    d.shadowBlur = 24;
    roundRectPath(d, 650, 130, 460, 250, 20);
    const cardGrad = d.createLinearGradient(650, 130, 1110, 380);
    cardGrad.addColorStop(0, '#1e293b');
    cardGrad.addColorStop(1, '#0f172a');
    d.fillStyle = cardGrad;
    d.fill();
    d.lineWidth = 1.5;
    d.strokeStyle = 'rgba(255,255,255,0.22)';
    d.stroke();
    d.restore();

    // Gold Chip
    d.fillStyle = '#fbbf24';
    roundRectPath(d, 688, 195, 58, 44, 8);
    d.fill();

    d.fillStyle = '#f8fafc';
    d.font = 'bold 27px monospace';
    d.fillText('4532  8910  7421  9088', 688, 286);

    d.fillStyle = '#94a3b8';
    d.font = '14px monospace';
    d.fillText('VALID THRU 09/29      CVV 842', 688, 322);
    d.fillStyle = '#f8fafc';
    d.font = 'bold 16px sans-serif';
    d.fillText('ALEXANDER V MERCER', 688, 354);

    loadFromImageSource(demo, 'blurrise-demo-scene.png');

    // Add one starter blur region over the license plate so the user immediately sees how regions work
    const starterRegion = {
      id: state.nextId++,
      type: 'rect',
      effect: 'gaussian',
      intensity: 45,
      cornerRadius: 12,
      redactColor: '#0B0F19',
      visible: true,
      x: 685,
      y: 492,
      w: 390,
      h: 92
    };
    state.regions.push(starterRegion);
    state.selectedId = starterRegion.id;
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
    showToast('Demo scene loaded! Drag the blur box over any text or draw a new one.');
  }

  // --- Viewport Zoom & Fit ---
  function fitCanvasToViewport() {
    if (!state.sourceCanvas) return;
    const vw = Math.max(240, canvasViewport.clientWidth - 72);
    const vh = Math.max(200, canvasViewport.clientHeight - 108);
    const scaleX = vw / state.naturalWidth;
    const scaleY = vh / state.naturalHeight;
    state.zoom = Math.min(1, scaleX, scaleY);
    applyZoomToCanvasElement();
    canvasViewport.scrollLeft = 0;
    canvasViewport.scrollTop = 0;
    renderCanvas();
  }

  function setZoom(newZoom, focalClientX, focalClientY) {
    if (!state.sourceCanvas) return;
    const clampedZoom = Math.max(0.15, Math.min(4.0, newZoom));
    if (Math.abs(clampedZoom - state.zoom) < 0.001) return;

    const vpRect = canvasViewport.getBoundingClientRect();
    const canvasRectBefore = editorCanvas.getBoundingClientRect();

    const anchorX =
      typeof focalClientX === 'number'
        ? focalClientX
        : vpRect.left + vpRect.width / 2;
    const anchorY =
      typeof focalClientY === 'number'
        ? focalClientY
        : vpRect.top + vpRect.height / 2;

    let ratioX = 0.5;
    let ratioY = 0.5;
    if (canvasRectBefore.width > 0 && canvasRectBefore.height > 0) {
      ratioX = Math.max(
        0,
        Math.min(1, (anchorX - canvasRectBefore.left) / canvasRectBefore.width)
      );
      ratioY = Math.max(
        0,
        Math.min(1, (anchorY - canvasRectBefore.top) / canvasRectBefore.height)
      );
    }

    state.zoom = clampedZoom;
    applyZoomToCanvasElement();

    const canvasRectAfter = editorCanvas.getBoundingClientRect();
    const targetClientX = canvasRectAfter.left + ratioX * canvasRectAfter.width;
    const targetClientY = canvasRectAfter.top + ratioY * canvasRectAfter.height;
    canvasViewport.scrollLeft += Math.round(targetClientX - anchorX);
    canvasViewport.scrollTop += Math.round(targetClientY - anchorY);

    renderCanvas();
  }

  function applyZoomToCanvasElement() {
    const displayW = Math.round(state.naturalWidth * state.zoom);
    const displayH = Math.round(state.naturalHeight * state.zoom);
    editorCanvas.style.width = `${displayW}px`;
    editorCanvas.style.height = `${displayH}px`;
    zoomFitBtn.textContent = `${Math.round(state.zoom * 100)}%`;
  }

  // --- Geometry & Rounded Rect Path Helper ---
  function roundRectPath(context, x, y, w, h, radius) {
    const normX = w < 0 ? x + w : x;
    const normY = h < 0 ? y + h : y;
    const normW = Math.abs(w);
    const normH = Math.abs(h);

    let tl = 0, tr = 0, br = 0, bl = 0;
    if (typeof radius === 'number') {
      const r = Math.min(radius, normW / 2, normH / 2);
      tl = tr = br = bl = r;
    } else if (radius && typeof radius === 'object') {
      tl = Math.min(radius.tl || 0, normW / 2, normH / 2);
      tr = Math.min(radius.tr || 0, normW / 2, normH / 2);
      br = Math.min(radius.br || 0, normW / 2, normH / 2);
      bl = Math.min(radius.bl || 0, normW / 2, normH / 2);
    }

    context.beginPath();
    context.moveTo(normX + tl, normY);
    context.lineTo(normX + normW - tr, normY);
    context.quadraticCurveTo(normX + normW, normY, normX + normW, normY + tr);
    context.lineTo(normX + normW, normY + normH - br);
    context.quadraticCurveTo(normX + normW, normY + normH, normX + normW - br, normY + normH);
    context.lineTo(normX + bl, normY + normH);
    context.quadraticCurveTo(normX, normY + normH, normX, normY + normH - bl);
    context.lineTo(normX, normY + tl);
    context.quadraticCurveTo(normX, normY, normX + tl, normY);
    context.closePath();
  }

  function getNormalizedBox(region) {
    const x = region.w < 0 ? region.x + region.w : region.x;
    const y = region.h < 0 ? region.y + region.h : region.y;
    const w = Math.abs(region.w);
    const h = Math.abs(region.h);
    return { x, y, w, h };
  }

  function getRegionBoundingBox(region) {
    if (region.type === 'rect' || region.type === 'ellipse') {
      return getNormalizedBox(region);
    }
    if (region.type === 'brush' && region.points && region.points.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const pad = (region.brushSize || 32) / 2 + 4;
      for (const pt of region.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      }
      return {
        x: minX - pad,
        y: minY - pad,
        w: Math.max(8, maxX - minX + pad * 2),
        h: Math.max(8, maxY - minY + pad * 2)
      };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }

  // --- Multi-Effect Region Renderer (Gaussian Blur, Pixelate, Solid Redact) ---
  function renderSingleRegion(targetCtx, region) {
    if (!region.visible || !state.sourceCanvas) return;

    const bbox = getRegionBoundingBox(region);
    if (bbox.w < 2 || bbox.h < 2) return;

    const imgW = state.naturalWidth;
    const imgH = state.naturalHeight;

    // 1. Prepare Effect Canvas for the bounding region (with margin for Gaussian blur kernel)
    const blurPx = Math.max(2, Math.round((region.intensity / 100) * 42));
    const margin = region.effect === 'gaussian' ? blurPx * 2 + 8 : 4;

    const sx = Math.max(0, Math.floor(bbox.x - margin));
    const sy = Math.max(0, Math.floor(bbox.y - margin));
    const ex = Math.min(imgW, Math.ceil(bbox.x + bbox.w + margin));
    const ey = Math.min(imgH, Math.ceil(bbox.y + bbox.h + margin));
    const sw = ex - sx;
    const sh = ey - sy;
    if (sw <= 0 || sh <= 0) return;

    // Clear sub-rectangle on effect & mask buffers
    effectBufferCtx.save();
    effectBufferCtx.clearRect(sx, sy, sw, sh);

    if (region.effect === 'gaussian') {
      effectBufferCtx.filter = `blur(${blurPx}px)`;
      // Draw slightly clamped edges so borders don't fade to transparent
      effectBufferCtx.drawImage(state.sourceCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
      effectBufferCtx.filter = 'none';
    } else if (region.effect === 'pixelate') {
      // Block size scales with intensity and image resolution
      const baseScale = Math.max(1, Math.min(imgW, imgH) / 900);
      const blockSize = Math.max(4, Math.round((region.intensity / 100) * 44 * baseScale));
      const cols = Math.max(1, Math.ceil(sw / blockSize));
      const rows = Math.max(1, Math.ceil(sh / blockSize));

      pixelateTempCanvas.width = cols;
      pixelateTempCanvas.height = rows;
      pixelateTempCtx.imageSmoothingEnabled = true;
      pixelateTempCtx.clearRect(0, 0, cols, rows);
      pixelateTempCtx.drawImage(state.sourceCanvas, sx, sy, sw, sh, 0, 0, cols, rows);

      effectBufferCtx.imageSmoothingEnabled = false;
      effectBufferCtx.drawImage(pixelateTempCanvas, 0, 0, cols, rows, sx, sy, sw, sh);
      effectBufferCtx.imageSmoothingEnabled = true;
    } else if (region.effect === 'redact') {
      if (region.redactColor === '#FF6B4A') {
        const grad = effectBufferCtx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, '#FF5E5B');
        grad.addColorStop(1, '#FFB347');
        effectBufferCtx.fillStyle = grad;
      } else {
        effectBufferCtx.fillStyle = region.redactColor || '#0B0F19';
      }
      effectBufferCtx.fillRect(sx, sy, sw, sh);
    }
    effectBufferCtx.restore();

    // 2. Build Shape / Brush Mask in maskBufferCanvas
    maskBufferCtx.save();
    maskBufferCtx.clearRect(sx, sy, sw, sh);
    maskBufferCtx.fillStyle = '#ffffff';
    maskBufferCtx.strokeStyle = '#ffffff';

    if (region.type === 'rect') {
      roundRectPath(
        maskBufferCtx,
        bbox.x,
        bbox.y,
        bbox.w,
        bbox.h,
        region.cornerRadius ?? 0
      );
      maskBufferCtx.fill();
    } else if (region.type === 'ellipse') {
      maskBufferCtx.beginPath();
      maskBufferCtx.ellipse(
        bbox.x + bbox.w / 2,
        bbox.y + bbox.h / 2,
        bbox.w / 2,
        bbox.h / 2,
        0,
        0,
        Math.PI * 2
      );
      maskBufferCtx.fill();
    } else if (region.type === 'brush' && region.points && region.points.length > 0) {
      maskBufferCtx.lineCap = 'round';
      maskBufferCtx.lineJoin = 'round';
      maskBufferCtx.lineWidth = region.brushSize || 40;
      maskBufferCtx.beginPath();
      const pts = region.points;
      maskBufferCtx.moveTo(pts[0].x, pts[0].y);
      if (pts.length === 1) {
        maskBufferCtx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
      } else {
        for (let i = 1; i < pts.length; i++) {
          const midX = (pts[i - 1].x + pts[i].x) / 2;
          const midY = (pts[i - 1].y + pts[i].y) / 2;
          maskBufferCtx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, midX, midY);
        }
        maskBufferCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      }
      maskBufferCtx.stroke();
    }
    maskBufferCtx.restore();

    // 3. Clip Effect Buffer by Mask Buffer & Stamp onto Target Context
    effectBufferCtx.save();
    effectBufferCtx.globalCompositeOperation = 'destination-in';
    effectBufferCtx.drawImage(maskBufferCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
    effectBufferCtx.restore();

    targetCtx.drawImage(effectBufferCanvas, sx, sy, sw, sh, sx, sy, sw, sh);
  }

  // --- Main Viewport Render Loop ---
  function renderCanvas(includeUI = true) {
    if (!state.sourceCanvas) return;

    ctx.clearRect(0, 0, state.naturalWidth, state.naturalHeight);
    ctx.drawImage(state.sourceCanvas, 0, 0);

    // If holding "Compare Original", skip rendering blur regions
    if (!state.isComparingOriginal) {
      for (const region of state.regions) {
        renderSingleRegion(ctx, region);
      }
      if (state.interaction && state.interaction.currentRegion) {
        renderSingleRegion(ctx, state.interaction.currentRegion);
      }
    }

    if (!includeUI || state.isComparingOriginal) return;

    // Draw selection box & resize handles for selected region
    const selected = state.regions.find((r) => r.id === state.selectedId);
    if (selected && selected.visible) {
      drawSelectionOverlay(ctx, selected);
    }

    // Draw live outline while dragging a new shape
    if (
      state.interaction &&
      state.interaction.mode === 'draw-shape' &&
      state.interaction.currentRegion
    ) {
      drawSelectionOverlay(ctx, state.interaction.currentRegion, true);
    }

    // Draw live circular brush cursor when Brush tool is active
    if (state.tool === 'brush' && state.pointerPos) {
      const r = state.brushSize / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(state.pointerPos.x, state.pointerPos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(1.5, 2 / state.zoom);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(state.pointerPos.x, state.pointerPos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.setLineDash([4 / state.zoom, 4 / state.zoom]);
      ctx.lineWidth = Math.max(1, 1.5 / state.zoom);
      ctx.stroke();
      ctx.restore();
    }
  }

  function getHandlePositions(bbox) {
    const { x, y, w, h } = bbox;
    const cx = x + w / 2;
    const cy = y + h / 2;
    return [
      { name: 'nw', x: x, y: y },
      { name: 'n', x: cx, y: y },
      { name: 'ne', x: x + w, y: y },
      { name: 'e', x: x + w, y: cy },
      { name: 'se', x: x + w, y: y + h },
      { name: 's', x: cx, y: y + h },
      { name: 'sw', x: x, y: y + h },
      { name: 'w', x: x, y: cy }
    ];
  }

  function drawSelectionOverlay(targetCtx, region, isPreview = false) {
    const bbox = getRegionBoundingBox(region);
    const invZoom = 1 / state.zoom;

    targetCtx.save();
    targetCtx.strokeStyle = isPreview ? '#ffd166' : '#ff8c42';
    targetCtx.lineWidth = 2 * invZoom;
    targetCtx.setLineDash([6 * invZoom, 4 * invZoom]);

    if (region.type === 'ellipse') {
      targetCtx.beginPath();
      targetCtx.ellipse(
        bbox.x + bbox.w / 2,
        bbox.y + bbox.h / 2,
        bbox.w / 2,
        bbox.h / 2,
        0,
        0,
        Math.PI * 2
      );
      targetCtx.stroke();
    } else {
      targetCtx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
    }

    targetCtx.setLineDash([]);

    // Draw 8 resize handles for rect/ellipse
    if (!isPreview && (region.type === 'rect' || region.type === 'ellipse')) {
      const handleSize = 9 * invZoom;
      const handles = getHandlePositions(bbox);
      for (const h of handles) {
        targetCtx.fillStyle = '#0b0f19';
        targetCtx.strokeStyle = '#ffd166';
        targetCtx.lineWidth = 2 * invZoom;
        targetCtx.beginPath();
        targetCtx.rect(
          h.x - handleSize / 2,
          h.y - handleSize / 2,
          handleSize,
          handleSize
        );
        targetCtx.fill();
        targetCtx.stroke();
      }
    }
    targetCtx.restore();
  }

  // --- Hit Testing for Selection & Resize Handles ---
  function getCanvasCoordinates(evt) {
    const rect = editorCanvas.getBoundingClientRect();
    const scaleX = state.naturalWidth / rect.width;
    const scaleY = state.naturalHeight / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  function hitTestResizeHandles(region, pt) {
    if (!region || (region.type !== 'rect' && region.type !== 'ellipse')) return null;
    const bbox = getRegionBoundingBox(region);
    const threshold = 11 / state.zoom;
    const handles = getHandlePositions(bbox);
    for (const h of handles) {
      if (Math.abs(pt.x - h.x) <= threshold && Math.abs(pt.y - h.y) <= threshold) {
        return h.name;
      }
    }
    return null;
  }

  function isPointInRegion(region, pt) {
    if (!region.visible) return false;
    const bbox = getRegionBoundingBox(region);
    if (region.type === 'rect') {
      return (
        pt.x >= bbox.x &&
        pt.x <= bbox.x + bbox.w &&
        pt.y >= bbox.y &&
        pt.y <= bbox.y + bbox.h
      );
    }
    if (region.type === 'ellipse') {
      const rx = bbox.w / 2;
      const ry = bbox.h / 2;
      if (rx <= 0 || ry <= 0) return false;
      const cx = bbox.x + rx;
      const cy = bbox.y + ry;
      const norm =
        Math.pow(pt.x - cx, 2) / Math.pow(rx, 2) +
        Math.pow(pt.y - cy, 2) / Math.pow(ry, 2);
      return norm <= 1.05;
    }
    if (region.type === 'brush' && region.points) {
      const radius = (region.brushSize || 40) / 2 + 4;
      for (const p of region.points) {
        const dx = pt.x - p.x;
        const dy = pt.y - p.y;
        if (dx * dx + dy * dy <= radius * radius) return true;
      }
    }
    return false;
  }

  function findTopmostRegionAtPoint(pt) {
    for (let i = state.regions.length - 1; i >= 0; i--) {
      if (isPointInRegion(state.regions[i], pt)) {
        return state.regions[i];
      }
    }
    return null;
  }

  // --- Sync Sidebar Controls When Selecting a Region ---
  function selectRegion(regionId) {
    state.selectedId = regionId;
    const region = state.regions.find((r) => r.id === regionId);
    if (region) {
      setActiveEffectUI(region.effect, false);
      state.intensity = region.intensity;
      intensitySlider.value = region.intensity;
      intensityValue.textContent = region.intensity;

      if (typeof region.cornerRadius === 'number') {
        state.cornerRadius = region.cornerRadius;
        cornerRadiusSlider.value = region.cornerRadius;
        cornerRadiusValue.textContent = region.cornerRadius;
      }
      if (region.brushSize) {
        state.brushSize = region.brushSize;
        brushSizeSlider.value = region.brushSize;
        brushSizeValue.textContent = region.brushSize;
      }
    }
    renderLayersPanel();
    renderCanvas();
  }

  // --- Pointer Events on Editor Canvas ---
  editorCanvas.addEventListener('pointerdown', (evt) => {
    if (!state.sourceCanvas) return;

    // Middle mouse button (button 1) pans the viewport when zoomed
    if (evt.button === 1) {
      evt.preventDefault();
      editorCanvas.setPointerCapture(evt.pointerId);
      state.interaction = {
        mode: 'pan',
        startClientX: evt.clientX,
        startClientY: evt.clientY,
        startScrollLeft: canvasViewport.scrollLeft,
        startScrollTop: canvasViewport.scrollTop
      };
      editorCanvas.style.cursor = 'grabbing';
      return;
    }

    if (evt.button !== 0) return;
    editorCanvas.setPointerCapture(evt.pointerId);
    const pt = getCanvasCoordinates(evt);
    state.pointerPos = pt;

    // 1. Check if clicking a resize handle of the currently selected shape
    const currentSelected = state.regions.find((r) => r.id === state.selectedId);
    if (currentSelected && state.tool !== 'brush') {
      const handle = hitTestResizeHandles(currentSelected, pt);
      if (handle) {
        pushUndoSnapshot();
        const norm = getNormalizedBox(currentSelected);
        currentSelected.x = norm.x;
        currentSelected.y = norm.y;
        currentSelected.w = norm.w;
        currentSelected.h = norm.h;
        state.interaction = {
          mode: 'resize',
          handle,
          startX: pt.x,
          startY: pt.y,
          origBox: { ...norm },
          targetRegion: currentSelected
        };
        return;
      }
    }

    // 2. If using Select tool, or clicking inside an existing selected shape, move it
    if (state.tool === 'select') {
      const hit = findTopmostRegionAtPoint(pt);
      if (hit) {
        selectRegion(hit.id);
        pushUndoSnapshot();
        state.interaction = {
          mode: 'move',
          startX: pt.x,
          startY: pt.y,
          targetRegion: hit,
          origX: hit.x,
          origY: hit.y,
          origPoints: hit.points ? hit.points.map((p) => ({ x: p.x, y: p.y })) : null
        };
      } else {
        selectRegion(null);
        // Allow panning the viewport when dragging empty canvas space in Move/Edit mode
        state.interaction = {
          mode: 'pan',
          startClientX: evt.clientX,
          startClientY: evt.clientY,
          startScrollLeft: canvasViewport.scrollLeft,
          startScrollTop: canvasViewport.scrollTop
        };
        editorCanvas.style.cursor = 'grabbing';
      }
      return;
    }

    // Also allow moving an already-selected shape when clicking inside it in rect/ellipse mode
    if (
      (state.tool === 'rect' || state.tool === 'ellipse') &&
      currentSelected &&
      isPointInRegion(currentSelected, pt)
    ) {
      pushUndoSnapshot();
      state.interaction = {
        mode: 'move',
        startX: pt.x,
        startY: pt.y,
        targetRegion: currentSelected,
        origX: currentSelected.x,
        origY: currentSelected.y,
        origPoints: null
      };
      return;
    }

    // 3. Brush Tool: Start painting freehand stroke
    if (state.tool === 'brush') {
      const newBrushRegion = {
        id: state.nextId++,
        type: 'brush',
        effect: state.effect,
        intensity: state.intensity,
        brushSize: state.brushSize,
        redactColor: state.redactColor,
        visible: true,
        points: [{ x: pt.x, y: pt.y }]
      };
      state.interaction = {
        mode: 'draw-brush',
        currentRegion: newBrushRegion
      };
      renderCanvas();
      return;
    }

    // 4. Rectangle or Ellipse Tool: Start dragging a new shape
    if (state.tool === 'rect' || state.tool === 'ellipse') {
      const newShape = {
        id: state.nextId++,
        type: state.tool,
        effect: state.effect,
        intensity: state.intensity,
        cornerRadius: state.cornerRadius,
        redactColor: state.redactColor,
        visible: true,
        x: pt.x,
        y: pt.y,
        w: 1,
        h: 1
      };
      state.interaction = {
        mode: 'draw-shape',
        startX: pt.x,
        startY: pt.y,
        currentRegion: newShape
      };
      renderCanvas();
    }
  });

  editorCanvas.addEventListener('pointermove', (evt) => {
    if (!state.sourceCanvas) return;
    const pt = getCanvasCoordinates(evt);
    state.pointerPos = pt;

    if (!state.interaction) {
      // Update cursor dynamically based on hover
      updateCanvasCursor(pt);
      if (state.tool === 'brush') {
        renderCanvas();
      }
      return;
    }

    const inter = state.interaction;
    if (inter.mode === 'pan') {
      const dx = evt.clientX - inter.startClientX;
      const dy = evt.clientY - inter.startClientY;
      canvasViewport.scrollLeft = inter.startScrollLeft - dx;
      canvasViewport.scrollTop = inter.startScrollTop - dy;
      return;
    }
    if (inter.mode === 'draw-shape') {
      inter.currentRegion.w = pt.x - inter.startX;
      inter.currentRegion.h = pt.y - inter.startY;
      renderCanvas();
    } else if (inter.mode === 'draw-brush') {
      const pts = inter.currentRegion.points;
      const last = pts[pts.length - 1];
      const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
      if (dist >= 2) {
        pts.push({ x: pt.x, y: pt.y });
        renderCanvas();
      }
    } else if (inter.mode === 'move') {
      const dx = pt.x - inter.startX;
      const dy = pt.y - inter.startY;
      const target = inter.targetRegion;
      if (target.type === 'brush' && inter.origPoints) {
        target.points = inter.origPoints.map((p) => ({
          x: p.x + dx,
          y: p.y + dy
        }));
      } else {
        target.x = inter.origX + dx;
        target.y = inter.origY + dy;
      }
      renderCanvas();
    } else if (inter.mode === 'resize') {
      const dx = pt.x - inter.startX;
      const dy = pt.y - inter.startY;
      const b = inter.origBox;
      const target = inter.targetRegion;
      const h = inter.handle;

      let nx = b.x;
      let ny = b.y;
      let nw = b.w;
      let nh = b.h;

      if (h.includes('e')) nw = b.w + dx;
      if (h.includes('s')) nh = b.h + dy;
      if (h.includes('w')) {
        nx = b.x + dx;
        nw = b.w - dx;
      }
      if (h.includes('n')) {
        ny = b.y + dy;
        nh = b.h - dy;
      }

      target.x = nx;
      target.y = ny;
      target.w = nw;
      target.h = nh;
      renderCanvas();
    }
  });

  function finishPointerInteraction() {
    if (!state.interaction) return;
    const inter = state.interaction;
    state.interaction = null;

    if (inter.mode === 'draw-shape' && inter.currentRegion) {
      const norm = getNormalizedBox(inter.currentRegion);
      // Only commit if the user dragged a meaningful box (> 6px)
      if (norm.w >= 6 && norm.h >= 6) {
        pushUndoSnapshot();
        inter.currentRegion.x = norm.x;
        inter.currentRegion.y = norm.y;
        inter.currentRegion.w = norm.w;
        inter.currentRegion.h = norm.h;
        state.regions.push(inter.currentRegion);
        state.selectedId = inter.currentRegion.id;
      } else {
        // Clicking without dragging selects whatever region is underneath
        const hit = findTopmostRegionAtPoint({
          x: inter.startX,
          y: inter.startY
        });
        selectRegion(hit ? hit.id : null);
      }
    } else if (inter.mode === 'draw-brush' && inter.currentRegion) {
      pushUndoSnapshot();
      state.regions.push(inter.currentRegion);
      state.selectedId = inter.currentRegion.id;
    } else if (inter.mode === 'resize' && inter.targetRegion) {
      const norm = getNormalizedBox(inter.targetRegion);
      inter.targetRegion.x = norm.x;
      inter.targetRegion.y = norm.y;
      inter.targetRegion.w = Math.max(8, norm.w);
      inter.targetRegion.h = Math.max(8, norm.h);
    }

    if (state.pointerPos) {
      updateCanvasCursor(state.pointerPos);
    }
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
  }

  editorCanvas.addEventListener('pointerup', finishPointerInteraction);
  editorCanvas.addEventListener('pointercancel', finishPointerInteraction);
  editorCanvas.addEventListener('pointerleave', () => {
    state.pointerPos = null;
    if (!state.interaction) {
      renderCanvas();
    }
  });

  function updateCanvasCursor(pt) {
    if (state.tool === 'brush') {
      editorCanvas.style.cursor = 'none';
      return;
    }
    const selected = state.regions.find((r) => r.id === state.selectedId);
    if (selected) {
      const handle = hitTestResizeHandles(selected, pt);
      if (handle) {
        const cursorMap = {
          nw: 'nwse-resize',
          se: 'nwse-resize',
          ne: 'nesw-resize',
          sw: 'nesw-resize',
          n: 'ns-resize',
          s: 'ns-resize',
          e: 'ew-resize',
          w: 'ew-resize'
        };
        editorCanvas.style.cursor = cursorMap[handle] || 'pointer';
        return;
      }
      if (isPointInRegion(selected, pt)) {
        editorCanvas.style.cursor = 'move';
        return;
      }
    }
    if (state.tool === 'select') {
      const hit = findTopmostRegionAtPoint(pt);
      const isScrollable =
        canvasViewport.scrollWidth > canvasViewport.clientWidth ||
        canvasViewport.scrollHeight > canvasViewport.clientHeight;
      editorCanvas.style.cursor = hit ? 'move' : isScrollable ? 'grab' : 'default';
      return;
    }
    editorCanvas.style.cursor = 'crosshair';
  }

  // --- Right Sidebar: Layers List UI ---
  function renderLayersPanel() {
    layerCountBadge.textContent = String(state.regions.length);

    if (state.regions.length === 0) {
      layersEmptyState.classList.remove('hidden');
      layersList.innerHTML = '';
      selectedLayerActions.classList.add('hidden');
      return;
    }

    layersEmptyState.classList.add('hidden');
    layersList.innerHTML = '';

    // Show newest layers at the top
    const reversed = [...state.regions].reverse();
    reversed.forEach((region, idx) => {
      const number = state.regions.length - idx;
      const li = document.createElement('li');
      li.className = `layer-item${region.id === state.selectedId ? ' selected' : ''}`;

      const typeLabel =
        region.type === 'rect'
          ? 'Rectangle'
          : region.type === 'ellipse'
          ? 'Ellipse'
          : 'Brush Stroke';

      const effectLabel =
        region.effect === 'gaussian'
          ? `Gaussian (${region.intensity}%)`
          : region.effect === 'pixelate'
          ? `Pixelate (${region.intensity}%)`
          : 'Solid Redact';

      const iconChar =
        region.type === 'rect' ? '▭' : region.type === 'ellipse' ? '◯' : '✎';

      li.innerHTML = `
        <div class="layer-item-left">
          <span class="layer-badge">${iconChar}</span>
          <div class="layer-label-group">
            <span class="layer-title">#${number} ${typeLabel}</span>
            <span class="layer-sub">${effectLabel}</span>
          </div>
        </div>
        <div class="layer-actions">
          <button type="button" class="layer-btn toggle-vis" title="${
            region.visible ? 'Hide blur region' : 'Show blur region'
          }">
            ${region.visible ? '👁' : '🚫'}
          </button>
          <button type="button" class="layer-btn delete" title="Delete region">
            ✕
          </button>
        </div>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.closest('.layer-btn')) return;
        selectRegion(region.id);
      });

      li.querySelector('.toggle-vis').addEventListener('click', (e) => {
        e.stopPropagation();
        region.visible = !region.visible;
        renderLayersPanel();
        renderCanvas();
      });

      li.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRegionById(region.id);
      });

      layersList.appendChild(li);
    });

    if (state.selectedId && state.regions.some((r) => r.id === state.selectedId)) {
      selectedLayerActions.classList.remove('hidden');
    } else {
      selectedLayerActions.classList.add('hidden');
    }
  }

  function deleteRegionById(id) {
    const idx = state.regions.findIndex((r) => r.id === id);
    if (idx === -1) return;
    pushUndoSnapshot();
    state.regions.splice(idx, 1);
    if (state.selectedId === id) {
      state.selectedId = null;
    }
    if (state.pointerPos) {
      updateCanvasCursor(state.pointerPos);
    }
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
  }

  // --- Tool & Effect Controls Wiring ---
  function setActiveTool(toolName) {
    state.tool = toolName;
    toolCards.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
    const labels = {
      rect: 'Rectangle',
      ellipse: 'Ellipse',
      brush: 'Freehand Brush',
      select: 'Move / Edit'
    };
    activeToolBadge.textContent = `Tool: ${labels[toolName] || toolName}`;
    renderCanvas();
  }

  function setActiveEffectUI(effectName, applyToSelected = true) {
    state.effect = effectName;
    effectOptions.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.effect === effectName);
    });
    redactColorBlock.classList.toggle('hidden', effectName !== 'redact');

    if (applyToSelected && state.selectedId) {
      const sel = state.regions.find((r) => r.id === state.selectedId);
      if (sel) {
        pushUndoSnapshot();
        sel.effect = effectName;
        renderLayersPanel();
        renderCanvas();
      }
    }
  }

  toolCards.forEach((btn) => {
    btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
  });

  effectOptions.forEach((btn) => {
    btn.addEventListener('click', () => setActiveEffectUI(btn.dataset.effect, true));
  });

  intensitySlider.addEventListener('input', () => {
    const val = Number(intensitySlider.value);
    state.intensity = val;
    intensityValue.textContent = String(val);

    const sel = state.regions.find((r) => r.id === state.selectedId);
    if (sel) {
      sel.intensity = val;
      renderLayersPanel();
      renderCanvas();
    }
  });

  brushSizeSlider.addEventListener('input', () => {
    const val = Number(brushSizeSlider.value);
    state.brushSize = val;
    brushSizeValue.textContent = String(val);

    const sel = state.regions.find((r) => r.id === state.selectedId);
    if (sel && sel.type === 'brush') {
      sel.brushSize = val;
      renderCanvas();
    }
  });

  cornerRadiusSlider.addEventListener('input', () => {
    const val = Number(cornerRadiusSlider.value);
    state.cornerRadius = val;
    cornerRadiusValue.textContent = String(val);

    const sel = state.regions.find((r) => r.id === state.selectedId);
    if (sel && sel.type === 'rect') {
      sel.cornerRadius = val;
      renderCanvas();
    }
  });

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      colorSwatches.forEach((s) => s.classList.remove('active'));
      swatch.classList.add('active');
      state.redactColor = swatch.dataset.color;

      const sel = state.regions.find((r) => r.id === state.selectedId);
      if (sel && sel.effect === 'redact') {
        sel.redactColor = state.redactColor;
        renderCanvas();
      }
    });
  });

  // --- Upload Button, Drag-and-Drop, and Paste Events ---
  uploadTopBtn.addEventListener('click', () => fileInput.click());
  uploadHeroBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFileObject(fileInput.files[0]);
      fileInput.value = '';
    }
  });

  sampleTopBtn.addEventListener('click', loadDemoScene);
  sampleHeroBtn.addEventListener('click', loadDemoScene);

  // Full-Window Drag & Drop
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragDepth++;
    emptyDropZone.classList.add('drag-active');
    if (state.sourceCanvas) {
      globalDropOverlay.classList.remove('hidden');
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      emptyDropZone.classList.remove('drag-active');
      globalDropOverlay.classList.add('hidden');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    emptyDropZone.classList.remove('drag-active');
    globalDropOverlay.classList.add('hidden');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileObject(e.dataTransfer.files[0]);
    }
  });

  // Clipboard Paste Support
  window.addEventListener('paste', (e) => {
    if (!e.clipboardData || !e.clipboardData.items) return;
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          handleFileObject(blob);
          break;
        }
      }
    }
  });

  // --- Topbar Actions (Undo, Redo, Compare, Clear, Export) ---
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  const startCompare = () => {
    if (!state.sourceCanvas) return;
    state.isComparingOriginal = true;
    renderCanvas();
  };
  const stopCompare = () => {
    if (!state.isComparingOriginal) return;
    state.isComparingOriginal = false;
    renderCanvas();
  };

  compareBtn.addEventListener('pointerdown', startCompare);
  compareBtn.addEventListener('pointerup', stopCompare);
  compareBtn.addEventListener('pointerleave', stopCompare);

  clearAllBtn.addEventListener('click', () => {
    if (state.regions.length === 0) return;
    pushUndoSnapshot();
    state.regions = [];
    state.selectedId = null;
    updateHistoryButtons();
    renderLayersPanel();
    renderCanvas();
    showToast('Cleared all blur regions.');
  });

  removeImageBtn.addEventListener('click', removeCurrentImage);

  deleteSelectedBtn.addEventListener('click', () => {
    if (state.selectedId) {
      deleteRegionById(state.selectedId);
    }
  });

  // Full-Resolution Local Export
  exportBtn.addEventListener('click', () => {
    if (!state.sourceCanvas) return;
    const mimeType = exportFormatSelect.value || 'image/png';
    const ext =
      mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';

    // Render clean full-res image without UI handles
    renderCanvas(false);

    editorCanvas.toBlob(
      (blob) => {
        // Restore UI overlay handles
        renderCanvas(true);
        if (!blob) {
          showToast('Export failed.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.imageName}-blurred.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast(`Exported ${a.download} (${state.naturalWidth}×${state.naturalHeight})`);
      },
      mimeType,
      0.92
    );
  });

  // --- Zoom Controls ---
  zoomInBtn.addEventListener('click', () => setZoom(state.zoom * 1.2));
  zoomOutBtn.addEventListener('click', () => setZoom(state.zoom / 1.2));
  zoomFitBtn.addEventListener('click', fitCanvasToViewport);

  canvasViewport.addEventListener(
    'wheel',
    (e) => {
      if (!state.sourceCanvas) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        setZoom(state.zoom * factor, e.clientX, e.clientY);
        return;
      }
      if (e.shiftKey && e.deltaY !== 0 && e.deltaX === 0) {
        e.preventDefault();
        canvasViewport.scrollLeft += e.deltaY;
      }
    },
    { passive: false }
  );

  window.addEventListener('resize', () => {
    if (state.sourceCanvas) fitCanvasToViewport();
  });

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    if (state.sourceCanvas && !e.ctrlKey && !e.metaKey) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(state.zoom * 1.2);
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom(state.zoom / 1.2);
        return;
      }
      if (e.key === '0') {
        e.preventDefault();
        fitCanvasToViewport();
        return;
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.selectedId) {
        e.preventDefault();
        deleteRegionById(state.selectedId);
      }
      return;
    }

    // Move selected blur region with Keyboard Arrow keys
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      const sel = state.regions.find((r) => r.id === state.selectedId);
      if (sel && state.sourceCanvas) {
        e.preventDefault();
        if (!e.repeat) {
          pushUndoSnapshot();
        }
        const step = e.shiftKey ? 20 : e.altKey ? 1 : 4;
        let dx = 0;
        let dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;

        if (sel.type === 'brush' && sel.points) {
          sel.points = sel.points.map((p) => ({
            x: p.x + dx,
            y: p.y + dy
          }));
        } else {
          sel.x += dx;
          sel.y += dy;
        }
        renderCanvas();
      }
      return;
    }

    if (e.code === 'Space' && !e.repeat && state.sourceCanvas) {
      e.preventDefault();
      startCompare();
      return;
    }

    const k = e.key.toLowerCase();
    if (k === 'r') setActiveTool('rect');
    else if (k === 'e') setActiveTool('ellipse');
    else if (k === 'b') setActiveTool('brush');
    else if (k === 'v') setActiveTool('select');
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      stopCompare();
    }
  });
})();
