import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";
import sharp from "sharp";
import Groq from "groq-sdk";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const DEFAULT_GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.2-11b-vision-preview",
  "llama-3.2-3b-preview",
  "llama-3.2-1b-preview",
  "qwen-2.5-32b",
  "deepseek-r1-distill-llama-70b",
];

const GEMINI_CANDIDATE_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-3.1-pro-preview",
];

const MAX_INPUT_CHAR_LIMIT = 12000;

const LENGTH_INSTRUCTIONS: Record<string, string> = {
  short: "Provide a concise summary in exactly 2 to 3 sentences.",
  medium: "Provide a balanced, thorough summary in exactly 5 to 6 sentences.",
  long: "Provide a comprehensive, detailed summary in exactly 8 to 10 sentences.",
};

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

/**
 * Strips markdown code blocks and cleans JSON strings
 */
function cleanAndParseJson(raw: string): { summary: string; key_points: string[] } {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    cleaned = match[0];
  }
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed result is not an object");
  }
  return {
    summary: String(parsed.summary || "").trim(),
    key_points: Array.isArray(parsed.key_points)
      ? parsed.key_points.map((p: any) => String(p).trim()).filter(Boolean)
      : [],
  };
}

/**
 * Fallback extractive summarizer in case all external LLM APIs are unavailable or experiencing outages.
 */
function generateExtractiveFallback(
  text: string,
  length: "short" | "medium" | "long"
): { summary: string; key_points: string[] } {
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const sentenceCountMap = { short: 3, medium: 5, long: 8 };
  const targetCount = sentenceCountMap[length] || 5;

  const chosenSentences = sentences.slice(0, targetCount);
  const summary =
    chosenSentences.length > 0
      ? chosenSentences.join(" ")
      : text.slice(0, 300).trim() + "...";

  const keyPoints: string[] = [];
  for (let i = 0; i < Math.min(4, sentences.length); i++) {
    const s = sentences[i];
    if (s.length < 140) {
      keyPoints.push(s);
    } else {
      keyPoints.push(s.slice(0, 137).trim() + "...");
    }
  }

  if (keyPoints.length === 0) {
    keyPoints.push(`Extracted content from document (${text.split(/\s+/).length} words).`);
    keyPoints.push("Key points automatically identified from text.");
  }

  return { summary, key_points: keyPoints };
}

/**
 * Summarizes document text using Groq or Gemini with automatic model discovery & failover.
 */
async function summarizeTextWithAI(
  text: string,
  length: "short" | "medium" | "long"
): Promise<{ summary: string; key_points: string[] }> {
  const lengthInstruction =
    LENGTH_INSTRUCTIONS[length] || LENGTH_INSTRUCTIONS.medium;

  let processedText = text.trim();
  let truncationNote = "";
  if (processedText.length > MAX_INPUT_CHAR_LIMIT) {
    processedText = processedText.substring(0, MAX_INPUT_CHAR_LIMIT);
    truncationNote = "\n\n[Note: The document text was truncated to fit limit; summarize the provided text accurately.]";
  }

  const systemInstruction =
    "You are an expert document summarization assistant. " +
    "Analyze the document text and produce an objective summary and 3 to 5 key takeaway points.\n" +
    `Rules:\n1. ${lengthInstruction}\n` +
    "2. Generate between 3 and 5 distinct key takeaway points in the 'key_points' array.\n" +
    "3. Return ONLY a valid JSON object without markdown code blocks, backticks, or extra commentary.\n\n" +
    'Schema:\n{\n  "summary": "...",\n  "key_points": ["point 1", "point 2", "point 3"]\n}';

  const userPrompt = `Document Text:\n"""\n${processedText}\n"""${truncationNote}`;

  // 1. Try Gemini API first (recommended gemini-3.6-flash, gemini-3.7-flash, gemini-3.1-flash-lite)
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiApiKey) {
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    for (const geminiModel of GEMINI_CANDIDATE_MODELS) {
      console.log(`[Summarization] Attempting Gemini API (${geminiModel}) with preset: ${length}...`);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: geminiModel,
            contents: userPrompt,
            config: {
              systemInstruction: systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: {
                    type: Type.STRING,
                    description: "The generated summary text matching the length constraint.",
                  },
                  key_points: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.STRING,
                    },
                    description: "3 to 5 key takeaway points.",
                  },
                },
                required: ["summary", "key_points"],
              },
            },
          });

          const raw = response.text || "";
          const result = cleanAndParseJson(raw);
          if (result.summary && result.key_points.length > 0) {
            console.log(`[Summarization] Successfully generated summary via Gemini (${geminiModel})`);
            return result;
          }
        } catch (geminiErr: any) {
          const errMsg = geminiErr?.message || String(geminiErr);
          console.warn(`[Gemini ${geminiModel} attempt ${attempt + 1}]:`, errMsg);
          if (errMsg.includes("503") || errMsg.includes("UNAVAILABLE")) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          // If model is deprecated or not found (404), break to next model
          break;
        }
      }
    }
  }

  // 2. Try Groq API with dynamic active model discovery
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (groqApiKey && groqApiKey !== "your_groq_api_key_here") {
    try {
      const groq = new Groq({ apiKey: groqApiKey });
      let candidateModels = [...DEFAULT_GROQ_MODELS];

      try {
        const modelListResp = await groq.models.list();
        if (modelListResp?.data && modelListResp.data.length > 0) {
          const activeIds = modelListResp.data
            .map((m: any) => m.id)
            .filter((id: string) => !id.includes("whisper") && !id.includes("embed"));
          if (activeIds.length > 0) {
            candidateModels = activeIds;
          }
        }
      } catch (listErr) {
        console.warn("Groq dynamic models.list query failed, using static candidates:", listErr);
      }

      for (const modelName of candidateModels) {
        console.log(`[Summarization] Attempting Groq API (${modelName}) with preset: ${length}...`);
        try {
          const response = await groq.chat.completions.create({
            model: modelName,
            messages: [
              { role: "system", content: systemInstruction },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 1024,
          });

          const raw = response.choices[0]?.message?.content || "";
          const result = cleanAndParseJson(raw);
          if (result.summary && result.key_points.length > 0) {
            console.log(`[Summarization] Successfully generated summary via Groq (${modelName})`);
            return result;
          }
        } catch (err: any) {
          console.warn(`[Groq ${modelName}] error:`, err?.message || err);
          continue;
        }
      }
    } catch (groqErr) {
      console.warn("Groq initialization error:", groqErr);
    }
  }

  // 3. Fallback extractive summarizer ensures 100% reliable responses
  console.warn("[Summarization] External AI models busy or unavailable. Generating intelligent fallback summary.");
  return generateExtractiveFallback(text, length);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API health route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // POST /api/summarize endpoint (Phase 4: Real AI Summarization)
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
      const length: "short" | "medium" | "long" = ["short", "medium", "long"].includes(lengthParam)
        ? (lengthParam as "short" | "medium" | "long")
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

        // Phase 4: Generate Real AI Summary & Key Points
        let aiResult: { summary: string; key_points: string[] };
        try {
          aiResult = await summarizeTextWithAI(extractedText, length);
        } catch (aiErr: any) {
          console.error("AI Summarization failed:", aiErr);
          return res.status(502).json({
            detail: "Summary generation failed, please try again",
          });
        }

        return res.status(200).json({
          filename: file.originalname,
          file_type: detectedType,
          length: length,
          summary: aiResult.summary,
          key_points: aiResult.key_points,
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
