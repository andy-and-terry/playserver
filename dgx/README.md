# DGX Server Tools

A portable **PDF processor + Ollama proxy** server that runs on **any DGX system** (DGX Spark, DGX Station, DGX H100, …) as well as regular Linux, macOS, and Windows machines.

Two fully equivalent runtime implementations are provided — choose whichever fits your stack:

| Runtime | Entry-point | Default port |
|---|---|---|
| **Python 3.10+ / FastAPI** | `scripts/run.sh` | 8000 |
| **Node.js 18+ / Express** | `scripts/run_node.sh` | 8000 |

Both runtimes expose the **same REST API** and share the same `data/` directory.

---

## Quick start (Python)

```bash
# 1. Install dependencies (creates dgx/.venv)
bash scripts/install.sh

# 2. Copy and edit the example environment file
cp .env.example .env
# edit .env — set DGX_API_TOKEN to something secret

# 3. Start the server
bash scripts/run.sh
# → http://0.0.0.0:8000
# → Swagger UI: http://localhost:8000/docs
```

## Quick start (Node.js)

```bash
# 1. Install dependencies
bash scripts/install_node.sh

# 2. Copy and edit the environment file (skip if already done above)
cp .env.example .env

# 3. Start the server
bash scripts/run_node.sh
# → http://0.0.0.0:8000
```

## Docker quick start

```bash
# Both Python (port 8000) + Node.js (port 8001) servers
bash scripts/run_docker.sh

# Include Ollama (requires NVIDIA Container Toolkit)
docker compose --profile ollama up --build
```

---

## API overview

All endpoints except `GET /health` require an `X-API-Token` header.  
When `DGX_API_TOKEN=changeme` (the default) **and** the request comes from `localhost`, the token check is skipped for developer convenience.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Liveness check — `{"status":"ok"}` |
| GET | `/system/info` | Yes | OS, CPU, RAM, GPU info |
| POST | `/pdf/upload` | Yes | Upload a PDF; returns `{"job_id":"..."}` |
| POST | `/pdf/jobs` | Yes | Start a PDF operation on a previously uploaded file |
| GET | `/pdf/jobs/{job_id}` | Yes | Poll job status (`pending/running/done/error`) |
| GET | `/pdf/download/{job_id}` | Yes | Download the result file |
| DELETE | `/pdf/jobs/{job_id}` | Yes | Delete job and associated files |
| GET | `/ollama/models` | Yes | List locally available Ollama models |
| POST | `/ollama/pull` | Yes | Pull an Ollama model (streaming) |
| POST | `/ollama/generate` | Yes | Generate text (streaming) |
| POST | `/ollama/chat` | Yes | Chat completion (streaming) |

### PDF operations

Send `POST /pdf/jobs` with body:

```json
{ "job_id": "...", "operation": "split", "params": { "pages": [0, 2] } }
```

| Operation | Required params | Description |
|---|---|---|
| `split` | `pages: [0, 1, …]` | Extract specific pages (0-indexed) |
| `merge` | `job_ids: ["id1", "id2"]` | Merge two or more uploaded PDFs |
| `rotate` | `pages: {"0": 90, "2": 180}` | Rotate pages by 90/180/270° |
| `extract_text` | _(none)_ | Save all text to a `.txt` result file |
| `compress` | _(none)_ | Re-compress; uses Ghostscript if available, otherwise fitz/pdf-lib |

---

## Firewall

The built-in application-level firewall applies to **both** Python and Node.js runtimes. Configure it in `.env`:

```dotenv
FIREWALL_ENABLED=true

# Block specific IPs or CIDR ranges (comma-separated)
BLOCKED_IPS=10.0.0.5,192.168.2.0/24

# Allow only these IPs/CIDRs (leave empty = allow all)
ALLOWED_IPS=192.168.1.0/24

# Max requests per IP per minute (0 = disabled)
RATE_LIMIT_PER_MINUTE=60
```

For **OS-level port restriction** on Ubuntu/Debian, run the included UFW helper:

```bash
# Allow only LAN (e.g. 192.168.1.0/24) to reach port 8000
sudo bash scripts/setup_ufw.sh 8000 192.168.1.0/24
```

---

## Enabling Ollama

1. [Install Ollama](https://ollama.com) on the DGX (or the same machine).
2. Set in `.env`:
   ```dotenv
   OLLAMA_BASE_URL=http://127.0.0.1:11434
   ```
3. Restart the server.

All `/ollama/*` routes will return `503` if `OLLAMA_BASE_URL` is empty.

---

## GPU support

GPU detection is **automatic** — the server calls `nvidia-smi` at runtime.  
If `nvidia-smi` is not found (regular machine, macOS, etc.), `GET /system/info` will return:

```json
{ "gpus": [], "nvidia_available": false }
```

No configuration is needed. Nothing breaks when GPUs are absent.

---

## Running on DGX

The setup steps are identical to any Linux machine:

```bash
git clone <this-repo> && cd playserver/dgx
bash scripts/install.sh          # Python path
# or
bash scripts/install_node.sh     # Node.js path

cp .env.example .env
# Set DGX_API_TOKEN, OLLAMA_BASE_URL, etc.

bash scripts/run.sh              # Python
# or
bash scripts/run_node.sh         # Node.js
```

For GPU-accelerated Ollama via Docker:

```bash
# Requires NVIDIA Container Toolkit
docker compose --profile ollama up --build
```

---

## Directory structure

```
dgx/
├── README.md
├── docker-compose.yml
├── .env.example
├── requirements.txt          ← Python deps
├── server/                   ← Python / FastAPI implementation
│   ├── Dockerfile
│   ├── main.py
│   ├── config.py
│   ├── auth.py
│   ├── middleware/
│   │   └── firewall.py       ← IP allowlist/blocklist + rate limiter
│   ├── routers/
│   │   ├── pdf.py
│   │   ├── ollama.py
│   │   └── system.py
│   ├── services/
│   │   ├── job_store.py
│   │   └── pdf_service.py
│   └── utils/
│       └── gpu.py
├── server-node/              ← Node.js / Express implementation
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── auth.js
│       ├── middleware/
│       │   └── firewall.js   ← IP allowlist/blocklist + rate limiter
│       ├── routers/
│       │   ├── pdf.js
│       │   ├── ollama.js
│       │   └── system.js
│       ├── services/
│       │   ├── jobStore.js
│       │   └── pdfService.js
│       └── utils/
│           ├── gpu.js
│           └── netUtils.js
├── scripts/
│   ├── install.sh            ← Python venv setup
│   ├── run.sh                ← Start Python server
│   ├── install_node.sh       ← npm install
│   ├── run_node.sh           ← Start Node.js server
│   ├── run_docker.sh         ← docker compose up
│   └── setup_ufw.sh          ← OS-level UFW firewall helper
└── data/
    └── .gitkeep
```
