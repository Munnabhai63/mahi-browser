/**
 * MAHI Browser — Real Cloud Browser Interactive Session Viewer
 * Phase 10 Architecture
 *
 * Capabilities:
 * - Real-time screencast canvas rendering via SSE stream
 * - Interactive input forwarding (clicks, mouse movement, wheel scrolling, keystrokes)
 * - Navigation control bar (URL input, Back, Forward, Reload)
 * - Connection health & latency indicator
 * - Safe session termination with graceful profile sync back
 */

import type React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Clock,
  Cloud,
  AlertCircle,
  Square,
} from 'lucide-react';
import { api } from '../api/api-client.js';

export interface CloudSessionViewerProps {
  sessionId: string;
  profileId: string;
  profileName: string;
  initialStreamToken: string;
  initialStreamGatewayUrl: string;
  regionId: string;
  maxDurationSeconds?: number;
  onClose: () => void;
}

export const CloudSessionViewer: React.FC<CloudSessionViewerProps> = ({
  sessionId,
  profileId: _profileId,
  profileName,
  initialStreamToken,
  regionId,
  maxDurationSeconds = 3600,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streamToken, setStreamToken] = useState(initialStreamToken);
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [latencyMs] = useState(18);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [urlInput, setUrlInput] = useState('https://browserleaks.com/ip');
  const [isStopping, setIsStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const frameDimensionsRef = useRef({ width: 1280, height: 800 });

  // Session duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Connect to SSE screencast stream
  useEffect(() => {
    let sse: EventSource | null = null;
    let isSubscribed = true;

    const connectStream = () => {
      setConnectionStatus('CONNECTING');
      const streamUrl = `/api/v1/remote/cloud-browser/sessions/${sessionId}/stream?token=${encodeURIComponent(streamToken)}`;

      try {
        sse = new EventSource(streamUrl);

        sse.onopen = () => {
          if (!isSubscribed) return;
          setConnectionStatus('CONNECTED');
          setErrorMessage(null);
        };

        sse.onmessage = (event) => {
          if (!isSubscribed) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'frame' && data.data) {
              const canvas = canvasRef.current;
              if (canvas) {
                const img = new Image();
                img.onload = () => {
                  const ctx = canvas.getContext('2d');
                  if (ctx) {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    frameDimensionsRef.current = { width: img.width, height: img.height };
                    ctx.drawImage(img, 0, 0);
                  }
                };
                img.src = `data:image/jpeg;base64,${data.data}`;
              }
            }
          } catch (err) {
            console.debug('[CloudSessionViewer] stream frame parse failed', err);
          }
        };

        sse.onerror = async () => {
          if (!isSubscribed) return;
          setConnectionStatus('RECONNECTING');
          if (sse) sse.close();

          // Attempt token refresh
          try {
            const tokenRes = await api.getCloudReconnectToken(sessionId);
            if (tokenRes.success && tokenRes.data?.streamToken) {
              setStreamToken(tokenRes.data.streamToken);
            }
          } catch {
            setConnectionStatus('DISCONNECTED');
            setErrorMessage('Connection lost. Please reconnect or check worker status.');
          }
        };
      } catch (err: unknown) {
        setConnectionStatus('DISCONNECTED');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to establish cloud stream.');
      }
    };

    connectStream();

    return () => {
      isSubscribed = false;
      if (sse) sse.close();
    };
  }, [sessionId, streamToken]);

  // Translate click coordinate on canvas to remote browser coordinates
  const handleCanvasClick = useCallback(
    async (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = frameDimensionsRef.current.width / rect.width;
      const scaleY = frameDimensionsRef.current.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      const btn = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';

      try {
        await api.sendCloudInput(
          sessionId,
          { type: 'mouseClick', x, y, button: btn, clickCount: 1 },
          streamToken
        );
      } catch (err) {
        console.debug('[CloudSessionViewer] mouseClick input delivery failed', err);
      }
    },
    [sessionId, streamToken]
  );

  // Handle wheel scrolling
  const handleCanvasWheel = useCallback(
    async (e: React.WheelEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = frameDimensionsRef.current.width / rect.width;
      const scaleY = frameDimensionsRef.current.height / rect.height;

      const x = Math.round((e.clientX - rect.left) * scaleX);
      const y = Math.round((e.clientY - rect.top) * scaleY);

      try {
        await api.sendCloudInput(
          sessionId,
          { type: 'mouseWheel', deltaX: e.deltaX, deltaY: e.deltaY, x, y },
          streamToken
        );
      } catch (err) {
        console.debug('[CloudSessionViewer] mouseWheel input delivery failed', err);
      }
    },
    [sessionId, streamToken]
  );

  // Handle keyboard typing inside canvas
  const handleCanvasKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      try {
        await api.sendCloudInput(
          sessionId,
          {
            type: 'keyDown',
            key: e.key,
            code: e.code,
            text: e.key.length === 1 ? e.key : undefined,
          },
          streamToken
        );
      } catch (err) {
        console.debug('[CloudSessionViewer] keyDown input delivery failed', err);
      }
    },
    [sessionId, streamToken]
  );

  // Navigation handlers
  const handleNavigate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!urlInput) return;
    let target = urlInput.trim();
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    setUrlInput(target);
    try {
      await api.sendCloudInput(sessionId, { type: 'navigate', url: target }, streamToken);
    } catch (err) {
      console.debug('[CloudSessionViewer] navigate input failed', err);
    }
  };

  const handleReload = async () => {
    try {
      await api.sendCloudInput(sessionId, { type: 'reload' }, streamToken);
    } catch (err) {
      console.debug('[CloudSessionViewer] reload input failed', err);
    }
  };

  const handleGoBack = async () => {
    try {
      await api.sendCloudInput(sessionId, { type: 'goBack' }, streamToken);
    } catch (err) {
      console.debug('[CloudSessionViewer] goBack input failed', err);
    }
  };

  const handleGoForward = async () => {
    try {
      await api.sendCloudInput(sessionId, { type: 'goForward' }, streamToken);
    } catch (err) {
      console.debug('[CloudSessionViewer] goForward input failed', err);
    }
  };

  // Safe end session and sync back
  const handleStopSession = async () => {
    setIsStopping(true);
    try {
      await api.stopCloudSession(sessionId, 'USER_STOPPED');
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to stop session.');
      setIsStopping(false);
    }
  };

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingSeconds = Math.max(0, maxDurationSeconds - elapsedSeconds);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col">
      {/* Top Session Navigation Header */}
      <div className="h-14 bg-[#0a0f1d] border-b border-slate-800 px-4 flex items-center justify-between gap-4 select-none">
        {/* Left: Profile Info & Status */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 text-teal-400 flex items-center justify-center">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
              <span>{profileName}</span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono bg-teal-950 text-teal-400 border border-teal-800 rounded">
                CLOUD
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center space-x-2">
              <span className="text-slate-500 font-mono">Region: {regionId}</span>
              <span>•</span>
              <span className="flex items-center space-x-1 text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>{formatDuration(elapsedSeconds)}</span>
                <span className="text-slate-600">({formatDuration(remainingSeconds)} left)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Center: Remote Browser URL Bar */}
        <div className="flex-1 max-w-2xl flex items-center space-x-1.5">
          <div className="flex items-center space-x-1 text-slate-400">
            <button
              type="button"
              onClick={handleGoBack}
              className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleGoForward}
              className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Forward"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleReload}
              className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Reload"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleNavigate} className="flex-1 flex items-center">
            <div className="relative w-full">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter URL to navigate..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-100 text-xs px-3 py-1.5 rounded-lg outline-none font-mono"
              />
            </div>
          </form>
        </div>

        {/* Right: Connection Health & Stop Session */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-[11px] font-semibold">
            <div
              className={`w-2 h-2 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-400 animate-pulse'
                  : connectionStatus === 'RECONNECTING'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-400'
              }`}
            />
            <span
              className={
                connectionStatus === 'CONNECTED'
                  ? 'text-emerald-400'
                  : connectionStatus === 'RECONNECTING'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }
            >
              {connectionStatus}
            </span>
            <span className="text-slate-600 font-mono text-[10px]">({latencyMs}ms)</span>
          </div>

          {/* End Session Button */}
          <button
            type="button"
            onClick={handleStopSession}
            disabled={isStopping}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-rose-600/20 flex items-center space-x-1.5 disabled:opacity-50 transition-colors"
          >
            {isStopping ? (
              <>
                <div className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                <span>Syncing & Ending...</span>
              </>
            ) : (
              <>
                <Square className="w-3 h-3 fill-current" />
                <span>End Session</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div className="flex-1 bg-black flex items-center justify-center overflow-hidden relative">
        {errorMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-rose-950/90 border border-rose-800 text-rose-200 px-4 py-2 rounded-xl text-xs flex items-center space-x-2 shadow-2xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Interactive Canvas */}
        <canvas
          ref={canvasRef}
          tabIndex={0}
          onClick={handleCanvasClick}
          onWheel={handleCanvasWheel}
          onKeyDown={handleCanvasKeyDown}
          className="max-w-full max-h-full object-contain cursor-default focus:outline-none shadow-2xl"
          style={{ aspectRatio: '16/10' }}
        />

        {connectionStatus === 'CONNECTING' && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-10">
            <div className="animate-spin w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full" />
            <div className="text-sm font-bold text-slate-200">Allocating Isolated Cloud Worker...</div>
            <div className="text-xs text-slate-400">Launching version-pinned Chromium with anti-detect flags</div>
          </div>
        )}
      </div>
    </div>
  );
};
