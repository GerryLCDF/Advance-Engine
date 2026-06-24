export async function imageDataUrlToTransitionHeader(
  dataUrl: string,
  cols: number,
  rows: number,
  speed: number,
): Promise<{ header: string; width: number; height: number }> {
  const img = new Image();
  const loadPromise = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
  });
  img.src = dataUrl;
  await loadPromise;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('Invalid image dimensions');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, w, h);
  const pixels = imageData.data;

  const values: string[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];
      const brightness = r + g + b;
      values.push(brightness >= 384 ? '0x7FFF' : '0x0000');
    }
  }

  const lines: string[] = [];
  for (let i = 0; i < values.length; i += 16) {
    lines.push('  ' + values.slice(i, i + 16).join(', '));
  }

  const header = `#define TILESET_W ${w}
#define TILESET_H ${h}
#define TILESET_COLS ${cols}
#define TILESET_ROWS ${rows}
#define TILESET_FRAMES ${cols * rows}
#define FRAME_DELAY ${Math.max(1, speed)}

const u16 tilesetData[${w * h}] = {
${lines.join(',\n')}
};
`;

  return { header, width: w, height: h };
}
