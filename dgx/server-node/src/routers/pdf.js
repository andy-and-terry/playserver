'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { requireAuth } = require('../auth');
const config = require('../config');
const { jobStore } = require('../services/jobStore');
const { runJob } = require('../services/pdfService');

const router = express.Router();

// ── helpers ───────────────────────────────────────────────────────────────────

function uploadsDir() {
  const dir = path.resolve(config.DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safePath(base, filename) {
  const resolved = path.resolve(base, filename);
  const baseResolved = path.resolve(base);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error(`Path traversal detected: ${filename}`);
  }
  return resolved;
}

// ── multer setup ──────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    isPdf ? cb(null, true) : cb(new Error('Only PDF files are allowed'));
  },
});

// ── routes ────────────────────────────────────────────────────────────────────

router.post('/pdf/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ detail: 'No file uploaded' });
  }

  const buf = req.file.buffer;
  if (buf.length < 4 || buf.toString('ascii', 0, 4) !== '%PDF') {
    return res.status(400).json({ detail: 'Uploaded file does not appear to be a PDF' });
  }

  const jobId = uuidv4();
  const dest = safePath(uploadsDir(), `${jobId}.pdf`);
  fs.writeFileSync(dest, buf);
  jobStore.create(jobId);

  res.json({ job_id: jobId });
});

router.post('/pdf/jobs', requireAuth, express.json(), (req, res) => {
  const { job_id: jobId, operation, params = {} } = req.body || {};
  if (!jobId || !operation) {
    return res.status(400).json({ detail: "'job_id' and 'operation' are required" });
  }

  const job = jobStore.get(jobId);
  if (!job) {
    return res.status(404).json({ detail: 'job_id not found; upload PDF first' });
  }
  if (job.status !== 'pending') {
    return res.status(409).json({ detail: `Job already in state: ${job.status}` });
  }

  // Run asynchronously without blocking the event loop
  setImmediate(() => runJob(jobId, operation, params));

  res.json({ job_id: jobId, status: 'running' });
});

router.get('/pdf/jobs/:jobId', requireAuth, (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  res.json({
    job_id: job.jobId,
    status: job.status,
    result_file: job.resultFile || null,
    error: job.error || null,
  });
});

router.get('/pdf/download/:jobId', requireAuth, (req, res) => {
  const job = jobStore.get(req.params.jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });
  if (job.status !== 'done') {
    return res.status(400).json({ detail: `Job status is '${job.status}'; not ready for download` });
  }
  if (!job.resultFile || !fs.existsSync(job.resultFile)) {
    return res.status(404).json({ detail: 'Result file not found on disk' });
  }

  const ext = path.extname(job.resultFile).toLowerCase();
  const contentType = ext === '.pdf' ? 'application/pdf' : 'text/plain; charset=utf-8';
  res.setHeader('Content-Type', contentType);
  res.download(job.resultFile);
});

router.delete('/pdf/jobs/:jobId', requireAuth, (req, res) => {
  const jobId = req.params.jobId;
  const job = jobStore.get(jobId);
  if (!job) return res.status(404).json({ detail: 'Job not found' });

  // Clean up upload — use safePath to reject path traversal
  try {
    const uploadFile = safePath(uploadsDir(), `${jobId}.pdf`);
    if (fs.existsSync(uploadFile)) {
      try { fs.unlinkSync(uploadFile); } catch { /* ignore */ }
    }
  } catch { /* safePath rejected the path — nothing to delete */ }

  // Clean up result — resultFile was written by the service (trusted), but
  // verify it still lives inside outputsDir before deleting
  if (job.resultFile) {
    try {
      const outDir = path.resolve(config.DATA_DIR, 'outputs');
      const resolved = path.resolve(job.resultFile);
      if (resolved.startsWith(path.resolve(outDir) + path.sep) && fs.existsSync(resolved)) {
        try { fs.unlinkSync(resolved); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  jobStore.delete(jobId);
  res.json({ deleted: jobId });
});

module.exports = router;
