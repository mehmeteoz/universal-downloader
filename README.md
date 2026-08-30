# Universal Media Downloader

A sleek, self-hosted web application for downloading videos and audio from hundreds of platforms (YouTube, Instagram, TikTok, etc.) using `yt-dlp` and `ffmpeg`.

## Tech Stack
- **Frontend:** React, TypeScript, Vite, Lucide Icons
- **Backend:** Node.js, Express, TypeScript
- **Engine:** `yt-dlp` (for extraction) and `ffmpeg` (for muxing/metadata)
- **Deployment:** Docker, Docker Compose, Nginx

## Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- Python 3 and FFmpeg (required for `yt-dlp`)
- Docker (optional, for containerized running)

### Running with Docker (Recommended)
You can build and start the entire stack with a single command:
```bash
docker compose up -d --build
```

### Running Manually

**1. Start the Backend**
```bash
cd backend
npm install
npm run dev
```

**2. Start the Frontend**
```bash
cd frontend
npm install
npm run dev
```

## Production Deployment
The application is configured to be securely hosted behind a reverse proxy (like Nginx) under a specific subpath (e.g., `/udownloader`). 

If deploying to a Linux server with an Nginx reverse proxy:
1. Ensure your `docker-compose.yml` maps the frontend to an open port (e.g., `8080:80`).
2. Run `docker compose up -d --build`.
3. Configure your host Nginx to proxy traffic to the container without modifying the path:
```nginx
location /udownloader {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

## Legal Disclaimer
This tool is provided for educational and personal use only. Users are strictly prohibited from downloading copyrighted material without explicit permission from the copyright owner. The server does not permanently store, cache, or host any downloaded content.
