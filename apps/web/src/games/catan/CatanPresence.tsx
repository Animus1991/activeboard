/**
 * CatanPresence — WebRTC Tier-1 Telepresence Panel
 *
 * Architecture:
 *  - Each player opens a RTCPeerConnection to every other player (full mesh, ≤4 peers)
 *  - Signalling transported over the existing WebSocket game channel (via Liveblocks storage)
 *  - Video streams rendered in small "holographic card" panels anchored to the right side
 *  - Audio is always live; video is togglable per-stream
 *  - Graceful degradation: panel stays invisible until at least one remote stream arrives
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface PresencePlayer {
  id: string;
  name: string;
  color: string;
}

interface PeerState {
  playerId: string;
  playerName: string;
  playerColor: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  connectionState: RTCPeerConnectionState;
}

interface SignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'presence-join' | 'presence-leave';
  from: string;
  to: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
}

// ============================================================================
// HOOKS
// ============================================================================

/** Acquire local camera + mic, returns stream + controls. */
function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const acquire = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setStream(s);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const toggleAudio = useCallback(() => {
    if (!stream) return;
    const next = !audioEnabled;
    stream.getAudioTracks().forEach(t => { t.enabled = next; });
    setAudioEnabled(next);
  }, [stream, audioEnabled]);

  const toggleVideo = useCallback(() => {
    if (!stream) return;
    const next = !videoEnabled;
    stream.getVideoTracks().forEach(t => { t.enabled = next; });
    setVideoEnabled(next);
  }, [stream, videoEnabled]);

  const stop = useCallback(() => {
    if (!stream) return;
    stream.getTracks().forEach(t => t.stop());
    setStream(null);
  }, [stream]);

  return { stream, audioEnabled, videoEnabled, error, acquire, toggleAudio, toggleVideo, stop };
}

// ============================================================================
// ICE CONFIGURATION
// ============================================================================

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface CatanPresenceProps {
  localPlayerId: string;
  players: PresencePlayer[];
  /** Send a signal message via the game's existing realtime channel */
  sendSignal: (msg: SignalMessage) => void;
  /** Subscribe to incoming signal messages */
  onSignal: (handler: (msg: SignalMessage) => void) => () => void;
}

export function CatanPresence({ localPlayerId, players, sendSignal, onSignal }: CatanPresenceProps) {
  const local = useLocalMedia();
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const [joined, setJoined] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && local.stream) {
      localVideoRef.current.srcObject = local.stream;
    }
  }, [local.stream]);

  // ── Create peer connection for a remote player ────────────────────────────
  const createPc = useCallback((remoteId: string, isInitiator: boolean) => {
    if (pcsRef.current.has(remoteId)) return pcsRef.current.get(remoteId)!;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcsRef.current.set(remoteId, pc);

    // Add local tracks
    if (local.stream) {
      local.stream.getTracks().forEach(t => pc.addTrack(t, local.stream!));
    }

    // ICE candidate forwarding
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal({
          type: 'ice-candidate',
          from: localPlayerId,
          to: remoteId,
          payload: e.candidate.toJSON(),
        });
      }
    };

    // Connection state tracking
    pc.onconnectionstatechange = () => {
      setPeers(prev => {
        const next = new Map(prev);
        const peer = next.get(remoteId);
        if (peer) next.set(remoteId, { ...peer, connectionState: pc.connectionState });
        return next;
      });
    };

    // Incoming stream
    pc.ontrack = (e) => {
      const [remoteStream] = e.streams;
      setPeers(prev => {
        const next = new Map(prev);
        const player = players.find(p => p.id === remoteId);
        next.set(remoteId, {
          playerId: remoteId,
          playerName: player?.name ?? remoteId,
          playerColor: player?.color ?? '#888',
          stream: remoteStream,
          audioEnabled: true,
          videoEnabled: true,
          connectionState: pc.connectionState,
        });
        return next;
      });
    };

    // Initiate offer if we are the caller
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          sendSignal({
            type: 'offer',
            from: localPlayerId,
            to: remoteId,
            payload: pc.localDescription!,
          });
        })
        .catch(console.error);
    }

    return pc;
  }, [local.stream, localPlayerId, players, sendSignal]);

  // ── Signal handler ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSignal(async (msg: SignalMessage) => {
      if (msg.to !== localPlayerId) return;
      const { from, type, payload } = msg;

      if (type === 'presence-join') {
        // A new peer joined — we initiate as the existing member
        createPc(from, true);
        return;
      }

      if (type === 'presence-leave') {
        const pc = pcsRef.current.get(from);
        pc?.close();
        pcsRef.current.delete(from);
        setPeers(prev => { const next = new Map(prev); next.delete(from); return next; });
        return;
      }

      let pc = pcsRef.current.get(from);
      if (!pc) pc = createPc(from, false);

      if (type === 'offer' && payload) {
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: 'answer', from: localPlayerId, to: from, payload: answer });
      } else if (type === 'answer' && payload) {
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
      } else if (type === 'ice-candidate' && payload) {
        await pc.addIceCandidate(new RTCIceCandidate(payload as RTCIceCandidateInit));
      }
    });
    return unsub;
  }, [localPlayerId, onSignal, createPc, sendSignal]);

  // ── Join / Leave ──────────────────────────────────────────────────────────
  const join = useCallback(async () => {
    await local.acquire();
    // Announce to all other players
    players
      .filter(p => p.id !== localPlayerId)
      .forEach(p => sendSignal({ type: 'presence-join', from: localPlayerId, to: p.id, payload: null }));
    setJoined(true);
  }, [local, localPlayerId, players, sendSignal]);

  const leave = useCallback(() => {
    players
      .filter(p => p.id !== localPlayerId)
      .forEach(p => sendSignal({ type: 'presence-leave', from: localPlayerId, to: p.id, payload: null }));
    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();
    setPeers(new Map());
    local.stop();
    setJoined(false);
  }, [local, localPlayerId, players, sendSignal]);

  // Cleanup on unmount
  useEffect(() => () => { pcsRef.current.forEach(pc => pc.close()); }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const peerList = Array.from(peers.values());

  if (!joined) {
    return (
      <div className="absolute bottom-4 right-4 z-30">
        <button
          onClick={join}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-900/40 transition-all"
        >
          <Users className="w-4 h-4" />
          Join Telepresence
        </button>
      </div>
    );
  }

  return (
    <div className={`absolute bottom-4 right-4 z-30 flex flex-col gap-2 items-end transition-all`}>
      {/* Local feed + controls bar */}
      <div className="bg-black/80 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden shadow-2xl w-48">
        <div className="relative">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`w-full aspect-video object-cover bg-slate-900 ${!local.videoEnabled ? 'opacity-0' : ''}`}
          />
          {!local.videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <VideoOff className="w-8 h-8 text-slate-600" />
            </div>
          )}
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-xs bg-black/60 text-white font-medium">
            You
          </div>
        </div>
        <div className="flex items-center justify-between px-2 py-1.5 gap-1">
          <button
            onClick={local.toggleAudio}
            className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors ${
              local.audioEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-600/80 hover:bg-red-600'
            }`}
            title={local.audioEnabled ? 'Mute' : 'Unmute'}
          >
            {local.audioEnabled ? <Mic className="w-3.5 h-3.5 text-white" /> : <MicOff className="w-3.5 h-3.5 text-white" />}
          </button>
          <button
            onClick={local.toggleVideo}
            className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors ${
              local.videoEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-600/80 hover:bg-red-600'
            }`}
            title={local.videoEnabled ? 'Stop video' : 'Start video'}
          >
            {local.videoEnabled ? <Video className="w-3.5 h-3.5 text-white" /> : <VideoOff className="w-3.5 h-3.5 text-white" />}
          </button>
          <button
            onClick={leave}
            className="py-1 px-2 rounded-lg bg-red-700/80 hover:bg-red-700 flex items-center justify-center transition-colors"
            title="Leave telepresence"
          >
            <PhoneOff className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="py-1 px-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '▲' : '▼'}
          </button>
        </div>
        {local.error && (
          <p className="text-xs text-red-400 px-2 pb-1.5">{local.error}</p>
        )}
      </div>

      {/* Remote peer feeds */}
      {!collapsed && peerList.map(peer => (
        <RemotePeerPanel key={peer.playerId} peer={peer} />
      ))}

      {/* Waiting indicator when no peers connected yet */}
      {!collapsed && peerList.length === 0 && (
        <div className="bg-black/60 backdrop-blur-md rounded-xl px-3 py-2 border border-white/10 w-48 text-center">
          <p className="text-xs text-slate-400">Waiting for other players to join telepresence…</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// REMOTE PEER PANEL
// ============================================================================

function RemotePeerPanel({ peer }: { peer: PeerState }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  const stateColor =
    peer.connectionState === 'connected' ? 'bg-emerald-400' :
    peer.connectionState === 'connecting' ? 'bg-yellow-400' :
    'bg-red-400';

  return (
    <div className="bg-black/80 backdrop-blur-lg rounded-2xl border overflow-hidden shadow-xl w-48"
      style={{ borderColor: peer.playerColor + '55' }}>
      <div className="relative">
        {peer.stream && peer.videoEnabled ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full aspect-video object-cover bg-slate-900"
          />
        ) : (
          <div className="w-full aspect-video bg-slate-900 flex items-center justify-center">
            <VideoOff className="w-7 h-7 text-slate-600" />
          </div>
        )}
        {/* Name badge */}
        <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: peer.playerColor }} />
          <span className="text-xs text-white font-medium truncate max-w-[80px]">{peer.playerName}</span>
        </div>
        {/* Connection dot */}
        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${stateColor}`} />
      </div>
    </div>
  );
}

export default CatanPresence;
