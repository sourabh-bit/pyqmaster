import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, RotateCcw } from "lucide-react";
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
  callStatus,
  peerName = "Friend",
  peerAvatar
}: ActiveCallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [lastRemoteFrame, setLastRemoteFrame] = useState<string | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(() => window.innerWidth < 768);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const captureRemoteFrame = useCallback(() => {
    const video = remoteVideoRef.current;
    if (!video || video.videoWidth <= 0 || video.videoHeight <= 0) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setLastRemoteFrame(canvas.toDataURL("image/jpeg", 0.65));
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
      const captureTimer = window.setInterval(() => {
        if (videoEl && !videoEl.paused && !videoEl.ended) {
          captureRemoteFrame();
        }
      }, 1500);
      videoEl?.addEventListener("playing", captureOnChange);
      videoEl?.addEventListener("pause", captureOnChange);
      videoEl?.addEventListener("stalled", captureOnChange);

      return () => {
        window.clearInterval(captureTimer);
        videoEl?.removeEventListener("playing", captureOnChange);
        videoEl?.removeEventListener("pause", captureOnChange);
        videoEl?.removeEventListener("stalled", captureOnChange);
        audioTracks.forEach((track) => {
          track.onunmute = null;
        });
      };
    }
    return undefined;
  }, [bindVideoStream, captureRemoteFrame, remoteStream]);

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
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
      {hasRemoteVideo && (
        <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 z-10 flex flex-col items-center bg-gradient-to-b from-black/70 via-black/30 to-transparent">
          <h2 className="text-lg sm:text-xl font-semibold text-white drop-shadow-lg">{peerName}</h2>
          <p className="text-green-400 font-mono text-sm sm:text-base mt-1">{formatDuration(duration)}</p>
          <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-widest mt-1">Encrypted</p>
        </div>
      )}

      {/* Local Video PIP */}
      {showLocalVideo && localStream && (
        <div 
          className={cn(
            "absolute bg-black/80 rounded-2xl border-2 border-white/20 overflow-hidden shadow-2xl z-20 cursor-pointer",
            isMobileLayout
              ? "top-20 right-3 w-[38vw] max-w-[170px] aspect-video"
              : "bottom-32 sm:bottom-36 right-3 sm:right-4 w-28 h-36 sm:w-36 sm:h-48"
          )}
          onClick={() => setShowLocalVideo(!showLocalVideo)}
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
            isMobileLayout ? "top-20 right-3" : "bottom-32 right-4"
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
