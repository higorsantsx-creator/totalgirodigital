// Server-only helper for embedding a PNG signature into a PDF.
// Isolated in a .server.ts file so the pdf-lib import graph never reaches
// client / SSR route module scope (top-level pdf-lib in a route file breaks
// SSR with a tslib __extends interop error).
import * as PdfLib from "pdf-lib";

export async function embedSignatureIntoPdf(
  pdfBytes: Uint8Array,
  signaturePng: Uint8Array,
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = PdfLib;
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pngImage = await pdfDoc.embedPng(signaturePng);
  const firstPage = pdfDoc.getPages()[0];

  // Fixed signature slots for the Total Giro payslip template (A4 portrait,
  // 595.32 x 841.92pt). Each holerite has a vertical signature line on the right.
  const slots = [
    { xLine: 550.7, yBottom: 638.52, yTop: 779.16 }, // top payslip
    { xLine: 550.7, yBottom: 227.04, yTop: 367.56 }, // bottom payslip
  ];

  for (const slot of slots) {
    const lineLen = slot.yTop - slot.yBottom;
    const targetLen = lineLen * 0.9;
    const scale = targetLen / pngImage.width;
    const drawW = pngImage.width * scale;
    const drawH = Math.min(pngImage.height * scale, 30);
    const midY = (slot.yBottom + slot.yTop) / 2;
    const anchorX = slot.xLine + drawH / 2;
    const anchorY = midY - drawW / 2;
    firstPage.drawImage(pngImage, {
      x: anchorX,
      y: anchorY,
      width: drawW,
      height: drawH,
      rotate: degrees(90),
    });
  }

  return await pdfDoc.save();
}
