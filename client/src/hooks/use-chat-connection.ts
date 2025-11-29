import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: Date;
  type: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
  senderName?: string;
}

interface UserProfile {
  name: string;
  avatar: string;
  lastSeen: Date | null;
  isTyping: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

const FIXED_ROOM_ID = 'SECURE_CHAT_MAIN';

export function useChatConnection(userType: 'admin' | 'friend') {
  const { toast } = useToast();
  
  const [isConnected, setIsConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  
  const [myProfile, setMyProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem(`profile_${userType}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...parsed, lastSeen: null, isTyping: false };
    }
    return {
      name: userType === 'admin' ? 'Admin' : 'Friend',
      avatar: '',
      lastSeen: null,
      isTyping: false
    };
  });
  
  const [peerProfile, setPeerProfile] = useState<UserProfile>({
    name: userType === 'admin' ? 'Friend' : 'Admin',
    avatar: '',
    lastSeen: null,
    isTyping: false
  });
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chat_messages');
    if (saved) {
      return JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
    }
    return [];
  });
  
  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ type: 'voice' | 'video'; from: string } | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'ringing' | 'connected'>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(`profile_${userType}`, JSON.stringify({
      name: myProfile.name,
      avatar: myProfile.avatar
    }));
  }, [myProfile.name, myProfile.avatar, userType]);

  const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  };

  const sendSignal = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ ...data, roomId: FIXED_ROOM_ID }));
    }
  }, []);

  const updateMyProfile = (updates: Partial<UserProfile>) => {
    setMyProfile(prev => {
      const updated = { ...prev, ...updates };
      sendSignal({ type: 'profile-update', profile: { name: updated.name, avatar: updated.avatar } });
      return updated;
    });
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ 
        type: 'join', 
        roomId: FIXED_ROOM_ID,
        profile: { name: myProfile.name, avatar: myProfile.avatar }
      }));
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      await handleMessage(data);
    };

    ws.onerror = () => console.error('WebSocket error');

    ws.onclose = () => {
      setIsConnected(false);
      setPeerConnected(false);
      setPeerProfile(prev => ({ ...prev, lastSeen: new Date(), isTyping: false }));
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };
  }, [myProfile.name, myProfile.avatar]);

  const handleMessage = async (data: any) => {
    switch (data.type) {
      case 'joined':
        if (!data.isInitiator && data.peerProfile) {
          setPeerConnected(true);
          setPeerProfile(prev => ({ ...prev, ...data.peerProfile, lastSeen: null, isTyping: false }));
        }
        break;

      case 'peer-joined':
        setPeerConnected(true);
        setPeerProfile(prev => ({ ...prev, lastSeen: null, isTyping: false }));
        if (data.profile) {
          setPeerProfile(prev => ({ ...prev, name: data.profile.name, avatar: data.profile.avatar }));
        }
        toast({ title: `${data.profile?.name || 'Friend'} is online!` });
        sendSignal({ type: 'profile-update', profile: { name: myProfile.name, avatar: myProfile.avatar } });
        break;

      case 'peer-left':
        setPeerConnected(false);
        setPeerProfile(prev => ({ ...prev, lastSeen: new Date(), isTyping: false }));
        toast({ title: `${peerProfile.name} went offline` });
        cleanupCall();
        break;

      case 'profile-update':
        if (data.profile) {
          setPeerProfile(prev => ({ ...prev, name: data.profile.name, avatar: data.profile.avatar }));
        }
        break;

      case 'typing':
        setPeerProfile(prev => ({ ...prev, isTyping: data.isTyping }));
        break;

      case 'chat-message':
        const newMsg: Message = {
          id: data.id || Date.now().toString(),
          text: data.text,
          sender: 'them',
          timestamp: new Date(data.timestamp),
          type: data.messageType || 'text',
          mediaUrl: data.mediaUrl,
          senderName: data.senderName
        };
        setMessages(prev => [...prev, newMsg]);
        setPeerProfile(prev => ({ ...prev, isTyping: false }));
        break;

      case 'call-request':
        setIncomingCall({ type: data.callType, from: data.from });
        setCallStatus('ringing');
        break;

      case 'call-accepted':
        await initiateWebRTC(data.callType);
        break;

      case 'call-rejected':
        toast({ title: "Call declined" });
        setCallStatus('idle');
        setActiveCall(null);
        break;

      case 'offer':
        await handleOffer(data.sdp);
        break;

      case 'answer':
        await handleAnswer(data.sdp);
        break;

      case 'ice-candidate':
        await handleIceCandidate(data.candidate);
        break;

      case 'call-end':
        toast({ title: "Call ended" });
        cleanupCall();
        break;
    }
  };

  const sendTyping = (isTyping: boolean) => {
    sendSignal({ type: 'typing', isTyping });
  };

  const handleTyping = () => {
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000);
  };

  const sendMessage = (msg: Partial<Message>) => {
    const newMsg: Message = {
      id: Date.now().toString(),
      text: msg.text || "",
      sender: 'me',
      timestamp: new Date(),
      type: msg.type || 'text',
      mediaUrl: msg.mediaUrl,
      senderName: myProfile.name
    };

    setMessages(prev => [...prev, newMsg]);
    sendTyping(false);
    
    sendSignal({
      type: 'chat-message',
      id: newMsg.id,
      text: newMsg.text,
      messageType: newMsg.type,
      mediaUrl: newMsg.mediaUrl,
      timestamp: newMsg.timestamp.toISOString(),
      senderName: myProfile.name
    });

    return newMsg;
  };

  const deleteMessage = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
  };

  const startCall = async (mode: 'voice' | 'video') => {
    if (!peerConnected) {
      toast({ variant: "destructive", title: "Friend not online" });
      return;
    }
    setActiveCall(mode);
    setCallStatus('calling');
    sendSignal({ type: 'call-request', callType: mode, from: myProfile.name });
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const callType = incomingCall.type;
    setActiveCall(callType);
    setIncomingCall(null);
    setCallStatus('connected');
    sendSignal({ type: 'call-accepted', callType });
  };

  const rejectCall = () => {
    sendSignal({ type: 'call-rejected' });
    setIncomingCall(null);
    setCallStatus('idle');
  };

  const endCall = () => {
    sendSignal({ type: 'call-end' });
    cleanupCall();
  };

  const initiateWebRTC = async (mode: 'voice' | 'video') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const peer = createPeerConnection(stream);
      peerRef.current = peer;

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal({ type: 'offer', sdp: offer });
      setCallStatus('connected');
    } catch (err) {
      toast({ variant: "destructive", title: "Could not access camera/microphone" });
      cleanupCall();
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'ice-candidate',
          candidate: { candidate: event.candidate.candidate, sdpMLineIndex: event.candidate.sdpMLineIndex, sdpMid: event.candidate.sdpMid }
        });
      }
    };

    peer.ontrack = (event) => setRemoteStream(event.streams[0]);

    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
        toast({ title: "Call connection lost", variant: "destructive" });
        cleanupCall();
      }
    };

    return peer;
  };

  const handleOffer = async (sdp: RTCSessionDescriptionInit) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: activeCall === 'video' });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const peer = createPeerConnection(stream);
      peerRef.current = peer;

      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      for (const candidate of pendingCandidates.current) {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidates.current = [];

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendSignal({ type: 'answer', sdp: answer });
    } catch (e) {
      console.error('Error handling offer:', e);
    }
  };

  const handleAnswer = async (sdp: RTCSessionDescriptionInit) => {
    if (!peerRef.current) return;
    await peerRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
    for (const candidate of pendingCandidates.current) {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    }
    pendingCandidates.current = [];
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!candidate) return;
    if (peerRef.current?.remoteDescription) {
      await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      pendingCandidates.current.push(candidate);
    }
  };

  const cleanupCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
    pendingCandidates.current = [];
  }, []);

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

  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem('chat_messages');
  };

  useEffect(() => {
    connect();
    return () => {
      cleanupCall();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [connect, cleanupCall]);

  return {
    isConnected,
    peerConnected,
    myProfile,
    peerProfile,
    updateMyProfile,
    messages,
    sendMessage,
    deleteMessage,
    clearMessages,
    handleTyping,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    activeCall,
    incomingCall,
    callStatus,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff
  };
}
