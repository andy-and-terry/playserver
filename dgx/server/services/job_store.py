import threading
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Job:
    job_id: str
    status: str = "pending"  # pending | running | done | error
    result_file: Optional[str] = None
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)


class JobStore:
    def __init__(self):
        self._store: dict[str, Job] = {}
        self._lock = threading.Lock()

    def create(self, job_id: str) -> Job:
        job = Job(job_id=job_id)
        with self._lock:
            self._store[job_id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._store.get(job_id)

    def update(self, job_id: str, **kwargs) -> Optional[Job]:
        with self._lock:
            job = self._store.get(job_id)
            if job:
                for k, v in kwargs.items():
                    setattr(job, k, v)
        return job

    def delete(self, job_id: str) -> bool:
        with self._lock:
            return self._store.pop(job_id, None) is not None

    def list_all(self) -> list["Job"]:
        """Return a snapshot of all jobs (used for TTL cleanup)."""
        with self._lock:
            return list(self._store.values())


# Module-level singleton
job_store = JobStore()
