import { useState, useEffect } from "react";
import { PYQView } from "@/components/disguise/PYQView";
import { CalculatorView } from "@/components/disguise/CalculatorView";
import { LoginOverlay } from "@/components/auth/LoginOverlay";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { Toaster } from "@/components/ui/toaster";

type AppMode = 'disguise' | 'chat';
type DisguiseType = 'pyq' | 'calc';

export default function Home() {
  // Initialize state
  const [mode, setMode] = useState<AppMode>('disguise');
  const [disguiseType, setDisguiseType] = useState<DisguiseType>('pyq'); // Can be toggled via URL param ?mode=calc
  const [showLogin, setShowLogin] = useState(false);

  // Check URL params for disguise mode preference
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'calc') {
      setDisguiseType('calc');
    }
  }, []);

  // Auto-lock logic (simple inactivity timer)
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(timeout);
      if (mode === 'chat') {
        timeout = setTimeout(() => {
          setMode('disguise');
          setShowLogin(false);
        }, 1000 * 60 * 5); // 5 minutes
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keypress', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keypress', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
    };
  }, [mode]);

  const handleUnlockTrigger = () => {
    setShowLogin(true);
  };

  const handleLoginSuccess = () => {
    setShowLogin(false);
    setMode('chat');
  };

  const handlePanicLock = () => {
    setMode('disguise');
    setShowLogin(false);
  };

  return (
    <div className="min-h-screen w-full overflow-hidden relative">
      {/* Render Disguise Layer */}
      {mode === 'disguise' && (
        <>
          {disguiseType === 'pyq' ? (
            <PYQView onUnlock={handleUnlockTrigger} />
          ) : (
            <CalculatorView onUnlock={handleUnlockTrigger} />
          )}
        </>
      )}

      {/* Render Login Overlay (Always mounted but hidden/shown via internal state logic) */}
      <LoginOverlay 
        isOpen={showLogin} 
        onSuccess={handleLoginSuccess} 
        onClose={() => setShowLogin(false)}
      />

      {/* Render Chat Layer */}
      {mode === 'chat' && (
        <ChatLayout onLock={handlePanicLock} />
      )}
      
      <Toaster />
    </div>
  );
}
