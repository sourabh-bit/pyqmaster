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
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  replyTo?: {
    id: string;
    text: string;
    sender: 'me' | 'them';
  };
}

interface HistoryBatch {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

const INITIAL_HISTORY_PAGE_SIZE = 120;
const OLDER_HISTORY_PAGE_SIZE = 100;

interface UserProfile {
  name: string;
  avatar: string;
  lastSeen: Date | null;
  isTyping: boolean;
}

type VideoProfile = "hd" | "sd" | "audio-priority";

interface CallStatsSnapshot {
  bytesSent: number;
  timestamp: number;
  framesEncoded: number;
  framesDropped: number;
}

type CandidateRoute = "host" | "srflx" | "relay" | "unknown";

const FIXED_ROOM_ID = 'secure-room-001';
const OFFLINE_QUEUE_LIMIT = 200;

// Fetch user profile from server (source of truth)
const fetchServerProfile = async (userType: 'admin' | 'friend'): Promise<{ name: string; avatar: string } | null> => {
  try {
    const response = await fetch(`/api/profile?userType=${userType}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`[PROFILE] Fetched ${userType} profile from server:`, data.name);
      return { name: data.name, avatar: data.avatar || '' };
    }
  } catch (error) {
    console.error('Failed to fetch profile from server:', error);
  }
  return null;
};

// Save profile to server
const saveServerProfile = async (userType: 'admin' | 'friend', name: string, avatar: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/profile/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userType, name, avatar })
    });
    if (response.ok) {
      console.log(`[PROFILE] Saved ${userType} profile to server: name="${name}"`);
      return true;
    }
  } catch (error) {
    console.error('Failed to save profile to server:', error);
  }
  return false;
};

const fetchChatHistory = async (
  userType: 'admin' | 'friend',
  cursor: string | null = null,
  limit = INITIAL_HISTORY_PAGE_SIZE
): Promise<HistoryBatch> => {
  try {
    const params = new URLSearchParams({
      userType,
      limit: String(limit),
    });
    if (cursor) {
      params.set("cursor", cursor);
    }
    const response = await fetch(`/api/messages/${FIXED_ROOM_ID}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          return {
            messages: normalizeHistoryMessages(data.messages),
            nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null,
            hasMore: Boolean(data.hasMore),
          };
        }
      }
  } catch (error) {
    console.error('Failed to fetch chat history:', error);
  }
  return { messages: [], nextCursor: null, hasMore: false };
};

const normalizeHistoryMessages = (input: any[]): Message[] => {
  return input.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
};

const parseEnvList = (value?: string) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const parseEnvBoolean = (value?: string) =>
  value === "1" || value === "true" || value === "yes";

const DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:stun1.l.google.com:19302",
  "stun:stun2.l.google.com:19302",
  "stun:stun3.l.google.com:19302",
  "stun:stun4.l.google.com:19302",
  "stun:global.stun.twilio.com:3478"
];

const DEFAULT_TURN_URLS = [
  "turn:openrelay.metered.ca:80",
  "turn:openrelay.metered.ca:443",
  "turn:openrelay.metered.ca:443?transport=tcp",
  "turns:openrelay.metered.ca:443?transport=tcp"
];

const DEFAULT_TURN_USERNAME = "openrelayproject";
const DEFAULT_TURN_CREDENTIAL = "openrelayproject";

const envStunUrls = parseEnvList(import.meta.env.VITE_STUN_URLS);
const envTurnUrls = parseEnvList(import.meta.env.VITE_TURN_URLS);
const envTurnUsername = import.meta.env.VITE_TURN_USERNAME;
const envTurnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

const buildIceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [];
  const stunUrls = envStunUrls.length > 0 ? envStunUrls : DEFAULT_STUN_URLS;
  const turnUrls = envTurnUrls.length > 0 ? envTurnUrls : DEFAULT_TURN_URLS;

  stunUrls.forEach((url) => servers.push({ urls: url }));

  if (turnUrls.length > 0) {
    const hasEnvCreds = Boolean(envTurnUsername && envTurnCredential);
    const isDefaultRelay = envTurnUrls.length === 0;

    servers.push({
      urls: turnUrls,
      ...(hasEnvCreds
        ? { username: envTurnUsername, credential: envTurnCredential }
        : isDefaultRelay
        ? { username: DEFAULT_TURN_USERNAME, credential: DEFAULT_TURN_CREDENTIAL }
        : {})
    });
  }

  return servers;
};

const ICE_SERVERS = {
  iceServers: buildIceServers(),
  iceCandidatePoolSize: 10
};

const isLikelyMobile = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const isCellularConnection = () => {
  const connection = (navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string };
  }).connection;
  if (!connection) return false;
  if (connection.type) return connection.type === "cellular";
  const effective = connection.effectiveType;
  return (
    isLikelyMobile() &&
    (effective === "slow-2g" ||
      effective === "2g" ||
      effective === "3g" ||
      effective === "4g" ||
      effective === "5g")
  );
};

const shouldForceRelayByDefault = () => {
  const urlForceRelay = new URLSearchParams(window.location.search).has("forceRelay");
  if (urlForceRelay) return true;
  const envValue = import.meta.env.VITE_FORCE_RELAY_ON_MOBILE;
  if (envValue && envValue.trim().length > 0) {
    const forceOnMobile = parseEnvBoolean(envValue);
    return forceOnMobile && (isLikelyMobile() || isCellularConnection());
  }
  // Mobile browsers often hide network-type info (notably iOS), so prefer relay by default.
  return isLikelyMobile() || isCellularConnection();
};

const buildRtcConfig = (forceRelay: boolean): RTCConfiguration => ({
  ...ICE_SERVERS,
  iceTransportPolicy: forceRelay ? "relay" : "all"
});

let swRegistration: ServiceWorkerRegistration | null = null;

const registerServiceWorker = async () => {
  const isDevelopment =
    import.meta.env.DEV ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  if (isDevelopment) {
    return null;
  }

  if ('serviceWorker' in navigator) {
    try {
      swRegistration =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ||
        (await navigator.serviceWorker.register('/sw.js'));
      return swRegistration;
    } catch (err) {
      console.log('Service Worker registration failed:', err);
      return null;
    }
  }
  return null;
};

const subscribeToPush = async (registration: ServiceWorkerRegistration, userType: 'admin' | 'friend') => {
  try {
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('Already subscribed to push notifications');
      return;
    }

    const response = await fetch('/api/push/vapid-key');
    if (!response.ok) {
      console.log('Push notifications not configured on server');
      return;
    }

    const { publicKey } = await response.json();
    if (!publicKey) {
      console.log('No VAPID public key available');
      return;
    }

    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const subscribeResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
            auth: arrayBufferToBase64(subscription.getKey('auth')!)
          }
        },
        userType: userType
      })
    });

    if (subscribeResponse.ok) {
      console.log('Successfully subscribed to push notifications');
    } else {
      console.error('Failed to subscribe on server');
    }
  } catch (err) {
    console.error('Push subscription failed:', err);
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const toBase64Url = (base64: string) =>
  base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const requestNotificationPermission = async (userType: 'admin' | 'friend') => {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const registration = await registerServiceWorker();
      if (registration) await subscribeToPush(registration, userType);
    }
  } else if (Notification.permission === 'granted') {
    const registration = await registerServiceWorker();
    if (registration) await subscribeToPush(registration, userType);
  }
};

const showBrowserNotification = (title: string, body: string, icon?: string, userType?: 'admin' | 'friend') => {
  // Completely disable notifications for friend user
  if (userType === 'friend') {
    return;
  }

  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  if (swRegistration) {
    swRegistration.showNotification(title, {
      body,
      icon: icon || "/favicon.png",
      tag: "chat-notification",
      vibrate: [300, 120, 300],
      renotify: true,
      sound: "default"
    } as any);
  } else if (document.hidden) {
    new Notification(title, {
      body,
      icon: icon || "/favicon.png",
      tag: "chat-notification"
    });
  }
};

const migrateLocalStorage = (userType: 'admin' | 'friend') => {
  const oldKeys = ['profile_admin', 'profile_friend'];
  oldKeys.forEach((key) => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
    }
  });
};

const logConnectionEvent = (user: string, action: string) => {
  const logs = JSON.parse(localStorage.getItem('connection_logs') || '[]');
  logs.push({
    timestamp: new Date().toISOString(),
    user,
    action
  });
  localStorage.setItem('connection_logs', JSON.stringify(logs.slice(-100)));
};

export function useChatConnection(userType: 'admin' | 'friend') {
  const { toast } = useToast();

  useEffect(() => {
    migrateLocalStorage(userType);
  }, [userType]);

  const [isConnected, setIsConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [isPeerOnline, setIsPeerOnline] = useState(false);

  const defaultPeerName = ""; // no fallback name anymore

  // Initialize profiles with defaults - server will update these on mount
  const [myProfile, setMyProfile] = useState<UserProfile>({
    name: '',
    avatar: '',
    lastSeen: null,
    isTyping: false
  });

  const [peerProfile, setPeerProfile] = useState<UserProfile>({
    name: '',
    avatar: '',
    lastSeen: null,
    isTyping: false
  });
  
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);

  // Reconnection state with exponential backoff
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = useRef(10);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(Date.now());

  useEffect(() => {
    if (userType === 'admin') {
      requestNotificationPermission(userType);
    } else if (userType === 'friend') {
      // Explicitly disable notifications for friend user
      if ('Notification' in window && Notification.permission === 'default') {
        // Deny permission request for friend
        console.log('Notifications disabled for friend user');
      }
    }
  }, [userType]);

  // Fetch BOTH own profile AND peer profile from server on mount (source of truth)
  useEffect(() => {
    const peerType = userType === 'admin' ? 'friend' : 'admin';
    
    const loadProfiles = async () => {
      console.log(`[CLIENT] Loading profiles for userType=${userType}`);
      
      // Fetch own profile
      const serverProfile = await fetchServerProfile(userType);
      if (serverProfile) {
        console.log(`[PROFILE] Loaded own profile (${userType}):`, serverProfile.name);
        setMyProfile(prev => ({
          ...prev,
          name: serverProfile.name,
          avatar: serverProfile.avatar
        }));
        localStorage.setItem(`chat_my_profile_${userType}`, JSON.stringify({
          name: serverProfile.name,
          avatar: serverProfile.avatar
        }));
      }
      
      // Fetch peer profile
      const peerServerProfile = await fetchServerProfile(peerType);
      if (peerServerProfile) {
        console.log(`[PROFILE] Loaded peer profile (${peerType}):`, peerServerProfile.name);
        setPeerProfile(prev => ({
          ...prev,
          name: peerServerProfile.name,
          avatar: peerServerProfile.avatar
        }));
        localStorage.setItem(`chat_peer_profile_${userType}`, JSON.stringify({
          name: peerServerProfile.name,
          avatar: peerServerProfile.avatar
        }));
      }
      
      setIsLoadingProfiles(false);
    };
    loadProfiles();
  }, [userType]);

  // Initialize messages as empty - server is the source of truth
  // localStorage is only used as a cache, not as initial state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);

  const [activeCall, setActiveCall] = useState<'voice' | 'video' | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    type: 'voice' | 'video';
    from: string;
  } | null>(null);
  const [callStatus, setCallStatus] = useState<
    'idle' | 'calling' | 'ringing' | 'connected'
  >('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const isMakingOfferRef = useRef(false);
  const isRecoveringRef = useRef(false);
  const recoveryAttemptsRef = useRef(0);
  const forceRelayRef = useRef(false);
  const pendingRecoveryReasonRef = useRef<string | null>(null);
  const mediaRequestRef = useRef<Promise<MediaStream> | null>(null);
  const iceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStatsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCallTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentVideoProfileRef = useRef<VideoProfile>("hd");
  const lastStatsRef = useRef<CallStatsSnapshot | null>(null);
  const lastCandidatePairIdRef = useRef<string>("");
  const lastInterfaceKeyRef = useRef<string>("");
  const selectedRouteRef = useRef<CandidateRoute>("unknown");
  const incomingCallSessionIdRef = useRef<string | null>(null);
  const callSessionIdRef = useRef<string | null>(null);
  const intentionalCallEndRef = useRef(false);
  const isPolitePeerRef = useRef(userType === "friend");
  const callEndLoggedRef = useRef(false);
  const callStartedAtRef = useRef<number | null>(null);
  const lastIceRestartAtRef = useRef(0);
  const handoffCooldownUntilRef = useRef(0);
  const qualityDowngradeStreakRef = useRef(0);
  const qualityUpgradeStreakRef = useRef(0);
  const statsTickRef = useRef(0);
  const relayStartedAtRef = useRef<number | null>(null);
  const relayUsageCountRef = useRef(0);
  const relayTotalDurationMsRef = useRef(0);
  const backgroundVideoSuspendTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoSenderDetachedRef = useRef(false);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const lastRemoteOfferSdpRef = useRef("");
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectBlockedUntilRef = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const currentCallType = useRef<'voice' | 'video' | null>(null);
  const deviceMemoryGbRef = useRef<number>(
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0
  );
  const processedMessageIds = useRef<Set<string>>(new Set());
  const isDocumentVisible = useRef<boolean>(!document.hidden);
  const offlineQueue = useRef<any[]>([]);
  const isIntentionalClose = useRef(false);
  const handleMessageRef = useRef<(data: any) => Promise<void>>(async () => {});
  const scheduleIceRecoveryRef = useRef<(reason: string) => void>(() => {});

  const deviceId = useRef<string>(
    localStorage.getItem('device_id') ||
      (() => {
        const id = `${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        localStorage.setItem('device_id', id);
        return id;
      })()
  );
  const sessionId = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );
  const lastSyncTimestamp = useRef<number>(
    parseInt(localStorage.getItem(`lastSyncTimestamp_${userType}`) || '0', 10)
  );

  const myProfileRef = useRef(myProfile);
  const peerProfileRef = useRef(peerProfile);
  const messagesRef = useRef(messages);
  const peerConnectedRef = useRef(peerConnected);
  const historyCursorRef = useRef<string | null>(null);

  useEffect(() => {
    myProfileRef.current = myProfile;
  }, [myProfile]);

  useEffect(() => {
    peerProfileRef.current = peerProfile;
  }, [peerProfile]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    peerConnectedRef.current = peerConnected;
  }, [peerConnected]);

  useEffect(() => {
    isPolitePeerRef.current = userType === 'friend';
  }, [userType]);

  // Trigger a read receipt for a single message if chat is visible
  function tryMarkAsRead(message: Message) {
    if (message.sender !== 'them') return;
    if (!isDocumentVisible.current) return;
    if (!wsRef.current) return;

    sendSignal({
      type: "message-read",
      ids: [message.id],
    });
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      isDocumentVisible.current = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const key = `chat_messages_${userType}`;
    const persist = () => {
      if (cancelled) return;
      localStorage.setItem(key, JSON.stringify(messages));
    };

    if (typeof (window as any).requestIdleCallback === "function") {
      const idleId = (window as any).requestIdleCallback(persist, { timeout: 1200 });
      return () => {
        cancelled = true;
        if (typeof (window as any).cancelIdleCallback === "function") {
          (window as any).cancelIdleCallback(idleId);
        }
      };
    }

    const timer = window.setTimeout(persist, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [messages, userType]);

  useEffect(() => {
    localStorage.setItem(
      `chat_my_profile_${userType}`,
      JSON.stringify({
        name: myProfile.name,
        avatar: myProfile.avatar
      })
    );
  }, [myProfile.name, myProfile.avatar, userType]);

  useEffect(() => {
    if (peerProfile.name !== defaultPeerName || peerProfile.avatar) {
      localStorage.setItem(
        `chat_peer_profile_${userType}`,
        JSON.stringify({
          name: peerProfile.name,
          avatar: peerProfile.avatar,
          lastSeen: peerProfile.lastSeen
        })
      );
    }
  }, [
    peerProfile.name,
    peerProfile.avatar,
    peerProfile.lastSeen,
    defaultPeerName,
    userType
  ]);

  const getWebSocketUrl = () => {
    const WS_URL =
      window.location.origin.startsWith("http")
        ? window.location.origin.replace("http", "ws")
        : `wss://${window.location.host}`;
    return `${WS_URL}/ws`;
  };

  const offlineQueueStorageKey = `chat_offline_queue_${userType}`;

  const persistOfflineQueue = useCallback(() => {
    if (offlineQueue.current.length === 0) {
      localStorage.removeItem(offlineQueueStorageKey);
      return;
    }
    try {
      localStorage.setItem(
        offlineQueueStorageKey,
        JSON.stringify(offlineQueue.current.slice(-OFFLINE_QUEUE_LIMIT))
      );
    } catch (err) {
      console.warn("[WS] failed to persist offline queue", err);
    }
  }, [offlineQueueStorageKey]);

  const enqueueOfflinePayload = useCallback((payload: any) => {
    if (payload.type === "send-message" && payload.id) {
      const exists = offlineQueue.current.some(
        (queued) => queued.type === "send-message" && queued.id === payload.id
      );
      if (exists) return;
    }
    offlineQueue.current.push(payload);
    if (offlineQueue.current.length > OFFLINE_QUEUE_LIMIT) {
      offlineQueue.current = offlineQueue.current.slice(-OFFLINE_QUEUE_LIMIT);
    }
    persistOfflineQueue();
  }, [persistOfflineQueue]);

  const emitAppEvent = useCallback((event: string, detail: Record<string, any> = {}) => {
    const payload = {
      event,
      at: new Date().toISOString(),
      userType,
      ...detail
    };
    console.log("[APP_EVT]", JSON.stringify(payload));
    try {
      window.dispatchEvent(new CustomEvent("chat:app-event", { detail: payload }));
    } catch {
      // ignore event dispatch failures
    }
  }, [userType]);

  const sendSignal = useCallback((data: any, queueIfOffline = false) => {
    const payload = { ...data, roomId: FIXED_ROOM_ID };
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(payload));
      } catch (err) {
        if (queueIfOffline) {
          enqueueOfflinePayload(payload);
          if (payload.type === "send-message") {
            emitAppEvent("message_retry", { reason: "send-throw", messageId: payload.id });
          }
        }
      }
    } else if (queueIfOffline) {
      enqueueOfflinePayload(payload);
      if (payload.type === "send-message") {
        emitAppEvent("message_retry", { reason: "socket-offline", messageId: payload.id });
      }
    }
  }, [enqueueOfflinePayload, emitAppEvent]);

  const flushOfflineQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || offlineQueue.current.length === 0) return;

    while (offlineQueue.current.length > 0 && ws.readyState === WebSocket.OPEN) {
      const payload = offlineQueue.current[0];
      try {
        ws.send(JSON.stringify(payload));
        if (payload.type === "send-message") {
          emitAppEvent("message_retry", { reason: "flushed", messageId: payload.id });
        }
        offlineQueue.current.shift();
      } catch {
        break;
      }
    }

    persistOfflineQueue();
  }, [persistOfflineQueue, emitAppEvent]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(offlineQueueStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        offlineQueue.current = parsed.slice(-OFFLINE_QUEUE_LIMIT);
      }
    } catch (err) {
      console.warn("[WS] failed to load offline queue", err);
      offlineQueue.current = [];
    }
  }, [offlineQueueStorageKey]);

  const createCallSessionId = useCallback(
    () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  const matchesActiveCallSession = useCallback((incomingSessionId?: string) => {
    if (!incomingSessionId) return true;
    const activeSession = callSessionIdRef.current || incomingCallSessionIdRef.current;
    if (!activeSession) return true;
    return incomingSessionId === activeSession;
  }, []);

  const sendCallSignal = useCallback((data: any, queueIfOffline = false) => {
    const activeSession = callSessionIdRef.current || incomingCallSessionIdRef.current;
    sendSignal(
      {
        ...data,
        callSessionId: activeSession || undefined
      },
      queueIfOffline
    );
  }, [sendSignal]);

  const emitCallTelemetry = useCallback((event: string, detail: Record<string, any> = {}) => {
    const payload = {
      event,
      at: new Date().toISOString(),
      userType,
      sessionId: callSessionIdRef.current || incomingCallSessionIdRef.current || null,
      callType: currentCallType.current,
      ...detail
    };
    console.log("[WEBRTC_EVT]", JSON.stringify(payload));
    try {
      window.dispatchEvent(new CustomEvent("chat:call-telemetry", { detail: payload }));
    } catch {
      // ignore CustomEvent dispatch errors in unsupported contexts
    }
  }, [userType]);

  const updateMyProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const newProfile = { ...myProfile, ...updates };
    
    // Save to server first (source of truth)
    const saved = await saveServerProfile(userType, newProfile.name, newProfile.avatar);
    
    if (saved) {
      // Update local state
      setMyProfile(prev => ({ ...prev, ...updates }));
      
      // Also broadcast via socket for real-time update
      sendSignal({
        type: 'profile-update',
        profile: { name: newProfile.name, avatar: newProfile.avatar }
      });
    }
  }, [myProfile, userType, sendSignal]);

  const clearCallTimers = useCallback(() => {
    if (iceTimeoutRef.current) {
      clearTimeout(iceTimeoutRef.current);
      iceTimeoutRef.current = null;
    }
    if (callStatsIntervalRef.current) {
      clearInterval(callStatsIntervalRef.current);
      callStatsIntervalRef.current = null;
    }
    if (reconnectCallTimeoutRef.current) {
      clearTimeout(reconnectCallTimeoutRef.current);
      reconnectCallTimeoutRef.current = null;
    }
    if (backgroundVideoSuspendTimeoutRef.current) {
      clearTimeout(backgroundVideoSuspendTimeoutRef.current);
      backgroundVideoSuspendTimeoutRef.current = null;
    }
  }, []);

  const cleanupCall = useCallback((preserveSession = false, endReason = "unknown") => {
    const hadActiveSession = Boolean(callSessionIdRef.current || incomingCallSessionIdRef.current);
    const durationMs =
      callStartedAtRef.current != null ? Date.now() - callStartedAtRef.current : null;
    if (relayStartedAtRef.current) {
      relayTotalDurationMsRef.current += Date.now() - relayStartedAtRef.current;
      relayStartedAtRef.current = null;
    }
    if (hadActiveSession && !callEndLoggedRef.current) {
      emitCallTelemetry("call_end_reason", {
        reason: endReason,
        durationMs,
        relayUsageCount: relayUsageCountRef.current,
        relayTotalDurationMs: relayTotalDurationMsRef.current
      });
      callEndLoggedRef.current = true;
    }

    clearCallTimers();
    isMakingOfferRef.current = false;
    isRecoveringRef.current = false;
    recoveryAttemptsRef.current = 0;
    pendingRecoveryReasonRef.current = null;
    pendingCandidates.current = [];
    lastStatsRef.current = null;
    lastCandidatePairIdRef.current = "";
    lastInterfaceKeyRef.current = "";
    selectedRouteRef.current = "unknown";
    mediaRequestRef.current = null;
    forceRelayRef.current = false;
    videoSenderDetachedRef.current = false;
    videoSenderRef.current = null;
    lastRemoteOfferSdpRef.current = "";
    lastIceRestartAtRef.current = 0;
    handoffCooldownUntilRef.current = 0;
    qualityDowngradeStreakRef.current = 0;
    qualityUpgradeStreakRef.current = 0;
    statsTickRef.current = 0;
    callStartedAtRef.current = null;
    relayUsageCountRef.current = 0;
    relayTotalDurationMsRef.current = 0;
    currentVideoProfileRef.current = "hd";

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    if (peerRef.current) {
      try {
        peerRef.current.onicecandidate = null;
        peerRef.current.ontrack = null;
        peerRef.current.onconnectionstatechange = null;
        peerRef.current.oniceconnectionstatechange = null;
      } catch {}
      peerRef.current.close();
      peerRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
    currentCallType.current = null;
    incomingCallSessionIdRef.current = null;
    if (!preserveSession) {
      callSessionIdRef.current = null;
    }
  }, [clearCallTimers, emitCallTelemetry]);

  const getMediaConstraints = useCallback((mode: 'voice' | 'video', profile: VideoProfile = currentVideoProfileRef.current) => {
    const isSd = profile === "sd";
    const isAudioPriority = profile === "audio-priority";
    const isLowRamDevice =
      deviceMemoryGbRef.current > 0 && deviceMemoryGbRef.current <= 4;
    const hdWidth = isLowRamDevice ? 1280 : 1440;
    const hdHeight = isLowRamDevice ? 720 : 810;
    const hdFps = isLowRamDevice ? 24 : 30;
    return {
      audio: {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        sampleRate: { ideal: 48000 },
        channelCount: { ideal: 1 },
        latency: { ideal: 0.01 }
      },
      video:
        mode === 'video'
          ? {
              width: {
                ideal: isAudioPriority ? 480 : isSd ? 960 : hdWidth,
                max: isAudioPriority ? 640 : isSd ? 1280 : 1920
              },
              height: {
                ideal: isAudioPriority ? 270 : isSd ? 540 : hdHeight,
                max: isAudioPriority ? 360 : isSd ? 720 : 1080
              },
              frameRate: {
                ideal: isAudioPriority ? 10 : isSd ? 20 : hdFps,
                max: isAudioPriority ? 15 : isSd ? 24 : hdFps
              },
              aspectRatio: { ideal: 16 / 9 },
              resizeMode: "crop-and-scale",
              facingMode: 'user'
            }
          : false
    };
  }, []);

  const ensureLocalStream = useCallback(async (mode: 'voice' | 'video'): Promise<MediaStream> => {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (mode === "video" && !window.isSecureContext && !isLocalHost) {
      throw new Error("VIDEO_SECURE_CONTEXT_REQUIRED");
    }

    const existing = localStreamRef.current;
    if (existing) {
      const hasLiveAudio = existing.getAudioTracks().some(t => t.readyState === "live");
      const hasLiveVideo = existing.getVideoTracks().some(t => t.readyState === "live");
      if (hasLiveAudio && (mode === 'voice' || hasLiveVideo)) {
        return existing;
      }
    }

    if (mediaRequestRef.current) {
      return mediaRequestRef.current;
    }

    const requestUserMediaWithFallback = async () => {
      const baseAudio = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      try {
        return await navigator.mediaDevices.getUserMedia(getMediaConstraints(mode));
      } catch (primaryErr) {
        if (mode !== "video") {
          throw primaryErr;
        }
        console.warn("[WEBRTC] primary video constraints failed, retrying with fallback constraints", primaryErr);
      }

      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: baseAudio,
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 15, max: 24 },
          },
        });
      } catch (fallbackErr) {
        console.warn("[WEBRTC] secondary video constraints failed, retrying with minimal constraints", fallbackErr);
      }

      return navigator.mediaDevices.getUserMedia({
        audio: baseAudio,
        video: true,
      });
    };

    const request = requestUserMediaWithFallback()
      .then((stream) => {
        const qualityHint = currentVideoProfileRef.current === "hd" ? "detail" : "motion";
        stream.getVideoTracks().forEach((track) => {
          try {
            (track as MediaStreamTrack & { contentHint?: string }).contentHint = qualityHint;
          } catch {
            // Some browsers do not allow writing contentHint.
          }
        });
        if (localStreamRef.current && localStreamRef.current !== stream) {
          localStreamRef.current.getTracks().forEach((track) => track.stop());
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      })
      .finally(() => {
        mediaRequestRef.current = null;
      });

    mediaRequestRef.current = request;
    return request;
  }, [getMediaConstraints]);

  const applyVideoProfile = useCallback(async (profile: VideoProfile, reason = "adaptive") => {
    if (currentCallType.current !== 'video') return;
    if (currentVideoProfileRef.current === profile) return;
    const from = currentVideoProfileRef.current;
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track || track.readyState !== "live") return;
    try {
      await track.applyConstraints(getMediaConstraints('video', profile).video as MediaTrackConstraints);
      try {
        (track as MediaStreamTrack & { contentHint?: string }).contentHint = profile === "hd" ? "detail" : "motion";
      } catch {
        // Ignore unsupported contentHint assignments.
      }
      currentVideoProfileRef.current = profile;
      console.log(`[WEBRTC] Applied video profile=${profile}`);
      emitCallTelemetry("quality_change", { from, to: profile, reason });
    } catch (err) {
      console.warn('[WEBRTC] Failed to apply video profile', err);
    }
  }, [getMediaConstraints, emitCallTelemetry]);

  const flushPendingCandidates = useCallback(async (peer: RTCPeerConnection) => {
    for (const candidate of pendingCandidates.current) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding pending candidate:', e);
      }
    }
    pendingCandidates.current = [];
  }, []);

  const startCallStatsMonitor = useCallback((peer: RTCPeerConnection) => {
    if (callStatsIntervalRef.current) {
      clearInterval(callStatsIntervalRef.current);
    }

    const profileRank: Record<VideoProfile, number> = {
      "audio-priority": 0,
      sd: 1,
      hd: 2
    };

    callStatsIntervalRef.current = setInterval(async () => {
      try {
        if (peerRef.current !== peer) return;
        if (document.hidden) return;
        statsTickRef.current += 1;
        const stats = await peer.getStats();

        let selectedPair: any = null;
        let outboundVideo: any = null;
        let inboundVideo: any = null;
        let inboundAudio: any = null;
        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && (report.selected || report.nominated)) {
            selectedPair = report;
          }
          if (report.type === 'outbound-rtp' && report.kind === 'video' && !report.isRemote) {
            outboundVideo = report;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'video' && !report.isRemote) {
            inboundVideo = report;
          }
          if (report.type === 'inbound-rtp' && report.kind === 'audio' && !report.isRemote) {
            inboundAudio = report;
          }
        });

        let route: CandidateRoute = "unknown";
        let availableBitrateKbps = 0;
        let rttMs = 0;
        if (selectedPair) {
          const pair = selectedPair as any;
          const localCandidate = pair.localCandidateId ? stats.get(pair.localCandidateId as string) as any : null;
          const remoteCandidate = pair.remoteCandidateId ? stats.get(pair.remoteCandidateId as string) as any : null;
          const localType = localCandidate?.candidateType as CandidateRoute | undefined;
          const remoteType = remoteCandidate?.candidateType as CandidateRoute | undefined;

          route =
            localType === "relay" || remoteType === "relay"
              ? "relay"
              : localType === "srflx" || remoteType === "srflx"
              ? "srflx"
              : localType === "host" || remoteType === "host"
              ? "host"
              : "unknown";

          const localAddress = localCandidate?.address || localCandidate?.ip || "unknown";
          const localNetworkType = localCandidate?.networkType || "unknown";
          const localProtocol = localCandidate?.protocol || "unknown";
          const interfaceKey = `${localNetworkType}:${localAddress}:${localProtocol}:${localType || "unknown"}`;

          if (lastCandidatePairIdRef.current !== pair.id) {
            console.log(
              `[WEBRTC] selected candidate local=${localType || 'unknown'} remote=${remoteType || 'unknown'} protocol=${localProtocol}`
            );
            lastCandidatePairIdRef.current = pair.id;
          }

          if (route === "relay" && selectedRouteRef.current !== "relay") {
            relayStartedAtRef.current = Date.now();
            relayUsageCountRef.current += 1;
            emitCallTelemetry("relay_entered", {
              localType: localType || "unknown",
              remoteType: remoteType || "unknown",
              count: relayUsageCountRef.current
            });
          } else if (route !== "relay" && selectedRouteRef.current === "relay" && relayStartedAtRef.current) {
            relayTotalDurationMsRef.current += Date.now() - relayStartedAtRef.current;
            relayStartedAtRef.current = null;
          }
          selectedRouteRef.current = route;

          const handoffDetected =
            Boolean(lastInterfaceKeyRef.current) &&
            interfaceKey !== lastInterfaceKeyRef.current &&
            route !== "relay" &&
            Date.now() > handoffCooldownUntilRef.current;
          if (handoffDetected) {
            handoffCooldownUntilRef.current = Date.now() + 20000;
            emitCallTelemetry("network_handoff", {
              from: lastInterfaceKeyRef.current,
              to: interfaceKey,
              route
            });
            scheduleIceRecoveryRef.current("network-handoff");
          }
          lastInterfaceKeyRef.current = interfaceKey;

          if (pair.availableOutgoingBitrate) {
            availableBitrateKbps = Math.round(pair.availableOutgoingBitrate / 1000);
          }
          if (pair.currentRoundTripTime) {
            rttMs = Math.round(pair.currentRoundTripTime * 1000);
          }
        }

        let bitrateKbps = 0;
        let packetLossRate = 0;
        let frameDropRate = 0;
        let jitterMs = 0;
        if (outboundVideo) {
          if (lastStatsRef.current && outboundVideo.timestamp > lastStatsRef.current.timestamp) {
            const bytesDiff = (outboundVideo.bytesSent || 0) - lastStatsRef.current.bytesSent;
            const timeDiffSec = (outboundVideo.timestamp - lastStatsRef.current.timestamp) / 1000;
            bitrateKbps = timeDiffSec > 0 ? Math.round((bytesDiff * 8) / 1000 / timeDiffSec) : 0;

            const frameDropDiff = (outboundVideo.framesDropped || 0) - lastStatsRef.current.framesDropped;
            const frameEncodedDiff = (outboundVideo.framesEncoded || 0) - lastStatsRef.current.framesEncoded;
            const totalFrameDiff = Math.max(1, frameDropDiff + frameEncodedDiff);
            frameDropRate = frameDropDiff > 0 ? frameDropDiff / totalFrameDiff : 0;
          }
          lastStatsRef.current = {
            bytesSent: outboundVideo.bytesSent || 0,
            timestamp: outboundVideo.timestamp || Date.now(),
            framesEncoded: outboundVideo.framesEncoded || 0,
            framesDropped: outboundVideo.framesDropped || 0
          };
        }
        if (inboundVideo) {
          const lost = inboundVideo.packetsLost || 0;
          const received = inboundVideo.packetsReceived || 0;
          const total = lost + received;
          packetLossRate = total > 0 ? lost / total : 0;
          if (!rttMs && inboundVideo.roundTripTime) {
            rttMs = Math.round(inboundVideo.roundTripTime * 1000);
          }
          if (inboundVideo.jitter) {
            jitterMs = Math.round(inboundVideo.jitter * 1000);
          }
        }
        if (inboundAudio?.jitter) {
          jitterMs = Math.max(jitterMs, Math.round(inboundAudio.jitter * 1000));
        }

        if (bitrateKbps > 0 || packetLossRate > 0 || rttMs > 0 || jitterMs > 0) {
          console.log(
            `[WEBRTC] stats bitrate=${bitrateKbps}kbps avail=${availableBitrateKbps}kbps rtt=${rttMs}ms jitter=${jitterMs}ms packetLoss=${(packetLossRate * 100).toFixed(1)}% frameDrop=${(frameDropRate * 100).toFixed(1)}% route=${route}`
          );
        }

        if (currentCallType.current === 'video') {
          let desired: VideoProfile = "hd";
          const severeNetwork =
            packetLossRate >= 0.15 ||
            rttMs >= 1100 ||
            jitterMs >= 110 ||
            (availableBitrateKbps > 0 && availableBitrateKbps < 180) ||
            (bitrateKbps > 0 && bitrateKbps < 140) ||
            frameDropRate >= 0.28;
          const moderateNetwork =
            packetLossRate >= 0.08 ||
            rttMs >= 650 ||
            jitterMs >= 65 ||
            (availableBitrateKbps > 0 && availableBitrateKbps < 600) ||
            (bitrateKbps > 0 && bitrateKbps < 340) ||
            frameDropRate >= 0.16;

          if (severeNetwork) desired = "audio-priority";
          else if (moderateNetwork) desired = "sd";

          const current = currentVideoProfileRef.current;
          if (desired !== current) {
            const isDowngrade = profileRank[desired] < profileRank[current];
            if (isDowngrade) {
              qualityDowngradeStreakRef.current += 1;
              qualityUpgradeStreakRef.current = 0;
              if (qualityDowngradeStreakRef.current >= 2) {
                qualityDowngradeStreakRef.current = 0;
                await applyVideoProfile(desired, "stats-downgrade");
              }
            } else {
              qualityUpgradeStreakRef.current += 1;
              qualityDowngradeStreakRef.current = 0;
              if (qualityUpgradeStreakRef.current >= 4) {
                qualityUpgradeStreakRef.current = 0;
                await applyVideoProfile(desired, "stats-upgrade");
              }
            }
          } else {
            qualityDowngradeStreakRef.current = 0;
            qualityUpgradeStreakRef.current = 0;
          }
        }

        if (statsTickRef.current % 12 === 0) {
          peer.getSenders().forEach((sender) => {
            const senderTrack = sender.track;
            if (senderTrack && senderTrack.readyState === "ended") {
              sender.replaceTrack(null).catch(() => {});
            }
          });
          localStreamRef.current?.getTracks().forEach((track) => {
            if (track.readyState === "ended") {
              localStreamRef.current?.removeTrack(track);
            }
          });
        }
      } catch (err) {
        console.debug('[WEBRTC] stats collection failed', err);
      }
    }, 6000);
  }, [applyVideoProfile, emitCallTelemetry]);

  const scheduleIceRecovery = useCallback((reason: string) => {
    if (intentionalCallEndRef.current || callStatus === 'idle') return;
    if (document.hidden) {
      pendingRecoveryReasonRef.current = reason;
      return;
    }
    if (isRecoveringRef.current) return;
    if (reconnectCallTimeoutRef.current) clearTimeout(reconnectCallTimeoutRef.current);

    // Relay is already the fallback path; don't keep restarting on route changes.
    if (
      selectedRouteRef.current === "relay" &&
      (reason === "network-handoff" || reason === "network-change")
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastIceRestartAtRef.current < 3000) {
      return;
    }

    const delay = Math.min(900 * (recoveryAttemptsRef.current + 1), 3500);
    reconnectCallTimeoutRef.current = setTimeout(async () => {
      const peer = peerRef.current;
      if (!peer || !callSessionIdRef.current || intentionalCallEndRef.current) return;
      if (peer.signalingState !== 'stable' || isMakingOfferRef.current) {
        pendingRecoveryReasonRef.current = 'signaling-busy';
        return;
      }
      if (recoveryAttemptsRef.current >= 3) {
        emitCallTelemetry("recovery_failed", { reason, attempts: recoveryAttemptsRef.current });
        emitAppEvent("call_recovery", { status: "failed", reason, attempts: recoveryAttemptsRef.current });
        toast({ variant: 'destructive', title: 'Call connection lost' });
        cleanupCall(false, "recovery-failed");
        return;
      }

      isRecoveringRef.current = true;
      recoveryAttemptsRef.current += 1;
      lastIceRestartAtRef.current = Date.now();
      emitCallTelemetry("ice_restart", { reason, attempt: recoveryAttemptsRef.current });
      emitAppEvent("call_recovery", { status: "attempt", reason, attempt: recoveryAttemptsRef.current });
      console.log(`[WEBRTC] attempting ICE recovery reason=${reason} attempt=${recoveryAttemptsRef.current}`);

      try {
        if (recoveryAttemptsRef.current >= 1 && !forceRelayRef.current) {
          forceRelayRef.current = true;
          peer.setConfiguration(buildRtcConfig(true));
          console.log('[WEBRTC] forcing relay transport for recovery');
        }

        isMakingOfferRef.current = true;
        const offer = await peer.createOffer({ iceRestart: true });
        await peer.setLocalDescription(offer);
        sendCallSignal({ type: 'offer', sdp: offer, recovery: true }, true);

        if (iceTimeoutRef.current) clearTimeout(iceTimeoutRef.current);
        iceTimeoutRef.current = setTimeout(() => {
          const activePeer = peerRef.current;
          if (!activePeer) return;
          const state = activePeer.iceConnectionState;
          if (state !== 'connected' && state !== 'completed') {
            scheduleIceRecovery('ice-timeout');
          }
        }, 10000);
      } catch (err) {
        console.error('[WEBRTC] ICE recovery failed', err);
        emitCallTelemetry("recovery_failed", {
          reason,
          attempt: recoveryAttemptsRef.current,
          error: err instanceof Error ? err.message : String(err)
        });
        emitAppEvent("call_recovery", {
          status: "error",
          reason,
          attempt: recoveryAttemptsRef.current
        });
        scheduleIceRecovery('restart-failed');
      } finally {
        isMakingOfferRef.current = false;
        isRecoveringRef.current = false;
      }
    }, delay);
  }, [callStatus, toast, cleanupCall, sendCallSignal, emitCallTelemetry, emitAppEvent]);

  useEffect(() => {
    scheduleIceRecoveryRef.current = scheduleIceRecovery;
  }, [scheduleIceRecovery]);

  const createPeerConnection = useCallback((stream: MediaStream, recreate = false) => {
    if (peerRef.current && !recreate) {
      return peerRef.current;
    }

    if (peerRef.current && recreate) {
      try {
        peerRef.current.close();
      } catch {}
      peerRef.current = null;
    }

    const peer = new RTCPeerConnection(buildRtcConfig(forceRelayRef.current));
    peerRef.current = peer;

    const existingSenders = peer.getSenders();
    const existingVideoSender = existingSenders.find((s) => s.track?.kind === "video");
    if (existingVideoSender) {
      videoSenderRef.current = existingVideoSender;
    }
    stream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some(s => s.track?.id === track.id);
      if (!alreadyAdded) {
        const sender = peer.addTrack(track, stream);
        if (track.kind === "video") {
          videoSenderRef.current = sender;
        }
      }
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendCallSignal({
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
          }
        }, true);
      }
    };

    peer.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    peer.onconnectionstatechange = () => {
      console.log(`[WEBRTC] connectionState=${peer.connectionState}`);
      if (peer.connectionState === 'connected') {
        setCallStatus('connected');
      }
      if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
        scheduleIceRecovery(`connection-${peer.connectionState}`);
      }
    };

    peer.oniceconnectionstatechange = () => {
      const state = peer.iceConnectionState;
      console.log(`[WEBRTC] iceConnectionState=${state}`);
      if (state === 'connected' || state === 'completed') {
        const wasRecovering = recoveryAttemptsRef.current > 0 || isRecoveringRef.current;
        recoveryAttemptsRef.current = 0;
        pendingRecoveryReasonRef.current = null;
        if (iceTimeoutRef.current) {
          clearTimeout(iceTimeoutRef.current);
          iceTimeoutRef.current = null;
        }
        setCallStatus('connected');
        if (wasRecovering) {
          emitCallTelemetry("recovery_success", { state });
          emitAppEvent("call_recovery", { status: "success", state });
        }
        startCallStatsMonitor(peer);
      } else if (state === 'disconnected' || state === 'failed') {
        scheduleIceRecovery(`ice-${state}`);
      }
    };

    return peer;
  }, [scheduleIceRecovery, sendCallSignal, startCallStatsMonitor, emitCallTelemetry, emitAppEvent]);

  const initiateWebRTC = useCallback(async (mode: 'voice' | 'video') => {
    try {
      intentionalCallEndRef.current = false;
      forceRelayRef.current = shouldForceRelayByDefault();
      if (forceRelayRef.current) {
        console.log("[WEBRTC] forcing relay by default for this call");
      }
      const stream = await ensureLocalStream(mode);
      const peer = createPeerConnection(stream);
      if (peer.signalingState !== 'stable' || isMakingOfferRef.current) return;

      isMakingOfferRef.current = true;
      const offer = await peer.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: mode === 'video'
      });
      await peer.setLocalDescription(offer);
      sendCallSignal({ type: 'offer', sdp: offer }, true);

      if (iceTimeoutRef.current) clearTimeout(iceTimeoutRef.current);
      iceTimeoutRef.current = setTimeout(() => {
        const activePeer = peerRef.current;
        if (!activePeer) return;
        const state = activePeer.iceConnectionState;
        if (state !== 'connected' && state !== 'completed') {
          scheduleIceRecovery('initial-timeout');
        }
      }, 10000);
    } catch (err) {
      console.error('Media error:', err);
      toast({
        variant: 'destructive',
        title:
          err instanceof Error && err.message === "VIDEO_SECURE_CONTEXT_REQUIRED"
            ? "Video calls on phone require HTTPS (secure site)"
            : "Could not access camera/microphone"
      });
      cleanupCall(false, "media-access-failed");
    } finally {
      isMakingOfferRef.current = false;
    }
  }, [ensureLocalStream, createPeerConnection, sendCallSignal, scheduleIceRecovery, toast, cleanupCall]);

  const handleOffer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    try {
      intentionalCallEndRef.current = false;
      forceRelayRef.current = shouldForceRelayByDefault();
      if (forceRelayRef.current) {
        console.log("[WEBRTC] forcing relay by default for this call");
      }
      const mode = currentCallType.current || 'voice';
      const stream = await ensureLocalStream(mode);
      const peer = createPeerConnection(stream);
      const incomingSdp = sdp.sdp || "";
      if (incomingSdp && incomingSdp === lastRemoteOfferSdpRef.current && peer.signalingState === 'stable') {
        console.log('[WEBRTC] Ignoring duplicate remote offer');
        return;
      }
      lastRemoteOfferSdpRef.current = incomingSdp;

      const offerCollision = isMakingOfferRef.current || peer.signalingState !== 'stable';
      if (offerCollision && !isPolitePeerRef.current) {
        console.log('[WEBRTC] Ignoring offer collision (impolite peer)');
        return;
      }

      if (offerCollision) {
        await peer.setLocalDescription({ type: 'rollback' } as RTCSessionDescriptionInit);
      }

      await peer.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sendCallSignal({ type: 'answer', sdp: answer }, true);

      if (iceTimeoutRef.current) clearTimeout(iceTimeoutRef.current);
      iceTimeoutRef.current = setTimeout(() => {
        const activePeer = peerRef.current;
        if (!activePeer) return;
        const state = activePeer.iceConnectionState;
        if (state !== 'connected' && state !== 'completed') {
          scheduleIceRecovery('answer-timeout');
        }
      }, 10000);
    } catch (e) {
      console.error('Error handling offer:', e);
      toast({
        variant: 'destructive',
        title:
          e instanceof Error && e.message === "VIDEO_SECURE_CONTEXT_REQUIRED"
            ? "Video calls on phone require HTTPS (secure site)"
            : 'Failed to connect call',
      });
      cleanupCall(false, "offer-handle-failed");
    }
  }, [ensureLocalStream, createPeerConnection, flushPendingCandidates, sendCallSignal, scheduleIceRecovery, toast, cleanupCall]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    if (!peerRef.current) return;
    try {
      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(sdp)
      );
      await flushPendingCandidates(peerRef.current);
    } catch (e) {
      console.error('Error handling answer:', e);
    }
  }, [flushPendingCandidates]);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    if (!candidate) return;

    if (peerRef.current?.remoteDescription) {
      try {
        await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    } else {
      pendingCandidates.current.push(candidate);
    }
  }, []);

  const handleMessage = useCallback(async (data: any) => {
    // Note: We do NOT skip messages based on processedMessageIds here.
    // Individual handlers (chat-message, sync-messages, etc.) do proper merging
    // to update status and fields even for existing messages.
    switch (data.type) {
      case 'joined':
      case 'room-joined': {
        if (data.peerProfile) {
          setPeerProfile((prev) => ({
            ...prev,
            ...data.peerProfile,
            lastSeen: data.peerOnline ? null : prev.lastSeen,
            isTyping: false
          }));
        }
        setPeerConnected(Boolean(data.peerOnline));
        setIsPeerOnline(Boolean(data.peerOnline));
        break;
      }

      case 'peer-joined': {
        setPeerConnected(true);
        setIsPeerOnline(true);
        const peerName = data.profile?.name || defaultPeerName;
        setPeerProfile((prev) => ({
          ...prev,
          name: data.profile?.name || '',
          avatar: data.profile?.avatar || '',
          lastSeen: null,
          isTyping: false
        }));
        toast({ title: `${peerName} is online!` });

        if (userType === 'admin') {
          logConnectionEvent(peerName, 'Came online');
          showBrowserNotification(
            '💚 Friend Online',
            `${peerName} just came online!`,
            data.profile?.avatar,
            userType
          );
        }

        sendSignal({
          type: 'profile-update',
          profile: { name: myProfileRef.current.name, avatar: myProfileRef.current.avatar }
        });
        break;
      }

      case 'peer-left': {
        setPeerConnected(false);
        setIsPeerOnline(false);
        const leftPeerName = peerProfileRef.current.name || defaultPeerName;
        setPeerProfile((prev) => ({
          ...prev,
          lastSeen: new Date(),
          isTyping: false
        }));
        toast({ title: `${leftPeerName} went offline` });
        if (userType === 'admin') {
          logConnectionEvent(leftPeerName, 'Went offline');
        }
        cleanupCall(false, "peer-left");
        break;
      }

      case 'profile-update':
      case 'profile_updated':
      case 'peer_profile_updated':
      case 'peer-profile-update':
      case 'self-profile-update': {
        if (!data.profile || !data.userType) break;

        const profileUserType = data.userType;   // ONLY trust server-defined userType
        const peerType = userType === 'admin' ? 'friend' : 'admin';

        console.log(`[PROFILE UPDATE] Received: type=${data.type}, profileUserType=${profileUserType}, myType=${userType}`);

        if (profileUserType === userType) {
          // MY profile updated (from another device)
          setMyProfile(prev => ({
            ...prev,
            name: data.profile.name,
            avatar: data.profile.avatar
          }));
          localStorage.setItem(`chat_my_profile_${userType}`, JSON.stringify({
            name: data.profile.name,
            avatar: data.profile.avatar
          }));
        }

        else if (profileUserType === peerType) {
          // PEER profile updated
          setPeerProfile(prev => ({
            ...prev,
            name: data.profile.name,
            avatar: data.profile.avatar
          }));
          localStorage.setItem(`chat_peer_profile_${userType}`, JSON.stringify({
            name: data.profile.name,
            avatar: data.profile.avatar
          }));
        }

        break;
      }

      case 'typing': {
        setPeerProfile((prev) => ({
          ...prev,
          isTyping: Boolean(data.isTyping)
        }));
        break;
      }

      case 'password-changed': {
        // Password was changed (either on this device or another)
        if (data.userType === userType) {
          toast({
            title: '🔐 Password Changed',
            description: 'Your password has been updated. Use the new password for future logins.'
          });
        }
        break;
      }

      case 'chat-message': {
        const msgId = data.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const msgSenderName = data.senderName || '';
        const incomingSender: 'me' | 'them' =
          data.sender === 'me' ? 'me' : 'them';

        const incomingMsg: Message = {
          id: msgId,
          text: data.text || '',
          sender: incomingSender,
          timestamp: new Date(
            typeof data.timestamp === 'number'
              ? data.timestamp
              : data.timestamp || Date.now()
          ),
          type: data.messageType || 'text',
          mediaUrl: data.mediaUrl,
          senderName: msgSenderName,
          status: (data.status as Message['status']) || 'delivered',
          replyTo: data.replyTo
        };

        // Always merge: update existing or insert new
        setMessages((prev) => {
          const existingIndex = prev.findIndex((m) => m.id === msgId);
          
          if (existingIndex >= 0) {
            // Update existing message (merge fields, preserve higher status)
            const existing = prev[existingIndex];
            const statusPriority: Record<string, number> = {
              'sent': 1, 'delivered': 2, 'read': 3
            };
            const existingPriority = statusPriority[existing.status || 'sent'] ?? 1;
            const incomingPriority = statusPriority[incomingMsg.status || 'sent'] ?? 1;
            
            const updated = [...prev];
            updated[existingIndex] = {
              ...existing,
              ...incomingMsg,
              // Keep higher status (don't downgrade)
              status: incomingPriority >= existingPriority ? incomingMsg.status : existing.status
            };
            return updated;
          }
          
          // Insert new message
          return [...prev, incomingMsg].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
        });

        // Clean up old message IDs to prevent memory leak
        if (processedMessageIds.current.size > 1000) {
          const idsArray = Array.from(processedMessageIds.current);
          processedMessageIds.current = new Set(idsArray.slice(-500));
        }

        // Update lastSyncTimestamp
        const msgTimestamp = incomingMsg.timestamp.getTime();
        if (msgTimestamp > lastSyncTimestamp.current) {
          lastSyncTimestamp.current = msgTimestamp;
          localStorage.setItem(`lastSyncTimestamp_${userType}`, msgTimestamp.toString());
        }

        setPeerProfile((prev) => ({ ...prev, isTyping: false }));

        // Auto-mark incoming messages as read instantly
        if (incomingSender === 'them') {
          tryMarkAsRead(incomingMsg);
        }

        if (userType === 'admin' && incomingSender === 'them') {
          const msgPreview =
            incomingMsg.type === 'text'
              ? incomingMsg.text.length > 50
                ? incomingMsg.text.substring(0, 50) + '...'
                : incomingMsg.text
              : incomingMsg.type === 'image'
              ? '📷 Photo'
              : incomingMsg.type === 'video'
              ? '🎥 Video'
              : incomingMsg.type === 'audio'
              ? '🎤 Voice message'
              : 'New message';

          showBrowserNotification(`💬 ${msgSenderName}`, msgPreview);
        }
        break;
      }

      case 'call-request': {
        const incomingSessionId = data.callSessionId as string | undefined;
        if (
          incomingSessionId &&
          callSessionIdRef.current &&
          incomingSessionId !== callSessionIdRef.current
        ) {
          // Busy with another call session, reject stale/new competing request.
          sendSignal({ type: 'call-rejected', callSessionId: incomingSessionId }, true);
          break;
        }

        if (callStatus === 'connected' || callStatus === 'calling' || activeCall) {
          sendSignal({ type: 'call-rejected', callSessionId: incomingSessionId }, true);
          break;
        }

        if (incomingCallSessionIdRef.current && incomingSessionId && incomingCallSessionIdRef.current === incomingSessionId) {
          break;
        }

        incomingCallSessionIdRef.current = incomingSessionId || createCallSessionId();
        callSessionIdRef.current = incomingCallSessionIdRef.current;
        intentionalCallEndRef.current = false;
        currentCallType.current = data.callType;
        setIncomingCall({ type: data.callType, from: data.from });
        setCallStatus('ringing');
        break;
      }

      case 'call-accepted': {
        if (!matchesActiveCallSession(data.callSessionId)) {
          console.log('[WEBRTC] Ignoring stale call-accepted');
          break;
        }
        if (!callSessionIdRef.current) {
          callSessionIdRef.current = data.callSessionId || createCallSessionId();
        }
        currentCallType.current = data.callType;
        await initiateWebRTC(data.callType);
        break;
      }

      case 'call-rejected': {
        if (!matchesActiveCallSession(data.callSessionId)) break;
        toast({ title: 'Call declined' });
        intentionalCallEndRef.current = true;
        cleanupCall(false, "rejected-by-peer");
        break;
      }

      case 'offer': {
        if (!matchesActiveCallSession(data.callSessionId)) {
          console.log('[WEBRTC] Ignoring stale offer');
          break;
        }
        if (!callSessionIdRef.current) {
          callSessionIdRef.current = data.callSessionId || createCallSessionId();
        }
        await handleOffer(data.sdp);
        break;
      }

      case 'answer': {
        if (!matchesActiveCallSession(data.callSessionId)) {
          console.log('[WEBRTC] Ignoring stale answer');
          break;
        }
        await handleAnswer(data.sdp);
        break;
      }

      case 'ice-candidate': {
        if (!matchesActiveCallSession(data.callSessionId)) {
          console.log('[WEBRTC] Ignoring stale ice-candidate');
          break;
        }
        await handleIceCandidate(data.candidate);
        break;
      }

      case 'call-end': {
        if (!matchesActiveCallSession(data.callSessionId)) break;
        toast({ title: 'Call ended' });
        intentionalCallEndRef.current = true;
        cleanupCall(false, "ended-by-peer");
        break;
      }

      case 'message-queued': {
        const queuedStatus: "sent" | "delivered" | "read" =
          data.status === "delivered" || data.status === "read" ? data.status : "sent";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.id ? { ...m, status: queuedStatus } : m
          )
        );
        break;
      }

      case 'message_update': {
        // Unified message status update event
        // { type: 'message_update', ids: [...], status: 'sent' | 'delivered' | 'read' }

        if (!Array.isArray(data.ids) || !data.status) break;

        const statusPriority: Record<string, number> = {
          'sending': 0,
          'sent': 1,
          'delivered': 2,
          'read': 3
        };
        const newStatusPriority = statusPriority[data.status] ?? 1;

        setMessages(prev =>
          prev.map(m => {
            if (!data.ids.includes(m.id)) return m;

            const currentPriority = statusPriority[m.status || 'sending'] ?? 0;
            // Update if new status is higher or equal priority (ensure status is set)
            if (newStatusPriority >= currentPriority) {
              return { ...m, status: data.status as 'sent' | 'delivered' | 'read' };
            }
            return m;
          })
        );
        break;
      }

      case 'emergency-wipe': {
        setMessages([]);
        localStorage.removeItem(`chat_messages_${userType}`);
        processedMessageIds.current.clear();
        toast({
          title: '🚨 All messages wiped',
          variant: 'destructive'
        });
        break;
      }

      case 'sync-request': {
        const currentMessages = JSON.parse(
          localStorage.getItem(`chat_messages_${userType}`) || '[]'
        );
        sendSignal({
          type: 'sync-response',
          targetDeviceId: data.targetDeviceId,
          messages: currentMessages
        });
        break;
      }

      case 'sync-messages': {
        if (data.messages && Array.isArray(data.messages)) {
          console.log(`[SYNC] Received ${data.messages.length} messages from server, current local: ${messagesRef.current.length}`);
          
          const statusPriority: Record<string, number> = {
            'sending': 0, 'sent': 1, 'delivered': 2, 'read': 3
          };

          // Convert incoming messages to Message format
          const incomingMessages: Message[] = data.messages.map((m: any) => ({
            id: m.id,
            text: m.text || '',
            sender: m.sender as 'me' | 'them',
            timestamp: new Date(m.timestamp),
            type: m.type || m.messageType || 'text',
            mediaUrl: m.mediaUrl,
            senderName: m.senderName || defaultPeerName,
            status: m.status || 'delivered',
            replyTo: m.replyTo ? {
              id: m.replyTo.id,
              text: m.replyTo.text || '',
              sender: m.replyTo.sender
            } : undefined
          }));

          setMessages((prev) => {
            // Build a map of existing messages by ID
            const messageMap = new Map<string, Message>();
            prev.forEach(m => messageMap.set(m.id, m));

            // Merge incoming messages
            for (const incoming of incomingMessages) {
              const existing = messageMap.get(incoming.id);
              
              if (existing) {
                // Update existing: merge fields, preserve higher status
                const existingPriority = statusPriority[existing.status || 'sending'] ?? 0;
                const incomingPriority = statusPriority[incoming.status || 'sent'] ?? 1;
                
                messageMap.set(incoming.id, {
                  ...existing,
                  ...incoming,
                  status: incomingPriority >= existingPriority ? incoming.status : existing.status
                });
              } else {
                // Insert new message
                messageMap.set(incoming.id, incoming);
              }
            }

            // Convert back to array and sort by timestamp
            const merged = Array.from(messageMap.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );

            // Update lastSyncTimestamp
            if (merged.length > 0) {
              const latestTimestamp = Math.max(
                ...merged.map(m => new Date(m.timestamp).getTime())
              );
              lastSyncTimestamp.current = latestTimestamp;
              localStorage.setItem(`lastSyncTimestamp_${userType}`, latestTimestamp.toString());
            }

            console.log(`[SYNC] After merge: ${merged.length} total messages`);
            return merged;
          });

          const unread = incomingMessages
            .filter(m => m.sender === 'them' && m.status !== 'read')
            .map(m => m.id);

          if (unread.length > 0 && isDocumentVisible.current) {
            sendSignal({ type: "message-read", ids: unread });
          }
        }
        break;
      }

      case 'message-deleted': {
        setMessages((prev) => prev.filter((m) => m.id !== data.id));
        break;
      }
    }
  }, [
    defaultPeerName,
    userType,
    activeCall,
    callStatus,
    createCallSessionId,
    matchesActiveCallSession,
    sendSignal,
    toast,
    cleanupCall,
    initiateWebRTC,
    handleOffer,
    handleAnswer,
    handleIceCandidate
  ]);

  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  const connect = useCallback(() => {
  if (Date.now() < reconnectBlockedUntilRef.current) {
    return;
  }
  if (
    wsRef.current?.readyState === WebSocket.OPEN ||
    wsRef.current?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  isIntentionalClose.current = false;

  if (wsRef.current) {
  try {
    wsRef.current.close();
  } catch {}
}

  const ws = new WebSocket(getWebSocketUrl());
  wsRef.current = ws;

  ws.onopen = () => {
    reconnectAttempts.current = 0;
    reconnectBlockedUntilRef.current = 0;

    ws.send(
      JSON.stringify({
        type: "join",
        roomId: FIXED_ROOM_ID,
        profile: {
          name: myProfileRef.current.name,
          avatar: myProfileRef.current.avatar,
        },
        userType,
        deviceId: deviceId.current,
        sessionId: sessionId.current,
        lastSyncTimestamp: lastSyncTimestamp.current,
      })
    );

    setIsConnected(true);

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    flushOfflineQueue();
    emitAppEvent("network_change", { state: "ws-open" });
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      await handleMessageRef.current(data);
    } catch (err) {
      console.error("WebSocket parse error:", err);
    }
  };

  ws.onerror = () => console.log("WS error");

ws.onclose = () => {
  setIsConnected(false);

  // stop reconnect if we closed intentionally
  if (isIntentionalClose.current) return;

  // stop reconnect if page hidden (prevents background loop)
  if (document.hidden) return;

  // limit attempts
  if (reconnectAttempts.current >= maxReconnectAttempts.current) {
    console.log("Max reconnect reached");
    return;
  }

  reconnectAttempts.current += 1;

  const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 8000);
  reconnectBlockedUntilRef.current = Date.now() + delay;
  emitAppEvent("network_change", {
    state: "ws-reconnect-wait",
    attempt: reconnectAttempts.current,
    delayMs: delay
  });

  reconnectTimeoutRef.current = setTimeout(() => {
    if (!isIntentionalClose.current) {
      connect();
    }
  }, delay);
};
}, [userType, flushOfflineQueue, emitAppEvent]);

  useEffect(() => {
    const tryResume = () => {
      if (isIntentionalClose.current) return;
      if (document.hidden) return;
      if (navigator.onLine === false) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }
      connect();
    };

    const onVisibility = () => {
      if (!document.hidden) {
        emitAppEvent("background_resume", { source: "chat-connection" });
        tryResume();
      }
    };
    const onOnline = () => tryResume();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [connect, emitAppEvent]);

  const sendTyping = useCallback((isTyping: boolean) => {
    sendSignal({ type: 'typing', isTyping });
  }, [sendSignal]);

  const handleTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentAtRef.current > 700) {
      sendTyping(true);
      lastTypingSentAtRef.current = now;
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
      lastTypingSentAtRef.current = 0;
    }, 2000);
  }, [sendTyping]);

  const sendMessage = useCallback((msg: Partial<Message>) => {
    // Sanitize input
    const sanitizedText = typeof msg.text === 'string' 
      ? msg.text.trim().slice(0, 10000) // Max 10k chars
      : '';
    
    if (!sanitizedText && !msg.mediaUrl && msg.type === 'text') {
      return; // Don't send empty messages
    }

    const now = new Date();
    const newMsg: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      text: sanitizedText,
      sender: 'me',
      timestamp: now,
      type: msg.type || 'text',
      mediaUrl: msg.mediaUrl ? String(msg.mediaUrl).slice(0, 2048) : undefined, // Max URL length
      senderName: myProfileRef.current.name.slice(0, 100), // Max name length
      status: 'sent',
      replyTo: msg.replyTo ? {
        id: String(msg.replyTo.id).slice(0, 100),
        text: String(msg.replyTo.text || '').slice(0, 500),
        sender: msg.replyTo.sender
      } : undefined
    };

    processedMessageIds.current.add(newMsg.id);
    setMessages((prev) => {
      // Prevent duplicate messages in state
      if (prev.some(m => m.id === newMsg.id)) {
        return prev;
      }
      return [...prev, newMsg];
    });
    sendTyping(false);

    sendSignal({
      type: 'send-message',
      id: newMsg.id,
      text: newMsg.text,
      messageType: newMsg.type,
      mediaUrl: newMsg.mediaUrl,
      timestamp: now.toISOString(),
      senderName: myProfileRef.current.name,
      replyTo: newMsg.replyTo
    }, true);

    return newMsg;
  }, [sendSignal, sendTyping]);

  const emergencyWipe = useCallback(() => {
    sendSignal({ type: 'emergency-wipe' });
    setMessages([]);
    localStorage.removeItem(`chat_messages_${userType}`);
    processedMessageIds.current.clear();
  }, [sendSignal, userType]);

  const deleteMessage = useCallback((msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
  }, []);

  const deleteMessages = useCallback(
    (msgIds: string[]) => {
      const idSet = new Set(msgIds);
      setMessages((prev) => prev.filter((m) => !idSet.has(m.id)));
      msgIds.forEach((id) => sendSignal({ type: 'message-delete', id }));
    },
    [sendSignal]
  );

  const mergeMessagesById = useCallback((prev: Message[], incoming: Message[]) => {
    const statusPriority: Record<string, number> = {
      sending: 0,
      sent: 1,
      delivered: 2,
      read: 3,
    };

    const messageMap = new Map<string, Message>();
    prev.forEach((m) => messageMap.set(m.id, m));

    for (const nextMessage of incoming) {
      const existing = messageMap.get(nextMessage.id);
      if (!existing) {
        messageMap.set(nextMessage.id, nextMessage);
        continue;
      }
      const existingPriority = statusPriority[existing.status || "sending"] ?? 0;
      const incomingPriority = statusPriority[nextMessage.status || "sent"] ?? 1;
      messageMap.set(nextMessage.id, {
        ...existing,
        ...nextMessage,
        status: incomingPriority >= existingPriority ? nextMessage.status : existing.status,
      });
    }

    return Array.from(messageMap.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderHistory || !hasMoreHistory || !historyCursorRef.current) {
      return;
    }

    setIsLoadingOlderHistory(true);
    try {
      const batch = await fetchChatHistory(
        userType,
        historyCursorRef.current,
        OLDER_HISTORY_PAGE_SIZE
      );
      historyCursorRef.current = batch.nextCursor;
      setHasMoreHistory(batch.hasMore);
      if (batch.messages.length > 0) {
        setMessages((prev) => mergeMessagesById(prev, batch.messages));
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setIsLoadingOlderHistory(false);
    }
  }, [hasMoreHistory, isLoadingOlderHistory, mergeMessagesById, userType]);

  const startCall = useCallback(async (mode: 'voice' | 'video') => {
    if (!peerConnectedRef.current) {
      toast({ variant: 'destructive', title: 'Friend not online' });
      return;
    }
    if (callStatus === 'calling' || callStatus === 'connected') {
      return;
    }
    intentionalCallEndRef.current = false;
    const newCallSessionId = createCallSessionId();
    callSessionIdRef.current = newCallSessionId;
    incomingCallSessionIdRef.current = null;
    callEndLoggedRef.current = false;
    callStartedAtRef.current = Date.now();
    relayStartedAtRef.current = null;
    relayUsageCountRef.current = 0;
    relayTotalDurationMsRef.current = 0;
    recoveryAttemptsRef.current = 0;
    forceRelayRef.current = false;
    currentVideoProfileRef.current = "hd";
    currentCallType.current = mode;
    setActiveCall(mode);
    setCallStatus('calling');
    emitCallTelemetry("call_start", { direction: "outgoing", mode });
    sendSignal(
      {
        type: 'call-request',
        callType: mode,
        from: myProfileRef.current.name,
        callSessionId: newCallSessionId
      },
      true
    );
  }, [callStatus, createCallSessionId, sendSignal, toast, emitCallTelemetry]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    if (!incomingCallSessionIdRef.current) return;
    if (callStatus === 'connected') return;
    const callType = incomingCall.type;
    intentionalCallEndRef.current = false;
    callSessionIdRef.current = incomingCallSessionIdRef.current;
    callEndLoggedRef.current = false;
    callStartedAtRef.current = Date.now();
    relayStartedAtRef.current = null;
    relayUsageCountRef.current = 0;
    relayTotalDurationMsRef.current = 0;
    currentVideoProfileRef.current = "hd";
    currentCallType.current = callType;
    setActiveCall(callType);
    setIncomingCall(null);
    setCallStatus('calling');
    emitCallTelemetry("call_start", { direction: "incoming", mode: callType });
    sendCallSignal({ type: 'call-accepted', callType }, true);
  }, [callStatus, incomingCall, sendCallSignal, emitCallTelemetry]);

  const rejectCall = useCallback(() => {
    if (callStatus === 'idle' && !incomingCall) return;
    intentionalCallEndRef.current = true;
    sendCallSignal({ type: 'call-rejected' }, true);
    cleanupCall(false, "rejected-local");
  }, [callStatus, incomingCall, sendCallSignal, cleanupCall]);

  const endCall = useCallback(() => {
    intentionalCallEndRef.current = true;
    sendCallSignal({ type: 'call-end' }, true);
    cleanupCall(false, "ended-local");
  }, [sendCallSignal, cleanupCall]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff((prev) => !prev);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(`chat_messages_${userType}`);
    processedMessageIds.current.clear();
    sendSignal({ type: 'emergency-wipe' });
  }, [userType, sendSignal]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Background policy: keep audio alive, reduce video load, and stop video only if hidden for long.
        if (currentCallType.current === 'video' && callStatus !== 'idle') {
          void applyVideoProfile("sd", "background-hidden");
          if (backgroundVideoSuspendTimeoutRef.current) {
            clearTimeout(backgroundVideoSuspendTimeoutRef.current);
          }
          backgroundVideoSuspendTimeoutRef.current = setTimeout(() => {
            if (!document.hidden || callStatus === 'idle') return;
            const sender = videoSenderRef.current;
            const liveTrack = localStreamRef.current?.getVideoTracks().find((t) => t.readyState === "live");
            if (!sender || !liveTrack) return;
            sender
              .replaceTrack(null)
              .then(() => {
                liveTrack.stop();
                localStreamRef.current?.removeTrack(liveTrack);
                videoSenderDetachedRef.current = true;
                setIsVideoOff(true);
              })
              .catch((err) => console.warn('[WEBRTC] failed to detach background video sender', err));
          }, 30000);
        }
        return;
      }

      if (backgroundVideoSuspendTimeoutRef.current) {
        clearTimeout(backgroundVideoSuspendTimeoutRef.current);
        backgroundVideoSuspendTimeoutRef.current = null;
      }

      if (pendingRecoveryReasonRef.current && callStatus !== 'idle') {
        const reason = pendingRecoveryReasonRef.current;
        pendingRecoveryReasonRef.current = null;
        scheduleIceRecovery(`resume-${reason}`);
      }

      // Resume camera without renegotiation when possible.
      if (currentCallType.current === 'video' && callStatus !== 'idle') {
        const hasLiveVideo = localStreamRef.current?.getVideoTracks().some((t) => t.readyState === 'live');
        if (!hasLiveVideo || videoSenderDetachedRef.current) {
          navigator.mediaDevices
            .getUserMedia({ video: getMediaConstraints('video', currentVideoProfileRef.current).video as MediaTrackConstraints, audio: false })
            .then((stream) => {
              const track = stream.getVideoTracks()[0];
              if (!track) return;
              try {
                (track as MediaStreamTrack & { contentHint?: string }).contentHint =
                  currentVideoProfileRef.current === "hd" ? "detail" : "motion";
              } catch {
                // Ignore unsupported contentHint assignments.
              }
              if (!localStreamRef.current) {
                localStreamRef.current = new MediaStream();
              }
              localStreamRef.current?.addTrack(track);
              const sender =
                videoSenderRef.current ||
                peerRef.current?.getSenders().find((s) => s.track?.kind === 'video') ||
                null;
              if (sender) {
                videoSenderRef.current = sender;
                sender.replaceTrack(track).catch(() => {});
              } else if (peerRef.current && localStreamRef.current) {
                videoSenderRef.current = peerRef.current.addTrack(track, localStreamRef.current);
              }
              videoSenderDetachedRef.current = false;
              setIsVideoOff(false);
              void applyVideoProfile(currentVideoProfileRef.current, "background-resume");
            })
            .catch((err) => console.warn('[WEBRTC] failed to resume camera', err));
        } else {
          const track = localStreamRef.current?.getVideoTracks()[0];
          if (track) {
            track.enabled = true;
            setIsVideoOff(false);
          }
        }
      }

      if (!document.hidden && messagesRef.current.length > 0) {
        const unreadMessageIds = messagesRef.current
          .filter(m => m.sender === 'them' && m.status !== 'read')
          .map(m => m.id);

        if (unreadMessageIds.length > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          sendSignal({ type: 'message-read', ids: unreadMessageIds.filter(id => id) });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (backgroundVideoSuspendTimeoutRef.current) {
        clearTimeout(backgroundVideoSuspendTimeoutRef.current);
        backgroundVideoSuspendTimeoutRef.current = null;
      }
    };
  }, [callStatus, getMediaConstraints, scheduleIceRecovery, sendSignal, applyVideoProfile]);

  useEffect(() => {
    const handleOnline = () => {
      emitAppEvent("network_change", { state: "online" });
      if (callStatus !== 'idle' && !document.hidden) {
        scheduleIceRecovery('network-online');
      }
    };

    const connectionAny = (navigator as any).connection;
    const handleConnectionChange = () => {
      emitAppEvent("network_change", {
        state: "connection-change",
        effectiveType: connectionAny?.effectiveType || "unknown",
        downlink: connectionAny?.downlink || null
      });
      if (callStatus !== 'idle' && !document.hidden) {
        const now = Date.now();
        if (now > handoffCooldownUntilRef.current) {
          handoffCooldownUntilRef.current = now + 15000;
          emitCallTelemetry("network_handoff", {
            trigger: "connection-change",
            effectiveType: connectionAny?.effectiveType || "unknown",
            downlink: connectionAny?.downlink || null
          });
          scheduleIceRecovery('network-change');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    connectionAny?.addEventListener?.('change', handleConnectionChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      connectionAny?.removeEventListener?.('change', handleConnectionChange);
    };
  }, [callStatus, scheduleIceRecovery, emitCallTelemetry, emitAppEvent]);

  useEffect(() => {
    const onBeforeUnload = () => {
      intentionalCallEndRef.current = true;
      cleanupCall(false, "page-unload");
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [cleanupCall]);

  useEffect(() => {
    const onMemoryPressure = () => {
      emitAppEvent("memory_pressure", { source: "browser-event" });
    };
    window.addEventListener("memorypressure", onMemoryPressure as EventListener);
    return () => {
      window.removeEventListener("memorypressure", onMemoryPressure as EventListener);
    };
  }, [emitAppEvent]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      console.log(`[HYDRATION] Loading messages from server for userType=${userType}`);
      const batch = await fetchChatHistory(userType, null, INITIAL_HISTORY_PAGE_SIZE);
      const serverMessages = batch.messages;
      historyCursorRef.current = batch.nextCursor;
      setHasMoreHistory(batch.hasMore);
      console.log(
        `[HYDRATION] Loaded ${serverMessages.length} messages from server (source of truth), hasMore=${batch.hasMore}`
      );

      setMessages((prev) => {
        const merged = mergeMessagesById(prev, serverMessages);

        // Update localStorage cache with merged data
        localStorage.setItem(`chat_messages_${userType}`, JSON.stringify(merged));

        // Update sync timestamp
        if (merged.length > 0) {
          const latestTimestamp = Math.max(
            ...merged.map(m => new Date(m.timestamp).getTime())
          );
          lastSyncTimestamp.current = latestTimestamp;
          localStorage.setItem(`lastSyncTimestamp_${userType}`, latestTimestamp.toString());
        }

        console.log(`[HYDRATION] After merge: ${merged.length} total messages`);
        return merged;
      });

      if (cancelled) return;
      setIsLoadingMessages(false);
    };

    if (typeof (window as any).requestIdleCallback === "function") {
      const idleId = (window as any).requestIdleCallback(() => {
        void loadHistory();
      }, { timeout: 1200 });
      return () => {
        cancelled = true;
        if (typeof (window as any).cancelIdleCallback === "function") {
          (window as any).cancelIdleCallback(idleId);
        }
      };
    }

    const timer = window.setTimeout(() => {
      void loadHistory();
    }, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userType, mergeMessagesById]);

useEffect(() => {
  connect();

  return () => {
    cleanupCall(false, "hook-unmount");

    isIntentionalClose.current = true;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      } catch {}

      wsRef.current = null;
    }
  };
}, []); 

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        const unread = messagesRef.current
          .filter(m => m.sender === "them" && m.status !== "read")
          .map(m => m.id);

        if (unread.length > 0) {
          sendSignal({ type: "message-read", ids: unread });
        }
      }
    };

    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return {
    isConnected,
    peerConnected,
    isPeerOnline,
    myProfile,
    peerProfile,
    updateMyProfile,
    messages,
    sendMessage,
    deleteMessage,
    deleteMessages,
    clearMessages,
    emergencyWipe,
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
    isVideoOff,
    deviceId: deviceId.current,
    sessionId: sessionId.current,
    isLoadingMessages,
    isLoadingProfiles,
    hasMoreHistory,
    isLoadingOlderHistory,
    loadOlderMessages
  };
}
