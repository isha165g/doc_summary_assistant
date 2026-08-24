import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";
import sharp from "sharp";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

/**
 * Runs Tesseract OCR on an image buffer with grayscale and normalization preprocessing.
 */
async function runOcrOnImageBuffer(imageBuffer: Buffer): Promise<string> {
  try {
    let processedBuffer = imageBuffer;
    try {
      processedBuffer = await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .toBuffer();
    } catch (sharpErr) {
      console.warn("Sharp preprocessing skipped/failed, using raw buffer:", sharpErr);
    }

    const { data } = await Tesseract.recognize(processedBuffer, "eng");
    return (data?.text || "").trim();
  } catch (err) {
    console.error("Tesseract OCR recognition error:", err);
    return "";
  }
}

/**
 * Scans PDF binary buffer for embedded JPEG image streams to OCR scanned documents.
 */
function extractJpegStreamsFromPdf(buffer: Buffer): Buffer[] {
  const images: Buffer[] = [];
  let startIndex = 0;
  while (startIndex < buffer.length && images.length < 8) {
    const soi = buffer.indexOf(Buffer.from([0xff, 0xd8, 0xff]), startIndex);
    if (soi === -1) break;
    const eoi = buffer.indexOf(Buffer.from([0xff, 0xd9]), soi + 3);
    if (eoi === -1) break;
    const imgBuf = buffer.subarray(soi, eoi + 2);
    // Only process images with reasonable resolution (> 2KB)
    if (imgBuf.length > 2048) {
      images.push(imgBuf);
    }
    startIndex = eoi + 2;
  }
  return images;
}

/**
 * Hybrid PDF Text Extraction:
 * Extracts digital selectable text, plus runs OCR on embedded image streams or scanned pages.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const extractedParts: string[] = [];

  // 1. Digital text layer
  let digitalText = "";
  try {
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    digitalText = (textResult?.text || "").trim();
    await parser.destroy();
  } catch (err) {
    console.warn("PDFParse structured extraction error, attempting fallback stream parsing:", err);
    const raw = buffer.toString("latin1");
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;
    const chunks: string[] = [];
    while ((match = streamRegex.exec(raw)) !== null) {
      const content = match[1];
      const textMatches = content.match(/\(([^)]+)\)\s*Tj/g);
      if (textMatches) {
        for (const tm of textMatches) {
          const t = tm.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
          if (t.trim()) chunks.push(t);
        }
      }
    }
    digitalText = chunks.join(" ").trim();
  }

  if (digitalText) {
    extractedParts.push(digitalText);
  }

  // 2. OCR pass for embedded images or scanned pages in PDF
  const embeddedImages = extractJpegStreamsFromPdf(buffer);
  if (embeddedImages.length > 0) {
    console.log(`[PDF Hybrid Extraction] Found ${embeddedImages.length} embedded images in PDF. Running OCR...`);
    for (let i = 0; i < embeddedImages.length; i++) {
      try {
        const ocrText = await runOcrOnImageBuffer(embeddedImages[i]);
        if (ocrText && ocrText.length > 10) {
          // If digital text didn't contain this text, append it
          const firstSnippet = ocrText.slice(0, 30);
          if (!digitalText.includes(firstSnippet)) {
            extractedParts.push(ocrText);
          }
        }
      } catch (ocrErr) {
        console.warn(`OCR failed for embedded image #${i}:`, ocrErr);
      }
    }
  }

  return extractedParts.join("\n\n").trim();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // POST /api/summarize endpoint (Phase 3: Hybrid Text Extraction & OCR)
  app.post("/api/summarize", (req, res) => {
    upload.single("file")(req, res, async (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({
            detail: "File size exceeds the 10MB limit.",
          });
        }
        return res.status(400).json({
          detail: err.message || "Invalid upload request.",
        });
      }

      const file = req.file;
      const lengthParam = (req.body.length || "medium").toLowerCase();
      const length = ["short", "medium", "long"].includes(lengthParam)
        ? lengthParam
        : "medium";

      if (!file || !file.originalname) {
        return res.status(400).json({
          detail: "No file was uploaded or file name is missing.",
        });
      }

      if (file.size === 0) {
        return res.status(400).json({
          detail: "The uploaded file is empty (0 bytes). Please upload a valid document.",
        });
      }

      const mimeType = (file.mimetype || "").toLowerCase();
      const filenameLower = file.originalname.toLowerCase();
      let detectedType: "pdf" | "image" | null = null;

      if (mimeType === "application/pdf" || filenameLower.endsWith(".pdf")) {
        detectedType = "pdf";
      } else if (
        mimeType.startsWith("image/jpeg") ||
        mimeType.startsWith("image/png") ||
        mimeType.startsWith("image/jpg") ||
        filenameLower.endsWith(".jpg") ||
        filenameLower.endsWith(".jpeg") ||
        filenameLower.endsWith(".png")
      ) {
        detectedType = "image";
      }

      if (!detectedType) {
        return res.status(415).json({
          detail: `Unsupported file type '${file.mimetype || "unknown"}'. Only application/pdf, image/jpeg, and image/png are supported.`,
        });
      }

      try {
        let extractedText = "";

        if (detectedType === "pdf") {
          console.log(`[Extraction Pipeline] Extracting text & scanned content from PDF: '${file.originalname}' (${file.size} bytes)`);
          try {
            extractedText = await extractPdfText(file.buffer);
          } catch (pdfErr: any) {
            console.error("PDF Parsing error:", pdfErr);
            return res.status(500).json({
              detail: "Failed to process document.",
            });
          }
        } else {
          console.log(`[Extraction Pipeline] Running Tesseract OCR on image: '${file.originalname}' (${file.size} bytes)`);
          extractedText = await runOcrOnImageBuffer(file.buffer);
        }

        // If no text was found or whitespace only, return 422
        if (!extractedText || extractedText.trim().length === 0) {
          return res.status(422).json({
            detail: "No readable text found in this document. Please try a clearer scan or a different file.",
          });
        }

        const words = extractedText.trim().split(/\s+/).filter(Boolean);
        const wordCount = words.length;

        // Preview summary: first 300 chars of extracted text + "..." if longer
        const previewSummary =
          extractedText.length > 300
            ? extractedText.substring(0, 300).trimEnd() + "..."
            : extractedText;

        const keyPoints = [
          `Extracted ${wordCount} words across the document.`,
          "Text parsing and OCR extraction successfully completed.",
          "Phase 4 will generate intelligent AI summaries and key insights from this text.",
        ];

        return res.status(200).json({
          filename: file.originalname,
          file_type: detectedType,
          length: length,
          summary: previewSummary,
          key_points: keyPoints,
          word_count: wordCount,
        });
      } catch (err: any) {
        console.error("Extraction error:", err);
        return res.status(500).json({
          detail: "Failed to process document.",
        });
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
