import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // POST /api/summarize endpoint matching Phase 2 specifications
  app.post("/api/summarize", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
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

      console.log(
        `[Summarize Pipeline] Received ${detectedType.toUpperCase()} file: '${file.originalname}' (${file.size} bytes), requested length: '${length}'`
      );

      return res.status(200).json({
        filename: file.originalname,
        file_type: detectedType,
        length: length,
        summary:
          "This is a placeholder summary. Real extraction and summarization will be added in later phases.",
        key_points: [
          "Placeholder key point 1",
          "Placeholder key point 2",
          "Placeholder key point 3",
        ],
        word_count: 0,
      });
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
