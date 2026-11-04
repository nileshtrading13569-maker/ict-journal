/**
 * Screenshot helpers shared by the journal attachment panels.
 *
 * Everything here runs in the browser. The goal is to make "attach a chart
 * screenshot" work from the three places traders actually get one:
 *  1. Clipboard paste  (Win+Shift+S / Cmd+Shift+4, then Ctrl+V)
 *  2. Drag & drop
 *  3. Direct screen capture via getDisplayMedia
 *
 * Images are normalised and downscaled before they are stored as data URLs in
 * the trade row, so a full-resolution desktop capture does not blow up the
 * synced JSON payload.
 */

export type ScreenshotSlot = "screenshotHtf" | "screenshotExec";

export const SCREENSHOT_SLOTS: ScreenshotSlot[] = ["screenshotHtf", "screenshotExec"];

export const SCREENSHOT_LABELS: Record<ScreenshotSlot, string> = {
  screenshotHtf: "HTF chart · 1H",
  screenshotExec: "Execution · 5m",
};

const MAX_SOURCE_BYTES = 10_000_000;
const MAX_STORED_CHARS = 2_000_000;
const MAX_DIMENSION = 1600;

export function isImageFile(file: File | null | undefined): file is File {
  return Boolean(file && file.type.startsWith("image/"));
}

/** Pull the first image out of a clipboard / drop payload. */
export function imageFileFromDataTransfer(data: DataTransfer | null | undefined): File | null {
  if (!data) return null;

  const items = Array.from(data.items ?? []);
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  const files = Array.from(data.files ?? []);
  return files.find((file) => file.type.startsWith("image/")) ?? null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read that image."));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be decoded."));
    image.src = src;
  });
}

/**
 * Downscale + re-encode an image when needed so the stored data URL stays
 * small enough to sync comfortably. Small images are returned untouched.
 */
export async function optimiseScreenshot(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/")) return dataUrl;
  if (dataUrl.length <= MAX_STORED_CHARS) return dataUrl;

  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  // Chart screenshots are opaque; paint a dark backdrop so transparent PNGs
  // do not turn into black-on-black in the JPEG fallback.
  ctx.fillStyle = "#0b0b0b";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);

  let quality = 0.92;
  let output = canvas.toDataURL("image/jpeg", quality);
  while (output.length > MAX_STORED_CHARS && quality > 0.45) {
    quality -= 0.1;
    output = canvas.toDataURL("image/jpeg", quality);
  }
  return output;
}

/** Read, validate and normalise an image file dropped / picked by the user. */
export async function prepareScreenshotFile(file: File | null | undefined): Promise<string> {
  if (!file) throw new Error("No image found.");
  if (!isImageFile(file)) throw new Error("Choose an image file (PNG, JPG, WebP or GIF).");
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Screenshot must be 10 MB or smaller.");

  const dataUrl = await fileToDataUrl(file);
  return optimiseScreenshot(dataUrl);
}

/**
 * Capture a single frame from a screen / window the user picks in the browser
 * picker. Requires a secure context (HTTPS or localhost), which the deployed
 * app and the local preview both satisfy.
 */
export async function captureScreenFrame(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    throw new Error(
      "Screen capture is not supported in this browser. Take a screenshot (Win+Shift+S / Cmd+Shift+4) and paste it here.",
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      throw new Error("Screen capture was cancelled.");
    }
    throw new Error("Could not start screen capture.");
  }

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read the captured screen."));
    });

    await video.play();
    // Give the compositor one frame so the current window contents are drawn.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) throw new Error("The captured screen was empty.");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");

    ctx.drawImage(video, 0, 0, width, height);
    return optimiseScreenshot(canvas.toDataURL("image/png"));
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}
