import { useState } from "react";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
}

export function MediaViewer({ isOpen, onClose, mediaUrl, mediaType }: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);

  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = `secure_chat_${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 bg-black/50">
        <div className="flex gap-2">
          {mediaType === 'image' && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <ZoomIn size={20} className="text-white" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <ZoomOut size={20} className="text-white" />
              </button>
            </>
          )}
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <Download size={20} className="text-white" />
          </button>
          <button 
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* Media Content */}
      <div 
        className="flex-1 flex items-center justify-center p-4 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {mediaType === 'image' ? (
          <img 
            src={mediaUrl} 
            alt="Full view" 
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <video 
            src={mediaUrl} 
            controls 
            autoPlay
            className="max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Hint */}
      <div className="p-3 text-center text-white/50 text-xs">
        Tap outside to close
      </div>
    </div>
  );
}
