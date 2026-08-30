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
  const ytdlp = spawn('yt-dlp', ['--dump-single-json', '--flat-playlist', '--no-warnings', url]);
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
      
      if (info._type === 'playlist' || info.playlist_count > 1 || info.entries) {
        res.json({
          isPlaylist: true,
          playlistCount: info.playlist_count || info.entries?.length || 0,
          entries: info.entries?.map((e: any) => ({ url: e.url, title: e.title })) || [],
          title: info.title || 'Playlist',
          thumbnail: info.thumbnails?.[0]?.url || info.entries?.[0]?.thumbnails?.[0]?.url || '',
          duration: null,
          extractor: info.extractor_key,
          videoFormats: [],
          audioFormats: []
        });
        return;
      }

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
        isPlaylist: false,
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

const tasks = new Map<string, {
  status: 'processing' | 'done' | 'error';
  progress: string;
  file?: string;
  filename?: string;
}>();

// 2. Prepare download (starts background task)
app.post('/api/prepare', (req: Request, res: Response) => {
  const { url, mediaType, ext, videoRes, audioKbps, title, startTime, endTime } = req.body;
  if (!url) {
    res.status(400).send('URL is required');
    return;
  }

  const taskId = require('crypto').randomBytes(16).toString('hex');
  const tmpFile = require('path').join(require('os').tmpdir(), `dl-${taskId}.${ext}`);

  tasks.set(taskId, { status: 'processing', progress: 'Starting download...' });
  res.json({ taskId });

  let args: string[] = [];

  if (mediaType === 'audio') {
    const audioQuality = audioKbps ? `${audioKbps}K` : '0';
    args = [ '--newline', '--embed-metadata', '--embed-thumbnail', '-x', '--audio-format', ext, '--audio-quality', audioQuality, '-o', tmpFile, url ];
  } else {
    let videoFormat = `bestvideo[ext=${ext}]+bestaudio/best[ext=${ext}]/best`;
    if (videoRes) {
      videoFormat = `bestvideo[ext=${ext}][height<=${videoRes}]+bestaudio/best[ext=${ext}][height<=${videoRes}]/best`;
    }
    args = [ '--newline', '--embed-metadata', '--embed-thumbnail', '-f', videoFormat, '--merge-output-format', ext, '-o', tmpFile, url ];
  }

  if (startTime || endTime) {
    const start = startTime || '0';
    const end = endTime || 'inf';
    args.push('--download-sections', `*${start}-${end}`, '--force-keyframes-at-cuts');
  }

  const ytdlp = spawn('yt-dlp', args);

  ytdlp.stdout.on('data', (data: Buffer) => {
    const output = data.toString();
    const task = tasks.get(taskId);
    if (!task) return;
    
    const match = output.match(/\[download\]\s+([\d\.]+)%/);
    if (match) {
      task.progress = `Downloading... ${match[1]}%`;
    } else if (output.includes('[Merger]')) {
      task.progress = 'Merging video and audio...';
    } else if (output.includes('[ExtractAudio]')) {
      task.progress = 'Extracting audio...';
    }
  });

  ytdlp.stderr.on('data', (data: Buffer) => {
    console.error(`yt-dlp stderr: ${data}`);
  });

  ytdlp.on('close', (code) => {
    const task = tasks.get(taskId);
    if (!task) return;

    if (code === 0) {
      let filename = mediaType === 'audio' ? `audio.${ext}` : `video.${ext}`;
      if (title) {
        const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').trim();
        if (safeTitle) filename = `${safeTitle}.${ext}`;
      }
      task.status = 'done';
      task.file = tmpFile;
      task.filename = filename;
      task.progress = 'Complete!';
    } else {
      task.status = 'error';
      task.progress = 'Error processing media.';
    }
  });
});

// 3. Get task status
app.get('/api/status/:taskId', (req: Request, res: Response) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({ status: task.status, progress: task.progress });
});

// 4. Download finished file
app.get('/api/download/:taskId', (req: Request, res: Response) => {
  const task = tasks.get(req.params.taskId);
  if (!task || task.status !== 'done' || !task.file) {
    res.status(400).send('File not ready or not found');
    return;
  }

  res.download(task.file, task.filename || 'download', (err) => {
    require('fs').unlink(task.file, () => {});
    tasks.delete(req.params.taskId);
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));