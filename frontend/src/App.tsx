import React, { useState } from 'react';
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

  const handleDownload = () => {
    let downloadUrl = `/api/download?url=${encodeURIComponent(url)}&mediaType=${mediaType}&ext=${ext}&videoRes=${videoRes}&audioKbps=${audioKbps}`;
    if (info?.title) {
      downloadUrl += `&title=${encodeURIComponent(info.title)}`;
    }
    window.open(downloadUrl, '_blank');
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
          <button className="btn" onClick={fetchInfo} disabled={loading || !url}>
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
                  onChange={() => {
                    setMediaType('audio');
                    setExt('mp3');
                  }} 
                />
                <FileAudio size={18} /> Audio
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <div className="options-group" style={{ flex: 1 }}>
              <h4>Format ({mediaType})</h4>
              <select 
                className="input" 
                value={ext} 
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
                    onChange={e => setVideoRes(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {info.videoFormats.map(res => (
                      <option key={res} value={res}>{res}p (or lower)</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', padding: '12px 0' }}>Best available</p>
                )
              ) : (
                info.audioFormats && info.audioFormats.length > 0 ? (
                  <select 
                    className="input" 
                    value={audioKbps} 
                    onChange={e => setAudioKbps(e.target.value)}
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    {info.audioFormats.map(kbps => (
                      <option key={kbps} value={kbps}>{kbps} kbps</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', padding: '12px 0' }}>Best available</p>
                )
              )}
            </div>
          </div>

          <div className="actions">
            <button className="btn" onClick={handleDownload}>
              <Download size={20} /> Download {ext.toUpperCase()}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}