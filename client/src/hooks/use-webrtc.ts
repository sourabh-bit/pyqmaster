import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

<<<<<<< HEAD
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Free TURN servers (for NAT traversal when STUN fails)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

export function useWebRTC(roomId?: string) {
=======
// Signaling message types
type SignalMessage = 
  | { type: 'offer'; sdp: RTCSessionDescriptionInit; caller: string }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit; responder: string }
  | { type: 'ice-candidate'; candidate: RTCIceCandidateInit; from: string }
  | { type: 'call-end' }
  | { type: 'call-reject' };

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

export function useWebRTC() {
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  const { toast } = useToast();
  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<'voice' | 'video' | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
<<<<<<< HEAD
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(roomId || null);
  const [isInitiator, setIsInitiator] = useState(false);
  
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  };

  const sendSignal = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...data, roomId: currentRoomId }));
    }
  }, [currentRoomId]);

  const createPeerConnection = useCallback((stream: MediaStream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
            usernameFragment: event.candidate.usernameFragment
          }
        });
      }
    };

    peer.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setCallStatus('connected');
    };

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
        toast({ title: "Connection lost", variant: "destructive" });
        cleanupCall();
      }
    };

    return peer;
  }, [sendSignal, toast]);

  const handleWebSocketMessage = useCallback(async (event: MessageEvent) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'joined':
        setIsInitiator(data.isInitiator);
        if (data.isInitiator) {
          setCallStatus('calling');
          toast({ title: "Waiting for someone to join..." });
        }
        break;

      case 'peer-joined':
        if (isInitiator && peerRef.current) {
          try {
            const offer = await peerRef.current.createOffer();
            await peerRef.current.setLocalDescription(offer);
            sendSignal({ type: 'offer', sdp: offer });
          } catch (e) {
            console.error('Error creating offer:', e);
          }
        }
        break;

      case 'offer':
        if (!peerRef.current) return;
        try {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          sendSignal({ type: 'answer', sdp: answer });
          
          // Add any pending ICE candidates
          for (const candidate of pendingCandidates.current) {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
          pendingCandidates.current = [];
        } catch (e) {
          console.error('Error handling offer:', e);
        }
        break;

      case 'answer':
        if (peerRef.current) {
          try {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            setCallStatus('connected');
            
            // Add any pending ICE candidates
            for (const candidate of pendingCandidates.current) {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            }
            pendingCandidates.current = [];
          } catch (e) {
            console.error('Error setting remote description:', e);
          }
        }
        break;

      case 'ice-candidate':
        if (peerRef.current && data.candidate) {
          try {
            if (peerRef.current.remoteDescription) {
              await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
              pendingCandidates.current.push(data.candidate);
            }
          } catch (e) {
            console.error('Error adding ICE candidate:', e);
          }
        }
        break;

      case 'peer-left':
        toast({ title: "Peer disconnected" });
        cleanupCall();
        break;

      case 'call-end':
        toast({ title: "Call ended" });
        cleanupCall();
        break;
    }
  }, [isInitiator, sendSignal, toast]);

  const cleanupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
    setCurrentRoomId(null);
    setIsInitiator(false);
    pendingCandidates.current = [];
  }, []);

  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const joinRoom = async (roomIdToJoin: string, mode: 'voice' | 'video') => {
    try {
      setActiveCall(mode);
      setCurrentRoomId(roomIdToJoin);
      setCallStatus('calling');

=======
  
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<BroadcastChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Helper to serialize ICE candidate for transmission
  const serializeCandidate = (candidate: RTCIceCandidate): RTCIceCandidateInit | null => {
    if (!candidate) return null;
    return {
      candidate: candidate.candidate,
      sdpMLineIndex: candidate.sdpMLineIndex,
      sdpMid: candidate.sdpMid,
      usernameFragment: candidate.usernameFragment
    };
  };

  // Initialize Signaling Channel (Mocking WebSocket with BroadcastChannel for Tab-to-Tab P2P)
  useEffect(() => {
    signalingRef.current = new BroadcastChannel('webrtc_signaling_channel');
    
    signalingRef.current.onmessage = async (event) => {
      const data = event.data as SignalMessage;
      
      if (data.type === 'offer') {
        // Incoming Call
        if (callStatus !== 'idle') return; // Busy
        setIncomingCall('video'); // Default to video capability for now, or infer from SDP
        setCallStatus('ringing');
        // Store the offer to handle later
        (window as any).pendingOffer = data.sdp; 
      } 
      else if (data.type === 'answer') {
        if (peerRef.current) {
          try {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
          } catch (e) {
            console.error('Error setting remote description', e);
          }
        }
      } 
      else if (data.type === 'ice-candidate') {
        if (peerRef.current && data.candidate) {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('Error adding received ice candidate', e);
          }
        }
      }
      else if (data.type === 'call-end' || data.type === 'call-reject') {
        cleanupCall();
        setCallStatus('ended');
        setTimeout(() => setCallStatus('idle'), 2000);
        toast({ title: "Call Ended" });
      }
    };

    return () => {
      signalingRef.current?.close();
    };
  }, [callStatus, toast]);

  const startCall = async (mode: 'voice' | 'video') => {
    try {
      setActiveCall(mode);
      setCallStatus('calling');

      // First close any existing call
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      // 1. Get User Media
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

<<<<<<< HEAD
      const peer = createPeerConnection(stream);
      peerRef.current = peer;

      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'join', roomId: roomIdToJoin }));
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({ variant: "destructive", title: "Connection error" });
        cleanupCall();
      };

      ws.onclose = () => {
        if (callStatus !== 'idle') {
          cleanupCall();
        }
      };

    } catch (err) {
      console.error("Failed to join room:", err);
=======
      // 2. Create Peer Connection
      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;

      // 3. Add Tracks
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      // 4. Handle ICE Candidates - SERIALIZE BEFORE SENDING
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          const serialized = serializeCandidate(event.candidate);
          signalingRef.current?.postMessage({
            type: 'ice-candidate',
            candidate: serialized,
            from: 'caller'
          });
        }
      };

      // 5. Handle Remote Stream
      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // 6. Create Offer
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // 7. Send Offer
      signalingRef.current?.postMessage({
        type: 'offer',
        sdp: offer,
        caller: 'me'
      });

    } catch (err) {
      console.error("Failed to start call:", err);
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
      cleanupCall();
      toast({ variant: "destructive", title: "Error", description: "Could not access camera/microphone" });
    }
  };

<<<<<<< HEAD
  const startCall = async (mode: 'voice' | 'video') => {
    const newRoomId = generateRoomId();
    await joinRoom(newRoomId, mode);
    return newRoomId;
  };

  const acceptCall = async () => {
    // This is now handled via room joining
=======
  const acceptCall = async () => {
    try {
      // First close any existing call
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }

      setIncomingCall(null);
      setActiveCall('video'); // Assuming video for now
      setCallStatus('connected');

      // 1. Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 1280 }, height: { ideal: 720 } } // Ideally match the offer
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // 2. Create Peer Connection
      const peer = new RTCPeerConnection(ICE_SERVERS);
      peerRef.current = peer;

      // 3. Add Tracks
      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      // 4. Handle ICE Candidates - SERIALIZE BEFORE SENDING
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          const serialized = serializeCandidate(event.candidate);
          signalingRef.current?.postMessage({
            type: 'ice-candidate',
            candidate: serialized,
            from: 'responder'
          });
        }
      };

      // 5. Handle Remote Stream
      peer.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // 6. Set Remote Description (Offer)
      const offer = (window as any).pendingOffer;
      await peer.setRemoteDescription(new RTCSessionDescription(offer));

      // 7. Create Answer
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      // 8. Send Answer
      signalingRef.current?.postMessage({
        type: 'answer',
        sdp: answer,
        responder: 'me'
      });

    } catch (err) {
      console.error("Failed to accept call:", err);
      cleanupCall();
    }
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  };

  const rejectCall = () => {
    setIncomingCall(null);
    setCallStatus('idle');
<<<<<<< HEAD
    sendSignal({ type: 'call-reject' });
  };

  const endCall = () => {
    sendSignal({ type: 'call-end' });
    cleanupCall();
  };

=======
    signalingRef.current?.postMessage({ type: 'call-reject' });
  };

  const endCall = () => {
    signalingRef.current?.postMessage({ type: 'call-end' });
    cleanupCall();
  };

  const cleanupCall = useCallback(() => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Close peer connection
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    // Reset State
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsVideoOff(!isVideoOff);
    }
  };

<<<<<<< HEAD
  const getInviteLink = () => {
    if (currentRoomId) {
      return `${window.location.origin}/call/${currentRoomId}`;
    }
    return null;
  };

  const copyInviteLink = async () => {
    const link = getInviteLink();
    if (link) {
      await navigator.clipboard.writeText(link);
      toast({ title: "Invite link copied!" });
    }
  };

  useEffect(() => {
    return () => {
      cleanupCall();
    };
  }, [cleanupCall]);

  return {
    startCall,
    joinRoom,
=======
  return {
    startCall,
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
<<<<<<< HEAD
    getInviteLink,
    copyInviteLink,
=======
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
    activeCall,
    incomingCall,
    callStatus,
    localStream,
    remoteStream,
    isMuted,
<<<<<<< HEAD
    isVideoOff,
    currentRoomId,
    isInitiator
=======
    isVideoOff
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  };
}
