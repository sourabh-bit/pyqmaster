import { useState, useEffect } from "react";
import { PYQView } from "@/components/disguise/PYQView";
import { CalculatorView } from "@/components/disguise/CalculatorView";
import { LoginOverlay } from "@/components/auth/LoginOverlay";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { Toaster } from "@/components/ui/toaster";
<<<<<<< HEAD
import { Shield } from "lucide-react";
=======
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451

type AppMode = 'disguise' | 'chat';
type DisguiseType = 'pyq' | 'calc';

export default function Home() {
<<<<<<< HEAD
=======
  // Initialize state
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  const [mode, setMode] = useState<AppMode>('disguise');
  const [disguiseType, setDisguiseType] = useState<DisguiseType>('pyq'); 
  const [showLogin, setShowLogin] = useState(false);
  const [currentUser, setCurrentUser] = useState<'admin' | 'friend'>('friend');
  const [showAdminPanel, setShowAdminPanel] = useState(false);

<<<<<<< HEAD
=======
  // Check URL params for disguise mode preference
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'calc') {
      setDisguiseType('calc');
    }
  }, []);

<<<<<<< HEAD
  // Auto-lock after inactivity
=======
  // Auto-lock logic
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(timeout);
      if (mode === 'chat') {
        timeout = setTimeout(() => {
          setMode('disguise');
          setShowLogin(false);
<<<<<<< HEAD
        }, 1000 * 60 * 5);
=======
        }, 1000 * 60 * 5); // 5 minutes
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
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

  const handleLoginSuccess = (userType: 'admin' | 'friend') => {
    setCurrentUser(userType);
<<<<<<< HEAD
    setShowAdminPanel(false);
    setShowLogin(false);
    setMode('chat');
    
    const logs = JSON.parse(localStorage.getItem('connection_logs') || '[]');
    logs.push({ timestamp: new Date().toISOString(), event: 'Logged in', user: userType });
    localStorage.setItem('connection_logs', JSON.stringify(logs.slice(-100)));
=======
    setShowAdminPanel(false); // Always close admin panel on login
    setShowLogin(false);
    setMode('chat');
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  };

  const handlePanicLock = () => {
    setMode('disguise');
    setShowLogin(false);
<<<<<<< HEAD
    setShowAdminPanel(false);
    setCurrentUser('friend');
  };

  // Keyboard shortcut for Admin Panel
=======
    setShowAdminPanel(false); // Also close admin panel on lock
    setCurrentUser('friend'); // Reset to friend on lock
  };

  // Keyboard shortcut for Admin Panel (Ctrl+Shift+A or hidden gesture)
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode === 'chat' && currentUser === 'admin' && e.ctrlKey && e.shiftKey && e.key === 'A') {
        setShowAdminPanel(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, currentUser]);

  return (
    <div className="min-h-screen w-full overflow-hidden relative">
<<<<<<< HEAD
      {/* Disguise Layer */}
=======
      {/* Render Disguise Layer */}
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
      {mode === 'disguise' && (
        <>
          {disguiseType === 'pyq' ? (
            <PYQView onUnlock={handleUnlockTrigger} />
          ) : (
            <CalculatorView onUnlock={handleUnlockTrigger} />
          )}
        </>
      )}

<<<<<<< HEAD
      {/* Login Overlay */}
=======
      {/* Render Login Overlay */}
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
      <LoginOverlay 
        isOpen={showLogin} 
        onSuccess={handleLoginSuccess} 
        onClose={() => setShowLogin(false)}
      />

<<<<<<< HEAD
      {/* Chat Layer */}
      {mode === 'chat' && (
        <>
          <ChatLayout 
            onLock={handlePanicLock} 
            currentUser={currentUser}
          />
          
          {/* Admin Panel Button - Fixed at top right, below header on mobile */}
          {currentUser === 'admin' && (
            <button 
              onClick={() => setShowAdminPanel(true)}
              className="fixed top-[60px] sm:top-4 right-2 sm:right-4 p-2 sm:p-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg z-40 transition-all flex items-center gap-1.5 text-xs sm:text-sm font-medium"
            >
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Admin</span>
            </button>
          )}
          
          {/* Admin Panel */}
=======
      {/* Render Chat Layer */}
      {mode === 'chat' && (
        <>
          <ChatLayout 
             onLock={handlePanicLock} 
             currentUser={currentUser} 
          />
          
          {/* Admin Trigger Button (Hidden/Visible for Admin Only) */}
          {currentUser === 'admin' && (
            <button 
              onClick={() => setShowAdminPanel(true)}
              className="fixed bottom-4 right-4 w-8 h-8 rounded-full bg-transparent z-50 opacity-0 hover:opacity-100 transition-opacity"
              title="Admin Panel"
            />
          )}
          
          {/* Admin Panel - Only render for admin users */}
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
          {currentUser === 'admin' && (
            <AdminPanel 
              isOpen={showAdminPanel} 
              onClose={() => setShowAdminPanel(false)} 
            />
          )}
        </>
      )}
      
      <Toaster />
    </div>
  );
}
