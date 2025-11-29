import { useState, useRef } from "react";
import { Camera, User, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentAvatar: string;
  onSave: (name: string, avatar: string) => void;
}

export function ProfileEditor({ isOpen, onClose, currentName, currentAvatar, onSave }: ProfileEditorProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [avatar, setAvatar] = useState(currentAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Image too large (max 2MB)" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatar(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Name required" });
      return;
    }
    onSave(name.trim(), avatar);
    toast({ title: "Profile updated!" });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[90vw] max-w-md bg-zinc-950 text-zinc-100 border-zinc-800 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl flex items-center gap-2">
            <User size={18} /> Edit Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-3 sm:py-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-zinc-800">
                <AvatarImage src={avatar} />
                <AvatarFallback className="text-xl sm:text-2xl bg-zinc-800">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 sm:p-2 bg-primary rounded-full hover:bg-primary/90"
              >
                <Camera size={14} className="sm:w-4 sm:h-4 text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <p className="text-xs text-zinc-500">Tap camera to change photo</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white focus:border-primary outline-none text-sm sm:text-base"
              placeholder="Enter your name"
            />
            <p className="text-xs text-zinc-500">{name.length}/20</p>
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-zinc-800">
          <Button variant="ghost" onClick={onClose} className="flex-1 h-10 sm:h-11 text-sm">
            <X size={16} className="mr-1.5" /> Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 h-10 sm:h-11 text-sm">
            <Save size={16} className="mr-1.5" /> Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
