/**
 * Preparing screenshots for upload.
 *
 * Phone screenshots are routinely 2-3MB each, and a recipe often takes four of
 * them. Sent raw that overruns the request body limit, so they are downscaled
 * in the browser first. 1600px on the long edge keeps recipe text comfortably
 * legible while cutting a screenshot to a few hundred KB.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale to a JPEG data URL.
 *
 * Falls back to the original file when the browser cannot decode it — Safari
 * and HEIC being the usual case. The server cap then does the arguing.
 */
export async function prepareImage(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 600_000) {
      bitmap.close();
      return readAsDataUrl(file);
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } catch {
    return readAsDataUrl(file);
  }
}

export async function prepareImages(files: File[]): Promise<string[]> {
  return Promise.all(files.map(prepareImage));
}

/** Rough decoded size of a base64 data URL, for showing a total. */
export function approximateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.round((base64.length * 3) / 4);
}
