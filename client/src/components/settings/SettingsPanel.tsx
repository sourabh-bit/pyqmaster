import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, Lock, Eye, EyeOff, Save, Check, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'admin' | 'friend';
}

export function SettingsPanel({ isOpen, onClose, userType }: SettingsPanelProps) {
  const { toast } = useToast();
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newSecretKey, setNewSecretKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleResetApp = () => {
    localStorage.clear();
    toast({ title: "App reset! Refreshing...", variant: "destructive" });
    setTimeout(() => window.location.reload(), 1000);
  };

  const handleSave = async () => {
    if (!currentPassword) {
      toast({ variant: "destructive", title: "Current password is required" });
      return;
    }

    const hasPasswordChange = newPassword.length > 0;
    const hasKeyChange = newSecretKey.length > 0;

    if (!hasPasswordChange && !hasKeyChange) {
      toast({ variant: "destructive", title: "Enter a new password or secret key to change" });
      return;
    }

    if (hasPasswordChange && newPassword.length < 4) {
      toast({ variant: "destructive", title: "New password must be at least 4 characters" });
      return;
    }

    if (hasKeyChange && newSecretKey.length < 4) {
      toast({ variant: "destructive", title: "New secret key must be at least 4 characters" });
      return;
    }

    setLoading(true);
    let success = true;

    try {
      if (hasPasswordChange) {
        const response = await fetch('/api/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userType,
            currentPassword,
            newPassword
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          toast({ variant: "destructive", title: result.error || "Failed to change password" });
          success = false;
        }
      }

      if (success && hasKeyChange) {
        const response = await fetch('/api/auth/gatekeeper/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword,
            newKey: newSecretKey
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          toast({ variant: "destructive", title: result.error || "Failed to change secret key" });
          success = false;
        }
      }

      if (success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        toast({ title: "Settings saved! Use new credentials to login." });
        setCurrentPassword('');
        setNewPassword('');
        setNewSecretKey('');
      }
    } catch {
      toast({ variant: "destructive", title: "Failed to save settings" });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <Key size={18} className="text-primary" />
              <span className="font-semibold">Security Settings</span>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-secondary rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Current Password */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lock size={14} />
                Current Password (to confirm changes)
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter current password"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium">Change Credentials</span>
                <button
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showPasswords ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* New Secret Key */}
              <div className="space-y-2 mb-4">
                <label className="text-sm text-muted-foreground">
                  New Shared Secret Key
                </label>
                <input
                  type={showPasswords ? "text" : "password"}
                  value={newSecretKey}
                  onChange={(e) => setNewSecretKey(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter new secret key (leave empty to keep current)"
                />
                <p className="text-xs text-muted-foreground">
                  This key is shared between you and your partner
                </p>
              </div>

              {/* New Personal Password */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  New Password ({userType === 'admin' ? 'Admin' : 'Friend'})
                </label>
                <input
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Enter new password (leave empty to keep current)"
                />
                <p className="text-xs text-muted-foreground">
                  Only you use this password to login
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border bg-secondary/30 space-y-3">
            <button
              onClick={handleSave}
              disabled={!currentPassword || loading}
              className={cn(
                "w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
                saved 
                  ? "bg-green-500 text-white" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
                (!currentPassword || loading) && "opacity-50 cursor-not-allowed"
              )}
            >
              {saved ? (
                <>
                  <Check size={18} />
                  Saved!
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
            
            {/* Reset App Button */}
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center gap-2 transition-all"
              >
                <RotateCcw size={14} />
                Reset App Data
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-lg text-sm bg-secondary hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetApp}
                  className="flex-1 py-2.5 rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
