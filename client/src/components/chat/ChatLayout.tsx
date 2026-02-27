import React, {
  Suspense,
  lazy,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  Send,
  Paperclip,
  Video,
  Phone,
  Lock,
  Smile,
  PhoneOff,
  Menu,
  X,
  Trash2,
  Settings,
  Reply,
  Shield,
  MoreVertical,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { uploadFormDataWithProgress } from "@/lib/upload-xhr";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useChatConnection } from "@/hooks/use-chat-connection";

import { useToast } from "@/hooks/use-toast";
import ChatMessage from "./ChatMessage";

const ActiveCallOverlay = lazy(() =>
  import("./ActiveCallOverlay").then((module) => ({ default: module.ActiveCallOverlay }))
);
const EmojiPicker = lazy(() =>
  import("./EmojiPicker").then((module) => ({ default: module.EmojiPicker }))
);
const ProfileEditor = lazy(() =>
  import("./ProfileEditor").then((module) => ({ default: module.ProfileEditor }))
);
const MediaViewer = lazy(() =>
  import("./MediaViewer").then((module) => ({ default: module.MediaViewer }))
);
const LazySettingsPanel = lazy(() =>
  import("@/components/settings/SettingsPanel").then((module) => ({ default: module.SettingsPanel }))
);

const FIXED_ROOM_ID = "secure-room-001";

interface ChatLayoutProps {
  onLock: () => void;
  currentUser: "admin" | "friend";
  showAdminPanel: boolean;
  onAdminPanelToggle: () => void;
}

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

type UploadQuality = "standard" | "hd";
type UploadStage =
  | "queued"
  | "waiting_online"
  | "compressing"
  | "uploading"
  | "retry_wait"
  | "success"
  | "failed";

interface UploadProgressPayload {
  fileName: string;
  stage: UploadStage;
  progress: number;
  attempt?: number;
  queueSize?: number;
  message?: string;
}

interface UploadRequestOptions {
  source?: "camera" | "gallery";
  preferLowMemory?: boolean;
  suppressErrorToast?: boolean;
}

export function ChatLayout({
  onLock,
  currentUser,
  showAdminPanel,
  onAdminPanelToggle,
}: ChatLayoutProps) {
  const { toast } = useToast();

  // text + UI
  const [inputText, setInputText] = useState("");
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [retentionMode, setRetentionMode] = useState<
    "forever" | "after_seen" | "1h" | "24h"
  >("forever");
  const [showRetentionSettings, setShowRetentionSettings] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [uploadQuality, setUploadQuality] = useState<UploadQuality>("standard");
  const [participantImageLoading, setParticipantImageLoading] = useState(true);
  const [isAppVisible, setIsAppVisible] = useState(!document.hidden);
  const [visibleMessageCount, setVisibleMessageCount] = useState(80);
  const [isLowMemoryMode, setIsLowMemoryMode] = useState(false);
  const [isCallOverlayMinimized, setIsCallOverlayMinimized] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // selection / reply
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(
    new Set()
  );
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasScrolledToBottomOnLoad = useRef(false);
  const uploadSlotsInUseRef = useRef(0);
  const uploadWaitersRef = useRef<Array<() => void>>([]);
  const queuedUploadCountRef = useRef(0);
  const compressionSlotsInUseRef = useRef(0);
  const compressionWaitersRef = useRef<Array<() => void>>([]);
  const scrollTopLoadThrottleRef = useRef(0);



  // chat connection
  const {
    isConnected,
    peerConnected,
    isPeerOnline,
    myProfile,
    peerProfile,
    updateMyProfile,
    messages,
    sendMessage,
    deleteMessages,
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
    isLoadingMessages,
    hasMoreHistory,
    isLoadingOlderHistory,
    loadOlderMessages,
  } = useChatConnection(currentUser);

  // safe wrapper so TS is happy even if hook returns undefined for deleteMessages
  const safeDeleteMessages = useCallback(
    (ids: string[]) => {
      if (deleteMessages) {
        deleteMessages(ids);
      } else {
        toast({
          title: `${ids.length} message${ids.length !== 1 ? "s" : ""} deleted`,
        });
      }
    },
    [deleteMessages, toast]
  );

  // nuke listener
  useEffect(() => {
    const channel = new BroadcastChannel("secure_chat_messages");
    channel.onmessage = (event) => {
      if (event.data.type === "nuke") {
        emergencyWipe();
      }
    };
    return () => channel.close();
  }, [emergencyWipe]);

  // Handle participant image loading state
  useEffect(() => {
    if (!peerProfile.avatar) {
      setParticipantImageLoading(false);
      return;
    }

    setParticipantImageLoading(true);

    // Fallback timeout in case image never loads
    const timeout = setTimeout(() => {
      setParticipantImageLoading(false);
    }, 2000);

    return () => clearTimeout(timeout);
  }, [peerProfile.avatar]);

  // retention
  useEffect(() => {
    const loadRetentionSettings = async () => {
      try {
        const response = await fetch(`/api/retention/${FIXED_ROOM_ID}`);
        if (response.ok) {
          const data = await response.json();
          setRetentionMode(data.retentionMode);
        }
      } catch (error) {
        console.error("Failed to load retention settings:", error);
      }
    };
    loadRetentionSettings();
  }, []);

  // scroll bottom
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const emitMobileEvent = useCallback((event: string, detail: Record<string, unknown> = {}) => {
    const payload = {
      event,
      at: new Date().toISOString(),
      ...detail,
    };
    console.log("[APP_EVT]", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("chat:mobile-event", { detail: payload }));
  }, []);

  // Optimize scroll to bottom - only scroll if user is near bottom
  useLayoutEffect(() => {
    if (!scrollRef.current) return;

    const container = scrollRef.current;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 200;

    if (isNearBottom) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [messages.length, scrollToBottom]);

  // Scroll to bottom once when messages first load
  useEffect(() => {
    if (!isLoadingMessages && messages.length > 0 && !hasScrolledToBottomOnLoad.current) {
      hasScrolledToBottomOnLoad.current = true;
      setTimeout(() => scrollToBottom(), 20);
    }
  }, [isLoadingMessages, messages.length, scrollToBottom]);

  // exit select mode if nothing selected
  useEffect(() => {
    if (isSelectMode && selectedMessages.size === 0) {
      setIsSelectMode(false);
    }
  }, [selectedMessages, isSelectMode]);

  // Handle mobile keyboard visibility
  useLayoutEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        const isKeyboardOpen = viewport.height < window.innerHeight * 0.75;
        
        if (isKeyboardOpen) {
          document.body.classList.add("keyboard-open");
        } else {
          document.body.classList.remove("keyboard-open");
        }
        
        // Scroll to bottom when keyboard opens
        if (isKeyboardOpen) {
          setTimeout(() => {
            requestAnimationFrame(() => {
              scrollToBottom();
            });
          }, 100);
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      return () => window.visualViewport?.removeEventListener("resize", handleResize);
    }
  }, [scrollToBottom]);

  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      setIsAppVisible(visible);
      if (visible) {
        emitMobileEvent("background_resume", { source: "chat-layout" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [emitMobileEvent]);

  useEffect(() => {
    if (!activeCall) {
      setIsCallOverlayMinimized(false);
    }
  }, [activeCall]);

  useEffect(() => {
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0;
    if (deviceMemory > 0 && deviceMemory <= 4) {
      setIsLowMemoryMode(true);
    }

    let timer: number | null = null;
    const sampleMemory = () => {
      const memory = (performance as Performance & {
        memory?: { jsHeapSizeLimit: number; usedJSHeapSize: number };
      }).memory;
      if (!memory || !memory.jsHeapSizeLimit) return;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      if (usageRatio > 0.82) {
        setIsLowMemoryMode(true);
        emitMobileEvent("memory_pressure", {
          usedMb: Number((memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)),
          limitMb: Number((memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(1)),
          ratio: Number(usageRatio.toFixed(2)),
        });
      }
    };

    timer = window.setInterval(() => {
      if (!document.hidden) sampleMemory();
    }, 45000);
    sampleMemory();

    return () => {
      if (timer != null) window.clearInterval(timer);
    };
  }, [emitMobileEvent]);

  // input change with WhatsApp-style growth (max 6 lines)
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const el = e.target;
      setInputText(el.value);
      handleTyping();

      // Reset height to auto to get accurate scrollHeight
      el.style.height = "auto";
      
      // Calculate line height (approximately 24px per line)
      const lineHeight = 24;
      const maxLines = 6;
      const maxHeight = lineHeight * maxLines;
      
      const scrollHeight = el.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, lineHeight), maxHeight);
      
      el.style.height = `${newHeight}px`;
      el.style.overflowY = scrollHeight > maxHeight ? "auto" : "hidden";
    },
    [handleTyping]
  );

  // send text
  const handleSendText = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!inputText.trim()) return;

      sendMessage({
        text: inputText,
        type: "text",
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              text: replyingTo.text,
              sender: replyingTo.sender,
            }
          : undefined,
      });

      setInputText("");
      setReplyingTo(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
    [inputText, sendMessage, replyingTo]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  const handleReply = useCallback((msg: Message) => {
    setReplyingTo(msg);
    textareaRef.current?.focus();
  }, []);


  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      }),
    []
  );

  const waitForVisible = useCallback(async () => {
    if (!document.hidden) return;
    await new Promise<void>((resolve) => {
      const onVisible = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", onVisible);
          emitMobileEvent("background_resume", { source: "upload-flow" });
          resolve();
        }
      };
      document.addEventListener("visibilitychange", onVisible);
    });
  }, [emitMobileEvent]);

  const toMb = useCallback((bytes: number) => (bytes / (1024 * 1024)).toFixed(2), []);

  const emitUploadProgress = useCallback((payload: UploadProgressPayload) => {
    window.dispatchEvent(new CustomEvent("chat-upload-progress", { detail: payload }));
  }, []);

  const waitForOnline = useCallback(
    async (fileName: string) => {
      if (navigator.onLine) return;
      emitUploadProgress({
        fileName,
        stage: "waiting_online",
        progress: 5,
        message: "Waiting for internet connection",
      });
      await new Promise<void>((resolve) => {
        const onOnline = () => {
          window.removeEventListener("online", onOnline);
          resolve();
        };
        window.addEventListener("online", onOnline, { once: true });
      });
    },
    [emitUploadProgress]
  );

  const getMaxParallelCompression = useCallback(() => {
    if (isLowMemoryMode) return 1;
    const memoryGb = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0;
    if (memoryGb > 0 && memoryGb <= 4) return 1;
    const connection = (navigator as Navigator & {
      connection?: { effectiveType?: string };
    }).connection;
    const effectiveType = connection?.effectiveType ?? "";
    if (effectiveType === "slow-2g" || effectiveType === "2g") return 1;
    return 2;
  }, [isLowMemoryMode]);

  const acquireCompressionSlot = useCallback(async () => {
    const maxParallel = getMaxParallelCompression();
    if (compressionSlotsInUseRef.current < maxParallel) {
      compressionSlotsInUseRef.current += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      compressionWaitersRef.current.push(resolve);
    });
    compressionSlotsInUseRef.current += 1;
  }, [getMaxParallelCompression]);

  const releaseCompressionSlot = useCallback(() => {
    compressionSlotsInUseRef.current = Math.max(0, compressionSlotsInUseRef.current - 1);
    const next = compressionWaitersRef.current.shift();
    if (next) next();
  }, []);

  const runCompressionExclusive = useCallback(
    async <T,>(task: () => Promise<T>): Promise<T> => {
      await acquireCompressionSlot();
      try {
        return await task();
      } finally {
        releaseCompressionSlot();
      }
    },
    [acquireCompressionSlot, releaseCompressionSlot]
  );

  const getMaxParallelUploads = useCallback(() => {
    if (isLowMemoryMode) return 1;
    const connection = (navigator as Navigator & {
      connection?: { effectiveType?: string };
    }).connection;
    const effectiveType = connection?.effectiveType ?? "";
    if (effectiveType === "slow-2g" || effectiveType === "2g") return 1;
    if (effectiveType === "3g") return 2;
    return 3;
  }, [isLowMemoryMode]);

  const acquireUploadSlot = useCallback(async () => {
    const maxParallel = getMaxParallelUploads();
    if (uploadSlotsInUseRef.current < maxParallel) {
      uploadSlotsInUseRef.current += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      uploadWaitersRef.current.push(resolve);
    });
    uploadSlotsInUseRef.current += 1;
  }, [getMaxParallelUploads]);

  const releaseUploadSlot = useCallback(() => {
    uploadSlotsInUseRef.current = Math.max(0, uploadSlotsInUseRef.current - 1);
    const next = uploadWaitersRef.current.shift();
    if (next) next();
  }, []);

  const queueUpload = useCallback(
    async (fileName: string, task: () => Promise<string | null>) => {
      queuedUploadCountRef.current += 1;
      console.log(`[UPLOAD] queued; pending=${queuedUploadCountRef.current}`);
      emitUploadProgress({
        fileName,
        stage: "queued",
        progress: 0,
        queueSize: queuedUploadCountRef.current,
      });

      await acquireUploadSlot();
      try {
        return await task();
      } finally {
        releaseUploadSlot();
        queuedUploadCountRef.current = Math.max(0, queuedUploadCountRef.current - 1);
        console.log(`[UPLOAD] finished; pending=${queuedUploadCountRef.current}`);
      }
    },
    [acquireUploadSlot, emitUploadProgress, releaseUploadSlot]
  );

  const compressImage = useCallback(
    async (file: File, qualityMode: UploadQuality): Promise<Blob> =>
      runCompressionExclusive(async () => {
        const connection = (navigator as Navigator & {
          connection?: { effectiveType?: string };
        }).connection;
        const effectiveType = connection?.effectiveType ?? "";
        const isSlowNetwork = effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g";
        const targetBytes = qualityMode === "hd" ? 4.5 * 1024 * 1024 : 2.4 * 1024 * 1024;
        const maxDimension = isSlowNetwork
          ? qualityMode === "hd"
            ? 1920
            : 1440
          : qualityMode === "hd"
          ? 2400
          : 1680;
        const minLongSide = qualityMode === "hd" ? 900 : 720;
        const minQuality = qualityMode === "hd" ? 0.68 : 0.56;
        let jpegQuality = qualityMode === "hd" ? 0.88 : 0.8;
        if (file.size > 8 * 1024 * 1024) {
          jpegQuality = Math.max(minQuality, jpegQuality - 0.08);
        }
        let source: CanvasImageSource;
        let sourceWidth = 0;
        let sourceHeight = 0;
        let cleanupSource = () => undefined;

        if (typeof window.createImageBitmap === "function") {
          const bitmap = await window.createImageBitmap(file);
          source = bitmap;
          sourceWidth = bitmap.width;
          sourceHeight = bitmap.height;
          cleanupSource = () => {
            bitmap.close();
          };
        } else {
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new window.Image();
            const objectUrl = URL.createObjectURL(file);
            element.onload = () => {
              URL.revokeObjectURL(objectUrl);
              resolve(element);
            };
            element.onerror = (err) => {
              URL.revokeObjectURL(objectUrl);
              reject(err);
            };
            element.src = objectUrl;
          });
          source = image;
          sourceWidth = image.naturalWidth || image.width;
          sourceHeight = image.naturalHeight || image.height;
          cleanupSource = () => {
            image.src = "";
          };
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Canvas context unavailable");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        try {
          let width = sourceWidth;
          let height = sourceHeight;
          const longSide = Math.max(width, height);
          if (longSide > maxDimension) {
            const ratio = maxDimension / longSide;
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          let bestBlob: Blob | null = null;
          let pass = 0;

          while (pass < 6) {
            pass += 1;
            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(source, 0, 0, width, height);

            const blob = await new Promise<Blob>((resolve, reject) => {
              canvas.toBlob(
                (result) =>
                  result ? resolve(result) : reject(new Error("Compression failed")),
                "image/jpeg",
                jpegQuality
              );
            });

            bestBlob = blob;
            console.log(
              `[UPLOAD] compress pass=${pass} quality=${jpegQuality.toFixed(2)} size=${toMb(blob.size)}MB (${width}x${height})`
            );

            if (blob.size <= targetBytes) break;

            if (jpegQuality > minQuality + 0.01) {
              jpegQuality = Math.max(minQuality, jpegQuality - 0.08);
            } else {
              const currentLongSide = Math.max(width, height);
              if (currentLongSide <= minLongSide) break;
              width = Math.max(1, Math.round(width * 0.86));
              height = Math.max(1, Math.round(height * 0.86));
            }

            await wait(0);
          }

          return bestBlob ?? file;
        } finally {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          canvas.width = 0;
          canvas.height = 0;
          cleanupSource();
        }
      }),
    [runCompressionExclusive, toMb, wait]
  );

  const uploadToCloudinary = useCallback(
    async (file: File, options?: UploadRequestOptions): Promise<string | null> =>
      queueUpload(file.name, async () => {
        try {
          const presetName = "chat_upload";
          const retryBackoffMs =
            options?.source === "gallery" ? [250, 800, 1500] : [500, 1500, 3000];
          const maxAttempts = retryBackoffMs.length + 1;
          const shouldAvoidCompression =
            Boolean(options?.preferLowMemory) ||
            isLowMemoryMode ||
            options?.source === "camera";
          const compressionThresholdBytes =
            options?.source === "gallery" ? Math.round(1.8 * 1024 * 1024) : 1024 * 1024;

          console.log(
            `[UPLOAD] start name=${file.name} type=${file.type} original=${toMb(file.size)}MB quality=${uploadQuality}`
          );
          emitUploadProgress({
            fileName: file.name,
            stage: "uploading",
            progress: 8,
            queueSize: queuedUploadCountRef.current,
          });

          await waitForOnline(file.name);
          await waitForVisible();

          let fileToUpload: File | Blob = file;
          if (file.type.startsWith("image/") && file.size > compressionThresholdBytes && !shouldAvoidCompression) {
            emitUploadProgress({
              fileName: file.name,
              stage: "compressing",
              progress: 18,
            });
            fileToUpload = await compressImage(file, uploadQuality);
            console.log(`[UPLOAD] after-compression size=${toMb(fileToUpload.size)}MB`);
            emitUploadProgress({
              fileName: file.name,
              stage: "compressing",
              progress: 42,
            });
          } else if (file.type.startsWith("image/") && shouldAvoidCompression) {
            console.log("[UPLOAD] skipped client compression due to low-memory preference");
          } else if (file.type.startsWith("video/")) {
            const maxVideoBytes = uploadQuality === "hd" ? 80 * 1024 * 1024 : 60 * 1024 * 1024;
            if (file.size > maxVideoBytes) {
              throw new Error(`Video exceeds ${Math.round(maxVideoBytes / (1024 * 1024))}MB upload limit`);
            }
            await wait(0);
          }

          const resourceType = file.type.startsWith("video/") ? "video" : "image";
          const uploadUrl = `https://api.cloudinary.com/v1_1/dqdx30pbj/${resourceType}/upload`;
          let lastError: unknown = null;

          for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            await waitForOnline(file.name);
            await waitForVisible();
            const formData = new FormData();
            formData.append("file", fileToUpload, file.name);
            formData.append("upload_preset", presetName);

            try {
              emitUploadProgress({
                fileName: file.name,
                stage: "uploading",
                progress: 45 + Math.min(45, attempt * 10),
                attempt,
              });
              console.log(`[UPLOAD] attempt ${attempt}/${maxAttempts}`);
              const result = await uploadFormDataWithProgress(
                uploadUrl,
                formData,
                {
                  timeoutMs: options?.source === "gallery" ? 120_000 : 90_000,
                  onProgress: ({ loaded, total }) => {
                    if (total <= 0) return;
                    const ratio = Math.min(1, Math.max(0, loaded / total));
                    const progress = Math.round(45 + ratio * 45);
                    emitUploadProgress({
                      fileName: file.name,
                      stage: "uploading",
                      progress,
                      attempt,
                    });
                  },
                }
              );

              const text = result.responseText;
              console.log(
                `[UPLOAD] response attempt ${attempt}: status=${result.status} body=${text.slice(0, 280)}`
              );

              if (result.status < 200 || result.status >= 300) {
                if (result.status === 400 || result.status === 401) {
                  console.error(
                    `[UPLOAD] Cloudinary auth/preset error preset=${presetName} status=${result.status} response=${text}`
                  );
                }
                throw new Error(`Cloudinary upload failed (${result.status})`);
              }

              const data = JSON.parse(text);
              if (!data?.secure_url) {
                throw new Error("Cloudinary response missing secure_url");
              }
              emitUploadProgress({
                fileName: file.name,
                stage: "success",
                progress: 100,
                attempt,
              });
              return data.secure_url as string;
            } catch (err) {
              lastError = err;
              console.error(`[UPLOAD] attempt ${attempt} failed`, err);
              if (attempt < maxAttempts) {
                const backoffMs = retryBackoffMs[attempt - 1] ?? 3000;
                emitMobileEvent("upload_retry", {
                  fileName: file.name,
                  attempt,
                  backoffMs,
                });
                emitUploadProgress({
                  fileName: file.name,
                  stage: "retry_wait",
                  progress: 25,
                  attempt,
                  message: `Retrying in ${backoffMs}ms`,
                });
                await wait(backoffMs);
              }
            }
          }

          throw lastError ?? new Error("Upload failed after retries");
        } catch (e) {
          console.error(e);
          emitUploadProgress({
            fileName: file.name,
            stage: "failed",
            progress: 100,
            message: e instanceof Error ? e.message : "Upload failed",
          });
          if (!options?.suppressErrorToast) {
            toast({ variant: "destructive", title: "Failed to upload media" });
          }
          return null;
        }
      }),
    [
      queueUpload,
      isLowMemoryMode,
      toMb,
      uploadQuality,
      emitUploadProgress,
      waitForOnline,
      waitForVisible,
      compressImage,
      wait,
      toast,
      emitMobileEvent,
    ]
  );

  const handleCamera = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.style.display = "none";
    document.body.appendChild(input);

    let cleanupTimer = 0;
    const cleanup = () => {
      if (cleanupTimer) {
        window.clearTimeout(cleanupTimer);
      }
      input.onchange = null;
      input.value = "";
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    cleanupTimer = window.setTimeout(cleanup, 60_000);

    input.onchange = async (e) => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        toast({ title: "Uploading image..." });
        const url = await uploadToCloudinary(file, { source: "camera", preferLowMemory: true });
        if (url) {
          sendMessage({ type: "image", mediaUrl: url, text: "" });
          // Scroll to bottom after sending camera image
          requestAnimationFrame(() => {
            scrollToBottom();
          });
        }
      } finally {
        cleanup();
      }
    };
    input.addEventListener("cancel", cleanup, { once: true });

    input.click();
    setShowMediaOptions(false);
  }, [sendMessage, uploadToCloudinary, toast, scrollToBottom]);

  const handleGallery = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      input.onchange = null;
      input.value = "";
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    input.onchange = async (e) => {
      try {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;
        const filesArray = Array.from(files).sort((a, b) => a.size - b.size);
        toast({ title: `Uploading ${filesArray.length} file(s)...` });
        let successCount = 0;
        let failedCount = 0;

        await Promise.all(
          filesArray.map(async (file) => {
            const url = await uploadToCloudinary(file, {
              source: "gallery",
              suppressErrorToast: true,
            });
            if (!url) {
              failedCount += 1;
              return;
            }
            const type = file.type.startsWith("image/") ? "image" : "video";
            sendMessage({ type, mediaUrl: url, text: "" });
            successCount += 1;
            await wait(0);
          })
        );

        if (failedCount > 0) {
          toast({
            variant: "destructive",
            title: `${failedCount} file(s) failed`,
            description: `${successCount} sent successfully`,
          });
        } else {
          toast({ title: `${successCount} file(s) sent` });
        }

        // Scroll to bottom after sending gallery media
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      } finally {
        cleanup();
      }
    };
    input.addEventListener("cancel", cleanup, { once: true });

    input.click();
    setShowMediaOptions(false);
  }, [sendMessage, uploadToCloudinary, toast, scrollToBottom, wait]);


  // long press -> select mode (with haptic feedback on supported devices)
  const handleMessageLongPress = useCallback((msgId: string) => {
    setIsSelectMode(true);
    setSelectedMessages(new Set([msgId]));
  }, []);

  const handleMediaClick = useCallback(
    (url: string, type: "image" | "video") => {
      setSelectedMedia({ url, type });
    },
    []
  );

  // Handle reply action
  const handleReplyAction = useCallback((msg: Message) => {
    if (isSelectMode) return;
    if ((msg.type === "image" || msg.type === "video") && msg.mediaUrl) {
      handleMediaClick(msg.mediaUrl, msg.type);
    } else {
      handleReply(msg);
    }
  }, [isSelectMode, handleMediaClick, handleReply]);

  const handleSelectMessage = useCallback((msgId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedMessages.size === 0) return;
    const ids = Array.from(selectedMessages);
    safeDeleteMessages(ids);
    setSelectedMessages(new Set());
    setIsSelectMode(false);
  }, [selectedMessages, safeDeleteMessages]);

  const handleCancelSelect = useCallback(() => {
    setSelectedMessages(new Set());
    setIsSelectMode(false);
  }, []);

  // last seen
  const getLastSeenText = useMemo(() => {
    if (isPeerOnline) return "Online";
    const lastSeen = (peerProfile as any).lastSeen;
    if (lastSeen) {
      return `Last seen ${formatDistanceToNow(lastSeen, { addSuffix: true })}`;
    }
    return "Offline";
  }, [isPeerOnline, (peerProfile as any).lastSeen]);

  // double tap header -> lock
  const [tapCount, setTapCount] = useState(0);
  const handleHeaderDoubleTap = useCallback(() => {
    setTapCount((prev) => prev + 1);
    setTimeout(() => setTapCount(0), 300);
    if (tapCount === 1) {
      onLock();
    }
  }, [tapCount, onLock]);

  const messageBatchSize = isLowMemoryMode ? 40 : 80;
  const hiddenMessagesCount = Math.max(0, messages.length - visibleMessageCount);
  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - visibleMessageCount)),
    [messages, visibleMessageCount]
  );

  useEffect(() => {
    if (messages.length === 0) {
      setVisibleMessageCount(messageBatchSize);
      return;
    }
    setVisibleMessageCount((prev) => {
      const minimum = Math.min(messages.length, Math.max(messageBatchSize, prev));
      return minimum;
    });
  }, [messageBatchSize, messages.length]);

  // render messages - memoized to prevent re-renders
const messagesList = useMemo(
  () =>
    visibleMessages.map((msg) => (
      <ChatMessage
        key={msg.id}
        message={msg as Message}
        isSelected={selectedMessages.has(msg.id)}
        isSelectMode={isSelectMode}
        onSelect={handleSelectMessage}
        onLongPress={handleMessageLongPress}
        onReply={handleReplyAction}
        onSwipeReply={handleReply}
      />
    )),
  [
    visibleMessages,
    selectedMessages.size,
    isSelectMode,
    handleSelectMessage,
    handleMessageLongPress,
    handleReplyAction,
    handleReply,
  ]
);

  // Handle click outside messages to deselect
  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (isSelectMode && e.target === e.currentTarget) {
        setSelectedMessages(new Set());
        setIsSelectMode(false);
      }
    },
    [isSelectMode]
  );

  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop > 80) return;
    const now = Date.now();
    if (now - scrollTopLoadThrottleRef.current < 300) return;
    scrollTopLoadThrottleRef.current = now;
    if (hiddenMessagesCount > 0) {
      setVisibleMessageCount((prev) => Math.min(messages.length, prev + messageBatchSize));
      return;
    }
    if (hasMoreHistory && !isLoadingOlderHistory) {
      void loadOlderMessages();
    }
  }, [hiddenMessagesCount, hasMoreHistory, isLoadingOlderHistory, loadOlderMessages, messageBatchSize, messages.length]);

  const handleLoadOlder = useCallback(async () => {
    if (hasMoreHistory && !isLoadingOlderHistory) {
      await loadOlderMessages();
    }
    setVisibleMessageCount((prev) => prev + messageBatchSize * 2);
  }, [hasMoreHistory, isLoadingOlderHistory, loadOlderMessages, messageBatchSize]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#0a1014]">
      <div className="w-full h-dvh md:h-[94vh] md:my-3 max-w-6xl flex bg-[#0A1014] md:rounded-2xl shadow-2xl overflow-hidden md:overflow-visible">
        {/* MOBILE SIDEBAR OVERLAY */}
        {showSidebar && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              setShowSidebar(false);
            }}
          />
        )}

        {/* MOBILE SIDEBAR */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[78%] max-w-xs bg-[#111b21] text-white shadow-2xl transform transition-transform duration-300 ease-out md:hidden",
            showSidebar ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold">Menu</h2>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div
                className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg:white/5 hover:bg-white/5"
                onClick={() => {
                  setShowProfileEditor(true);
                  setShowSidebar(false);
                }}
              >
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarImage src={myProfile.avatar} />
                  <AvatarFallback className="bg-emerald-600 text-white text-sm">
                    {myProfile.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">
                    {myProfile.name}
                  </p>
                  <p className="text-xs text-zinc-400 flex items-center gap-2">
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isConnected ? "bg-emerald-500" : "bg-yellow-500"
                      )}
                    />
                    <span className="truncate">
                      {isConnected ? "Connected" : "Connecting..."}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              <button
                onClick={() => {
                  setShowSettings(true);
                  setShowSidebar(false);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left"
              >
                <Settings size={20} className="text-zinc-400" />
                <span className="text-sm">Settings</span>
              </button>
              {currentUser === "admin" && (
                <button
                  onClick={() => {
                    onAdminPanelToggle();
                    setShowSidebar(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/10 transition-colors text-left"
                >
                  <Shield size={20} className="text-zinc-400" />
                  <span className="text-sm">Admin Panel</span>
                </button>
              )}

            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 p-3 bg-[#202c33] border-l-4 border-emerald-500">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={peerProfile.avatar} />
                  <AvatarFallback className="bg-emerald-700 text-white">
                    {peerProfile.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center gap-2">
                    <h3 className="font-medium text-sm truncate">
                      {peerProfile.name}
                    </h3>
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        isPeerOnline ? "bg-emerald-500" : "bg-zinc-500"
                      )}
                    />
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    {peerProfile.isTyping ? (
                      <span className="text-emerald-400">typing…</span>
                    ) : (
                      getLastSeenText
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 border-t border-white/10 text-[11px] text-center text-zinc-500">
              Double tap header to lock • Long press message to select
            </div>
          </div>
        </div>

        {/* DESKTOP SIDEBAR */}
        <div className="hidden md:flex md:w-[340px] bg-[#111b21] text-white flex-col border-r border-black/40">
          <div className="p-3 border-b border-black/40 flex justify-between items-center">
            <div
              className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
              onClick={() => setShowProfileEditor(true)}
            >
              <Avatar className="h-10 w-10 border border-white/10">
                <AvatarImage src={myProfile.avatar} />
                <AvatarFallback className="bg-emerald-600 text-white text-sm">
                  {myProfile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {myProfile.name}
                </p>
                <p className="text-xs text-zinc-400 flex items-center gap-2">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isConnected ? "bg-emerald-500" : "bg-yellow-500"
                    )}
                  />
                  <span className="truncate">
                    {isConnected ? "Connected" : "Connecting..."}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {currentUser === "admin" && (
                <button
                  onClick={onAdminPanelToggle}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  title="Admin Panel"
                >
                  <Shield size={18} />
                </button>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Settings"
              >
                <Settings size={18} />
              </button>

            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center gap-3 p-3 bg-[#202c33] border-l-4 border-emerald-500">
              <Avatar className="h-11 w-11">
                <AvatarImage src={peerProfile.avatar} />
                <AvatarFallback className="bg-emerald-700 text-white">
                  {peerProfile.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <h3 className="font-medium text-sm truncate">
                    {peerProfile.name}
                  </h3>
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isPeerOnline ? "bg-emerald-500" : "bg-zinc-500"
                    )}
                  />
                </div>
                <p className="text-xs text-zinc-400 truncate">
                  {peerProfile.isTyping ? (
                    <span className="text-emerald-400">typing…</span>
                  ) : (
                    getLastSeenText
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-black/40 text-[11px] text-center text-zinc-500">
            Double tap header to lock • Long press message to select
          </div>
        </div>

        {/* MAIN CHAT AREA */}
        <div className="flex-1 flex flex-col bg-[#0B141A] h-dvh md:h-auto overflow-hidden chat-container md:overflow-visible">
          {/* Incoming Call Dialog */}
          <Dialog
            open={!!incomingCall}
            onOpenChange={(open) => !open && rejectCall()}
          >
            <DialogContent className="w-[90vw] max-w-md border-none bg-slate-900 text-white shadow-2xl mx-auto">
              <DialogHeader className="flex flex-col items-center gap-4">
                <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-white/10 animate-pulse">
                  <AvatarImage src={peerProfile.avatar} />
                  <AvatarFallback className="text-2xl bg-emerald-600 text-white">
                    {peerProfile.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <DialogTitle className="text-xl sm:text-2xl font-light">
                  {incomingCall?.type === "video" ? "Video" : "Voice"} Call
                </DialogTitle>
                <DialogDescription className="text-white/60">
                  {peerProfile.name} is calling...
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center gap-6 sm:gap-8 mt-4 sm:mt-6">
                <button
                  onClick={rejectCall}
                  className="p-3 sm:p-4 bg-red-500 rounded-full hover:bg-red-600 transition-colors"
                >
                  <PhoneOff size={20} className="sm:w-6 sm:h-6" />
                </button>
                <button
                  onClick={acceptCall}
                  className="p-3 sm:p-4 bg-green-500 rounded-full hover:bg-green-600 transition-colors"
                >
                  <Phone size={20} className="sm:w-6 sm:h-6" />
                </button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Active Call Overlay */}
          {activeCall && (
            <Suspense fallback={null}>
              <ActiveCallOverlay
                peerName={peerProfile.name}
                peerAvatar={peerProfile.avatar}
                callStatus={callStatus}
                localStream={localStream}
                remoteStream={remoteStream}
                isMuted={isMuted}
                isVideoOff={isVideoOff}
                onToggleMute={toggleMute}
                onToggleVideo={toggleVideo}
                onEndCall={endCall}
                onMinimize={() => setIsCallOverlayMinimized(true)}
                isMinimized={isCallOverlayMinimized}
              />
            </Suspense>
          )}

          {/* Profile Editor */}
          {showProfileEditor && (
            <Suspense fallback={null}>
              <ProfileEditor
                isOpen={showProfileEditor}
                onClose={() => setShowProfileEditor(false)}
                currentName={myProfile.name}
                currentAvatar={myProfile.avatar}
                onSave={(name, avatar) => updateMyProfile({ name, avatar })}
              />
            </Suspense>
          )}

          {/* Settings Panel */}
          {showSettings && (
            <Suspense fallback={null}>
              <LazySettingsPanel
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                userType={currentUser}
              />
            </Suspense>
          )}

          {/* Media Viewer */}
          {selectedMedia && (
            <Suspense fallback={null}>
              <MediaViewer
                isOpen={!!selectedMedia}
                mediaUrl={selectedMedia.url}
                mediaType={selectedMedia.type}
                onClose={() => setSelectedMedia(null)}
              />
            </Suspense>
          )}



          {/* Retention Settings */}
          <Dialog
            open={showRetentionSettings}
            onOpenChange={setShowRetentionSettings}
          >
            <DialogContent className="w-[90vw] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle>Message Retention</DialogTitle>
                <DialogDescription>
                  Choose how long messages should be kept.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Retention Mode</label>
                  <select
                    value={retentionMode}
                    onChange={(e) =>
                      setRetentionMode(e.target.value as any)
                    }
                    className="w-full px-3 py-2 border border-input bg-background rounded-md"
                  >
                    <option value="forever">
                      Off (keep messages forever)
                    </option>
                    <option value="after_seen">After seen</option>
                    <option value="1h">1 hour</option>
                    <option value="24h">24 hours</option>
                  </select>
                </div>
                <div className="text-sm text-muted-foreground">
                  {retentionMode === "forever" &&
                    "Messages will never disappear."}
                  {retentionMode === "after_seen" &&
                    "Messages disappear after both users have seen them."}
                  {retentionMode === "1h" &&
                    "Messages disappear 1 hour after being sent."}
                  {retentionMode === "24h" &&
                    "Messages disappear 24 hours after being sent."}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowRetentionSettings(false)}
                  className="px-4 py-2 text-sm border border-input rounded-md hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(
                        `/api/retention/${FIXED_ROOM_ID}`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ retentionMode }),
                        }
                      );
                      if (response.ok) {
                        setShowRetentionSettings(false);
                        toast({ title: "Retention setting updated" });
                      } else {
                        throw new Error("Failed to update retention");
                      }
                    } catch (error) {
                      console.error("Error updating retention:", error);
                      toast({
                        variant: "destructive",
                        title: "Failed to update retention setting",
                      });
                    }
                  }}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
                >
                  Save
                </button>
              </div>
            </DialogContent>
          </Dialog>

          

          {/* HEADER */}
          <header
            className={cn(
              "h-14 sm:h-16 flex items-center justify-between px-2 sm:px-4 border-b border-black/40 z-50 shrink-0 safe-area-top selection-header md:relative fixed top-0 left-0 right-0 md:top-auto md:left-auto md:right-auto",
              isSelectMode ? "bg-emerald-900/90" : "bg-[#202c33]"
            )}
            onClick={!isSelectMode ? handleHeaderDoubleTap : undefined}
          >
            {isSelectMode ? (
              <>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCancelSelect}
                    className="p-2 rounded-full hover:bg-white/10 text-zinc-100"
                  >
                    <X size={20} />
                  </button>
                  <span className="font-medium text-sm text-zinc-100">
                    {selectedMessages.size} selected
                  </span>
                </div>
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500 text-white text-sm hover:bg-red-600"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {/* Mobile 3-dot menu button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setShowSidebar((prev) => !prev);
                    }}
                    className="p-2 rounded-full hover:bg-white/5 md:hidden text-zinc-100 z-50"
                    type="button"
                  >
                    <MoreVertical size={20} />
                  </button>
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarImage
                      src={peerProfile.avatar}
                      onLoad={() => setParticipantImageLoading(false)}
                      onError={() => setParticipantImageLoading(false)}
                    />
                    <AvatarFallback className={cn(
                      "bg-emerald-700 text-white",
                      participantImageLoading && "animate-pulse bg-zinc-600"
                    )}>
                      {participantImageLoading ? "" : peerProfile.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-sm truncate text-zinc-100">
                      {peerProfile.name}
                    </h2>
                    <span
                      className={cn(
                        "text-xs truncate block",
                        isPeerOnline
                          ? "text-emerald-400"
                          : "text-zinc-400"
                      )}
                    >
                      {peerProfile.isTyping ? (
                        <span className="text-emerald-400">typing…</span>
                      ) : (
                        getLastSeenText
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      peerConnected && startCall("voice");
                    }}
                    disabled={!peerConnected}
                    className={cn(
                      "p-2.5 rounded-full text-zinc-100",
                      peerConnected
                        ? "hover:bg-white/5"
                        : "opacity-40 cursor-default"
                    )}
                  >
                    <Phone size={20} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      peerConnected && startCall("video");
                    }}
                    disabled={!peerConnected}
                    className={cn(
                      "p-2.5 rounded-full text-zinc-100",
                      peerConnected
                        ? "hover:bg-white/5"
                        : "opacity-40 cursor-default"
                    )}
                  >
                    <Video size={20} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLock();
                    }}
                    className="p-2.5 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Lock size={20} />
                  </button>
                </div>
              </>
            )}
          </header>

          {activeCall && isCallOverlayMinimized && (
            <button
              type="button"
              onClick={() => setIsCallOverlayMinimized(false)}
              className="fixed top-[calc(env(safe-area-inset-top,0px)+62px)] right-3 z-[60] md:top-4 md:right-4 px-3 py-2 rounded-full bg-emerald-600/90 text-white text-xs font-medium shadow-lg backdrop-blur border border-emerald-300/20"
            >
              Return to call
            </button>
          )}

          {/* MESSAGES */}
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto px-2 sm:px-4 pt-[72px] md:pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+80px+16px)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+96px+16px)] bg-[#0B141A] overscroll-contain"
            style={{
              WebkitOverflowScrolling: "touch",
              touchAction: isSelectMode ? "none" : "pan-y",
            }}
            onScroll={handleMessagesScroll}
            onClick={handleContainerClick}
          >
            {(hiddenMessagesCount > 0 || hasMoreHistory) && (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  disabled={isLoadingOlderHistory}
                  className="text-[11px] text-zinc-300 bg-black/20 rounded-full px-3 py-1 hover:bg-black/35"
                >
                  {isLoadingOlderHistory
                    ? "Loading older messages..."
                    : hiddenMessagesCount > 0
                    ? `Load older messages (${hiddenMessagesCount})`
                    : "Load older messages"}
                </button>
              </div>
            )}

            {messages.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <div className="text-xs sm:text-sm text-zinc-100/80 bg-black/20 rounded-full px-4 py-2">
                  Start a conversation with {peerProfile.name}
                </div>
              </div>
            )}

            {messagesList}

            {peerProfile.isTyping && (
              <div className="flex justify-start px-4 mt-1">
                <div className="bg-[#202c33] rounded-2xl px-3 py-2 shadow-sm border border-black/40">
                  <div className="flex gap-1 items-end">
                    <span
                      className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 bg-zinc-300 rounded-full animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-1" />
          </div>

          {/* INPUT */}
          <div className="bg-[#202c33] border-t border-black/40 shrink-0 safe-area-bottom md:relative fixed bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto z-40 md:z-auto pt-4 md:pt-0">
            {replyingTo && (
              <div className="px-3 pt-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#18252f] rounded-xl border-l-2 border-emerald-500">
                  <Reply size={16} className="text-emerald-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-emerald-400">
                      Reply to{" "}
                      {replyingTo.sender === "me"
                        ? "yourself"
                        : peerProfile.name}
                    </p>
                    <p className="text-xs text-zinc-300 truncate">
                      {replyingTo.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 rounded-full hover:bg-white/10 text-zinc-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}

            <div className="px-2 sm:px-3 py-2 sm:py-3">
              <form onSubmit={handleSendText}>
                <div className="flex items-end gap-1.5 sm:gap-2 rounded-3xl bg-[#2a3942] px-2 sm:px-3 py-1.5">
                  <Popover open={showMediaOptions} onOpenChange={setShowMediaOptions}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowMediaOptions(true)}
                        disabled={!isConnected}
                        className="p-1.5 sm:p-2 text-zinc-300 hover:bg-white/10 rounded-full disabled:opacity-40 shrink-0 mb-0.5"
                      >
                        <Paperclip size={18} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2" align="start" side="top">
                      <div className="space-y-1">
                        <button
                          onClick={handleCamera}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/10 text-left"
                        >
                          <Camera size={16} /> Camera
                        </button>
                        <button
                          onClick={handleGallery}
                          className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/10 text-left"
                        >
                          <ImageIcon size={16} /> Gallery
                        </button>
                        <div className="pt-2 mt-1 border-t border-white/10">
                          <p className="px-2 pb-1 text-[11px] text-zinc-400">Upload quality</p>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => setUploadQuality("standard")}
                              className={cn(
                                "text-xs px-2 py-1.5 rounded",
                                uploadQuality === "standard"
                                  ? "bg-emerald-600 text-white"
                                  : "hover:bg-white/10 text-zinc-300"
                              )}
                            >
                              Standard
                            </button>
                            <button
                              type="button"
                              onClick={() => setUploadQuality("hd")}
                              className={cn(
                                "text-xs px-2 py-1.5 rounded",
                                uploadQuality === "hd"
                                  ? "bg-emerald-600 text-white"
                                  : "hover:bg-white/10 text-zinc-300"
                              )}
                            >
                              HD
                            </button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="p-1.5 sm:p-2 text-zinc-300 hover:bg-white/10 rounded-full shrink-0 mb-0.5"
                      >
                        <Smile size={18} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                      side="top"
                    >
                      <Suspense fallback={null}>
                        <EmojiPicker
                          onSelect={(emoji) =>
                            setInputText((prev) => prev + emoji)
                          }
                        />
                      </Suspense>
                    </PopoverContent>
                  </Popover>

                  <div className="flex-1 flex items-end min-h-9 sm:min-h-10 min-w-0">
                    <textarea
                      ref={textareaRef}
                      value={inputText}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        isConnected
                          ? isAppVisible
                            ? "Message"
                            : "Background mode"
                          : "Connecting..."
                      }
                      disabled={!isConnected}
                      rows={1}
                      className={cn(
                        "flex-1 bg-transparent text-[15px] leading-[1.5] text-zinc-100",
                        "w-full resize-none overflow-x-hidden chat-textarea",
                        "placeholder:text-zinc-500",
                        "py-1.5",
                        "border-none outline-none ring-0",
                        "focus:outline-none focus:ring-0 focus:border-none focus:shadow-none"
                      )}
                      style={{ 
                        height: "24px",
                        minHeight: "24px",
                        maxHeight: "144px",
                        border: "none",
                        boxShadow: "none",
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!isConnected || !inputText.trim()}
                    className="p-2 sm:p-2.5 rounded-full bg-emerald-600 shrink-0 hover:bg-emerald-700 disabled:opacity-40"
                  >
                    <Send size={18} className="text-white" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

