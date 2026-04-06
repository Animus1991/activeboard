/**
 * TableForge - Voice Chat Hook
 * WebRTC-based voice communication for game sessions
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface VoicePeer {
  id: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  volume: number;
}

export interface VoiceChatState {
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  peers: VoicePeer[];
  localStream: MediaStream | null;
  error: string | null;
}

interface UseVoiceChatOptions {
  roomCode: string;
  playerId: string;
  playerName: string;
  onPeerJoined?: (peerId: string) => void;
  onPeerLeft?: (peerId: string) => void;
  onError?: (error: string) => void;
}

interface UseVoiceChatReturn extends VoiceChatState {
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  setVolume: (peerId: string, volume: number) => void;
  setPeerMuted: (peerId: string, muted: boolean) => void;
}

// ============================================================================
// VOICE CHAT HOOK
// ============================================================================

export function useVoiceChat({
  roomCode,
  playerId,
  playerName,
  onPeerJoined,
  onPeerLeft,
  onError,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const analyserNodesRef = useRef<Map<string, AnalyserNode>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  // ICE servers configuration
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // Create peer connection
  const createPeerConnection = useCallback((peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ICE_CANDIDATE',
          targetId: peerId,
          candidate: event.candidate,
        }));
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      
      // Create or get audio element
      let audioElement = audioElementsRef.current.get(peerId);
      if (!audioElement) {
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElementsRef.current.set(peerId, audioElement);
      }
      audioElement.srcObject = stream;

      // Set up audio analysis for speaking detection
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      const audioContext = audioContextRef.current;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserNodesRef.current.set(peerId, analyser);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handlePeerDisconnect(peerId);
      }
    };

    peerConnectionsRef.current.set(peerId, pc);
    return pc;
  }, []);

  // Handle peer disconnect
  const handlePeerDisconnect = useCallback((peerId: string) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }

    const audioElement = audioElementsRef.current.get(peerId);
    if (audioElement) {
      audioElement.srcObject = null;
      audioElementsRef.current.delete(peerId);
    }

    analyserNodesRef.current.delete(peerId);

    setPeers(prev => prev.filter(p => p.id !== peerId));
    onPeerLeft?.(peerId);
  }, [onPeerLeft]);

  // Handle WebSocket messages
  const handleSignalingMessage = useCallback(async (data: unknown) => {
    const message = data as {
      type: string;
      peerId?: string;
      peerName?: string;
      offer?: RTCSessionDescriptionInit;
      answer?: RTCSessionDescriptionInit;
      candidate?: RTCIceCandidateInit;
      fromId?: string;
    };

    switch (message.type) {
      case 'PEER_JOINED': {
        if (!message.peerId || !message.peerName) break;
        
        // Add peer to list
        setPeers(prev => [...prev, {
          id: message.peerId!,
          name: message.peerName!,
          isSpeaking: false,
          isMuted: false,
          volume: 1,
        }]);
        onPeerJoined?.(message.peerId);

        // Create offer for new peer
        const pc = createPeerConnection(message.peerId);
        
        if (localStream) {
          localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
          });
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        wsRef.current?.send(JSON.stringify({
          type: 'OFFER',
          targetId: message.peerId,
          offer: pc.localDescription,
        }));
        break;
      }

      case 'PEER_LEFT': {
        if (message.peerId) {
          handlePeerDisconnect(message.peerId);
        }
        break;
      }

      case 'OFFER': {
        if (!message.fromId || !message.offer) break;
        
        let pc = peerConnectionsRef.current.get(message.fromId);
        if (!pc) {
          pc = createPeerConnection(message.fromId);
        }

        if (localStream) {
          localStream.getTracks().forEach(track => {
            pc!.addTrack(track, localStream);
          });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsRef.current?.send(JSON.stringify({
          type: 'ANSWER',
          targetId: message.fromId,
          answer: pc.localDescription,
        }));
        break;
      }

      case 'ANSWER': {
        if (!message.fromId || !message.answer) break;
        
        const pc = peerConnectionsRef.current.get(message.fromId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
        break;
      }

      case 'ICE_CANDIDATE': {
        if (!message.fromId || !message.candidate) break;
        
        const pc = peerConnectionsRef.current.get(message.fromId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;
      }
    }
  }, [localStream, createPeerConnection, handlePeerDisconnect, onPeerJoined]);

  // Connect to voice chat
  const connect = useCallback(async () => {
    if (isConnected || isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      setLocalStream(stream);

      // Connect to signaling server
      const wsUrl = `ws://${window.location.hostname}:3001/ws/voice`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'JOIN_VOICE',
          roomCode,
          playerId,
          playerName,
        }));
        setIsConnected(true);
        setIsConnecting(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSignalingMessage(data);
        } catch (err) {
          console.error('[VoiceChat] Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };

      ws.onerror = () => {
        setError('Failed to connect to voice server');
        setIsConnecting(false);
        onError?.('Failed to connect to voice server');
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access microphone';
      setError(errorMessage);
      setIsConnecting(false);
      onError?.(errorMessage);
    }
  }, [isConnected, isConnecting, roomCode, playerId, playerName, handleSignalingMessage, onError]);

  // Disconnect from voice chat
  const disconnect = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    // Clean up audio elements
    audioElementsRef.current.forEach(audio => {
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    // Clean up analyser nodes
    analyserNodesRef.current.clear();

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setPeers([]);
    setIsConnected(false);
    setError(null);
  }, [localStream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  }, [localStream, isMuted]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    audioElementsRef.current.forEach(audio => {
      audio.muted = !isDeafened;
    });
    setIsDeafened(!isDeafened);
  }, [isDeafened]);

  // Set peer volume
  const setVolume = useCallback((peerId: string, volume: number) => {
    const audioElement = audioElementsRef.current.get(peerId);
    if (audioElement) {
      audioElement.volume = Math.max(0, Math.min(1, volume));
    }
    setPeers(prev => prev.map(p => 
      p.id === peerId ? { ...p, volume } : p
    ));
  }, []);

  // Set peer muted
  const setPeerMuted = useCallback((peerId: string, muted: boolean) => {
    const audioElement = audioElementsRef.current.get(peerId);
    if (audioElement) {
      audioElement.muted = muted;
    }
    setPeers(prev => prev.map(p => 
      p.id === peerId ? { ...p, isMuted: muted } : p
    ));
  }, []);

  // Speaking detection loop
  useEffect(() => {
    if (!isConnected) return;

    const checkSpeaking = () => {
      analyserNodesRef.current.forEach((analyser, peerId) => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const isSpeaking = average > 30; // Threshold for speaking detection

        setPeers(prev => prev.map(p => 
          p.id === peerId ? { ...p, isSpeaking } : p
        ));
      });
    };

    const interval = setInterval(checkSpeaking, 100);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    isMuted,
    isDeafened,
    peers,
    localStream,
    error,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    setVolume,
    setPeerMuted,
  };
}

export default useVoiceChat;
