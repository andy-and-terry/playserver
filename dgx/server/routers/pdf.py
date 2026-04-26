import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..auth import require_auth
from ..config import get_settings
from ..services.job_store import job_store
from ..services.pdf_service import executor, run_job, uploads_dir, outputs_dir, safe_path

router = APIRouter()


class JobCreate(BaseModel):
    job_id: str
    operation: str
    params: dict[str, Any] = {}


@router.post("/pdf/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    _: None = Depends(require_auth),
):
    settings = get_settings()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024

    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(413, f"File exceeds {settings.MAX_UPLOAD_MB} MB limit")
    if content[:4] != b"%PDF":
        raise HTTPException(400, "Uploaded file does not appear to be a PDF")

    job_id = str(uuid.uuid4())
    dest = safe_path(uploads_dir(), f"{job_id}.pdf")
    dest.write_bytes(content)
    job_store.create(job_id)
    return {"job_id": job_id}


@router.post("/pdf/jobs")
async def create_job(body: JobCreate, _: None = Depends(require_auth)):
    job = job_store.get(body.job_id)
    if job is None:
        raise HTTPException(404, "job_id not found; upload PDF first")
    if job.status != "pending":
        raise HTTPException(409, f"Job already in state: {job.status}")

    executor.submit(run_job, body.job_id, body.operation, body.params)
    return {"job_id": body.job_id, "status": "running"}


@router.get("/pdf/jobs/{job_id}")
async def get_job(job_id: str, _: None = Depends(require_auth)):
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "result_file": job.result_file,
        "error": job.error,
    }


@router.get("/pdf/download/{job_id}")
async def download_result(job_id: str, _: None = Depends(require_auth)):
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")
    if job.status != "done":
        raise HTTPException(400, f"Job status is '{job.status}'; not ready for download")
    if not job.result_file:
        raise HTTPException(500, "Result file path missing")

    result_path = Path(job.result_file)
    if not result_path.exists():
        raise HTTPException(404, "Result file not found on disk")

    media_type = "application/pdf" if result_path.suffix == ".pdf" else "text/plain"
    return FileResponse(str(result_path), media_type=media_type, filename=result_path.name)


@router.delete("/pdf/jobs/{job_id}")
async def delete_job(job_id: str, _: None = Depends(require_auth)):
    job = job_store.get(job_id)
    if job is None:
        raise HTTPException(404, "Job not found")

    upload_file = uploads_dir() / f"{job_id}.pdf"
    if upload_file.exists():
        upload_file.unlink()

    if job.result_file:
        result_path = Path(job.result_file)
        if result_path.exists():
            result_path.unlink()

    job_store.delete(job_id)
    return {"deleted": job_id}
