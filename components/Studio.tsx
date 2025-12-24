import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Trash2, Eye, EyeOff, Settings
} from 'lucide-react';
import { Scene, Source, StreamMetrics, StreamState } from '../types';
import { Button } from './ui/Button';

// --- Source Renderer with URL Resolution and Controls ---
const SourceRenderer: React.FC<{
  source: Source;
  index: number;
  onStreamReady: (id: string, stream: MediaStream, element?: HTMLVideoElement | HTMLImageElement) => void;
}> = ({ source, index, onStreamReady }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastEmittedStreamRef = useRef<string | null>(null);

  const emitStream = useCallback((id: string, stream: MediaStream, element?: any) => {
    const streamId = `${id}-${stream.id}`;
    if (lastEmittedStreamRef.current === streamId) return;
    lastEmittedStreamRef.current = streamId;
    onStreamReady(id, stream, element);
  }, [onStreamReady]);

  useEffect(() => {
    if (!source.visible) return;

    const init = async () => {
      try {
        let stream: MediaStream | null = null;

        if (source.type === 'webcam') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } else if (source.type === 'screen') {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else if (source.type === 'audio_source') {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } else if (source.type === 'local_file' && source.config.file) {
          setResolvedUrl(URL.createObjectURL(source.config.file));
        } else if (source.type === 'image' && source.config.url) {
          // Handle Image
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = source.config.url;
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });

          const canvas = document.createElement('canvas');
          canvas.width = 1920;
          canvas.height = 1080;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width / 2) - (img.width / 2) * scale;
            const y = (canvas.height / 2) - (img.height / 2) * scale;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            stream = canvas.captureStream(30);
            const actx = new AudioContext();
            const dest = actx.createMediaStreamDestination();
            const silence = actx.createOscillator();
            silence.connect(dest);
            stream.addTrack(dest.stream.getAudioTracks()[0]);
            emitStream(source.id, stream, img);
          }
        } else if (source.type === 'remote_url' && source.config.url) {
          // Resolve URL via backend
          // dependency: source.config.url
          if (!source.config.url.match(/\.(mp4|webm|m3u8)$/i)) {
            try {
              const res = await fetch('/api/tools/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: source.config.url })
              });
              const data = await res.json();
              if (data.url) setResolvedUrl(data.url);
            } catch (e) { setError('Failed to resolve video'); }
          } else {
            setResolvedUrl(source.config.url);
          }
        }

        if (stream && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => { }); // Force attempt to play
          emitStream(source.id, stream, videoRef.current);
        }
      } catch (e) {
        console.error("Source init error:", e);
        setError("Source unavailable");
      }
    };
    init();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
    // Only re-run when these specific fields change, NOT the whole source object
  }, [source.id, source.type, source.config.url, source.visible]);

  // Capture stream from video element (for files/remote urls)
  useEffect(() => {
    if (resolvedUrl && videoRef.current) {
      const handleLoaded = () => {
        // @ts-ignore - captureStream exists
        if (videoRef.current?.captureStream) {
          // @ts-ignore
          const stream = videoRef.current.captureStream();
          emitStream(source.id, stream, videoRef.current || undefined);
        }
      };

      // Register immediately if already loaded, or wait for one frame
      if (videoRef.current.readyState >= 2) handleLoaded();
      else videoRef.current.addEventListener('loadeddata', handleLoaded);

      return () => videoRef.current?.removeEventListener('loadeddata', handleLoaded);
    }
  }, [resolvedUrl, emitStream, source.id]);

  useEffect(() => {
    if (videoRef.current) {
      if (source.playing === false && !videoRef.current.paused) {
        videoRef.current.pause();
      }
      if (source.playing !== false && videoRef.current.paused) {
        // Attempt unmuted play first, browser may allow it due to 'Start Streaming' click
        videoRef.current.muted = false;
        videoRef.current.play().catch(e => {
          if (e.name === 'AbortError') {
            // Expected if a new load interrupted us
            return;
          }
          console.warn("Unmuted autoplay blocked, falling back to muted:", e);
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => { });
          }
        });
      }
    }
  }, [source.playing]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const style: React.CSSProperties = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', zIndex: index };
  if (!source.visible) return null;

  if (source.type === 'image') {
    return (
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: index }}>
        {source.config.url && <img src={source.config.url} style={style} alt="" className="object-contain w-full h-full" />}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: index }}>
      {resolvedUrl ? (
        <video
          ref={videoRef} src={resolvedUrl} style={style}
          autoPlay playsInline loop muted={false}
          onVolumeChange={() => { }} // Keep internal volume up for capture
          className="pointer-events-auto" crossOrigin="anonymous"
          onError={(e) => {
            console.error("Video error", e);
            if (resolvedUrl?.includes('youtube.com') || resolvedUrl?.includes('youtu.be')) {
              setError("YouTube playback requires a public 'Watch' link. Studio/Edit links are not supported.");
            } else {
              setError("Failed to load media (CORS or Invalid URL)");
            }
          }}
        />
      ) : (
        <video ref={videoRef} style={style} autoPlay playsInline muted className="pointer-events-auto" />
      )}

      {/* Controls Overlay */}
      {(source.type === 'remote_url' || source.type === 'local_file') && (
        <div className="absolute bottom-4 left-4 z-50 flex space-x-2 pointer-events-auto bg-black/50 p-2 rounded backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity">
          <button onClick={togglePlay} className="text-white hover:text-indigo-400">
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span className="text-xs text-white truncate max-w-[100px]">{source.name}</span>
        </div>
      )}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 text-red-500">{error}</div>}
    </div>
  );
};

// --- Main Studio ---
interface StudioProps {
  currentScene: Scene | null;
  scenes: Scene[];
  streamState: StreamState;
  metrics: StreamMetrics;
  onStreamAction: () => void;
  onStreamDataAvailable: (data: Blob) => void;
  onSceneSelect: (id: string) => void;
  onAddScene: () => void;
  onRemoveScene: (id: string) => void;
  onAddSource: (sid: string) => void;
  onRemoveSource: (sid: string, id: string) => void;
  onToggleMute: (sid: string, id: string) => void;
  onVolumeChange: (sid: string, id: string, volume: number) => void;
  onToggleSourceVisibility: (sid: string, id: string) => void;
  onTogglePlay: (sid: string, id: string) => void;
  bitrate?: number;
  // dummy props for compatibility
  isRecording?: boolean; isVirtualCamActive?: boolean; isStudioMode?: boolean;
  onRecordAction?: any; onVirtualCamAction?: any; onStudioModeAction?: any; onMoveScene?: any; onMoveSource?: any; onEditSource?: any;
}

export const Studio: React.FC<StudioProps> = ({
  currentScene, scenes, streamState, metrics, onStreamAction, onStreamDataAvailable,
  onSceneSelect, onAddScene, onRemoveScene, onAddSource, onRemoveSource, onToggleMute, onVolumeChange, onToggleSourceVisibility,
  onTogglePlay, onRecordAction, isRecording, bitrate
}) => {
  const activeStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const gainNodesRef = useRef<Map<string, { gain: GainNode, source: MediaStreamAudioSourceNode }>>(new Map());
  const streamStateRef = useRef(streamState);
  const isRecordingRef = useRef(isRecording);
  const currentSceneRef = useRef(currentScene);
  const cumulativeBytesRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const [streamCounter, setStreamCounter] = useState(0);

  useEffect(() => {
    streamStateRef.current = streamState;
    if (streamState === StreamState.LIVE && !startTimeRef.current) {
      startTimeRef.current = Date.now();
      cumulativeBytesRef.current = 0;
      if (audioContextRef.current) audioContextRef.current.resume().catch(() => { });
    } else if (streamState !== StreamState.LIVE) {
      startTimeRef.current = null;
    }
  }, [streamState]);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { currentSceneRef.current = currentScene; }, [currentScene]);

  // Init Audio Context
  useEffect(() => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const dest = ctx.createMediaStreamDestination();
      audioContextRef.current = ctx;
      audioDestRef.current = dest;
    }
  }, []);

  // Audio Mixing & Compositing Loop
  useEffect(() => {
    if (!audioContextRef.current || !audioDestRef.current || !currentScene) return;
    const ctx = audioContextRef.current;
    const dest = audioDestRef.current;

    if (ctx.state === 'suspended') ctx.resume().catch(() => { });

    // Monitor for volume changes and update gain nodes
    currentScene.sources.forEach(source => {
      const stream = activeStreamsRef.current.get(source.id);
      if (stream && stream.getAudioTracks().length > 0) {
        let nodeRef = gainNodesRef.current.get(source.id);

        // If node exists but source stream is different, disconnect and re-create
        // This handles cases where a source URL is updated (e.g. YouTube rotation)
        if (nodeRef && nodeRef.source.mediaStream !== stream) {
          console.log(`[AudioMixer] Source ${source.id} stream changed, reconnecting...`);
          nodeRef.source.disconnect();
          nodeRef.gain.disconnect();
          gainNodesRef.current.delete(source.id);
          nodeRef = undefined;
        }

        if (!nodeRef) {
          try {
            console.log(`[AudioMixer] Connecting audio for source: ${source.name || source.id}`);
            const sourceNode = ctx.createMediaStreamSource(stream);
            const gainNode = ctx.createGain();
            sourceNode.connect(gainNode);
            gainNode.connect(dest);
            nodeRef = { gain: gainNode, source: sourceNode };
            gainNodesRef.current.set(source.id, nodeRef);
          } catch (e) {
            console.error(`[AudioMixer] Failed to connect source ${source.id}:`, e);
          }
        }

        if (nodeRef) {
          nodeRef.gain.gain.value = source.config.muted ? 0 : (source.config.volume || 100) / 100;
        }
      }
    });

    // Cleanup nodes...
    const sourceIds = new Set(currentScene.sources.map(s => s.id));
    gainNodesRef.current.forEach((node, id) => {
      if (!sourceIds.has(id)) {
        node.source.disconnect();
        node.gain.disconnect();
        gainNodesRef.current.delete(id);
      }
    });

    return () => { };
  }, [currentScene, scenes, streamCounter]);

  const activeElementsRef = useRef<Map<string, HTMLVideoElement | HTMLImageElement>>(new Map());

  const handleStreamReady = useCallback((id: string, stream: MediaStream, element?: HTMLVideoElement | HTMLImageElement) => {
    activeStreamsRef.current.set(id, stream);
    if (element) activeElementsRef.current.set(id, element);
    setStreamCounter(c => c + 1);
  }, []);

  // Streaming/Recording Logic
  useEffect(() => {
    const isStreaming = streamState === StreamState.LIVE;
    if ((isStreaming || isRecording) && audioDestRef.current) {
      if (!canvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        canvasRef.current = canvas;
      }

      const canvas = canvasRef.current;
      const cctx = canvas.getContext('2d', { alpha: false });

      let compositeTimer: any;
      const composite = () => {
        const currentScene = currentSceneRef.current;
        if (!cctx || !currentScene) return;

        cctx.fillStyle = 'black';
        cctx.fillRect(0, 0, canvas.width, canvas.height);

        currentScene.sources.forEach(src => {
          if (!src.visible) return;
          const el = activeElementsRef.current.get(src.id);
          if (el) {
            try {
              cctx.drawImage(el, 0, 0, canvas.width, canvas.height);
            } catch (e) {
              // Usually means video not ready or CORS issue
            }
          }
        });

        // --- HUD Overlay ---
        if (streamStateRef.current === StreamState.LIVE) {
          const padding = 10;
          const hudHeight = 35;
          const hudWidth = 450;
          cctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          cctx.fillRect(canvas.width - hudWidth - padding, padding, hudWidth, hudHeight);

          cctx.fillStyle = 'white';
          cctx.font = '12px Inter, sans-serif';

          const totalMB = (cumulativeBytesRef.current / (1024 * 1024)).toFixed(2);
          const elapsedSec = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
          const h = Math.floor(elapsedSec / 3600).toString().padStart(2, '0');
          const m = Math.floor((elapsedSec % 3600) / 60).toString().padStart(2, '0');
          const s = (elapsedSec % 60).toString().padStart(2, '0');
          const duration = `${h}:${m}:${s}`;

          cctx.fillText(`BITRATE: ${bitrate} kbps`, canvas.width - hudWidth + 5, padding + 22);
          cctx.fillText(`DATA: ${totalMB} MB`, canvas.width - hudWidth + 140, padding + 22);
          cctx.fillText(`DURATION: ${duration}`, canvas.width - hudWidth + 260, padding + 22);
          cctx.fillText(`FPS: 30`, canvas.width - hudWidth + 390, padding + 22);

          // Indicator
          cctx.fillStyle = '#ef4444';
          cctx.beginPath();
          cctx.arc(canvas.width - hudWidth - padding - 15, padding + 17, 5, 0, Math.PI * 2);
          cctx.fill();
        }

        // Live text indicator
        cctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        cctx.fillRect(10, 10, 50, 22);
        cctx.fillStyle = 'white';
        cctx.font = 'bold 12px Inter, sans-serif';
        cctx.fillText('LIVE', 18, 26);
        cctx.font = '10px Inter, sans-serif';
        cctx.fillText(new Date().toLocaleTimeString(), 65, 25);
      };

      // Run compositor at ~30fps
      // Note: setInterval is throttled to 1s in background tabs unless audio is playing.
      // Since we are capturing a stream with audio, the audio clock should keep us alive.
      compositeTimer = setInterval(composite, 1000 / 30);

      const videoStream = canvas.captureStream(30);
      const mixedAudioTrack = audioDestRef.current.stream.getAudioTracks()[0];

      if (mixedAudioTrack) {
        console.log("[Audio] Success: Found mixed audio track for stream.");
      } else {
        console.warn("[Audio] Warning: No audio tracks found in mixer destination.");
      }

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...(mixedAudioTrack ? [mixedAudioTrack] : [])
      ]);

      try {
        const recorder = new MediaRecorder(combinedStream, {
          mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
            ? 'video/webm;codecs=vp8,opus'
            : 'video/webm',
          videoBitsPerSecond: (bitrate || 1500) * 1000
        });

        recorder.onerror = (e) => console.error('MediaRecorder error:', e);
        recorder.onstart = () => console.log('MediaRecorder started, state:', recorder.state);

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            const isLive = streamStateRef.current === StreamState.LIVE;
            console.log(`MediaRecorder data: ${e.data.size} bytes. isLive=${isLive}, state=${streamStateRef.current}`);

            if (isLive) {
              cumulativeBytesRef.current += e.data.size;
              onStreamDataAvailable(e.data);
            }
            if (isRecordingRef.current) recordingChunksRef.current.push(e.data);
          } else {
            console.warn('MediaRecorder produced empty chunk');
          }
        };

        recorder.onstop = () => {
          console.log('MediaRecorder stopped');
          if (recordingChunksRef.current.length > 0) {
            const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `recording-${Date.now()}.webm`;
            a.click();
            recordingChunksRef.current = [];
          }
        };

        recorder.start(200); // 200ms timeslice for better flow
        recorderRef.current = recorder;
      } catch (e) {
        console.error("Recorder initialization error:", e);
      }

      return () => {
        console.log('Cleaning up Streaming effect');
        if (compositeTimer) clearInterval(compositeTimer);
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      };
    }
  }, [streamState, isRecording, audioDestRef.current, bitrate]); // Note: bitrate is now a dependency

  return (
    <main className="flex-1 flex flex-col bg-zinc-900 overflow-hidden relative">
      <div className="flex-1 p-4 flex flex-col bg-zinc-900/50 relative">
        <div className="relative bg-black rounded-lg border border-zinc-800 flex-1 flex flex-col overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            {currentScene?.sources.map((src, idx) => (
              <SourceRenderer key={src.id} source={src} index={idx} onStreamReady={handleStreamReady} />
            ))}
          </div>
        </div>
      </div>

      <div className="h-64 bg-zinc-950 border-t border-zinc-800 flex divide-x divide-zinc-800 shrink-0">
        <div className="w-56 p-2 flex flex-col">
          <h4 className="text-xs font-bold text-zinc-400 uppercase mb-2">Scenes</h4>
          <div className="flex-1 overflow-y-auto">
            {scenes.map(s => (
              <div key={s.id} onClick={() => onSceneSelect(s.id)}
                className={`p-2 mb-1 rounded cursor-pointer ${currentScene?.id === s.id ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-400'}`}>
                {s.name}
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2 w-full border border-dashed border-zinc-700" onClick={onAddScene}>+ Add Scene</Button>
        </div>

        <div className="w-56 p-2 flex flex-col">
          <h4 className="text-xs font-bold text-zinc-400 uppercase mb-2">Sources</h4>
          <div className="flex-1 overflow-y-auto space-y-1">
            {currentScene?.sources.map(s => (
              <div key={s.id} className="p-2 bg-zinc-900 rounded text-zinc-300 flex justify-between items-center group">
                <span className="truncate text-sm">{s.name}</span>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100">
                  {(s.type === 'remote_url' || s.type === 'local_file') && (
                    <button onClick={() => onTogglePlay(currentScene.id, s.id)} className="hover:text-amber-400">
                      {s.playing === false ? <Play size={12} /> : <Pause size={12} />}
                    </button>
                  )}
                  <button onClick={() => onToggleSourceVisibility(currentScene.id, s.id)} className="hover:text-white">
                    {s.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button onClick={() => onRemoveSource(currentScene.id, s.id)} className="hover:text-red-400"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" className="mt-2 w-full border border-dashed border-zinc-700" onClick={() => currentScene && onAddSource(currentScene.id)}>+ Add Source</Button>
        </div>

        <div className="flex-1 p-2 flex flex-col">
          <h4 className="text-xs font-bold text-zinc-400 uppercase mb-2">Audio Mixer</h4>
          <div className="flex-1 overflow-y-auto space-y-2">
            {currentScene?.sources.map(s => (
              <div key={s.id} className="flex items-center space-x-2">
                <span className="text-[10px] w-20 truncate text-zinc-400">{s.name}</span>
                <button onClick={() => onToggleMute(currentScene.id, s.id)} className={`p-1 rounded ${s.config.muted ? 'text-red-500 bg-red-900/20' : 'text-green-500 bg-green-900/20'}`}>
                  {s.config.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  value={s.config.volume || 100}
                  onChange={(e) => onVolumeChange(currentScene.id, s.id, parseInt(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="w-56 p-4 space-y-2 bg-zinc-900/20">
          <Button variant={streamState === StreamState.LIVE ? 'danger' : 'primary'} size="sm" className="w-full" onClick={() => {
            // Explicitly resume audio context on user gesture
            if (audioContextRef.current?.state === 'suspended') {
              console.log("[Audio] Resuming audio context on user gesture...");
              audioContextRef.current.resume().catch(e => console.error("Gesture resume failed:", e));
            }
            onStreamAction();
          }}>
            {streamState === StreamState.LIVE ? 'Stop Streaming' : 'Start Streaming'}
          </Button>
          <Button variant={isRecording ? 'danger' : 'secondary'} size="sm" className="w-full" onClick={() => onRecordAction && onRecordAction(!isRecording)}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </Button>
          <div className="text-center text-xs text-zinc-500 mt-2">
            {streamState === StreamState.LIVE ? <span className="text-red-500 animate-pulse">● Live</span> : <span>Offline</span>}
          </div>
        </div>
      </div>
    </main>
  );
};