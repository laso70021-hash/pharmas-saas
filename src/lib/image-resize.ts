import { validateLogo } from './logo';
/** Preserve transparency and complete artwork; never crop or upscale logos. */
export async function optimizeLogo(file: File): Promise<File> {
  validateLogo(file);
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('This logo image cannot be opened.');
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d'); if (!ctx) { bitmap.close(); throw new Error('Image processing is unavailable.'); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.94));
  if (!blob) throw new Error('Could not optimize the logo.');
  const result = scale === 1 && blob.size >= file.size ? file : new File([blob], 'business-logo.webp', { type: 'image/webp' });
  validateLogo(result); return result;
}
/** Browser-only helpers: shrink photos to a sharp, light image before upload or AI reading. */
export async function resizeImage(file: File, maxSide = 1200, quality = 0.86, type: 'image/webp' | 'image/jpeg' = 'image/webp'): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); if (!ctx) return file;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  if (!blob || (blob.size >= file.size && scale === 1)) return file;
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type });
}
/** Square product photo: centred, padded on white, consistent size for grids. */
export async function squareProductImage(file: File, side = 800): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const canvas = document.createElement('canvas'); canvas.width = side; canvas.height = side;
  const ctx = canvas.getContext('2d'); if (!ctx) return file;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, side, side);
  const pad = side * 0.04, box = side - pad * 2;
  const scale = Math.min(box / bitmap.width, box / bitmap.height);
  const w = bitmap.width * scale, h = bitmap.height * scale;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h); bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.88));
  return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' }) : file;
}
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new Error('Could not read this file.')); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file); });
}
/** Photo → resized data URL; PDF → data URL as-is. Max 4 MB after processing. */
export async function prepareAiFile(file: File): Promise<{ name: string; data: string }> {
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!ok.includes(file.type)) throw new Error('Choose a photo (JPG, PNG, WebP) or a PDF.');
  const f = file.type === 'application/pdf' ? file : await resizeImage(file, 1800, 0.9, 'image/jpeg');
  if (f.size > 4 * 1024 * 1024) throw new Error('File is too large (max 4 MB).');
  return { name: file.name, data: await fileToDataUrl(f) };
}
