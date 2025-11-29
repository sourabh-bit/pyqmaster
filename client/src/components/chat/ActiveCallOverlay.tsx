import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
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
<<<<<<< HEAD
  callStatus?: string;
  peerName?: string;
  peerAvatar?: string;
=======
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
}

export function ActiveCallOverlay({
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
<<<<<<< HEAD
  onEndCall,
  callStatus,
  peerName = "Friend",
  peerAvatar
=======
  onEndCall
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
}: ActiveCallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const timer = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
<<<<<<< HEAD
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden">
      {/* Remote Video */}
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
=======
    <div className="absolute inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-300">
      {/* Remote Video (Full Screen) */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-900">
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
<<<<<<< HEAD
          <div className="flex flex-col items-center px-4">
            <Avatar className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-white/10 mb-4 animate-pulse">
              <AvatarImage src={peerAvatar} />
              <AvatarFallback className="text-3xl sm:text-4xl">{peerName.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-white/50 text-sm sm:text-base">
              {callStatus === 'calling' ? 'Calling...' : 'Connecting...'}
            </p>
=======
          <div className="flex flex-col items-center animate-pulse">
            <Avatar className="w-32 h-32 border-4 border-white/10 mb-4">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <p className="text-white/50">Connecting...</p>
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
          </div>
        )}
      </div>

<<<<<<< HEAD
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-8 z-10 flex flex-col items-center bg-gradient-to-b from-black/60 to-transparent">
        <h2 className="text-lg sm:text-2xl font-semibold text-white">{peerName}</h2>
        <p className="text-green-400 font-mono text-sm sm:text-base mt-1">{formatDuration(duration)}</p>
        <p className="text-[10px] sm:text-xs text-white/50 uppercase tracking-widest mt-2">Encrypted</p>
      </div>

      {/* Local Video PIP */}
      <div className="absolute bottom-28 sm:bottom-32 right-3 sm:right-4 w-24 h-32 sm:w-32 sm:h-44 bg-black/50 rounded-xl border border-white/20 overflow-hidden shadow-2xl z-20">
=======
      {/* Header Info */}
      <div className="absolute top-0 left-0 right-0 p-8 z-10 flex flex-col items-center bg-gradient-to-b from-black/60 to-transparent">
        <h2 className="text-2xl font-semibold text-white drop-shadow-md">John Doe</h2>
        <p className="text-green-400 font-mono mt-1 drop-shadow-md">{formatDuration(duration)}</p>
        <p className="text-xs text-white/50 uppercase tracking-widest mt-2">End-to-End Encrypted</p>
      </div>

      {/* Local Video (PIP) */}
      <div className="absolute bottom-24 right-4 w-32 h-48 bg-black/50 rounded-xl border border-white/20 overflow-hidden shadow-2xl z-20">
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        {localStream ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
<<<<<<< HEAD
            className="w-full h-full object-cover"
=======
            className="w-full h-full object-cover mirror-mode"
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
            style={{ transform: 'scaleX(-1)' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800">
<<<<<<< HEAD
            <VideoOff className="text-white/30" size={24} />
=======
            <VideoOff className="text-white/30" />
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
          </div>
        )}
      </div>

      {/* Controls */}
<<<<<<< HEAD
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 z-10 flex items-center justify-center gap-4 sm:gap-6 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={onToggleMute}
          className={cn(
            "p-3 sm:p-4 rounded-full transition-all border border-white/10",
            isMuted ? "bg-white text-black" : "bg-white/10 text-white"
          )}
        >
          {isMuted ? <MicOff size={20} className="sm:w-6 sm:h-6" /> : <Mic size={20} className="sm:w-6 sm:h-6" />}
=======
      <div className="absolute bottom-0 left-0 right-0 p-8 z-10 flex items-center justify-center gap-6 bg-gradient-to-t from-black/80 to-transparent">
        <button
          onClick={onToggleMute}
          className={cn(
            "p-4 rounded-full transition-all backdrop-blur-md border border-white/10",
            isMuted ? "bg-white text-black" : "bg-white/10 hover:bg-white/20 text-white"
          )}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        </button>

        <button
          onClick={onEndCall}
<<<<<<< HEAD
          className="p-4 sm:p-5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg"
        >
          <PhoneOff size={24} className="sm:w-8 sm:h-8" />
=======
          className="p-5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30 transform hover:scale-105 transition-all"
        >
          <PhoneOff size={32} />
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        </button>

        <button
          onClick={onToggleVideo}
          className={cn(
<<<<<<< HEAD
            "p-3 sm:p-4 rounded-full transition-all border border-white/10",
            isVideoOff ? "bg-white text-black" : "bg-white/10 text-white"
          )}
        >
          {isVideoOff ? <VideoOff size={20} className="sm:w-6 sm:h-6" /> : <Video size={20} className="sm:w-6 sm:h-6" />}
=======
            "p-4 rounded-full transition-all backdrop-blur-md border border-white/10",
            isVideoOff ? "bg-white text-black" : "bg-white/10 hover:bg-white/20 text-white"
          )}
        >
          {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        </button>
      </div>
    </div>
  );
}
