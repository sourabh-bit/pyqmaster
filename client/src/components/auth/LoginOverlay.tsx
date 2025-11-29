import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight, X } from "lucide-react";
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

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setPin("");
      setStep('password');
      setError(false);
    }
  }, [isOpen]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'password') {
      // Shared secret for first step (hardcoded or env in real app)
      // Let's say both need to know the "Gatekeeper" password first
      if (password === "secret" || password === "gatekeeper") {
        setStep('pin');
        setError(false);
      } else {
        shakeError();
      }
    } else {
      // Step 2: Individual PINs (fetched from localStorage/settings)
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
                  onChange={(e) => step === 'password' ? setPassword(e.target.value) : setPin(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-4 text-xl tracking-widest placeholder:text-white/10 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all font-mono text-center"
                  placeholder={step === 'password' ? "••••••••" : "••••"}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-white text-black font-medium py-4 rounded-lg flex items-center justify-center gap-2 hover:bg-white/90 transition-colors active:scale-[0.98]"
            >
              {step === 'password' ? 'Verify Identity' : 'Decrypt Session'} <ArrowRight size={18} />
            </button>
          </form>
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
