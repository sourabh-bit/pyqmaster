import { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Mic, Video, Phone, Lock, CheckCheck, Smile, PhoneOff, Menu, X, Edit, Trash2, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useChatConnection } from "@/hooks/use-chat-connection";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { EmojiPicker } from "./EmojiPicker";
import { ProfileEditor } from "./ProfileEditor";
import { MediaViewer } from "./MediaViewer";
import { AudioPlayer } from "./AudioPlayer";

interface ChatLayoutProps {
  onLock: () => void;
  currentUser: 'admin' | 'friend';
}

export function ChatLayout({ onLock, currentUser }: ChatLayoutProps) {
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const {
    isRecording,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording
  } = useAudioRecorder();

  const {
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
  } = useChatConnection(currentUser);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const channel = new BroadcastChannel('secure_chat_messages');
    channel.onmessage = (event) => {
      if (event.data.type === 'nuke') {
        clearMessages();
        toast({ title: "Chat Cleared" });
      }
    };
    return () => channel.close();
  }, [clearMessages, toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    handleTyping();
  };

  const handleSendText = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendMessage({ text: inputText, type: 'text' });
    setInputText("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large (max 10MB)" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      sendMessage({ type, mediaUrl: result, text: type === 'video' ? '🎥 Video' : '📷 Photo' });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch {
      toast({ variant: "destructive", title: "Microphone access denied" });
    }
  };

  const handleStopRecording = async () => {
    const audioUrl = await stopRecording();
    if (audioUrl) {
      sendMessage({ type: 'audio', mediaUrl: audioUrl, text: `🎤 Voice (0:${recordingTime.toString().padStart(2, '0')})` });
    }
  };

  const handleMessageLongPress = (msgId: string) => {
    const timer = setTimeout(() => {
      setMessageToDelete(msgId);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleMessageRelease = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleDeleteMessage = () => {
    if (messageToDelete) {
      deleteMessage(messageToDelete);
      setMessageToDelete(null);
      toast({ title: "Message deleted" });
    }
  };

  const getLastSeenText = () => {
    if (peerConnected) return "Online";
    if (peerProfile.lastSeen) {
      return `Last seen ${formatDistanceToNow(peerProfile.lastSeen, { addSuffix: true })}`;
    }
    return "Offline";
  };

  // Double tap to hide (secret feature)
  const [tapCount, setTapCount] = useState(0);
  const handleHeaderDoubleTap = () => {
    setTapCount(prev => prev + 1);
    setTimeout(() => setTapCount(0), 300);
    if (tapCount === 1) {
      onLock();
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground font-sans overflow-hidden relative">
      
      {/* Incoming Call Dialog */}
      <Dialog open={!!incomingCall} onOpenChange={(open) => !open && rejectCall()}>
        <DialogContent className="w-[90vw] max-w-md border-none bg-slate-900 text-white shadow-2xl mx-auto">
          <DialogHeader className="flex flex-col items-center gap-4">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-white/10 animate-pulse">
              <AvatarImage src={peerProfile.avatar} />
              <AvatarFallback className="text-2xl">{peerProfile.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <DialogTitle className="text-xl sm:text-2xl font-light">
              {incomingCall?.type === 'video' ? 'Video' : 'Voice'} Call
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {peerProfile.name} is calling...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-6 sm:gap-8 mt-4 sm:mt-6">
            <button onClick={rejectCall} className="p-3 sm:p-4 bg-red-500 rounded-full hover:bg-red-600">
              <PhoneOff size={20} className="sm:w-6 sm:h-6" />
            </button>
            <button onClick={acceptCall} className="p-3 sm:p-4 bg-green-500 rounded-full hover:bg-green-600 animate-bounce">
              <Phone size={20} className="sm:w-6 sm:h-6" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Message Confirmation */}
      <Dialog open={!!messageToDelete} onOpenChange={(open) => !open && setMessageToDelete(null)}>
        <DialogContent className="w-[85vw] max-w-sm bg-zinc-900 text-white border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Message?</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm">
              This message will be deleted for you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => setMessageToDelete(null)}
              className="flex-1 py-2 bg-zinc-800 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button 
              onClick={handleDeleteMessage}
              className="flex-1 py-2 bg-red-500 rounded-lg text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active Call Overlay */}
      {activeCall && (
        <ActiveCallOverlay 
          localStream={localStream}
          remoteStream={remoteStream}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
          callStatus={callStatus}
          peerName={peerProfile.name}
          peerAvatar={peerProfile.avatar}
        />
      )}

      {/* Media Viewer */}
      <MediaViewer
        isOpen={!!selectedMedia}
        onClose={() => setSelectedMedia(null)}
        mediaUrl={selectedMedia?.url || ''}
        mediaType={selectedMedia?.type || 'image'}
      />

      {/* Profile Editor */}
      <ProfileEditor
        isOpen={showProfileEditor}
        onClose={() => setShowProfileEditor(false)}
        currentName={myProfile.name}
        currentAvatar={myProfile.avatar}
        onSave={(name, avatar) => updateMyProfile({ name, avatar })}
      />

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,video/*" 
        onChange={handleFileUpload}
      />

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed md:relative inset-y-0 left-0 w-72 sm:w-80 border-r border-border flex flex-col bg-background z-50 transition-transform duration-300",
        showSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-3 sm:p-4 border-b border-border flex justify-between items-center">
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 flex-1 min-w-0"
            onClick={() => { setShowProfileEditor(true); setShowSidebar(false); }}
          >
            <div className="relative flex-shrink-0">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border border-border">
                <AvatarImage src={myProfile.avatar} />
                <AvatarFallback className={cn("text-white text-sm", currentUser === 'admin' ? "bg-red-500" : "bg-blue-500")}>
                  {myProfile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Edit size={8} className="absolute -bottom-0.5 -right-0.5 text-muted-foreground bg-background rounded-full p-0.5" />
            </div>
            <div className="min-w-0">
              <span className="font-semibold text-sm truncate block">{myProfile.name}</span>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", isConnected ? "bg-green-500" : "bg-yellow-500")} />
                <span className="truncate">{isConnected ? 'Connected' : 'Connecting...'}</span>
              </p>
            </div>
          </div>
          <button onClick={() => setShowSidebar(false)} className="p-2 md:hidden hover:bg-secondary rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center gap-3 p-3 bg-secondary/50 border-l-4 border-primary">
            <Avatar className="h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0">
              <AvatarImage src={peerProfile.avatar} />
              <AvatarFallback>{peerProfile.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-medium text-sm truncate">{peerProfile.name}</h3>
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", peerConnected ? "bg-green-500" : "bg-gray-400")} />
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {peerProfile.isTyping ? <span className="text-green-500">typing...</span> : getLastSeenText()}
              </p>
            </div>
          </div>
        </div>

        {/* Secret hint */}
        <div className="p-3 border-t border-border bg-background/50">
          <p className="text-[10px] text-muted-foreground/50 text-center">
            Double tap header to lock
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-[#efeae2] dark:bg-background">
        {/* Header */}
        <header 
          className="h-14 sm:h-16 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-2 sm:px-4 shadow-sm z-10 flex-shrink-0"
          onClick={handleHeaderDoubleTap}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button onClick={(e) => { e.stopPropagation(); setShowSidebar(true); }} className="p-2 md:hidden hover:bg-secondary rounded-lg flex-shrink-0">
              <Menu size={20} />
            </button>
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
              <AvatarImage src={peerProfile.avatar} />
              <AvatarFallback>{peerProfile.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm truncate">{peerProfile.name}</h2>
              <span className={cn("text-xs truncate block", peerConnected ? "text-green-600" : "text-muted-foreground")}>
                {peerProfile.isTyping ? <span className="text-green-500">typing...</span> : getLastSeenText()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 flex-shrink-0">
            <button 
              onClick={(e) => { e.stopPropagation(); peerConnected && startCall('voice'); }} 
              disabled={!peerConnected}
              className={cn("p-2 rounded-full", peerConnected ? "hover:bg-secondary" : "opacity-40")}
            >
              <Phone size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); peerConnected && startCall('video'); }}
              disabled={!peerConnected}
              className={cn("p-2 rounded-full", peerConnected ? "hover:bg-secondary" : "opacity-40")}
            >
              <Video size={18} className="sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onLock(); }} 
              className="p-2 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white rounded-full ml-1"
            >
              <Lock size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </header>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3"
          style={{ backgroundImage: 'radial-gradient(#00000008 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          {!peerConnected && messages.length === 0 && (
            <div className="text-center py-6 sm:py-8">
              <div className="inline-flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                Waiting for {peerProfile.name}...
              </div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn("flex w-full group", msg.sender === 'me' ? "justify-end" : "justify-start")}
              onTouchStart={() => handleMessageLongPress(msg.id)}
              onTouchEnd={handleMessageRelease}
              onMouseDown={() => handleMessageLongPress(msg.id)}
              onMouseUp={handleMessageRelease}
              onMouseLeave={handleMessageRelease}
            >
              <div className={cn(
                "max-w-[85%] sm:max-w-[70%] md:max-w-[60%] rounded-lg p-2.5 sm:p-3 shadow-sm relative",
                msg.sender === 'me' 
                  ? "bg-primary text-primary-foreground rounded-tr-none" 
                  : "bg-white dark:bg-secondary text-foreground rounded-tl-none"
              )}>
                {/* Delete button on hover */}
                <button 
                  onClick={() => setMessageToDelete(msg.id)}
                  className={cn(
                    "absolute -top-2 opacity-0 group-hover:opacity-100 p-1 bg-red-500 rounded-full transition-opacity",
                    msg.sender === 'me' ? "-left-2" : "-right-2"
                  )}
                >
                  <Trash2 size={12} className="text-white" />
                </button>

                {msg.type === 'text' && <p className="text-sm leading-relaxed break-words">{msg.text}</p>}
                
                {msg.type === 'image' && (
                  <div 
                    className="cursor-pointer"
                    onClick={() => setSelectedMedia({ url: msg.mediaUrl!, type: 'image' })}
                  >
                    <img src={msg.mediaUrl} alt="" className="rounded max-h-48 sm:max-h-64 object-cover w-full" />
                    <p className="text-xs mt-1 opacity-70">Tap to view</p>
                  </div>
                )}
                
                {msg.type === 'video' && (
                  <div 
                    className="cursor-pointer"
                    onClick={() => setSelectedMedia({ url: msg.mediaUrl!, type: 'video' })}
                  >
                    <video src={msg.mediaUrl} className="rounded max-h-48 sm:max-h-64 w-full" />
                    <p className="text-xs mt-1 opacity-70">Tap to play</p>
                  </div>
                )}
                
                {msg.type === 'audio' && msg.mediaUrl && (
                  <AudioPlayer audioUrl={msg.mediaUrl} isOwn={msg.sender === 'me'} />
                )}

                <div className={cn("flex items-center justify-end gap-1 mt-1", msg.sender === 'me' ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  <span className="text-[10px]">{format(new Date(msg.timestamp), 'h:mm a')}</span>
                  {msg.sender === 'me' && <CheckCheck size={12} />}
                </div>
              </div>
            </div>
          ))}

          {peerProfile.isTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-secondary rounded-lg px-3 py-2 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-background p-2 sm:p-3 border-t border-border flex-shrink-0">
          <form onSubmit={handleSendText} className="flex items-end gap-1.5 sm:gap-2">
            {!isRecording && (
              <>
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={!peerConnected}
                  className="p-2 sm:p-2.5 text-muted-foreground hover:bg-secondary rounded-full disabled:opacity-40"
                >
                  <Paperclip size={18} className="sm:w-5 sm:h-5" />
                </button>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="p-2 sm:p-2.5 text-muted-foreground hover:bg-secondary rounded-full">
                      <Smile size={18} className="sm:w-5 sm:h-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="top">
                    <EmojiPicker onSelect={(emoji) => setInputText(prev => prev + emoji)} />
                  </PopoverContent>
                </Popover>
              </>
            )}

            <div className={cn(
              "flex-1 rounded-2xl px-3 sm:px-4 py-2 min-h-[40px] sm:min-h-[44px] flex items-center",
              isRecording ? "bg-red-500/10 border border-red-500/30" : "bg-secondary/50"
            )}>
              {isRecording ? (
                <div className="flex items-center gap-2 w-full">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 text-sm font-mono flex-1">
                    Recording {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                  <button 
                    type="button" 
                    onClick={cancelRecording}
                    className="p-1 hover:bg-red-500/20 rounded"
                  >
                    <X size={16} className="text-red-500" />
                  </button>
                </div>
              ) : (
                <input 
                  type="text" 
                  value={inputText} 
                  onChange={handleInputChange} 
                  placeholder={peerConnected ? "Message..." : "Waiting..."}
                  disabled={!peerConnected}
                  className="flex-1 bg-transparent border-none outline-none text-sm disabled:opacity-50 w-full" 
                />
              )}
            </div>

            {isRecording ? (
              <button 
                type="button"
                onClick={handleStopRecording}
                className="p-2.5 sm:p-3 rounded-full bg-red-500 flex-shrink-0"
              >
                <Square size={18} className="text-white sm:w-5 sm:h-5" fill="white" />
              </button>
            ) : inputText.trim() ? (
              <button 
                type="submit"
                disabled={!peerConnected}
                className="p-2.5 sm:p-3 rounded-full bg-primary disabled:opacity-40 flex-shrink-0"
              >
                <Send size={18} className="text-white sm:w-5 sm:h-5" />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleStartRecording}
                disabled={!peerConnected}
                className="p-2.5 sm:p-3 text-muted-foreground hover:bg-secondary rounded-full disabled:opacity-40 flex-shrink-0"
              >
                <Mic size={18} className="sm:w-5 sm:h-5" />
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
