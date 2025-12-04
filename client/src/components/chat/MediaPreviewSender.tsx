import { useState, useRef, useCallback } from "react";
import { X, Send, Image, Film, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaPreviewSenderProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: { type: "image" | "video"; mediaUrl: string; text: string }) => void;
  initialFile?: File | null;
}

export function MediaPreviewSender({
  isOpen,
  onClose,
  onSend,
  initialFile,
}: MediaPreviewSenderProps) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
      setFile(selectedFile);
    };
    reader.readAsDataURL(selectedFile);
    return true;
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
    },
    [processFile]
  );

  const handleSend = useCallback(() => {
    if (!preview || !file) return;

    setIsProcessing(true);
    const type = file.type.startsWith("video/") ? "video" : "image";
    
    onSend({
      type,
      mediaUrl: preview,
      text: caption || (type === "video" ? "🎥 Video" : "📷 Photo"),
    });

    setFile(null);
    setPreview(null);
    setCaption("");
    setIsProcessing(false);
    onClose();
  }, [preview, file, caption, onSend, onClose]);

  const handleClose = useCallback(() => {
    setFile(null);
    setPreview(null);
    setCaption("");
    onClose();
  }, [onClose]);

  const handleRetake = useCallback(() => {
    setFile(null);
    setPreview(null);
    fileInputRef.current?.click();
  }, []);

  if (!isOpen) return null;

  const isVideo = file?.type.startsWith("video/");

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-black/80 backdrop-blur-sm">
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={24} className="text-white" />
        </button>
        <span className="text-white font-medium text-sm">
          {isVideo ? "Video" : "Photo"}
        </span>
        <div className="w-10" />
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {preview ? (
          isVideo ? (
            <video
              src={preview}
              controls
              autoPlay
              muted
              playsInline
              className="max-w-full max-h-full rounded-2xl object-contain"
            />
          ) : (
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-full rounded-2xl object-contain"
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "image/*";
                    fileInputRef.current.click();
                  }
                }}
                className="flex flex-col items-center gap-2 p-6 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors"
              >
                <Image size={32} className="text-emerald-400" />
                <span className="text-white text-sm">Photo</span>
              </button>
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = "video/*";
                    fileInputRef.current.click();
                  }
                }}
                className="flex flex-col items-center gap-2 p-6 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors"
              >
                <Film size={32} className="text-blue-400" />
                <span className="text-white text-sm">Video</span>
              </button>
            </div>
            <p className="text-zinc-400 text-sm">Select media to send</p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      {preview && (
        <div className="bg-black/80 backdrop-blur-sm p-4 safe-area-pb">
          {/* Caption Input */}
          <div className="flex items-center gap-3 mb-4 bg-[#2a3942] rounded-full px-4 py-2">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleRetake}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
            >
              <RotateCcw size={18} className="text-white" />
              <span className="text-white text-sm">Change</span>
            </button>

            <button
              onClick={handleSend}
              disabled={isProcessing}
              className={cn(
                "flex items-center gap-2 px-6 py-3 bg-emerald-600 rounded-full transition-colors",
                isProcessing
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-emerald-700"
              )}
            >
              <Send size={18} className="text-white" />
              <span className="text-white font-medium">Send</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
