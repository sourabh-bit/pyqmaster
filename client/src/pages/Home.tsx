import { useState, useEffect } from "react";
import { PYQView } from "@/components/disguise/PYQView";
import { CalculatorView } from "@/components/disguise/CalculatorView";
import { LoginOverlay } from "@/components/auth/LoginOverlay";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Toaster } from "@/components/ui/toaster";

const AUTH_SESSION_KEY = "chat_unlocked_session_v1";
const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24;

export default function Home() {
  const AUTO_LOCK_TIMEOUT_MS = 0; // set > 0 to enable inactivity lock
  const [mode, setMode] = useState<'disguise' | 'chat'>('disguise');
  const [disguiseType, setDisguiseType] = useState<'pyq' | 'calc'>('pyq');
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState<'admin' | 'friend'>('friend');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'calc') {
      setDisguiseType('calc');
    }

    try {
      const raw = localStorage.getItem(AUTH_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { userType?: "admin" | "friend"; at?: number };
      const age = Date.now() - (parsed?.at ?? 0);
      if (!parsed?.at || age > AUTH_SESSION_TTL_MS) {
        localStorage.removeItem(AUTH_SESSION_KEY);
        return;
      }
      if (parsed?.userType === "admin" || parsed?.userType === "friend") {
        setCurrentUser(parsed.userType);
        setMode("chat");
        setShowLogin(false);
      }
    } catch {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }, []);

  // Auto lock on inactivity
  useEffect(() => {
    if (AUTO_LOCK_TIMEOUT_MS <= 0) return;

    let timeout: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeout);
      if (mode === "chat") {
        timeout = setTimeout(() => {
          setMode("disguise");
          setShowLogin(false);
        }, AUTO_LOCK_TIMEOUT_MS);
      }
    };

    if (mode === "chat") {
      resetTimer();
    }

    window.addEventListener("mousemove", resetTimer);
    window.addEventListener("keypress", resetTimer);
    window.addEventListener("keydown", resetTimer);
    window.addEventListener("click", resetTimer);
    window.addEventListener("scroll", resetTimer, { passive: true });
    window.addEventListener("touchstart", resetTimer);
    window.addEventListener("touchmove", resetTimer, { passive: true });

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("mousemove", resetTimer);
      window.removeEventListener("keypress", resetTimer);
      window.removeEventListener("keydown", resetTimer);
      window.removeEventListener("click", resetTimer);
      window.removeEventListener("scroll", resetTimer);
      window.removeEventListener("touchstart", resetTimer);
      window.removeEventListener("touchmove", resetTimer);
    };
  }, [AUTO_LOCK_TIMEOUT_MS, mode]);

  const handleUnlockTrigger = () => setShowLogin(true);

  const handleLoginSuccess = (userType: 'admin' | 'friend') => {
    setCurrentUser(userType);
    setMode("chat");
    setShowAdminPanel(false);
    setShowLogin(false);
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ userType, at: Date.now() })
    );
  };

  const handlePanicLock = () => {
    setMode("disguise");
    setShowLogin(false);
    setShowAdminPanel(false);
    setCurrentUser("friend");
    localStorage.removeItem(AUTH_SESSION_KEY);
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
