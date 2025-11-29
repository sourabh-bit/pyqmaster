import { useState } from "react";
import { Shield, Trash2, Clock, Key, X, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminPanel({ isOpen, onClose }: AdminPanelProps) {
  const { toast } = useToast();
  
  // Mock State (In real app, fetch from backend)
  const [adminPass, setAdminPass] = useState(localStorage.getItem('admin_pass') || '1234');
  const [friendPass, setFriendPass] = useState(localStorage.getItem('friend_pass') || '5678');
  const [expiry, setExpiry] = useState(localStorage.getItem('message_expiry') || '24h');
  
  const [showNukeConfirm, setShowNukeConfirm] = useState(false);

  const handleSave = () => {
    localStorage.setItem('admin_pass', adminPass);
    localStorage.setItem('friend_pass', friendPass);
    localStorage.setItem('message_expiry', expiry);
    
    toast({
      title: "Settings Saved",
      description: "Security configuration updated successfully.",
    });
    onClose();
  };

  const handleNuke = () => {
    // Send nuke signal via broadcast channel to clear chats in all tabs
    const channel = new BroadcastChannel('secure_chat_messages');
    channel.postMessage({ type: 'nuke' });
    channel.close();
    
    setShowNukeConfirm(false);
    toast({
      variant: "destructive",
      title: "EMERGENCY WIPE EXECUTED",
      description: "All messages and media have been destroyed.",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-zinc-950 text-zinc-100 border-zinc-800">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-500/10 rounded-full text-red-500">
              <Shield size={24} />
            </div>
            <div>
              <DialogTitle className="text-xl">Admin Control Center</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Manage security, credentials, and emergency protocols.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          
          {/* Credentials Section */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Key size={16} /> Access Credentials
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Admin PIN</label>
                <input 
                  type="text" 
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono focus:border-red-500 outline-none transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Friend PIN</label>
                <input 
                  type="text" 
                  value={friendPass}
                  onChange={(e) => setFriendPass(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Expiry Section */}
          <div className="space-y-4 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Clock size={16} /> Message Retention
            </h3>
            
            <div className="grid grid-cols-3 gap-2">
              {['view', '1h', '24h'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setExpiry(opt)}
                  className={cn(
                    "px-3 py-2 rounded text-sm border transition-all",
                    expiry === opt 
                      ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-medium" 
                      : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600"
                  )}
                >
                  {opt === 'view' ? 'After View' : opt === '1h' ? '1 Hour' : '24 Hours'}
                </button>
              ))}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-4 border-t border-zinc-800">
            {!showNukeConfirm ? (
              <button 
                onClick={() => setShowNukeConfirm(true)}
                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Trash2 size={18} /> Emergency Wipe (Nuke)
              </button>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-start gap-3 text-red-500 mb-4">
                  <AlertTriangle size={20} className="mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold">Confirm Emergency Wipe?</p>
                    <p className="opacity-80 mt-1">This action is irreversible. All messages, media, and logs will be permanently deleted immediately.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowNukeConfirm(false)}
                    className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleNuke}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold transition-colors shadow-lg shadow-red-900/20"
                  >
                    CONFIRM WIPE
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-white text-black rounded font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function for class names if not already imported
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
