import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Mic, MicOff, Video, VideoOff, PhoneOff, RotateCcw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ActiveCallOverlayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  callStatus?: string;
  peerName?: string;
  peerAvatar?: string;
}

export function ActiveCallOverlay({
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  onMinimize,
  isMinimized = false,
  callStatus,
  peerName = "Friend",
  peerAvatar
}: ActiveCallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localPreviewRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [lastRemoteFrame, setLastRemoteFrame] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth < 768);
  const [localPreviewPosition, setLocalPreviewPosition] = useState<{ x: number; y: number } | null>(null);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const lastRemoteFrameUrlRef = useRef<string | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const captureRemoteFrame = useCallback(() => {
    const video = remoteVideoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 360 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const frameUrl = URL.createObjectURL(blob);
        if (lastRemoteFrameUrlRef.current) {
          URL.revokeObjectURL(lastRemoteFrameUrlRef.current);
        }
        lastRemoteFrameUrlRef.current = frameUrl;
        setLastRemoteFrame(frameUrl);
      },
      "image/jpeg",
      0.52
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
  }, []);

  const bindVideoStream = useCallback(
    (element: HTMLVideoElement | null, stream: MediaStream | null, muted: boolean) => {
      if (!element || !stream) return;
      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }
      element.muted = muted;
      element.volume = muted ? 0 : 1;
      element.play().catch(() => {});
    },
    []
  );

  const getPreviewBounds = useCallback(
    (previewWidth: number, previewHeight: number) => {
      const margin = 12;
      const topInset = 88 + (window.visualViewport?.offsetTop ?? 0);
      const bottomInset = 136;
      return {
        minX: margin,
        maxX: Math.max(margin, window.innerWidth - previewWidth - margin),
        minY: topInset,
        maxY: Math.max(topInset, window.innerHeight - previewHeight - bottomInset),
      };
    },
    []
  );

  const clampPosition = useCallback(
    (x: number, y: number, previewWidth: number, previewHeight: number) => {
      const bounds = getPreviewBounds(previewWidth, previewHeight);
      return {
        x: Math.min(bounds.maxX, Math.max(bounds.minX, x)),
        y: Math.min(bounds.maxY, Math.max(bounds.minY, y)),
      };
    },
    [getPreviewBounds]
  );

  const snapToNearestCorner = useCallback(
    (x: number, y: number, previewWidth: number, previewHeight: number) => {
      const bounds = getPreviewBounds(previewWidth, previewHeight);
      const corners = [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.minX, y: bounds.maxY },
        { x: bounds.maxX, y: bounds.maxY },
      ];
      return corners.reduce((closest, corner) => {
        const cornerDistance = (corner.x - x) ** 2 + (corner.y - y) ** 2;
        const closestDistance = (closest.x - x) ** 2 + (closest.y - y) ** 2;
        return cornerDistance < closestDistance ? corner : closest;
      }, corners[0]);
    },
    [getPreviewBounds]
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const applyLayout = (matches: boolean) => setIsMobileLayout(matches);
    applyLayout(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => applyLayout(event.matches);
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    bindVideoStream(localVideoRef.current, localStream, true);
  }, [bindVideoStream, localStream, showLocalVideo]);

  useEffect(() => {
    if (!isMobileLayout || !showLocalVideo || !localStream) return;
    const raf = window.requestAnimationFrame(() => {
      const element = localPreviewRef.current;
      if (!element) return;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setLocalPreviewPosition((prev) => {
        if (prev) return clampPosition(prev.x, prev.y, width, height);
        const bounds = getPreviewBounds(width, height);
        return { x: bounds.maxX, y: bounds.minY };
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [clampPosition, getPreviewBounds, isMobileLayout, localStream, showLocalVideo]);

  useEffect(() => {
    if (!isMobileLayout) return;
    const handleResize = () => {
      const element = localPreviewRef.current;
      if (!element) return;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setLocalPreviewPosition((prev) => {
        if (!prev) return prev;
        return clampPosition(prev.x, prev.y, width, height);
      });
    };
    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [clampPosition, isMobileLayout]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current) {
        bindVideoStream(remoteVideoRef.current, remoteStream, false);
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = 1;
        remoteAudioRef.current.play().catch(console.error);
      }

      const audioTracks = remoteStream.getAudioTracks();
      const resumeAudio = () => {
        remoteAudioRef.current?.play().catch(() => {});
      };
      audioTracks.forEach((track) => {
        track.onunmute = resumeAudio;
      });

      const videoEl = remoteVideoRef.current;
      const captureOnChange = () => captureRemoteFrame();
      videoEl?.addEventListener("playing", captureOnChange);
      videoEl?.addEventListener("pause", captureOnChange);
      videoEl?.addEventListener("waiting", captureOnChange);
      videoEl?.addEventListener("stalled", captureOnChange);

      return () => {
        videoEl?.removeEventListener("playing", captureOnChange);
        videoEl?.removeEventListener("pause", captureOnChange);
        videoEl?.removeEventListener("waiting", captureOnChange);
        videoEl?.removeEventListener("stalled", captureOnChange);
        audioTracks.forEach((track) => {
          track.onunmute = null;
        });
      };
    }
    setLastRemoteFrame((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      lastRemoteFrameUrlRef.current = null;
      return null;
    });
    return undefined;
  }, [bindVideoStream, captureRemoteFrame, remoteStream]);

  useEffect(() => {
    if (!isMinimized) return;
    setLastRemoteFrame((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      lastRemoteFrameUrlRef.current = null;
      return null;
    });
  }, [isMinimized]);

  useEffect(() => {
    return () => {
      if (lastRemoteFrameUrlRef.current) {
        URL.revokeObjectURL(lastRemoteFrameUrlRef.current);
        lastRemoteFrameUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasRemoteVideo = remoteStream?.getVideoTracks().some(t => t.enabled && t.readyState === 'live');
  const showVideoHeader = !isMinimized;

  const handleLocalPreviewPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileLayout) return;
    const element = localPreviewRef.current;
    if (!element || !localPreviewPosition) return;
    element.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: localPreviewPosition.x,
      originY: localPreviewPosition.y,
      moved: false,
    };
  }, [isMobileLayout, localPreviewPosition]);

  const handleLocalPreviewPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileLayout) return;
    const state = dragStateRef.current;
    const element = localPreviewRef.current;
    if (!state || !element || state.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      state.moved = true;
    }
    const next = clampPosition(
      state.originX + dx,
      state.originY + dy,
      element.offsetWidth,
      element.offsetHeight
    );
    setLocalPreviewPosition(next);
  }, [clampPosition, isMobileLayout]);

  const handleLocalPreviewPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isMobileLayout) return;
    const state = dragStateRef.current;
    const element = localPreviewRef.current;
    if (!state || !element || state.pointerId !== e.pointerId) return;
    element.releasePointerCapture(e.pointerId);
    if (!state.moved) {
      setShowLocalVideo(false);
      dragStateRef.current = null;
      return;
    }
    const snapped = snapToNearestCorner(
      localPreviewPosition?.x ?? state.originX,
      localPreviewPosition?.y ?? state.originY,
      element.offsetWidth,
      element.offsetHeight
    );
    setLocalPreviewPosition(snapped);
    dragStateRef.current = null;
  }, [isMobileLayout, localPreviewPosition, snapToNearestCorner]);

  const handleLocalPreviewPointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    const element = localPreviewRef.current;
    if (state && element && state.pointerId === e.pointerId) {
      element.releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 bg-slate-950 flex flex-col overflow-hidden transition-opacity duration-150",
        isMobileLayout ? "z-[70]" : "z-50",
        isMinimized ? "opacity-0 pointer-events-none" : "opacity-100"
      )}
    >
      {/* Hidden audio element for reliable audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      
      {/* Remote Video/Audio */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        {remoteStream && hasRemoteVideo ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={cn(
              "w-full h-full bg-black",
              isMobileLayout ? "object-cover" : "object-contain"
            )}
          />
        ) : remoteStream && lastRemoteFrame ? (
          <div className="relative w-full h-full bg-black flex items-center justify-center">
            <img
              src={lastRemoteFrame}
              alt="Last remote frame"
              className={cn(
                "w-full h-full",
                isMobileLayout ? "object-cover" : "object-contain"
              )}
            />
            <div className="absolute inset-0 bg-black/25 flex items-end justify-center pb-24">
              <p className="text-white/80 text-sm sm:text-base">Reconnecting video...</p>
            </div>
          </div>
        ) : remoteStream ? (
          <div className="flex flex-col items-center px-4">
            <Avatar className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-white/20 mb-6">
              <AvatarImage src={peerAvatar} />
              <AvatarFallback className="text-4xl sm:text-5xl bg-gradient-to-br from-blue-500 to-purple-600">
                {peerName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <p className="text-white text-xl font-medium">{peerName}</p>
            <p className="text-green-400 font-mono text-lg mt-2">{formatDuration(duration)}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4">
            <Avatar className="w-28 h-28 sm:w-36 sm:h-36 border-4 border-white/10 mb-6 animate-pulse">
              <AvatarImage src={peerAvatar} />
              <AvatarFallback className="text-4xl sm:text-5xl">{peerName.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-white/50 text-base sm:text-lg">
              {callStatus === 'calling' ? 'Calling...' : 'Connecting...'}
            </p>
          </div>
        )}
      </div>

      {/* Header - Only show when video is active */}
      {showVideoHeader && (
        <div
          className={cn(
            "absolute left-0 right-0 z-10 bg-gradient-to-b from-black/70 via-black/30 to-transparent",
            isMobileLayout ? "pt-[calc(env(safe-area-inset-top)+8px)] px-3 pb-3" : "p-4 sm:p-6"
          )}
        >
          <div className={cn("flex items-start", isMobileLayout ? "justify-between" : "justify-center")}>
            {isMobileLayout ? (
              <>
                <button
                  onClick={onMinimize}
                  className="p-2 rounded-full bg-black/35 border border-white/15 text-white"
                  aria-label="Back to chat"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex-1 text-center px-2">
                  <h2 className="text-base font-semibold text-white drop-shadow-lg truncate">{peerName}</h2>
                  <p className="text-green-400 font-mono text-sm mt-0.5">{formatDuration(duration)}</p>
                  <p className="text-[10px] text-white/60 uppercase tracking-widest mt-0.5">Encrypted</p>
                </div>
                <div className="w-10" />
              </>
            ) : (
              <div className="flex flex-col items-center">
                <h2 className="text-lg sm:text-xl font-semibold text-white drop-shadow-lg">{peerName}</h2>
                <p className="text-green-400 font-mono text-sm sm:text-base mt-1">{formatDuration(duration)}</p>
                <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-widest mt-1">Encrypted</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Local Video PIP */}
      {showLocalVideo && localStream && (
        <div 
          ref={localPreviewRef}
          className={cn(
            "absolute bg-black/80 rounded-2xl border-2 border-white/20 overflow-hidden shadow-2xl z-20 cursor-pointer",
            isMobileLayout
              ? "w-[52vw] min-w-[176px] max-w-[240px] aspect-video touch-none"
              : "bottom-32 sm:bottom-36 right-3 sm:right-4 w-28 h-36 sm:w-36 sm:h-48"
          )}
          style={
            isMobileLayout && localPreviewPosition
              ? { left: `${localPreviewPosition.x}px`, top: `${localPreviewPosition.y}px` }
              : undefined
          }
          onClick={!isMobileLayout ? () => setShowLocalVideo(!showLocalVideo) : undefined}
          onPointerDown={handleLocalPreviewPointerDown}
          onPointerMove={handleLocalPreviewPointerMove}
          onPointerUp={handleLocalPreviewPointerUp}
          onPointerCancel={handleLocalPreviewPointerCancel}
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
            style={{ transform: 'none' }}
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <VideoOff className="text-white/50" size={28} />
            </div>
          )}
        </div>
      )}

      {/* Toggle local video button when hidden */}
      {!showLocalVideo && localStream && (
        <button
          onClick={() => setShowLocalVideo(true)}
          className={cn(
            "absolute p-3 bg-white/10 rounded-full z-20",
            isMobileLayout ? "top-[calc(env(safe-area-inset-top)+90px)] right-3" : "bottom-32 right-4"
          )}
        >
          <RotateCcw size={20} className="text-white" />
        </button>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 z-10 flex items-center justify-center gap-5 sm:gap-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        <button
          onClick={onToggleMute}
          className={cn(
            "p-4 sm:p-5 rounded-full transition-all duration-200 shadow-lg",
            isMuted 
              ? "bg-white text-slate-900 scale-110" 
              : "bg-white/15 text-white hover:bg-white/25 border border-white/10"
          )}
        >
          {isMuted ? <MicOff size={22} className="sm:w-6 sm:h-6" /> : <Mic size={22} className="sm:w-6 sm:h-6" />}
        </button>

        <button
          onClick={onEndCall}
          className="p-5 sm:p-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-xl transition-all duration-200 hover:scale-105"
        >
          <PhoneOff size={26} className="sm:w-8 sm:h-8" />
        </button>

        <button
          onClick={onToggleVideo}
          className={cn(
            "p-4 sm:p-5 rounded-full transition-all duration-200 shadow-lg",
            isVideoOff 
              ? "bg-white text-slate-900 scale-110" 
              : "bg-white/15 text-white hover:bg-white/25 border border-white/10"
          )}
        >
          {isVideoOff ? <VideoOff size={22} className="sm:w-6 sm:h-6" /> : <Video size={22} className="sm:w-6 sm:h-6" />}
        </button>
      </div>
    </div>
  );
}
