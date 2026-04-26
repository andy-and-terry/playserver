"""
PDF service — runs operations in a background ThreadPoolExecutor.

Primary library: PyMuPDF (fitz) — pure-wheel, no system deps.
Fallback:        pypdf — used for merge/split/rotate if fitz is absent.
Ghostscript:     used for compress if available on PATH; falls back to fitz.
"""

import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..config import get_settings
from .job_store import job_store

executor = ThreadPoolExecutor(max_workers=4)


# ── path helpers ─────────────────────────────────────────────────────────────

def _data_dir() -> Path:
    return Path(get_settings().DATA_DIR)


def uploads_dir() -> Path:
    d = _data_dir() / "uploads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def outputs_dir() -> Path:
    d = _data_dir() / "outputs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def safe_path(base: Path, filename: str) -> Path:
    """Resolve *filename* relative to *base* and reject path-traversal attempts."""
    resolved = (base / filename).resolve()
    base_resolved = base.resolve()
    # Ensure resolved path is strictly inside base (handles both POSIX and Windows)
    try:
        resolved.relative_to(base_resolved)
    except ValueError:
        raise ValueError(f"Path traversal detected: {filename}")
    return resolved


# ── job runner ───────────────────────────────────────────────────────────────

def run_job(job_id: str, operation: str, params: dict) -> None:
    job_store.update(job_id, status="running")
    try:
        result_file = _execute(job_id, operation, params)
        job_store.update(job_id, status="done", result_file=str(result_file))
    except Exception as exc:  # noqa: BLE001
        job_store.update(job_id, status="error", error=str(exc))


def _execute(job_id: str, operation: str, params: dict) -> Path:
    input_path = safe_path(uploads_dir(), f"{job_id}.pdf")
    out = outputs_dir()
    ops = {
        "split": _split,
        "merge": _merge,
        "rotate": _rotate,
        "extract_text": _extract_text,
        "compress": _compress,
    }
    if operation not in ops:
        raise ValueError(f"Unknown operation: {operation!r}. Valid: {list(ops)}")
    return ops[operation](job_id, input_path, params, out)


# ── operations ───────────────────────────────────────────────────────────────

def _split(job_id: str, input_path: Path, params: dict, out: Path) -> Path:
    pages: list[int] = params.get("pages", [])
    if not pages:
        raise ValueError("split: 'pages' list is required")
    out_path = out / f"{job_id}_result.pdf"
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(input_path))
        new_doc = fitz.open()
        for p in pages:
            new_doc.insert_pdf(doc, from_page=p, to_page=p)
        new_doc.save(str(out_path), deflate=True, garbage=4)
        new_doc.close(); doc.close()
    except ImportError:
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        for p in pages:
            writer.add_page(reader.pages[p])
        with open(out_path, "wb") as f:
            writer.write(f)
    return out_path


def _merge(job_id: str, _input: Path, params: dict, out: Path) -> Path:
    job_ids: list[str] = params.get("job_ids", [])
    if len(job_ids) < 2:
        raise ValueError("merge: 'job_ids' must contain at least 2 IDs")
    out_path = out / f"{job_id}_result.pdf"
    try:
        import fitz
        merged = fitz.open()
        for jid in job_ids:
            src_path = safe_path(uploads_dir(), f"{jid}.pdf")
            src = fitz.open(str(src_path))
            merged.insert_pdf(src)
            src.close()
        merged.save(str(out_path), deflate=True, garbage=4)
        merged.close()
    except ImportError:
        from pypdf import PdfReader, PdfWriter
        writer = PdfWriter()
        for jid in job_ids:
            src_path = safe_path(uploads_dir(), f"{jid}.pdf")
            reader = PdfReader(str(src_path))
            for page in reader.pages:
                writer.add_page(page)
        with open(out_path, "wb") as f:
            writer.write(f)
    return out_path


def _rotate(job_id: str, input_path: Path, params: dict, out: Path) -> Path:
    # params["pages"]: {"0": 90, "2": 180}
    page_rotations: dict[str, int] = params.get("pages", {})
    out_path = out / f"{job_id}_result.pdf"
    try:
        import fitz
        doc = fitz.open(str(input_path))
        for idx_str, degrees in page_rotations.items():
            doc[int(idx_str)].set_rotation(degrees)
        doc.save(str(out_path), deflate=True, garbage=4)
        doc.close()
    except ImportError:
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        for i, page in enumerate(reader.pages):
            if str(i) in page_rotations:
                page.rotate(page_rotations[str(i)])
            writer.add_page(page)
        with open(out_path, "wb") as f:
            writer.write(f)
    return out_path


def _extract_text(job_id: str, input_path: Path, _params: dict, out: Path) -> Path:
    out_path = out / f"{job_id}_result.txt"
    try:
        import fitz
        doc = fitz.open(str(input_path))
        text = "".join(page.get_text() for page in doc)
        doc.close()
    except ImportError:
        from pypdf import PdfReader
        reader = PdfReader(str(input_path))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    out_path.write_text(text, encoding="utf-8")
    return out_path


def _compress(job_id: str, input_path: Path, _params: dict, out: Path) -> Path:
    out_path = out / f"{job_id}_result.pdf"

    # Try Ghostscript first (best compression)
    gs = shutil.which("gs") or shutil.which("gswin64c") or shutil.which("gswin32c")
    if gs:
        result = subprocess.run(
            [
                gs,
                "-sDEVICE=pdfwrite",
                "-dCompatibilityLevel=1.4",
                "-dPDFSETTINGS=/ebook",
                "-dNOPAUSE",
                "-dBATCH",
                "-dQUIET",
                f"-sOutputFile={out_path}",
                str(input_path),
            ],
            capture_output=True,
            timeout=120,
        )
        if result.returncode == 0:
            return out_path

    # Fall back to fitz (deflate + garbage collect)
    try:
        import fitz
        doc = fitz.open(str(input_path))
        doc.save(str(out_path), deflate=True, garbage=4, clean=True)
        doc.close()
    except ImportError:
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        with open(out_path, "wb") as f:
            writer.write(f)
    return out_path
