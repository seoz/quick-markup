// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const btnBrowse = document.getElementById('btn-browse');
const appContainer = document.getElementById('app-container');
const canvasWrapper = document.getElementById('canvas-wrapper');

// Tools & Properties
const toolBtns = document.querySelectorAll('.tool-btn');
const colorPicker = document.getElementById('color-picker');
const swatches = document.querySelectorAll('.swatch');
const thicknessSlider = document.getElementById('thickness-slider');
const fontPropGroup = document.getElementById('font-prop-group');
const fontSelect = document.getElementById('font-select');
const btnBold = document.getElementById('btn-bold');

// Actions
const btnUndo = document.getElementById('btn-undo');
const btnDelete = document.getElementById('btn-delete');
const btnExpand = document.getElementById('btn-expand');
const btnReset = document.getElementById('btn-reset');
const btnCopy = document.getElementById('btn-copy');
const btnDownload = document.getElementById('btn-download');

// Modal Elements
const confirmModal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
let pendingConfirmAction = null;

function showConfirmDialog(title, desc, onConfirm) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  pendingConfirmAction = onConfirm;
  confirmModal.classList.remove('hidden');
}

modalCancel.addEventListener('click', () => {
  confirmModal.classList.add('hidden');
  pendingConfirmAction = null;
});

modalConfirm.addEventListener('click', () => {
  if (pendingConfirmAction) pendingConfirmAction();
  confirmModal.classList.add('hidden');
  pendingConfirmAction = null;
});

// State
let canvas = null;
let currentTool = 'select'; // select, draw, arrow, rect, circle, text
let currentColor = '#ff0000';
let currentThickness = 10;
let currentFont = 'Inter';
let isBold = false;
let originalImage = null; // Store reference to image for resets/padding
let currentScale = 1;
let canvasPadding = 0; // Internal padding applied
let isDrawing = false;
let startX, startY;
let activeShape = null;

// Undo State
let undoStack = [];
let isUndoing = false;

function saveHistory() {
  if (isUndoing || !canvas || !originalImage) return;
  
  if (undoStack.length >= 50) {
    undoStack.shift();
  }
  
  const state = {
    padding: canvasPadding,
    objects: canvas.getObjects().map(o => o.toObject(['selectable', 'evented', 'customType', 'effectIntensity', 'src']))
  };
  
  if (undoStack.length > 0) {
     const lastState = undoStack[undoStack.length - 1];
     if (JSON.stringify(lastState.objects) === JSON.stringify(state.objects) && lastState.padding === state.padding) return;
  }
  
  undoStack.push(state);
}

function undo() {
  if (undoStack.length > 1) {
    isUndoing = true;
    undoStack.pop(); 
    const state = undoStack[undoStack.length - 1];
    
    canvasPadding = state.padding;
    fabric.util.enlivenObjects(state.objects, (objs) => {
      canvas.remove(...canvas.getObjects());
      objs.forEach(o => {
        canvas.add(o);
      });
      setupCanvasForImage(false);
      canvas.renderAll();
      isUndoing = false;
    });
  }
}

// Initialize Fabric
function initFabric() {
  canvas = new fabric.Canvas('markup-canvas', {
    selection: true,
    preserveObjectStacking: true
  });

  // Handle keydown for delete/copy/paste inside canvas
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.isEditing) return;
      deleteSelected();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  });

  canvas.on('mouse:down', onMouseDown);
  canvas.on('mouse:move', onMouseMove);
  canvas.on('mouse:up', onMouseUp);
  canvas.on('selection:created', onSelection);
  canvas.on('selection:updated', onSelection);
  canvas.on('selection:cleared', () => { 
    fontPropGroup.style.display = currentTool === 'text' ? 'block' : 'none'; 
    updateThicknessSliderLabel();
    canvas.getObjects().forEach(o => {
      if (o.customType === 'blur' || o.customType === 'mosaic') {
        updateBlurMosaicObject(o);
      }
    });
    canvas.renderAll();
  });
  
  canvas.on('path:created', () => saveHistory());
  canvas.on('object:modified', (e) => {
    const obj = e.target;
    if (obj && (obj.customType === 'blur' || obj.customType === 'mosaic')) {
      updateBlurMosaicObject(obj);
      canvas.renderAll();
    }
    saveHistory();
  });
  canvas.on('text:changed', () => saveHistory());
}

// Image Loading
function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    loadImageFromUrl(e.target.result);
  };
  reader.readAsDataURL(file);
}

function loadImageFromUrl(url) {
  fabric.Image.fromURL(url, (img) => {
    if (!canvas) initFabric();
    originalImage = img;
    canvasPadding = 0;
    
    // Switch UI
    dropZone.classList.add('hidden');
    appContainer.classList.remove('hidden');
    
    setupCanvasForImage(true);
  });
}

function setupCanvasForImage(isNewImage = false) {
  if (!originalImage) return;

  const wrapperRect = canvasWrapper.getBoundingClientRect();
  const maxWidth = wrapperRect.width - 80; // 40px padding on sides
  const maxHeight = wrapperRect.height - 80;

  const totalWidth = originalImage.width + (canvasPadding * 2);
  const totalHeight = originalImage.height + (canvasPadding * 2);

  const scaleX = maxWidth / totalWidth;
  const scaleY = maxHeight / totalHeight;
  currentScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 1 if image is small

  // Set visual dimensions relative to window
  canvas.setDimensions({
    width: totalWidth * currentScale,
    height: totalHeight * currentScale
  });
  
  // Set internal zoom
  canvas.setZoom(currentScale);

  // Set background
  originalImage.set({
    left: canvasPadding,
    top: canvasPadding,
    originX: 'left',
    originY: 'top'
  });

  // If we already have a background set, wait. We should set it as the background image.
  // Actually, setting background image with padding in Fabric:
  canvas.setBackgroundImage(originalImage, () => {
    canvas.renderAll();
    if (isNewImage) {
      undoStack = [];
      saveHistory(); // initial state loaded
    }
  }, {
    originX: 'left',
    originY: 'top',
    left: canvasPadding,
    top: canvasPadding
  });
  
  // Also extend the actual logic to not clip if padding exists. Since canvas is resized, it's fine.
  canvas.renderAll();
  setTool(currentTool);
}

// Event Listeners for Upload
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleImageFile(e.dataTransfer.files[0]);
  }
});
btnBrowse.addEventListener('click', () => {
  fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleImageFile(e.target.files[0]);
  }
});

// Paste
window.addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let index in items) {
    const item = items[index];
    if (item.kind === 'file') {
      const blob = item.getAsFile();
      handleImageFile(blob);
      break;
    }
  }
});

// Window Resize
window.addEventListener('resize', () => {
  if (canvas && originalImage) {
    setupCanvasForImage(false);
  }
});

// Tools Logic
toolBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setTool(btn.getAttribute('data-tool'));
  });
});

function updateThicknessSliderLabel() {
  const thicknessLabel = document.getElementById('thickness-label');
  if (!thicknessLabel) return;
  
  const activeObj = canvas?.getActiveObject();
  if (activeObj && activeObj.customType === 'blur') {
    thicknessLabel.innerHTML = `Blur Intensity: <span id="thickness-val">${activeObj.effectIntensity}</span>px`;
    thicknessSlider.value = activeObj.effectIntensity;
    thicknessSlider.min = 1;
    thicknessSlider.max = 50;
  } else if (activeObj && activeObj.customType === 'mosaic') {
    thicknessLabel.innerHTML = `Block Size: <span id="thickness-val">${activeObj.effectIntensity}</span>px`;
    thicknessSlider.value = activeObj.effectIntensity;
    thicknessSlider.min = 2;
    thicknessSlider.max = 50;
  } else {
    // Base it on currentTool
    if (currentTool === 'blur') {
      thicknessLabel.innerHTML = `Blur Intensity: <span id="thickness-val">${currentThickness}</span>px`;
      thicknessSlider.min = 1;
      thicknessSlider.max = 50;
    } else if (currentTool === 'mosaic') {
      thicknessLabel.innerHTML = `Block Size: <span id="thickness-val">${currentThickness}</span>px`;
      thicknessSlider.min = 2;
      thicknessSlider.max = 50;
    } else {
      thicknessLabel.innerHTML = `Thickness: <span id="thickness-val">${currentThickness}</span>px`;
      thicknessSlider.min = 1;
      thicknessSlider.max = 50;
    }
    thicknessSlider.value = currentThickness;
  }
}

function setTool(tool) {
  currentTool = tool;
  toolBtns.forEach(b => b.classList.remove('active'));
  document.querySelector(`.tool-btn[data-tool="${tool}"]`).classList.add('active');

  fontPropGroup.style.display = (tool === 'text') ? 'block' : 'none';

  updateThicknessSliderLabel();

  if (!canvas) return;

  canvas.isDrawingMode = (tool === 'draw');
  if (canvas.isDrawingMode) {
    canvas.freeDrawingBrush.color = currentColor;
    canvas.freeDrawingBrush.width = currentThickness;
  }

  // If select, enable selection, else disable so we can click-drag to draw
  canvas.selection = (tool === 'select');
  canvas.getObjects().forEach(o => {
    o.selectable = (tool === 'select' || tool === 'text');
    o.evented = (tool === 'select' || tool === 'text');
  });
  
  if (tool !== 'select') {
    canvas.discardActiveObject();
  }
  canvas.renderAll();
  canvas.defaultCursor = tool === 'select' ? 'default' : 'crosshair';
}

// Properties Logic
colorPicker.addEventListener('input', (e) => setColor(e.target.value));
swatches.forEach(swatch => {
  swatch.addEventListener('click', () => setColor(swatch.getAttribute('data-color')));
});

function setColor(color) {
  currentColor = color;
  colorPicker.value = color;
  if (canvas && canvas.isDrawingMode) {
    canvas.freeDrawingBrush.color = color;
  }
  const activeObj = canvas?.getActiveObject();
  if (activeObj) {
    if (activeObj.type === 'path' || activeObj.type === 'line' || activeObj.type === 'polyline') {
      activeObj.set({ stroke: color });
      if (activeObj.type === 'path' && activeObj.fill) {
        // arrow head
        activeObj.set({ fill: color });
      }
    } else if (activeObj.type === 'i-text') {
      activeObj.set({ fill: color });
    } else if (activeObj.type === 'group') { 
      // Arrow group
      activeObj._objects.forEach(o => {
        if (o.type === 'line') o.set({stroke: color});
        if (o.type === 'triangle') o.set({fill: color});
      });
      activeObj.set({dirty:true});
    } else {
      activeObj.set({ stroke: color });
    }
    canvas.renderAll();
    saveHistory();
  }
}

thicknessSlider.addEventListener('input', (e) => {
  const val = parseInt(e.target.value, 10);
  currentThickness = val;
  const valEl = document.getElementById('thickness-val');
  if (valEl) {
    valEl.textContent = val;
  }
  if (canvas && canvas.isDrawingMode) {
    canvas.freeDrawingBrush.width = val;
  }
  const activeObj = canvas?.getActiveObject();
  if (activeObj) {
     if (activeObj.customType === 'blur' || activeObj.customType === 'mosaic') {
       activeObj.effectIntensity = val;
       updateBlurMosaicObject(activeObj);
       canvas.renderAll();
       saveHistory();
       return;
     }
     if (activeObj.type === 'i-text') return; // Do not apply thickness to text
     if (activeObj.type === 'group') {
       activeObj._objects.forEach(o => {
          if (o.type === 'line') o.set({strokeWidth: val});
          // Triangle head might need proportional scaling, but let's keep it simple
       });
       activeObj.set({dirty:true});
     } else {
       activeObj.set({ strokeWidth: val });
     }
     canvas.renderAll();
     saveHistory();
  }
});

fontSelect.addEventListener('change', (e) => {
  currentFont = e.target.value;
  fontSelect.style.fontFamily = currentFont;
  const activeObj = canvas?.getActiveObject();
  if (activeObj && activeObj.type === 'i-text') {
    activeObj.set({ fontFamily: currentFont });
    canvas.renderAll();
    saveHistory();
  }
});

btnBold.addEventListener('click', () => {
  isBold = !isBold;
  btnBold.style.background = isBold ? 'var(--active-bg)' : '';
  btnBold.style.color = isBold ? 'var(--primary)' : '';
  
  const activeObj = canvas?.getActiveObject();
  if (activeObj && activeObj.type === 'i-text') {
    activeObj.set({ fontWeight: isBold ? 'bold' : 'normal' });
    canvas.renderAll();
    saveHistory();
  }
});

// Helper for generating Blur or Mosaic elements
function generateBlurredOrPixelatedElement(sx, sy, sw, sh, type, intensity) {
  if (!originalImage) return document.createElement('canvas');
  
  const imgEl = originalImage.getElement();
  const imgW = originalImage.width;
  const imgH = originalImage.height;
  
  // Clamp source coordinates to image boundaries
  sx = Math.max(0, Math.min(imgW - 1, sx));
  sy = Math.max(0, Math.min(imgH - 1, sy));
  sw = Math.max(1, Math.min(imgW - sx, sw));
  sh = Math.max(1, Math.min(imgH - sy, sh));
  
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = sw;
  outputCanvas.height = sh;
  const ctx = outputCanvas.getContext('2d');
  
  if (type === 'blur') {
    // To avoid soft/transparent edges, we crop a padded area, blur it, and extract the center.
    const pad = Math.min(intensity * 2, 50);
    
    let psx = Math.max(0, sx - pad);
    let psy = Math.max(0, sy - pad);
    let psw = Math.min(imgW - psx, sw + (sx - psx) + pad);
    let psh = Math.min(imgH - psy, sh + (sy - psy) + pad);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = psw;
    tempCanvas.height = psh;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(imgEl, psx, psy, psw, psh, 0, 0, psw, psh);
    
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = psw;
    blurCanvas.height = psh;
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.filter = `blur(${intensity}px)`;
    blurCtx.drawImage(tempCanvas, 0, 0);
    
    const dx = sx - psx;
    const dy = sy - psy;
    
    ctx.drawImage(blurCanvas, dx, dy, sw, sh, 0, 0, sw, sh);
  } else if (type === 'mosaic') {
    const blockSize = Math.max(2, intensity);
    
    const smallCanvas = document.createElement('canvas');
    const smallW = Math.max(1, Math.round(sw / blockSize));
    const smallH = Math.max(1, Math.round(sh / blockSize));
    smallCanvas.width = smallW;
    smallCanvas.height = smallH;
    const smallCtx = smallCanvas.getContext('2d');
    smallCtx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, smallW, smallH);
    
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    
    ctx.drawImage(smallCanvas, 0, 0, smallW, smallH, 0, 0, sw, sh);
  }
  
  return outputCanvas;
}

// Regenerates cropped and processed visual image for blur/mosaic lens
function updateBlurMosaicObject(obj) {
  if (!obj || (obj.customType !== 'blur' && obj.customType !== 'mosaic')) return;
  
  const left = obj.left;
  const top = obj.top;
  const width = obj.width * obj.scaleX;
  const height = obj.height * obj.scaleY;
  
  const sx = left - canvasPadding;
  const sy = top - canvasPadding;
  
  const intensity = obj.effectIntensity || 10;
  
  const newImgEl = generateBlurredOrPixelatedElement(sx, sy, width, height, obj.customType, intensity);
  
  obj.setElement(newImgEl);
  obj.set({
    width: width,
    height: height,
    scaleX: 1,
    scaleY: 1
  });
  
  // Set the serialized source to the new data URL so it undoes/exports properly
  obj.src = newImgEl.toDataURL();
  obj.setCoords();
}

// Drawing logic
function onMouseDown(o) {
  if (currentTool === 'select' || currentTool === 'draw') return;

  const pointer = canvas.getPointer(o.e);
  startX = pointer.x;
  startY = pointer.y;
  isDrawing = true;

  if (currentTool === 'rect') {
    activeShape = new fabric.Rect({
      left: startX,
      top: startY,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: currentColor,
      strokeWidth: currentThickness,
      selectable: false,
      evented: false
    });
    canvas.add(activeShape);
  } else if (currentTool === 'circle') {
    activeShape = new fabric.Circle({
      left: startX,
      top: startY,
      radius: 0,
      fill: 'transparent',
      stroke: currentColor,
      strokeWidth: currentThickness,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center'
    });
    canvas.add(activeShape);
  } else if (currentTool === 'arrow') {
    // Arrow consists of a line for preview, will build group on mouse up
    activeShape = new fabric.Line([startX, startY, startX, startY], {
      stroke: currentColor,
      strokeWidth: currentThickness,
      selectable: false,
      evented: false
    });
    canvas.add(activeShape);
  } else if (currentTool === 'text') {
    const textObj = new fabric.IText('Text', {
      left: startX,
      top: startY,
      fontFamily: currentFont,
      fontWeight: isBold ? 'bold' : 'normal',
      fill: currentColor,
      fontSize: currentThickness * 8 + 12, // Arbitrary scaling for text size
      selectable: true,
      evented: true
    });
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    textObj.enterEditing();
    textObj.selectAll();
    setTool('select'); // auto switch to select
    isDrawing = false;
    saveHistory();
  } else if (currentTool === 'blur' || currentTool === 'mosaic') {
    activeShape = new fabric.Rect({
      left: startX,
      top: startY,
      width: 0,
      height: 0,
      fill: 'rgba(255, 255, 255, 0.1)',
      stroke: '#3b82f6',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false
    });
    canvas.add(activeShape);
  }
}

function onMouseMove(o) {
  if (!isDrawing || !activeShape) return;
  const pointer = canvas.getPointer(o.e);

  if (currentTool === 'rect' || currentTool === 'blur' || currentTool === 'mosaic') {
    activeShape.set({
      width: Math.abs(pointer.x - startX),
      height: Math.abs(pointer.y - startY),
      left: Math.min(pointer.x, startX),
      top: Math.min(pointer.y, startY)
    });
  } else if (currentTool === 'circle') {
    const radius = Math.sqrt(Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2));
    activeShape.set({ radius: radius });
  } else if (currentTool === 'arrow') {
    activeShape.set({ x2: pointer.x, y2: pointer.y });
  }
  canvas.renderAll();
}

function onMouseUp(o) {
  if (!isDrawing) return;
  isDrawing = false;

  if ((currentTool === 'blur' || currentTool === 'mosaic') && activeShape) {
    const tempShape = activeShape;
    canvas.remove(tempShape);
    activeShape = null;

    const pointer = canvas.getPointer(o.e);
    const left = Math.min(startX, pointer.x);
    const top = Math.min(startY, pointer.y);
    const width = Math.abs(pointer.x - startX);
    const height = Math.abs(pointer.y - startY);

    if (width > 5 && height > 5) {
      const sx = left - canvasPadding;
      const sy = top - canvasPadding;
      const outputCanvas = generateBlurredOrPixelatedElement(sx, sy, width, height, currentTool, currentThickness);
      const effectObj = new fabric.Image(outputCanvas, {
        left: left,
        top: top,
        width: width,
        height: height,
        selectable: false,
        evented: false
      });
      effectObj.customType = currentTool;
      effectObj.effectIntensity = currentThickness;
      effectObj.src = outputCanvas.toDataURL();
      
      canvas.add(effectObj);
      canvas.renderAll();
      saveHistory();
    }
    return;
  }

  if (currentTool === 'arrow' && activeShape) {
    // Create arrow head and group it
    const pointer = canvas.getPointer(o.e);
    
    // Update line end to final position
    activeShape.set({ x2: pointer.x, y2: pointer.y });
    
    // If it's too short, just remove it
    const dist = Math.sqrt(Math.pow(pointer.x - startX, 2) + Math.pow(pointer.y - startY, 2));
    if (dist < 5) {
      canvas.remove(activeShape);
      activeShape = null;
      return;
    }

    const angle = Math.atan2(pointer.y - startY, pointer.x - startX) * 180 / Math.PI;
    const headLength = currentThickness * 3 + 10;
    
    const head = new fabric.Triangle({
      width: headLength,
      height: headLength,
      fill: currentColor,
      left: pointer.x,
      top: pointer.y,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      angle: angle + 90
    });

    const line = activeShape;
    canvas.remove(line);

    // Create a mathematically sound line for the final group,
    // explicitly centering it to bypass Fabric's bounding-box diagonal offset bug in Groups.
    const finalLine = new fabric.Line([startX, startY, pointer.x, pointer.y], {
      stroke: currentColor,
      strokeWidth: currentThickness,
      originX: 'center',
      originY: 'center',
      left: (startX + pointer.x) / 2,
      top: (startY + pointer.y) / 2,
      selectable: false,
      evented: false
    });

    // Grouping original objects with skewed latent bounding-box offsets causes misalignment.
    const group = new fabric.Group([finalLine, head], {
      selectable: false,
      evented: false
    });
    canvas.add(group);
  }

  if (activeShape) {
    activeShape.setCoords();
    // Re-apply selectability if we immediately switch to select, but let's keep them unselectable until select mode
    activeShape = null;
    saveHistory();
  } else if (currentTool === 'arrow') {
    saveHistory(); // arrow group was added
  }
}

function onSelection(o) {
  const activeObj = o.selected[0];
  if (activeObj) {
    if (activeObj.type === 'i-text') {
      fontPropGroup.style.display = 'block';
      fontSelect.value = activeObj.fontFamily;
      fontSelect.style.fontFamily = activeObj.fontFamily;
      isBold = activeObj.fontWeight === 'bold';
      btnBold.style.background = isBold ? 'var(--active-bg)' : '';
      btnBold.style.color = isBold ? 'var(--primary)' : '';
    } else {
      fontPropGroup.style.display = 'none';
    }
    updateThicknessSliderLabel();
  }
}

function deleteSelected() {
  if (!canvas) return;
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length) {
    canvas.discardActiveObject();
    activeObjects.forEach(obj => canvas.remove(obj));
    saveHistory();
  }
}

btnUndo.addEventListener('click', undo);

btnDelete.addEventListener('click', () => {
  if (!canvas) return;
  const activeObjects = canvas.getActiveObjects();
  if (activeObjects.length) {
    showConfirmDialog('Delete Selected', 'Are you sure you want to delete the selected item(s)?', () => {
      deleteSelected();
    });
  } else {
    // Treat as "markup reset" if nothing is selected
    showConfirmDialog('Clear All Markups', 'Are you sure you want to discard all drawn markups?', () => {
      canvas.clear();
      setupCanvasForImage(true);
    });
  }
});

// Reset image and start from scratch
btnReset.addEventListener('click', () => {
  showConfirmDialog('Start From Scratch', 'Are you sure you want to discard the image and all markups?', () => {
    canvas.clear();
    originalImage = null;
    appContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = ''; // reset file input so the same file can be uploaded again
  });
});

// Expand Padding
btnExpand.addEventListener('click', () => {
  if (!canvas || !originalImage) return;
  canvasPadding += 100; // Add 100px padding each time (internal coords)
  setupCanvasForImage(false); 
  // Restore objects positions? Wait, expanding size means we need to shift all objects if we want them visually centered, 
  // but since we shift the background image right/down by 100, we must also shift all existing markups.
  const objects = canvas.getObjects();
  objects.forEach(obj => {
    obj.set({
      left: obj.left + 100,
      top: obj.top + 100
    });
    obj.setCoords();
  });
  canvas.renderAll();
  saveHistory();
});

// Export (Copy & Download)
function getExportDataURL() {
  canvas.discardActiveObject();
  canvas.renderAll();
  
  // Fabric toDataURL with multiplier to extract full resolution
  // Wait, if canvas size is currently scaled, its internal size is totalWidth * currentScale.
  // To get original size (totalWidth), we need a multiplier of 1 / currentScale.
  return canvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier: 1 / currentScale
  });
}

btnCopy.addEventListener('click', async () => {
  if (!canvas) return;
  const dataUrl = getExportDataURL();
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    
    // Copy to clipboard
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]);
    
    const originalText = btnCopy.innerHTML;
    btnCopy.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
    setTimeout(() => { btnCopy.innerHTML = originalText; }, 2000);
  } catch (err) {
    console.error('Failed to copy: ', err);
    alert('Failed to copy. ' + err.message);
  }
});

btnDownload.addEventListener('click', () => {
  if (!canvas) return;
  const dataUrl = getExportDataURL();
  
  const link = document.createElement('a');
  link.download = `markup_${new Date().getTime()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
