export async function imageDataUrlToGradientHeader(
  dataUrl: string,
): Promise<{ header: string; width: number; height: number }> {
  const img = new Image();
  const loadPromise = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load gradient image'));
  });
  img.src = dataUrl;
  await loadPromise;

  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('Invalid gradient image dimensions');

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
      const brightness = Math.round((r + g + b) / 3);
      values.push(String(brightness));
    }
  }

  const lines: string[] = [];
  for (let i = 0; i < values.length; i += 16) {
    lines.push('  ' + values.slice(i, i + 16).join(', '));
  }

  const header = `#define GRADIENT_W ${w}
#define GRADIENT_H ${h}

const u8 gradientData[${w * h}] = {
${lines.join(',\n')}
};
`;

  return { header, width: w, height: h };
}
