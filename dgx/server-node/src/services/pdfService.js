'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PDFDocument, degrees } = require('pdf-lib');
const pdfParse = require('pdf-parse');

const config = require('../config');
const { jobStore } = require('./jobStore');

// ── path helpers ─────────────────────────────────────────────────────────────

function uploadsDir() {
  const dir = path.resolve(config.DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function outputsDir() {
  const dir = path.resolve(config.DATA_DIR, 'outputs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Resolve filename relative to base and reject path-traversal attempts.
 * Returns the resolved absolute path string.
 */
function safePath(base, filename) {
  const resolved = path.resolve(base, filename);
  const baseResolved = path.resolve(base);
  if (!resolved.startsWith(baseResolved + path.sep) && resolved !== baseResolved) {
    throw new Error(`Path traversal detected: ${filename}`);
  }
  return resolved;
}

/**
 * Build and validate an output path under outputsDir().
 * jobId is validated to only contain safe UUID characters.
 */
function safeOutputPath(outDir, jobId, suffix) {
  // UUIDs are hex + hyphens only; reject anything else
  if (!/^[0-9a-f-]+$/i.test(jobId)) {
    throw new Error(`Invalid job ID: ${jobId}`);
  }
  return safePath(outDir, `${jobId}_result.${suffix}`);
}

// ── job runner ───────────────────────────────────────────────────────────────

async function runJob(jobId, operation, params) {
  jobStore.update(jobId, { status: 'running' });
  try {
    const resultFile = await executeOperation(jobId, operation, params);
    jobStore.update(jobId, { status: 'done', resultFile });
  } catch (err) {
    jobStore.update(jobId, { status: 'error', error: err.message });
  }
}

async function executeOperation(jobId, operation, params) {
  const inputPath = safePath(uploadsDir(), `${jobId}.pdf`);
  const outDir = outputsDir();

  switch (operation) {
    case 'split':        return splitPdf(jobId, inputPath, params, outDir);
    case 'merge':        return mergePdf(jobId, params, outDir);
    case 'rotate':       return rotatePdf(jobId, inputPath, params, outDir);
    case 'extract_text': return extractText(jobId, inputPath, outDir);
    case 'compress':     return compressPdf(jobId, inputPath, outDir);
    default:
      throw new Error(`Unknown operation: ${operation}. Valid: split, merge, rotate, extract_text, compress`);
  }
}

// ── operations ───────────────────────────────────────────────────────────────

async function splitPdf(jobId, inputPath, params, outDir) {
  const pages = params.pages || [];
  if (!pages.length) throw new Error("split: 'pages' list is required");

  const srcBytes = fs.readFileSync(inputPath);
  const srcDoc = await PDFDocument.load(srcBytes);
  const outDoc = await PDFDocument.create();

  const copied = await outDoc.copyPages(srcDoc, pages);
  copied.forEach((p) => outDoc.addPage(p));

  const outBytes = await outDoc.save();
  const outPath = safeOutputPath(outDir, jobId, 'pdf');
  fs.writeFileSync(outPath, outBytes);
  return outPath;
}

async function mergePdf(jobId, params, outDir) {
  const jobIds = params.job_ids || [];
  if (jobIds.length < 2) throw new Error("merge: 'job_ids' must contain at least 2 IDs");

  const outDoc = await PDFDocument.create();
  for (const jid of jobIds) {
    const srcPath = safePath(uploadsDir(), `${jid}.pdf`);
    const srcBytes = fs.readFileSync(srcPath);
    const srcDoc = await PDFDocument.load(srcBytes);
    const copied = await outDoc.copyPages(srcDoc, srcDoc.getPageIndices());
    copied.forEach((p) => outDoc.addPage(p));
  }

  const outBytes = await outDoc.save();
  const outPath = safeOutputPath(outDir, jobId, 'pdf');
  fs.writeFileSync(outPath, outBytes);
  return outPath;
}

async function rotatePdf(jobId, inputPath, params, outDir) {
  // params.pages: { "0": 90, "2": 180 }
  const pageRotations = params.pages || {};

  const srcBytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(srcBytes);

  for (const [idxStr, deg] of Object.entries(pageRotations)) {
    const idx = parseInt(idxStr, 10);
    const page = doc.getPage(idx);
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + deg) % 360));
  }

  const outBytes = await doc.save();
  const outPath = safeOutputPath(outDir, jobId, 'pdf');
  fs.writeFileSync(outPath, outBytes);
  return outPath;
}

async function extractText(jobId, inputPath, outDir) {
  const buf = fs.readFileSync(inputPath);
  const data = await pdfParse(buf);
  const outPath = safeOutputPath(outDir, jobId, 'txt');
  fs.writeFileSync(outPath, data.text, 'utf8');
  return outPath;
}

async function compressPdf(jobId, inputPath, outDir) {
  const outPath = safeOutputPath(outDir, jobId, 'pdf');

  // Try Ghostscript first — use execFileSync with argument array to prevent
  // command injection; never pass user-controlled data via shell string.
  const gsCandidates = ['gs', 'gswin64c', 'gswin32c'];
  for (const cmd of gsCandidates) {
    try {
      execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 5_000 });
      // Found — run compression with safe arg array
      execFileSync(
        cmd,
        [
          '-sDEVICE=pdfwrite',
          '-dCompatibilityLevel=1.4',
          '-dPDFSETTINGS=/ebook',
          '-dNOPAUSE',
          '-dBATCH',
          '-dQUIET',
          `-sOutputFile=${outPath}`,
          inputPath,
        ],
        { timeout: 120_000 }
      );
      return outPath;
    } catch { /* not found or failed — try next */ }
  }

  // Fall back to pdf-lib re-save with object streams (modest size reduction)
  const srcBytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(srcBytes, { updateMetadata: false });
  const outBytes = await doc.save({ useObjectStreams: true });
  fs.writeFileSync(outPath, outBytes);
  return outPath;
}

module.exports = { runJob };

// ── TTL cleanup ───────────────────────────────────────────────────────────────

const _JOB_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h
const _CLEANUP_INTERVAL_MS = 60 * 60 * 1000;   // 1 h

function _cleanupOldJobs() {
  const cutoff = Date.now() - _JOB_MAX_AGE_MS;
  for (const job of jobStore.listAll()) {
    if (job.createdAt < cutoff) {
      // Delete upload file
      try {
        const uploadFile = safePath(uploadsDir(), `${job.jobId}.pdf`);
        if (fs.existsSync(uploadFile)) fs.unlinkSync(uploadFile);
      } catch { /* ignore */ }

      // Delete result file
      if (job.resultFile) {
        try {
          if (fs.existsSync(job.resultFile)) fs.unlinkSync(job.resultFile);
        } catch { /* ignore */ }
      }

      jobStore.delete(job.jobId);
    }
  }
}

setInterval(() => {
  try { _cleanupOldJobs(); } catch { /* ignore */ }
}, _CLEANUP_INTERVAL_MS).unref();

