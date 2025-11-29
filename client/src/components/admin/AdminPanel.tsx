<<<<<<< HEAD
import { useState, useEffect } from "react";
import { Shield, Trash2, Clock, Key, Save, AlertTriangle, Users, Activity, MessageSquare, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
=======
import { useState } from "react";
import { Shield, Trash2, Clock, Key, X, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
<<<<<<< HEAD
  onNuke?: () => void;
}

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  timestamp: string;
  type: string;
}

export function AdminPanel({ isOpen, onClose, onNuke }: AdminPanelProps) {
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'settings' | 'data' | 'logs'>('settings');
  const [gatekeeperKey, setGatekeeperKey] = useState(localStorage.getItem('gatekeeper_key') || 'secret');
  const [adminPass, setAdminPass] = useState(localStorage.getItem('admin_pass') || '1234');
  const [friendPass, setFriendPass] = useState(localStorage.getItem('friend_pass') || '5678');
  const [expiry, setExpiry] = useState(localStorage.getItem('message_expiry') || '24h');
  const [showNukeConfirm, setShowNukeConfirm] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionLogs, setConnectionLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setMessages(JSON.parse(localStorage.getItem('chat_messages') || '[]'));
      setConnectionLogs(JSON.parse(localStorage.getItem('connection_logs') || '[]'));
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('gatekeeper_key', gatekeeperKey);
    localStorage.setItem('admin_pass', adminPass);
    localStorage.setItem('friend_pass', friendPass);
    localStorage.setItem('message_expiry', expiry);
    toast({ title: "Settings Saved" });
  };

  const handleNuke = () => {
=======
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
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
    const channel = new BroadcastChannel('secure_chat_messages');
    channel.postMessage({ type: 'nuke' });
    channel.close();
    
<<<<<<< HEAD
    localStorage.removeItem('chat_messages');
    localStorage.setItem('connection_logs', '[]');
    setMessages([]);
    setConnectionLogs([]);
    setShowNukeConfirm(false);
    toast({ variant: "destructive", title: "All data wiped!" });
    onNuke?.();
    onClose();
  };

  const stats = {
    total: messages.length,
    text: messages.filter(m => m.type === 'text').length,
    media: messages.filter(m => m.type === 'image' || m.type === 'video').length,
    voice: messages.filter(m => m.type === 'audio').length
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-2xl bg-zinc-950 text-zinc-100 border-zinc-800 max-h-[85vh] overflow-hidden flex flex-col p-3 sm:p-6">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-red-500/10 rounded-full text-red-500">
              <Shield size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-xl">Admin Panel</DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-zinc-400">
                Security & Data Management
=======
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
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

<<<<<<< HEAD
        {/* Tabs */}
        <div className="flex gap-1 sm:gap-2 border-b border-zinc-800 pb-2 overflow-x-auto">
          {[
            { id: 'settings', label: 'Settings', icon: Key },
            { id: 'data', label: 'Data', icon: MessageSquare },
            { id: 'logs', label: 'Logs', icon: Activity }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap",
                activeTab === tab.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              <tab.icon size={14} className="sm:w-4 sm:h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-3 sm:py-4 space-y-4 sm:space-y-6">
          
          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <>
              <div className="space-y-3 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h3 className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Key size={14} /> Shared Secret Key
                </h3>
                <input 
                  type="text" 
                  value={gatekeeperKey}
                  onChange={(e) => setGatekeeperKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono focus:border-yellow-500 outline-none"
                />
              </div>

              <div className="space-y-3 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h3 className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Users size={14} /> User PINs
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs text-zinc-500">Admin</label>
                    <input 
                      type="text" 
                      value={adminPass}
                      onChange={(e) => setAdminPass(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 sm:px-3 py-2 text-sm font-mono focus:border-red-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] sm:text-xs text-zinc-500">Friend</label>
                    <input 
                      type="text" 
                      value={friendPass}
                      onChange={(e) => setFriendPass(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 sm:px-3 py-2 text-sm font-mono focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h3 className="text-xs sm:text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <Clock size={14} /> Message Retention
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {['view', '1h', '24h'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setExpiry(opt)}
                      className={cn(
                        "px-2 sm:px-3 py-2 rounded text-xs sm:text-sm border",
                        expiry === opt ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-950 text-zinc-400 border-zinc-800"
                      )}
                    >
                      {opt === 'view' ? 'View' : opt}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={handleSave} className="w-full py-2.5 sm:py-3 bg-white text-black rounded-lg font-medium text-sm flex items-center justify-center gap-2">
                <Save size={16} /> Save
              </button>
            </>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total', value: stats.total, color: 'text-white' },
                  { label: 'Text', value: stats.text, color: 'text-blue-400' },
                  { label: 'Media', value: stats.media, color: 'text-green-400' },
                  { label: 'Voice', value: stats.voice, color: 'text-purple-400' }
                ].map(stat => (
                  <div key={stat.label} className="p-2 sm:p-3 bg-zinc-900/50 rounded-lg border border-zinc-800 text-center">
                    <div className={cn("text-lg sm:text-2xl font-bold", stat.color)}>{stat.value}</div>
                    <div className="text-[10px] sm:text-xs text-zinc-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <h3 className="text-xs font-medium text-zinc-300">Recent Messages</h3>
                <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1.5">
                  {messages.length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">No messages</p>
                  ) : (
                    messages.slice(-15).reverse().map((msg, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] sm:text-xs p-1.5 bg-zinc-800/30 rounded">
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-medium flex-shrink-0",
                          msg.sender === 'me' ? "bg-red-500/20 text-red-400" : "bg-blue-500/20 text-blue-400"
                        )}>
                          {msg.sender === 'me' ? 'Me' : 'Them'}
                        </span>
                        <span className="truncate text-zinc-300 flex-1">{msg.text || `[${msg.type}]`}</span>
                        <span className="text-zinc-600 flex-shrink-0">
                          {format(new Date(msg.timestamp), 'h:mm a')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-2 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-300">Connection Logs</h3>
                <button 
                  onClick={() => { localStorage.setItem('connection_logs', '[]'); setConnectionLogs([]); }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Clear
                </button>
              </div>
              <div className="max-h-52 sm:max-h-64 overflow-y-auto space-y-1">
                {connectionLogs.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic">No logs</p>
                ) : (
                  connectionLogs.slice(-30).reverse().map((log, i) => (
                    <div key={i} className="text-[10px] sm:text-xs flex items-center gap-2 text-zinc-500 p-1">
                      <span className="font-mono text-zinc-600">{format(new Date(log.timestamp), 'MMM d, h:mm a')}</span>
                      <span className={log.user === 'admin' ? 'text-red-400' : 'text-blue-400'}>[{log.user}]</span>
                      <span className="text-zinc-400">{log.event}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          <div className="pt-3 sm:pt-4 border-t border-zinc-800">
            {!showNukeConfirm ? (
              <button 
                onClick={() => setShowNukeConfirm(true)}
                className="w-full py-2.5 sm:py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg border border-red-500/20 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium"
              >
                <Trash2 size={16} /> Emergency Wipe
              </button>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 text-red-500 mb-3">
                  <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold">Delete all data?</p>
                    <p className="opacity-80">This cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowNukeConfirm(false)} className="flex-1 py-2 bg-zinc-800 text-white rounded text-xs sm:text-sm font-medium">
                    Cancel
                  </button>
                  <button onClick={handleNuke} className="flex-1 py-2 bg-red-600 text-white rounded text-xs sm:text-sm font-bold">
                    WIPE
=======
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
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
                  </button>
                </div>
              </div>
            )}
          </div>
<<<<<<< HEAD
=======

        </div>

        <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-white text-black rounded font-medium hover:bg-zinc-200 transition-colors flex items-center gap-2">
            <Save size={16} /> Save Changes
          </button>
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
        </div>
      </DialogContent>
    </Dialog>
  );
}
<<<<<<< HEAD
=======

// Helper function for class names if not already imported
function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}
>>>>>>> 9cb4134f265eef55780dc90b3f570550bf0e2451
