import React, { memo, useCallback, useRef, useState } from "react";
import { Check, CheckCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AudioPlayer } from "./AudioPlayer";
import { useLongPress } from "@/hooks/use-long-press";

interface Message {
  id: string;
  text: string;
  sender: "me" | "them";
  timestamp: Date;
  type: "text" | "image" | "video" | "audio";
  mediaUrl?: string;
  status?: "sending" | "sent" | "delivered" | "read";
  replyTo?: {
    id: string;
    text: string;
    sender: "me" | "them";
  };
}

interface Props {
  message: Message;
  isSelected: boolean;
  isSelectMode: boolean;
  onSelect: (id: string) => void;
  onLongPress: (id: string) => void;
  onReply: (msg: Message) => void;
}

export default memo(function ChatMessage({
  message: msg,
  isSelected,
  isSelectMode,
  onSelect,
  onLongPress,
  onReply,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPressing, setIsPressing] = useState(false);

  const handleClick = useCallback(() => {
    if (isSelectMode) {
      onSelect(msg.id);
    }
  }, [isSelectMode, msg.id, onSelect]);

  const handleLongPress = useCallback(() => {
    if (!isSelectMode) {
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      onLongPress(msg.id);
    }
    setIsPressing(false);
  }, [isSelectMode, msg.id, onLongPress]);

  const longPressHandlers = useLongPress({
    onLongPress: handleLongPress,
    onClick: handleClick,
    threshold: 350,
    moveThreshold: 15,
  });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsPressing(true);
    longPressHandlers.onPointerDown(e);
  }, [longPressHandlers]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setIsPressing(false);
    longPressHandlers.onPointerUp(e);
  }, [longPressHandlers]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    setIsPressing(false);
    longPressHandlers.onPointerCancel(e);
  }, [longPressHandlers]);

  const handleMediaClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isSelectMode) {
        onReply(msg);
      }
    },
    [isSelectMode, msg, onReply]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full px-3 sm:px-4 mb-1.5 flex no-select",
        "transition-all duration-150 ease-out",
        msg.sender === "me" ? "justify-end" : "justify-start",
        isSelected && "message-selected",
        isPressing && !isSelectMode && "scale-[0.98] opacity-90"
      )}
      style={{ touchAction: isSelectMode ? "none" : "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerMove={longPressHandlers.onPointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onContextMenu={longPressHandlers.onContextMenu}
    >
      {isSelectMode && (
        <div
          className={cn(
            "flex items-center px-2 transition-transform duration-200",
            msg.sender === "me" ? "order-2" : "order-first",
            isSelected ? "scale-110" : "scale-100"
          )}
        >
          <div
            className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200",
              isSelected
                ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30"
                : "border-zinc-500 bg-transparent"
            )}
          >
            {isSelected && <Check size={12} className="text-white" />}
          </div>
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] sm:max-w-[70%] md:max-w-[60%] px-3 py-2 rounded-2xl shadow-sm",
          "transition-all duration-150 ease-out",
          msg.sender === "me"
            ? "bg-[#128C7E] text-white rounded-br-sm"
            : "bg-[#1f2c33] text-white rounded-bl-sm border border-white/10",
          isSelected && "ring-2 ring-emerald-500/50"
        )}
      >
        {msg.replyTo && (
          <div
            className={cn(
              "mb-2 px-2 py-1 rounded-lg border-l-2 text-xs",
              msg.sender === "me"
                ? "bg-white/10 border-white/50"
                : "bg-black/20 border-emerald-500"
            )}
          >
            <p className="font-medium opacity-80">
              {msg.replyTo.sender === "me" ? "You" : "Them"}
            </p>
            <p className="opacity-70 truncate">{msg.replyTo.text}</p>
          </div>
        )}

        {msg.type === "text" && (
          <p className="text-[14px] leading-[1.4] whitespace-pre-wrap break-words">
            {msg.text}
          </p>
        )}

        {msg.type === "image" && msg.mediaUrl && (
          <img
            src={msg.mediaUrl}
            className="rounded-xl max-h-72 w-full object-cover mt-1 cursor-pointer"
            onClick={handleMediaClick}
            draggable={false}
          />
        )}

        {msg.type === "video" && msg.mediaUrl && (
          <video
            src={msg.mediaUrl}
            className="rounded-xl max-h-72 w-full mt-1"
            controls
          />
        )}

        {msg.type === "audio" && msg.mediaUrl && (
          <AudioPlayer audioUrl={msg.mediaUrl} isOwn={msg.sender === "me"} />
        )}

        <div className="flex items-center justify-end gap-1 mt-1 opacity-80 text-[11px]">
          <span>{format(new Date(msg.timestamp), "h:mm a")}</span>

          {msg.sender === "me" && (
            <>
              {msg.status === "sending" && <Clock size={12} />}
              {msg.status === "sent" && <Check size={12} />}
              {msg.status === "delivered" && <CheckCheck size={12} />}
              {msg.status === "read" && (
                <CheckCheck size={12} className="text-sky-400" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});
