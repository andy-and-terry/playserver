# playserver

This repository hosts two unrelated pieces:

1. **Public status/landing site** — static HTML served from the repo root and `site/`.
2. **[`dgx/`](dgx/README.md)** — DGX Server Tools: a portable PDF processor + Ollama proxy server (Python/FastAPI and Node.js/Express implementations). See [`dgx/README.md`](dgx/README.md) for installation, usage, and the full API reference.

## Repository structure

```
.
├── index.html           ← Funding/status placeholder page ("Server is in construction...")
├── site/
│   ├── index.html        ← Landing page linking to the AI and Games sections
│   ├── index.js           ← Marks AI/Games sections as "Unavailable" (placeholders, not yet built)
│   ├── ai/
│   │   └── initial.index.html   ← Placeholder app download page
│   └── games/
│       └── index.html    ← Placeholder ("Site in development")
└── dgx/                  ← DGX Server Tools — see dgx/README.md for details
```

The `site/ai` and `site/games` pages are placeholders; both report their status as unavailable until built out.

## DGX Server Tools

The `dgx/` directory contains a standalone PDF processor + Ollama proxy server, with equivalent Python/FastAPI and Node.js/Express implementations, a built-in firewall, and Docker support.

See [`dgx/README.md`](dgx/README.md) for the quick start, API overview, firewall configuration, and directory structure.
