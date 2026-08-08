import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";
import { asyncHandler } from "../asyncHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, "../../uploads/progress-photos");
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.userId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }
    cb(null, true);
  },
});

export const progressRouter = Router();
progressRouter.use(requireAuth);

progressRouter.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT id, note, taken_at FROM progress_photos WHERE user_id = $1 ORDER BY taken_at DESC",
    [req.userId]
  );
  res.json(result.rows);
}));

progressRouter.post("/", upload.single("photo"), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "A photo file is required" });
    return;
  }

  const note = typeof req.body.note === "string" ? req.body.note.trim() || null : null;
  const result = await pool.query(
    `INSERT INTO progress_photos (user_id, file_path, note)
     VALUES ($1, $2, $3)
     RETURNING id, note, taken_at`,
    [req.userId, req.file.filename, note]
  );

  res.status(201).json(result.rows[0]);
}));

// Serves the image bytes directly — never exposed as a static file, since
// progress photos are personal and must stay behind auth + ownership checks.
progressRouter.get("/:id/image", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT file_path FROM progress_photos WHERE id = $1 AND user_id = $2",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).end();
    return;
  }

  res.sendFile(path.resolve(uploadsDir, result.rows[0].file_path));
}));

progressRouter.delete("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "DELETE FROM progress_photos WHERE id = $1 AND user_id = $2 RETURNING file_path",
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  fs.unlink(path.resolve(uploadsDir, result.rows[0].file_path), () => {});
  res.status(204).end();
}));
