import { toPng } from "html-to-image";

const IGNORE_ATTR = "data-capture-ignore";
const PAD_PX = 50;
const PIXEL_RATIO = 2;
const BG = "#f8fafc";

function shouldIgnore(node: HTMLElement) {
  return (
    node.hasAttribute(IGNORE_ATTR) ||
    Boolean(node.closest(`[${IGNORE_ATTR}]`))
  );
}

async function withPadding(dataUrl: string, padCssPx: number) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("โหลดรูปสำหรับใส่ padding ไม่สำเร็จ"));
    el.src = dataUrl;
  });

  const pad = padCssPx * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่สามารถสร้าง canvas ได้");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, pad, pad);

  return canvas.toDataURL("image/png");
}

/**
 * แคปเจอร์เฉพาะ element ที่ส่งมา (ไม่รวม sidebar / navbar นอกขอบเขต)
 * และข้ามโหนดที่มี data-capture-ignore
 */
export async function captureElementAsPng(
  element: HTMLElement,
  fileName: string,
) {
  const raw = await toPng(element, {
    cacheBust: true,
    pixelRatio: PIXEL_RATIO,
    backgroundColor: BG,
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !shouldIgnore(node);
    },
  });

  const dataUrl = await withPadding(raw, PAD_PX);

  const link = document.createElement("a");
  link.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
  link.href = dataUrl;
  link.click();
}
