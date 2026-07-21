// Server-only helper for embedding a PNG signature into a PDF.
// Load pdf-lib's bundled ESM build lazily: the package entry imports tslib,
// which breaks in the deployed worker bundle with a __extends interop error.
type PdfLibModule = typeof import("pdf-lib");

async function loadPdfLib(): Promise<PdfLibModule> {
  // @ts-expect-error pdf-lib does not publish declarations for its dist ESM subpath.
  return (await import("pdf-lib/dist/pdf-lib.esm.js")) as PdfLibModule;
}

export async function embedSignatureIntoPdf(
  pdfBytes: Uint8Array,
  signaturePng: Uint8Array,
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await loadPdfLib();
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pngImage = await pdfDoc.embedPng(signaturePng);
  const firstPage = pdfDoc.getPages()[0];

  // Fixed signature slots for the Total Giro payslip template (A4 portrait,
  // 595.32 x 841.92pt). Each holerite has a vertical signature line on the right.
  const slots = [
    { xLine: 550.7, yBottom: 638.52, yTop: 779.16 }, // top payslip
    { xLine: 550.7, yBottom: 227.04, yTop: 367.56 }, // bottom payslip
  ];

  // Vertical offset applied to lift the signature slightly above the demarcated line
  // so descenders (letters like g, j, p, y) don't cross into the printed line.
  const LIFT_ABOVE_LINE = 18;

  for (const slot of slots) {
    const lineLen = slot.yTop - slot.yBottom;
    const targetLen = lineLen * 0.9;
    const scale = targetLen / pngImage.width;
    const drawW = pngImage.width * scale;
    const drawH = Math.min(pngImage.height * scale, 30);
    const midY = (slot.yBottom + slot.yTop) / 2;
    // rotate 90°: image local +x -> page +y, image local +y -> page -x.
    // Shifting anchorX to a smaller value moves the rendered signature to the LEFT of the line (i.e. above it on the rotated axis).
    const anchorX = slot.xLine + drawH / 2 - LIFT_ABOVE_LINE;
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
