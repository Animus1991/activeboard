/**
 * TableForge — UnityEmbed.tsx
 * React component that hosts the Unity WebGL Catan build inside an <iframe>.
 * Bidirectional communication via window.postMessage using the ReactBridge protocol.
 *
 * OUTGOING (React → Unity):  sendToUnity(type, payload)
 * INCOMING (Unity → React):  onMessage(type, payload) callbacks
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState } from './CatanEngine';

// ============================================================================
// Types
// ============================================================================

export interface UnityEmbedProps {
  /** URL to the index.html of the Unity WebGL build. */
  buildUrl: string;
  /** Initial player configuration to send once Unity reports ready. */
  playerNames: string[];
  localPlayerId?: string;
  /** Callback fired each time Unity sends a full STATE_UPDATE snapshot. */
  onStateUpdate?: (state: Partial<GameState>) => void;
  /** Optional camera mode override from React UI. */
  cameraMode?: 'Tactical' | 'Table' | 'Inspect' | 'Cinematic';
  /** CSS class applied to the outer wrapper. */
  className?: string;
}

// ============================================================================
// Message envelope (mirrors C# ReactMessage)
// ============================================================================

interface UnityMessage {
  source: 'TableForgeUnity';
  type:   'READY' | 'STATE_UPDATE' | 'PONG';
  payload: unknown;
}

// ============================================================================
// Component
// ============================================================================

export default function UnityEmbed({
  buildUrl,
  playerNames,
  localPlayerId = 'player-0',
  onStateUpdate,
  cameraMode = 'Tactical',
  className = '',
}: UnityEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady]     = useState(false);
  const [loading, setLoading] = useState(true);
  const prevMode = useRef(cameraMode);

  // ----------------------------------------------------------------
  // Send a message to the Unity iframe
  // ----------------------------------------------------------------

  const sendToUnity = useCallback((type: string, payload: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: 'TableForge', type, payload: JSON.stringify(payload) },
      '*'   // replace with build origin in production
    );
  }, []);

  // ----------------------------------------------------------------
  // Receive messages from Unity
  // ----------------------------------------------------------------

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data as UnityMessage;
      if (!data || data.source !== 'TableForgeUnity') return;

      switch (data.type) {
        case 'READY':
          setReady(true);
          setLoading(false);
          // Initialise game with player list
          sendToUnity('INIT', { playerNames, localPlayerId });
          sendToUnity('CAMERA', { mode: cameraMode });
          break;

        case 'STATE_UPDATE':
          onStateUpdate?.(data.payload as Partial<GameState>);
          break;

        case 'PONG':
          // heartbeat acknowledged — connection healthy
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToUnity, playerNames, localPlayerId, cameraMode, onStateUpdate]);

  // ----------------------------------------------------------------
  // Camera mode changes propagated to Unity
  // ----------------------------------------------------------------

  useEffect(() => {
    if (!ready || cameraMode === prevMode.current) return;
    prevMode.current = cameraMode;
    sendToUnity('CAMERA', { mode: cameraMode });
  }, [cameraMode, ready, sendToUnity]);

  // ----------------------------------------------------------------
  // Public action helpers (exposed via ref if needed by parent)
  // ----------------------------------------------------------------

  const roll     = () => sendToUnity('ACTION', { action: 'ROLL',     data: '{}' });
  const endTurn  = () => sendToUnity('ACTION', { action: 'END_TURN', data: '{}' });

  const clickVertex = (vertexId: string) =>
    sendToUnity('ACTION', { action: 'CLICK_VERTEX', data: JSON.stringify({ vertexId }) });

  const clickEdge = (edgeId: string) =>
    sendToUnity('ACTION', { action: 'CLICK_EDGE', data: JSON.stringify({ edgeId }) });

  const clickHex = (hexId: number) =>
    sendToUnity('ACTION', { action: 'CLICK_HEX', data: JSON.stringify({ hexId }) });

  // Expose full handle for parent imperative access
  const handle: UnityEmbedHandle = { roll, endTurn, clickVertex, clickEdge, clickHex };
  void handle; // consumed by parent via ref in future Unity integration

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className={`relative w-full h-full bg-black overflow-hidden ${className}`}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07101E] z-10">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-amber-200 font-medium tracking-widest text-sm uppercase">
            Loading Unity HDRP…
          </p>
        </div>
      )}

      {/* Unity WebGL iframe */}
      <iframe
        ref={iframeRef}
        src={buildUrl}
        title="Catan HDRP Board"
        className="w-full h-full border-0"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen
        onLoad={() => {
          // Don't hide loading yet — wait for Unity READY message
        }}
      />

      {/* Minimal React overlay: roll + end-turn while Unity handles all 3D input */}
      {ready && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          <button
            onClick={roll}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold
                       rounded-lg shadow-lg transition-colors uppercase tracking-wider"
          >
            Roll Dice
          </button>
          <button
            onClick={endTurn}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold
                       rounded-lg shadow-lg transition-colors uppercase tracking-wider"
          >
            End Turn
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Imperative handle (forward-ref version for parent access to actions)
// ============================================================================

export type UnityEmbedHandle = {
  roll:         () => void;
  endTurn:      () => void;
  clickVertex:  (vertexId: string) => void;
  clickEdge:    (edgeId:   string) => void;
  clickHex:     (hexId:    number) => void;
};
