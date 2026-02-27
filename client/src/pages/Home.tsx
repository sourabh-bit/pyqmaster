import { useState, useEffect, useRef } from "react";
import { PYQView } from "@/components/disguise/PYQView";
import { CalculatorView } from "@/components/disguise/CalculatorView";
import { LoginOverlay } from "@/components/auth/LoginOverlay";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Toaster } from "@/components/ui/toaster";

export default function Home() {
  const [mode, setMode] = useState<'disguise' | 'chat'>('disguise');
  const [disguiseType, setDisguiseType] = useState<'pyq' | 'calc'>('pyq');
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState<'admin' | 'friend'>('friend');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const lastActiveRef = useRef<number>(Date.now());

  const SESSION_KEY = "chat_auth_user";
  const SESSION_TS_KEY = "chat_auth_ts";
  const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'calc') {
      setDisguiseType('calc');
    }

    // Auto-restore last session if still fresh
    const savedUser = localStorage.getItem(SESSION_KEY) as 'admin' | 'friend' | null;
    const savedTs = Number(localStorage.getItem(SESSION_TS_KEY) || 0);
    if (savedUser && savedTs && Date.now() - savedTs < SESSION_TTL_MS) {
      setCurrentUser(savedUser);
      setMode('chat');
      setShowLogin(false);
    }
  }, []);

  // Auto lock on inactivity
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const lockDelayMs = 1000 * 60 * 20; // 20 minutes of inactivity

    const resetTimer = () => {
      clearTimeout(timeout);
      lastActiveRef.current = Date.now();
      if (mode === "chat") {
        timeout = setTimeout(() => {
          setMode("disguise");
          setShowLogin(false);
        }, lockDelayMs);
      }
    };

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keypress", resetTimer);
    window.addEventListener("touchstart", resetTimer);
    const handleVisibility = () => {
      if (document.hidden) {
        clearTimeout(timeout);
      } else if (mode === "chat") {
        const elapsed = Date.now() - lastActiveRef.current;
        if (elapsed >= lockDelayMs) {
          setMode("disguise");
          setShowLogin(false);
          setShowAdminPanel(false);
          setCurrentUser("friend");
        } else {
          timeout = setTimeout(() => {
            setMode("disguise");
            setShowLogin(false);
          }, lockDelayMs - elapsed);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keypress", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [mode]);

  const handleUnlockTrigger = () => setShowLogin(true);

  const handleLoginSuccess = (userType: 'admin' | 'friend') => {
    setCurrentUser(userType);
    setMode("chat");
    setShowAdminPanel(false);
    setShowLogin(false);
    localStorage.setItem(SESSION_KEY, userType);
    localStorage.setItem(SESSION_TS_KEY, Date.now().toString());
  };

  const handlePanicLock = () => {
    setMode("disguise");
    setShowLogin(false);
    setShowAdminPanel(false);
    setCurrentUser("friend");
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_TS_KEY);
  };

  // Admin shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode === "chat" && currentUser === "admin" && e.ctrlKey && e.shiftKey && e.key === "A") {
        setShowAdminPanel(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, currentUser]);

  return (
    <div className="min-h-screen w-full bg-background overflow-hidden relative">

      {/* disguise layer */}
      {mode === "disguise" && (
        disguiseType === "pyq"
          ? <PYQView onUnlock={handleUnlockTrigger} />
          : <CalculatorView onUnlock={handleUnlockTrigger} />
      )}

      {/* login */}
      <LoginOverlay
        isOpen={showLogin}
        onSuccess={handleLoginSuccess}
        onClose={() => setShowLogin(false)}
      />

      {/* CHAT */}
      {mode === "chat" && (
        <div className="w-full h-full flex justify-center">
          <div className="w-full max-w-[1400px] h-full flex overflow-hidden">
            <ChatLayout
              onLock={handlePanicLock}
              currentUser={currentUser}
              showAdminPanel={showAdminPanel}
              onAdminPanelToggle={() => setShowAdminPanel(!showAdminPanel)}
            />
          </div>
        </div>
      )}

      {/* admin panel */}
      {mode === "chat" && currentUser === "admin" && (
        <AdminPanel
          isOpen={showAdminPanel}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

      <Toaster />
    </div>
  );
}
