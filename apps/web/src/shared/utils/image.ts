/**
 * Reads an image File, downscales it, and returns a compressed JPEG data URL.
 * Keeps payment receipts small enough to store inline in the database.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxWidth = 1100,
  quality = 0.7,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Imagen inválida.'));
    image.src = dataUrl;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Reads any File into a base64 data URL (no transformation). Used for PDFs. */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Turns an uploaded KYC document into a self-contained data URL: images are
 * downscaled/compressed (kept legible for manual review), everything else
 * (e.g. PDFs) is embedded as-is. Used by the offline mock, which has no real
 * object storage.
 */
export function kycFileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith('image/')) return fileToCompressedDataUrl(file, 1600, 0.75);
  return fileToDataUrl(file);
}
