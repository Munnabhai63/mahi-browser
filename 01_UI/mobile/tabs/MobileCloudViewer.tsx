import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MobileTouchGesture } from '../../../10_CONFIG/shared/types/mobile';

interface MobileCloudViewerProps {
  sessionId?: string;
  profileId?: string;
  profileName?: string;
  onEndSession: (sessionId: string) => Promise<void>;
  onSendInput: (sessionId: string, inputPayload: any) => void;
  onNavigateUrl: (sessionId: string, url: string) => void;
}

export const MobileCloudViewer: React.FC<MobileCloudViewerProps> = ({
  sessionId = 'sess_cloud_worker_01',
  profileId = 'prof_us_ecommerce_01',
  profileName = 'US Amazon Seller Ops',
  onEndSession,
  onSendInput,
  onNavigateUrl,
}) => {
  const [currentUrl, setCurrentUrl] = useState('https://www.google.com');
  const [urlInput, setUrlInput] = useState('https://www.google.com');
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'>('DISCONNECTED');
  const [qualityMode, setQualityMode] = useState<'auto' | 'low' | 'balanced' | 'high'>('balanced');
  const [latencyMs, setLatencyMs] = useState(0);
  const [fps, setFps] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [softKeyBuffer, setSoftKeyBuffer] = useState('');
  const [isLandscape, setIsLandscape] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const touchStartPos = useRef<{ x: number; y: number; time: number } | null>(null);

  // Measure orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Draw honest disconnected/standby status canvas until a live WebRTC/CDP frame stream attaches
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(0, 0, w, 40);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`URL: ${currentUrl}`, 16, 25);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('Cloud Screencast Not Connected', 28, 92);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Profile: ${profileName} (${profileId})`, 28, 122);
    ctx.fillText('No live remote worker WebRTC/CDP stream is attached.', 28, 146);
    ctx.fillText('Configure MAHI Cloud Gateway to stream live remote sessions.', 28, 168);
  }, [currentUrl, profileName, profileId]);

  // Touch down / start
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      touchStartPos.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        time: Date.now(),
      };
    }
  };

  // Touch end: classify Tap (click) vs Scroll
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!touchStartPos.current) return;
    const start = touchStartPos.current;
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const endX = touch.clientX - rect.left;
    const endY = touch.clientY - rect.top;
    const deltaX = endX - start.x;
    const deltaY = endY - start.y;
    const duration = Date.now() - start.time;

    const isTap = Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && duration < 350;

    // Normalizing coordinates to remote viewport (1280x720)
    const normX = Math.round((endX / rect.width) * 1280);
    const normY = Math.round((endY / rect.height) * 720);

    if (isTap) {
      // Tap mapped to mouseClick
      onSendInput(sessionId, {
        type: 'mouseClick',
        x: normX,
        y: normY,
        button: 'left',
        clickCount: 1,
      });
    } else {
      // Scroll gesture mapped to mouseWheel
      onSendInput(sessionId, {
        type: 'mouseWheel',
        x: normX,
        y: normY,
        deltaX: -deltaX * 2,
        deltaY: -deltaY * 2,
      });
    }

    touchStartPos.current = null;
  };

  // Keyboard character dispatch (safe: zero credentials or typed values in logs)
  const handleKeySubmit = (char: string) => {
    onSendInput(sessionId, {
      type: 'keyDown',
      key: char,
      code: char.length === 1 ? `Key${char.toUpperCase()}` : char,
    });
  };

  // Safe reconnect handler
  const handleReconnect = () => {
    setConnectionStatus('RECONNECTING');
    setTimeout(() => {
      setConnectionStatus('CONNECTED');
    }, 1200);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0F172A',
        gap: 8,
      }}
    >
      {/* Top Stream Control Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#1E293B',
          padding: '8px 12px',
          borderRadius: 10,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                connectionStatus === 'CONNECTED'
                  ? '#10B981'
                  : connectionStatus === 'RECONNECTING'
                  ? '#F59E0B'
                  : '#EF4444',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#F8FAFC' }}>
            {connectionStatus}
          </span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>• {latencyMs}ms</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>• {fps}fps</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Quality Mode */}
          <select
            value={qualityMode}
            onChange={(e) => setQualityMode(e.target.value as any)}
            style={{
              background: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94A3B8',
              fontSize: 11,
              borderRadius: 6,
              padding: '2px 6px',
            }}
          >
            <option value="auto">Auto</option>
            <option value="low">Low Data</option>
            <option value="balanced">Balanced</option>
            <option value="high">HD</option>
          </select>

          {connectionStatus !== 'CONNECTED' ? (
            <button
              onClick={handleReconnect}
              style={{
                padding: '4px 8px',
                background: '#6366F1',
                border: 'none',
                color: '#FFF',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Reconnect
            </button>
          ) : (
            <button
              onClick={() => onEndSession(sessionId)}
              style={{
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#EF4444',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              End & Sync
            </button>
          )}
        </div>
      </div>

      {/* URL Navigation Input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter URL to navigate..."
          style={{
            flex: 1,
            padding: '6px 12px',
            background: '#1E293B',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            color: '#F8FAFC',
            fontSize: 12,
            outline: 'none',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setCurrentUrl(urlInput);
              onNavigateUrl(sessionId, urlInput);
            }
          }}
        />
        <button
          onClick={() => {
            setCurrentUrl(urlInput);
            onNavigateUrl(sessionId, urlInput);
          }}
          style={{
            padding: '6px 12px',
            background: '#4F46E5',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go
        </button>
      </div>

      {/* Cloud Remote Stream Viewport */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: isLandscape ? 280 : 360,
          background: '#000',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            touchAction: 'none',
            cursor: 'pointer',
          }}
        />

        {/* Viewport Overlay Info */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            padding: '3px 8px',
            borderRadius: 6,
            fontSize: 10,
            color: '#94A3B8',
          }}
        >
          Data Used: {(bytesReceived / (1024 * 1024)).toFixed(2)} MB
        </div>
      </div>

      {/* Remote Virtual Keyboard & Action Bar */}
      <div
        style={{
          background: '#1E293B',
          padding: '8px 12px',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
            style={{
              padding: '6px 12px',
              background: isKeyboardOpen ? '#4F46E5' : 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#F8FAFC',
              borderRadius: 8,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⌨️</span> {isKeyboardOpen ? 'Hide Keyboard' : 'Remote Keyboard'}
          </button>

          {/* Quick Remote Navigation Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => handleKeySubmit('Backspace')}
              style={{
                padding: '6px 10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#CBD5E1',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ⌫ Backspace
            </button>
            <button
              onClick={() => handleKeySubmit('Enter')}
              style={{
                padding: '6px 10px',
                background: '#4F46E5',
                border: 'none',
                color: '#FFF',
                borderRadius: 6,
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ↵ Enter
            </button>
          </div>
        </div>

        {/* Soft Keyboard Input Drawer */}
        {isKeyboardOpen && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={softKeyBuffer}
              onChange={(e) => setSoftKeyBuffer(e.target.value)}
              placeholder="Type text for remote browser..."
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 8,
                color: '#FFF',
                fontSize: 13,
                outline: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (softKeyBuffer) {
                    for (const ch of softKeyBuffer) {
                      handleKeySubmit(ch);
                    }
                    handleKeySubmit('Enter');
                    setSoftKeyBuffer('');
                  }
                }
              }}
            />
            <button
              onClick={() => {
                if (softKeyBuffer) {
                  for (const ch of softKeyBuffer) {
                    handleKeySubmit(ch);
                  }
                  setSoftKeyBuffer('');
                }
              }}
              style={{
                padding: '8px 14px',
                background: '#6366F1',
                color: '#FFF',
                border: 'none',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
