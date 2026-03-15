// Generate the extension icon programmatically using OffscreenCanvas
function createIconImageData(size) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const s = size / 128;

    // Blue background
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';
    ctx.lineWidth = Math.max(1.5, size / 10);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Arrow (top-right diagonal)
    ctx.beginPath();
    ctx.moveTo(28 * s, 100 * s);
    ctx.lineTo(95 * s, 28 * s);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(95 * s, 28 * s);
    ctx.lineTo(68 * s, 32 * s);
    ctx.lineTo(92 * s, 56 * s);
    ctx.closePath();
    ctx.fill();

    // Small rectangle (bottom-left)
    ctx.lineWidth = Math.max(1, size / 14);
    ctx.strokeRect(18 * s, 72 * s, 44 * s, 30 * s);

    return ctx.getImageData(0, 0, size, size);
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.action.setIcon({
        imageData: {
            16: createIconImageData(16),
            48: createIconImageData(48),
            128: createIconImageData(128)
        }
    });
});

// Also set icon on startup (service workers can be restarted)
chrome.runtime.onStartup.addListener(() => {
    chrome.action.setIcon({
        imageData: {
            16: createIconImageData(16),
            48: createIconImageData(48),
            128: createIconImageData(128)
        }
    });
});

// Open Quick Markup in a new tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});
