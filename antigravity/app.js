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
const thicknessVal = document.getElementById('thickness-val');
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
let currentColor = '#ff3366';
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
    objects: canvas.getObjects().map(o => o.toObject(['selectable', 'evented']))
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
  canvas.on('selection:cleared', () => { fontPropGroup.style.display = currentTool === 'text' ? 'block' : 'none'; });
  
  canvas.on('path:created', () => saveHistory());
  canvas.on('object:modified', () => saveHistory());
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

function setTool(tool) {
  currentTool = tool;
  toolBtns.forEach(b => b.classList.remove('active'));
  document.querySelector(`.tool-btn[data-tool="${tool}"]`).classList.add('active');

  fontPropGroup.style.display = (tool === 'text') ? 'block' : 'none';

  if (!canvas) return;

  canvas.isDrawingMode = (tool === 'draw');
  if (canvas.isDrawingMode) {
    canvas.freeDrawingBrush.color = currentColor;
    canvas.freeDrawingBrush.width = currentThickness;
  }

  // If select, enable selection, else disable so we can click-drag to draw
  canvas.selection = (tool === 'select');
  canvas.getObjects().forEach(o => {
    o.selectable = (tool === 'select' || tool === 'text'); // Allow selecting text maybe? No, let's keep strict.
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
  thicknessVal.textContent = val;
  if (canvas && canvas.isDrawingMode) {
    canvas.freeDrawingBrush.width = val;
  }
  const activeObj = canvas?.getActiveObject();
  if (activeObj) {
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
  }
}

function onMouseMove(o) {
  if (!isDrawing || !activeShape) return;
  const pointer = canvas.getPointer(o.e);

  if (currentTool === 'rect') {
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

  if (currentTool === 'arrow' && activeShape) {
    // Create arrow head and group it
    const pointer = canvas.getPointer(o.e);
    
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

    // Adjust line end to not poke out of triangle
    const group = new fabric.Group([line, head], {
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
