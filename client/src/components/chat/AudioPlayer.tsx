import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
  isOwn?: boolean;
}

export function AudioPlayer({ audioUrl, duration = 0, isOwn }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setAudioDuration(audio.duration);
    const handleEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[180px] sm:min-w-[200px]">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <button 
        onClick={togglePlay}
        className={cn(
          "p-2 rounded-full transition-colors flex-shrink-0",
          isOwn ? "bg-white/20 hover:bg-white/30" : "bg-primary/20 hover:bg-primary/30"
        )}
      >
        {isPlaying ? (
          <Pause size={16} className={isOwn ? "text-white" : "text-primary"} />
        ) : (
          <Play size={16} className={cn("ml-0.5", isOwn ? "text-white" : "text-primary")} />
        )}
      </button>

      <div className="flex-1 space-y-1">
        {/* Progress bar */}
        <div className={cn("h-1 rounded-full overflow-hidden", isOwn ? "bg-white/20" : "bg-gray-300")}>
          <div 
            className={cn("h-full rounded-full transition-all", isOwn ? "bg-white" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Time */}
        <div className={cn("text-[10px] font-mono", isOwn ? "text-white/70" : "text-muted-foreground")}>
          {formatTime(currentTime)} / {formatTime(audioDuration || 0)}
        </div>
      </div>
    </div>
  );
}
