# Blurrise 🌅

> **Local Privacy Image Blur & Redaction Studio**  
> 100% Client-Side • Zero Network Upload • No Telemetry • Zero Dependencies

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![Vanilla JS](https://img.shields.io/badge/Dependencies-0%20(Pure%20Vanilla)-brightgreen)](#tech-stack)
[![CSP](https://img.shields.io/badge/Privacy-Hardened%20CSP-success)](#privacy--security-first)

**Blurrise** is a lightweight, browser-based studio designed to selectively blur, pixelate, or redact sensitive parts of images (faces, license plates, credentials, personal information) without sending your data to any server.

---

## ✨ Features

- **🛡️ 100% Client-Side Privacy**: All processing runs locally in your browser memory via the HTML5 Canvas API. No analytics, tracking, or outbound requests.
- **🎨 Multiple Effect Types**:
  - **Gaussian Blur**: Smooth, customizable blur intensity.
  - **Pixelate / Censoring**: Authentic retro pixelation with adjustable block size.
  - **Solid Redaction**: Color-coded opaque blackout blocks (Black, Charcoal, Navy, Crimson, Yellow-Warning, Pure White).
- **🖌️ Flexible Selection Tools**:
  - **Rectangle**: Bounding boxes with adjustable corner roundness.
  - **Ellipse / Circle**: Ideal for faces, badges, or circular elements.
  - **Freehand Brush**: Paint custom redaction paths across complex shapes with adjustable brush sizes.
  - **Select & Transform**: Click to move, resize (8-point handles), or nudge regions with pixel precision.
- **📑 Non-Destructive Layers**:
  - Re-order, select, tweak parameters, or delete individual blur regions at any time.
  - Full **Undo / Redo** history stack (`Ctrl+Z` / `Ctrl+Y`).
  - **Hold to Compare**: Press Spacebar or hold the compare button to see the original unblurred image instantly.
- **⚡ Multiple Import & Export Options**:
  - Open images via **File Picker**, **Drag & Drop** (anywhere on the window), or direct **Paste (`Ctrl+V`)** from clipboard.
  - Built-in test sample generator to explore tools without uploading an image.
  - Export at original full resolution to **PNG**, **JPEG** (high quality), or modern **WebP**.

---

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

Run Blurrise in an isolated container using Docker:

```bash
docker compose up -d
```

Open your browser and navigate to:  
👉 **`http://localhost:8742`**

To stop the container:
```bash
docker compose down
```

### Option 2: Docker Build

```bash
# Build the image
docker build -t blurrise .

# Run the container
docker run -d -p 8742:80 --name blurrise blurrise
```

### Option 3: Direct Static File Server

Because Blurrise has **zero build steps and zero npm dependencies**, you can serve the `public/` directory with any static file server:

```bash
# Python 3
cd public && python3 -m http.server 8000

# Node.js (npx serve)
npx serve public

# PHP
php -S localhost:8000 -t public
```

---

## 🔒 Privacy & Security First

Blurrise is architected from the ground up for strict privacy:

1. **Air-Gapped Content Security Policy (CSP)**:
   The included [`nginx.conf`](nginx.conf) sets a strict header:
   ```http
   Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-ancestors 'none';
   ```
   The `connect-src 'none'` directive blocks all outbound network requests (`fetch`, `XMLHttpRequest`, `WebSocket`, `WebRTC`), technically guaranteeing your images cannot leave your machine.
2. **Zero External Assets**: All SVG icons and styles are bundled locally. No CDNs, external Google Fonts, or remote tracking scripts.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Z` / `Cmd + Z` | Undo last action |
| `Ctrl + Y` / `Cmd + Shift + Z` | Redo action |
| `Space` (Hold) | Compare with original unblurred image |
| `R` | Select **Rectangle** tool |
| `E` | Select **Ellipse** tool |
| `B` | Select **Brush** tool |
| `V` | Switch to **Select / Move** mode |
| `Arrow Keys` | Nudge selected region by 4px |
| `Shift + Arrow Keys` | Nudge selected region by 20px |
| `Alt + Arrow Keys` | Nudge selected region by 1px (fine-tune) |
| `Delete` / `Backspace` | Delete active blur region |
| `+` / `-` | Zoom in / Zoom out |
| `0` | Fit image to viewport |
| `Ctrl + V` | Paste image from clipboard |

---

## 🛠️ Tech Stack

- **Frontend**: Pure Vanilla HTML5, CSS3, ES6+ JavaScript
- **Canvas Engine**: HTML5 2D Canvas with offscreen multi-buffer compositing
- **Web Server**: Nginx 1.27 Alpine (with Gzip compression & security headers)
- **Containerization**: Docker & Docker Compose
- **Dependencies**: **0** (No npm, no React, no Tailwind, no external runtime libraries)

---

## 📂 Project Structure

```text
blurrise/
├── Dockerfile              # Minimal Alpine-based Nginx image
├── docker-compose.yml      # Local orchestration (port 8742)
├── nginx.conf              # Production Nginx config with strict CSP
├── public/                 # Static web application
│   ├── app.js              # Complete canvas engine & state management
│   ├── index.html          # Semantic application layout & toolbars
│   ├── styles.css          # Glassmorphism dark theme & layout styles
│   └── assets/
│       └── logo.svg        # Vector application logo & icon
└── README.md
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
