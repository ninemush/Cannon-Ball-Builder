import type { Express, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mammoth from "mammoth";

const upload = multer({
  dest: "/tmp/uploads",
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/plain",
      "text/csv",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

async function extractDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

async function extractPdf(filePath: string): Promise<string> {
  const pdfModule = await import("pdf-parse");
  const pdfParse = (pdfModule as any).default || pdfModule;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractXlsx(filePath: string): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.readFile(filePath);
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    lines.push(`--- Sheet: ${sheetName} ---`);
    lines.push(csv);
  }
  return lines.join("\n");
}

function extractText(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

function describeMedia(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname).toLowerCase();
  const isVideo = [".mp4", ".webm", ".mov"].includes(ext);
  const isImage = [".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext);
  const sizeKB = Math.round((file.size || 0) / 1024);

  if (isVideo) {
    return `[Uploaded video file: "${file.originalname}" (${sizeKB} KB). Video content cannot be parsed as text — please describe the process or steps shown in this video so I can help create a process map and documentation.]`;
  }
  if (isImage) {
    return `[Uploaded image file: "${file.originalname}" (${sizeKB} KB). This appears to be a screenshot or diagram. Please describe the process, workflow, or steps visible in this image so I can help create a process map and documentation.]`;
  }
  return `[Uploaded file: "${file.originalname}" (${sizeKB} KB)]`;
}

async function extractFileContent(file: Express.Multer.File): Promise<{ text: string; type: string }> {
  const ext = path.extname(file.originalname).toLowerCase();

  try {
    if (ext === ".docx") {
      const text = await extractDocx(file.path);
      return { text: text.slice(0, 50000), type: "docx" };
    }
    if (ext === ".pdf") {
      const text = await extractPdf(file.path);
      return { text: text.slice(0, 50000), type: "pdf" };
    }
    if (ext === ".xlsx" || ext === ".xls") {
      const text = await extractXlsx(file.path);
      return { text: text.slice(0, 50000), type: "spreadsheet" };
    }
    if (ext === ".txt" || ext === ".csv") {
      const text = extractText(file.path);
      return { text: text.slice(0, 50000), type: ext === ".csv" ? "csv" : "text" };
    }
    if ([".png", ".jpg", ".jpeg", ".gif", ".webp"].includes(ext)) {
      return { text: describeMedia(file), type: "image" };
    }
    if ([".mp4", ".webm", ".mov"].includes(ext)) {
      return { text: describeMedia(file), type: "video" };
    }
    return { text: `[Uploaded file: ${file.originalname}]`, type: "unknown" };
  } catch (err: any) {
    console.error(`[File Upload] Failed to extract content from ${file.originalname}:`, err.message);
    return { text: `[File "${file.originalname}" uploaded but content extraction failed: ${err.message}]`, type: "error" };
  } finally {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
}

export function registerFileUploadRoutes(app: Express) {
  app.post("/api/upload", upload.array("files", 5), async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    try {
      const results = await Promise.all(
        files.map(async (file) => {
          const extracted = await extractFileContent(file);
          return {
            filename: file.originalname,
            type: extracted.type,
            text: extracted.text,
            size: file.size,
          };
        })
      );

      res.json({ files: results });
    } catch (err: any) {
      console.error("[File Upload] Error:", err.message);
      res.status(500).json({ message: "File processing failed" });
    }
  });
}
