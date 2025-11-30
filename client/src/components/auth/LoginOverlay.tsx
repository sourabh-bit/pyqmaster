import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowRight, X, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginOverlayProps {
  isOpen: boolean;
  onSuccess: (userType: 'admin' | 'friend') => void;
  onClose: () => void;
}

export function LoginOverlay({ isOpen, onSuccess, onClose }: LoginOverlayProps) {
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [step, setStep] = useState<'password' | 'pin'>('password');
  const [detectedUser, setDetectedUser] = useState<'admin' | 'friend' | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setPin("");
      setStep('password');
      setError(false);
      setDetectedUser(null);
    }
  }, [isOpen]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'password') {
      const gatekeeperKey = localStorage.getItem('gatekeeper_key') || 'secret';
      if (password === gatekeeperKey) {
        setStep('pin');
        setError(false);
      } else {
        shakeError();
      }
    } else {
      const adminPin = localStorage.getItem('admin_pass') || '1234';
      const friendPin = localStorage.getItem('friend_pass') || '5678';

      if (pin === adminPin) {
        onSuccess('admin');
      } else if (pin === friendPin) {
        onSuccess('friend');
      } else {
        shakeError();
      }
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    
    const adminPin = localStorage.getItem('admin_pass') || '1234';
    const friendPin = localStorage.getItem('friend_pass') || '5678';
    
    if (value.length >= 2) {
      if (adminPin.startsWith(value)) {
        setDetectedUser('admin');
      } else if (friendPin.startsWith(value)) {
        setDetectedUser('friend');
      } else {
        setDetectedUser(null);
      }
    } else {
      setDetectedUser(null);
    }
  };

  const shakeError = () => {
    setError(true);
    setTimeout(() => setError(false), 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-md bg-[#111] text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2 text-white/70">
            <Lock size={16} />
            <span className="text-sm font-medium tracking-widest uppercase">Secure Access</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 py-12">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-mono text-white/40 uppercase tracking-widest ml-1">
                {step === 'password' ? 'Gatekeeper Key' : 'Personal ID PIN'}
              </label>
              <div className={cn("relative transition-transform", error && "animate-shake")}>
                <input
                  type={step === 'password' ? "password" : "tel"}
                  autoFocus
                  value={step === 'password' ? password : pin}
                  onChange={(e) => step === 'password' ? setPassword(e.target.value) : handlePinChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-4 text-xl tracking-widest placeholder:text-white/10 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all font-mono text-center"
                  placeholder={step === 'password' ? "••••••••" : "••••"}
                  maxLength={step === 'pin' ? 6 : undefined}
                />
              </div>
              
              {/* User Type Indicator */}
              {step === 'pin' && (
                <div className="flex justify-center mt-4">
                  <div className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                    detectedUser === 'admin' 
                      ? "bg-red-500/20 text-red-400 border border-red-500/30" 
                      : detectedUser === 'friend'
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-white/5 text-white/30 border border-white/10"
                  )}>
                    {detectedUser === 'admin' ? (
                      <>
                        <Shield size={16} />
                        <span>Admin Access</span>
                      </>
                    ) : detectedUser === 'friend' ? (
                      <>
                        <User size={16} />
                        <span>Friend Access</span>
                      </>
                    ) : (
                      <>
                        <Lock size={16} />
                        <span>Enter PIN</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              type="submit"
              className={cn(
                "w-full font-medium py-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
                detectedUser === 'admin' 
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : detectedUser === 'friend'
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-white text-black hover:bg-white/90"
              )}
            >
              {step === 'password' ? 'Verify Identity' : detectedUser ? `Login as ${detectedUser === 'admin' ? 'Admin' : 'Friend'}` : 'Decrypt Session'} 
              <ArrowRight size={18} />
            </button>
          </form>
          
          {/* Hint */}
          {step === 'pin' && (
            <p className="text-center text-xs text-white/30 mt-4">
              Default: Admin = 1234, Friend = 5678
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/5 text-center">
          <p className="text-[10px] text-white/20 font-mono uppercase tracking-widest">
            End-to-End Encryption • Zero Knowledge
          </p>
        </div>
      </motion.div>
    </div>
  );
}
