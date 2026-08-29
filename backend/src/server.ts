import express, { Request, Response } from 'express';
import cors from 'cors';
import { spawn } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

interface InfoRequestBody {
  url: string;
}

// 1. Fetch metadata
app.post('/api/info', (req: Request<{}, {}, InfoRequestBody>, res: Response) => {
  const { url } = req.body;
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  // Use a max buffer size in case of huge JSON outputs
  const ytdlp = spawn('yt-dlp', ['--dump-json', '--no-warnings', url]);
  let output = '';
  let errorOutput = '';

  ytdlp.stdout.on('data', (data: Buffer) => { output += data.toString(); });
  ytdlp.stderr.on('data', (data: Buffer) => { errorOutput += data.toString(); });

  ytdlp.on('close', (code: number) => {
    if (code !== 0) {
      res.status(500).json({ error: 'Failed to extract info', details: errorOutput });
      return;
    }
    try {
      const info = JSON.parse(output);
      
      const videoFormats = Array.from(new Set(
        (info.formats || [])
          .filter((f: any) => f.vcodec !== 'none' && f.height)
          .map((f: any) => f.height)
      )).sort((a: any, b: any) => b - a);

      const audioFormats = Array.from(new Set(
        (info.formats || [])
          .filter((f: any) => f.acodec !== 'none' && f.abr)
          .map((f: any) => Math.round(f.abr))
      )).sort((a: any, b: any) => b - a);

      res.json({
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration_string || info.duration,
        extractor: info.extractor_key,
        videoFormats,
        audioFormats
      });
    } catch (e) {
      res.status(500).json({ error: 'Invalid JSON metadata returned' });
    }
  });
});

// 2. Download audio or video (using temp file to ensure proper muxing/headers)
app.get('/api/download', (req: Request, res: Response) => {
  const url = req.query.url as string;
  const mediaType = req.query.mediaType as string; // 'video' or 'audio'
  const ext = req.query.ext as string; // e.g. 'mp4', 'webm', 'mp3', 'wav'
  const videoRes = req.query.videoRes as string;
  const audioKbps = req.query.audioKbps as string;
  
  if (!url) {
    res.status(400).send('URL is required');
    return;
  }

  const tmpId = require('crypto').randomBytes(16).toString('hex');
  const tmpFile = require('path').join(require('os').tmpdir(), `dl-${tmpId}.${ext}`);

  let args: string[] = [];

  if (mediaType === 'audio') {
    const audioQuality = audioKbps ? `${audioKbps}K` : '0';

    args = [
      '-x',
      '--audio-format', ext,
      '--audio-quality', audioQuality,
      '-o', tmpFile, 
      url
    ];
  } else {
    let videoFormat = `bestvideo[ext=${ext}]+bestaudio/best[ext=${ext}]/best`;
    if (videoRes) {
      videoFormat = `bestvideo[ext=${ext}][height<=${videoRes}]+bestaudio/best[ext=${ext}][height<=${videoRes}]/best`;
    }

    args = [
      '-f', videoFormat,
      '--merge-output-format', ext,
      '-o', tmpFile, 
      url
    ];
  }

  const ytdlp = spawn('yt-dlp', args);
  let errorOutput = '';

  ytdlp.stderr.on('data', (data: Buffer) => {
    errorOutput += data.toString();
    console.error(`yt-dlp stderr: ${data}`);
  });

  ytdlp.on('close', (code) => {
    if (code === 0) {
      const filename = mediaType === 'audio' ? `audio.${ext}` : `video.${ext}`;
      res.download(tmpFile, filename, (err) => {
        require('fs').unlink(tmpFile, () => {});
      });
    } else {
      res.status(500).send('Error downloading media');
    }
  });

  req.on('close', () => {
    // If client disconnects early, kill process and clean up
    ytdlp.kill('SIGKILL');
    setTimeout(() => require('fs').unlink(tmpFile, () => {}), 1000);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));