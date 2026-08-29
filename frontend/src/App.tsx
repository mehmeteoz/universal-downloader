import React, { useState, useEffect } from 'react';
import { Download, Search, AlertCircle, FileVideo, FileAudio, Clock, Image as ImageIcon } from 'lucide-react';
import './App.css';

interface MediaInfo {
  title: string;
  thumbnail: string;
  duration: string | number;
  extractor: string;
  videoFormats: number[];
  audioFormats: number[];
}

type MediaType = 'video' | 'audio';

const VIDEO_EXTS = ['mp4', 'webm', 'mkv'];
const AUDIO_EXTS = ['mp3', 'm4a', 'wav', 'flac'];

export default function App() {
  const [url, setUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [ext, setExt] = useState<string>('mp4');
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  const [videoRes, setVideoRes] = useState<string>('');
  const [audioKbps, setAudioKbps] = useState<string>('');
  
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');

  useEffect(() => {
    const active = localStorage.getItem('activeDownload');
    if (active) {
      try {
        const data = JSON.parse(active);
        
        setUrl(data.url);
        setMediaType(data.mediaType);
        setExt(data.ext);
        if (data.videoRes) setVideoRes(data.videoRes);
        if (data.audioKbps) setAudioKbps(data.audioKbps);
        setIsDownloading(true);
        setDownloadProgress('Resuming...');
        
        fetch('/api/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: data.url })
        }).then(res => res.json()).then(infoData => {
          if (!infoData.error) setInfo(infoData);
        }).catch(() => {});

        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/status/${data.taskId}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setDownloadProgress(statusData.progress);
              
              if (statusData.status === 'done') {
                clearInterval(interval);
                setIsDownloading(false);
                setDownloadProgress('');
                localStorage.removeItem('activeDownload');
                window.location.href = `/api/download/${data.taskId}`;
              } else if (statusData.status === 'error') {
                clearInterval(interval);
                setIsDownloading(false);
                setDownloadProgress('');
                setError('Server failed to process the media.');
                localStorage.removeItem('activeDownload');
              }
            } else if (statusRes.status === 404) {
              clearInterval(interval);
              setIsDownloading(false);
              setDownloadProgress('');
              localStorage.removeItem('activeDownload');
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 1000);
      } catch (e) {
        localStorage.removeItem('activeDownload');
      }
    }
  }, []);

  const fetchInfo = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setInfo(null);
    
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Could not fetch media info.');
      }
      
      const data: MediaInfo = await res.json();
      setInfo(data);
      
      if (data.videoFormats && data.videoFormats.length > 0) {
        setVideoRes(data.videoFormats[0].toString());
      }
      if (data.audioFormats && data.audioFormats.length > 0) {
        setAudioKbps(data.audioFormats[0].toString());
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadProgress('Preparing...');
    setError('');

    try {
      const res = await fetch('/api/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, mediaType, ext, videoRes, audioKbps, title: info?.title 
        })
      });

      if (!res.ok) throw new Error('Failed to prepare download');
      const { taskId } = await res.json();

      localStorage.setItem('activeDownload', JSON.stringify({
        taskId, url, mediaType, ext, videoRes, audioKbps
      }));

      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/status/${taskId}`);
          if (statusRes.ok) {
            const data = await statusRes.json();
            setDownloadProgress(data.progress);
            
            if (data.status === 'done') {
              clearInterval(interval);
              setIsDownloading(false);
              setDownloadProgress('');
              localStorage.removeItem('activeDownload');
              window.location.href = `/api/download/${taskId}`;
            } else if (data.status === 'error') {
              clearInterval(interval);
              setIsDownloading(false);
              setDownloadProgress('');
              setError('Server failed to process the media.');
              localStorage.removeItem('activeDownload');
            }
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 1000);
    } catch (err) {
      setIsDownloading(false);
      setDownloadProgress('');
      setError('Failed to initiate download.');
    }
  };

  const downloadThumbnail = () => {
    if (!info?.thumbnail) return;
    window.open(info.thumbnail, '_blank');
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Media Downloader</h1>
        <p>Save content from YouTube, Instagram, TikTok & more</p>
      </div>

      <div className="card">
        <div className="input-group">
          <input
            type="text"
            className="input"
            placeholder="Paste media link here..."
            value={url}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
          />
          <button className="btn" onClick={fetchInfo} disabled={loading || isDownloading || !url}>
            {loading ? 'Checking...' : <><Search size={18} /> Inspect</>}
          </button>
        </div>

        {error && (
          <div className="error">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
      </div>

      {info && (
        <div className="card" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="media-info">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {info.thumbnail ? (
                <img src={info.thumbnail} alt="Thumbnail" className="thumbnail" />
              ) : (
                <div className="thumbnail" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileVideo size={32} color="#94a3b8" />
                </div>
              )}
              {info.thumbnail && (
                <button 
                  onClick={downloadThumbnail} 
                  style={{ background: 'none', border: '1px solid var(--border)', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <ImageIcon size={14} /> Get Thumb
                </button>
              )}
            </div>
            
            <div className="info-text">
              <h3>{info.title}</h3>
              <p>
                <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#3b82f6' }}>{info.extractor}</span>
                {info.duration && (
                  <>
                    <span style={{ margin: '0 6px' }}>•</span>
                    <Clock size={14} style={{ marginRight: 4 }} /> {info.duration}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="options-group">
            <h4>Media Type</h4>
            <div className="radio-group">
              <label className="radio-label">
                <input 
                  type="radio" 
                  value="video" 
                  checked={mediaType === 'video'} 
                  disabled={isDownloading}
                  onChange={() => {
                    setMediaType('video');
                    setExt('mp4');
                  }} 
                />
                <FileVideo size={18} /> Video
              </label>
              <label className="radio-label">
                <input 
                  type="radio" 
                  value="audio" 
                  checked={mediaType === 'audio'} 
                  disabled={isDownloading}
                  onChange={() => {
                    setMediaType('audio');
                    setExt('mp3');
                  }} 
                />
                <FileAudio size={18} /> Audio
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <div className="options-group" style={{ flex: 1 }}>
              <h4>Format ({mediaType})</h4>
              <select 
                className="input" 
                value={ext} 
                disabled={isDownloading}
                onChange={e => setExt(e.target.value)}
                style={{ width: '100%', cursor: 'pointer' }}
              >
                {mediaType === 'video' 
                  ? VIDEO_EXTS.map(e => <option key={e} value={e}>.{e}</option>)
                  : AUDIO_EXTS.map(e => <option key={e} value={e}>.{e}</option>)
                }
              </select>
            </div>

            <div className="options-group" style={{ flex: 1 }}>
              <h4>Quality Selection</h4>
              {mediaType === 'video' ? (
                info.videoFormats && info.videoFormats.length > 0 ? (
                  <select 
                    className="input" 
                    value={videoRes} 
                    disabled={isDownloading}
                    onChange={e => setVideoRes(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {info.videoFormats.map(res => (
                      <option key={res} value={res}>{res}p</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '12px 0' }}>Best available</p>
                )
              ) : (
                info.audioFormats && info.audioFormats.length > 0 ? (
                  <select 
                    className="input" 
                    value={audioKbps} 
                    disabled={isDownloading}
                    onChange={e => setAudioKbps(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {info.audioFormats.map(kbps => (
                      <option key={kbps} value={kbps}>{kbps} kbps</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '12px 0' }}>Best available</p>
                )
              )}
            </div>
          </div>

          <div className="actions">
            {(() => {
              let progressPercent = 0;
              if (downloadProgress.includes('Merging') || downloadProgress.includes('Extracting')) {
                progressPercent = 100;
              } else {
                const match = downloadProgress.match(/([\d\.]+)%/);
                if (match) progressPercent = parseFloat(match[1]);
              }
              
              return (
                <button 
                  className={`btn ${isDownloading ? 'downloading' : ''}`} 
                  onClick={handleDownload} 
                  disabled={isDownloading}
                  style={isDownloading ? { '--progress': `${progressPercent}%` } as React.CSSProperties : {}}
                >
                  {isDownloading ? (
                    <span>{downloadProgress || 'Downloading...'}</span>
                  ) : (
                    <><Download size={20} /> Download {ext.toUpperCase()}</>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}