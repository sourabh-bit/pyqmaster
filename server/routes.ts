import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import webpush from "web-push";
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ClientData {
  ws: WebSocket;
  profile?: { name: string; avatar: string };
  userType?: string;
  deviceId?: string;
}

interface RoomData {
  clients: Map<WebSocket, ClientData>;
  createdAt: Date;
}

interface PendingMessage {
  id: string;
  text: string;
  messageType: string;
  mediaUrl?: string;
  timestamp: string;
  senderName: string;
  targetUserType: string;
  status: 'sent' | 'delivered' | 'read';
}

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PasswordData {
  gatekeeper_key: string;
  admin_pass: string;
  friend_pass: string;
  admin_pass_hash?: string;
  friend_pass_hash?: string;
  admin_pass_changed_at?: string;
  friend_pass_changed_at?: string;
  gatekeeper_changed_at?: string;
  initialized: boolean;
}

const rooms = new Map<string, RoomData>();
const pendingMessages = new Map<string, PendingMessage[]>();
const messageStatus = new Map<string, 'sent' | 'delivered' | 'read'>();

const pushSubscriptions = new Map<string, PushSubscriptionData[]>();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLBz8nXqJ3H5VSJgNPaF1N7p0_VfQKZwzPvHRmqIKvE4EHlpjBqeGMx5PaJk9R7VxTkNh3n_WbE2OqK8yXlH8Aw';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'dGnKX_4nRqH5VSJgNPaF1N7p0_VfQKZwzPvHRmqIKvE';

webpush.setVapidDetails(
  'mailto:admin@securechat.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

const sendPushNotification = async (userType: string, title: string, body: string) => {
  const subscriptions = pushSubscriptions.get(userType) || [];
  const validSubscriptions: PushSubscriptionData[] = [];
  
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys
        },
        JSON.stringify({ title, body, tag: 'chat-message' })
      );
      validSubscriptions.push(subscription);
    } catch (error: any) {
      if (error.statusCode === 410 || error.statusCode === 404) {
        console.log('Removing invalid push subscription');
      } else {
        validSubscriptions.push(subscription);
        console.error('Push notification error:', error.message);
      }
    }
  }
  
  if (validSubscriptions.length > 0) {
    pushSubscriptions.set(userType, validSubscriptions);
  } else {
    pushSubscriptions.delete(userType);
  }
};

const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

const verifyPassword = (password: string, hash: string): boolean => {
  return hashPassword(password) === hash;
};

const DEFAULT_PASSWORDS: PasswordData = {
  gatekeeper_key: 'secret',
  admin_pass: 'admin123',
  friend_pass: 'friend123',
  initialized: false
};

let passwords: PasswordData = { ...DEFAULT_PASSWORDS };

const getPasswordFilePath = (): string => {
  const locations = [
    path.join(process.cwd(), 'data', '.passwords.json'),
    path.join(process.cwd(), '.passwords.json'),
    '/tmp/.passwords.json'
  ];
  
  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) {
        return loc;
      }
    } catch {}
  }
  
  try {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return path.join(dataDir, '.passwords.json');
  } catch {
    return path.join(process.cwd(), '.passwords.json');
  }
};

let PASSWORD_FILE = getPasswordFilePath();

const loadPasswords = () => {
  try {
    const locations = [
      path.join(process.cwd(), 'data', '.passwords.json'),
      path.join(process.cwd(), '.passwords.json'),
      '/tmp/.passwords.json'
    ];
    
    for (const loc of locations) {
      try {
        if (fs.existsSync(loc)) {
          const data = JSON.parse(fs.readFileSync(loc, 'utf-8')) as Partial<PasswordData>;
          
          if (data.initialized === true) {
            if (data.gatekeeper_key) passwords.gatekeeper_key = data.gatekeeper_key;
            if (data.admin_pass) passwords.admin_pass = data.admin_pass;
            if (data.friend_pass) passwords.friend_pass = data.friend_pass;
            if (data.admin_pass_hash) passwords.admin_pass_hash = data.admin_pass_hash;
            if (data.friend_pass_hash) passwords.friend_pass_hash = data.friend_pass_hash;
            if (data.admin_pass_changed_at) passwords.admin_pass_changed_at = data.admin_pass_changed_at;
            if (data.friend_pass_changed_at) passwords.friend_pass_changed_at = data.friend_pass_changed_at;
            if (data.gatekeeper_changed_at) passwords.gatekeeper_changed_at = data.gatekeeper_changed_at;
            passwords.initialized = true;
            PASSWORD_FILE = loc;
            console.log('✓ Passwords loaded from:', loc);
            console.log('  Admin password changed at:', passwords.admin_pass_changed_at || 'never');
            console.log('  Friend password changed at:', passwords.friend_pass_changed_at || 'never');
            return;
          }
        }
      } catch (e) {
        console.error('Error reading password file at', loc, ':', e);
      }
    }
    
    console.log('No saved passwords found, using defaults (first-time setup)');
    passwords = { ...DEFAULT_PASSWORDS };
  } catch (err) {
    console.error('Failed to load passwords:', err);
    passwords = { ...DEFAULT_PASSWORDS };
  }
};

const savePasswords = (): boolean => {
  try {
    const dir = path.dirname(PASSWORD_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    passwords.initialized = true;
    
    const dataToSave = {
      gatekeeper_key: passwords.gatekeeper_key,
      admin_pass: passwords.admin_pass,
      friend_pass: passwords.friend_pass,
      admin_pass_hash: passwords.admin_pass_hash,
      friend_pass_hash: passwords.friend_pass_hash,
      admin_pass_changed_at: passwords.admin_pass_changed_at,
      friend_pass_changed_at: passwords.friend_pass_changed_at,
      gatekeeper_changed_at: passwords.gatekeeper_changed_at,
      initialized: true,
      last_saved: new Date().toISOString()
    };
    
    fs.writeFileSync(PASSWORD_FILE, JSON.stringify(dataToSave, null, 2));
    console.log('✓ Passwords saved to:', PASSWORD_FILE);
    return true;
  } catch (err) {
    console.error('Failed to save passwords to', PASSWORD_FILE, ':', err);
    
    const fallbacks = ['/tmp/.passwords.json', path.join(process.cwd(), '.passwords.json')];
    for (const fallback of fallbacks) {
      try {
        const dataToSave = {
          gatekeeper_key: passwords.gatekeeper_key,
          admin_pass: passwords.admin_pass,
          friend_pass: passwords.friend_pass,
          admin_pass_hash: passwords.admin_pass_hash,
          friend_pass_hash: passwords.friend_pass_hash,
          admin_pass_changed_at: passwords.admin_pass_changed_at,
          friend_pass_changed_at: passwords.friend_pass_changed_at,
          gatekeeper_changed_at: passwords.gatekeeper_changed_at,
          initialized: true,
          last_saved: new Date().toISOString()
        };
        fs.writeFileSync(fallback, JSON.stringify(dataToSave, null, 2));
        PASSWORD_FILE = fallback;
        console.log('✓ Passwords saved to fallback:', fallback);
        return true;
      } catch {}
    }
    return false;
  }
};

try {
  loadPasswords();
} catch (err) {
  console.error('Failed to load passwords on startup:', err);
}

const broadcastToUserType = (room: RoomData, userType: string, data: any, excludeWs?: WebSocket) => {
  room.clients.forEach((client, clientWs) => {
    if (client.userType === userType && clientWs.readyState === WebSocket.OPEN && clientWs !== excludeWs) {
      clientWs.send(JSON.stringify(data));
    }
  });
};

const broadcastToAll = (room: RoomData, data: any, excludeWs?: WebSocket) => {
  room.clients.forEach((client, clientWs) => {
    if (clientWs.readyState === WebSocket.OPEN && clientWs !== excludeWs) {
      clientWs.send(JSON.stringify(data));
    }
  });
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  app.get('/api/auth/passwords', (req, res) => {
    res.json({
      gatekeeper_key: passwords.gatekeeper_key,
      admin_pass: passwords.admin_pass,
      friend_pass: passwords.friend_pass,
      admin_pass_changed_at: passwords.admin_pass_changed_at || null,
      friend_pass_changed_at: passwords.friend_pass_changed_at || null,
      gatekeeper_changed_at: passwords.gatekeeper_changed_at || null
    });
  });
  
  app.post('/api/auth/passwords', (req, res) => {
    const { gatekeeper_key, admin_pass, friend_pass, current_password } = req.body;
    
    const isValidPassword = current_password === passwords.admin_pass || 
                            current_password === passwords.friend_pass;
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid current password' });
    }
    
    const now = new Date().toISOString();
    let changed = false;
    
    if (gatekeeper_key && gatekeeper_key !== passwords.gatekeeper_key) {
      passwords.gatekeeper_key = gatekeeper_key;
      passwords.gatekeeper_changed_at = now;
      changed = true;
    }
    
    if (admin_pass && admin_pass !== passwords.admin_pass) {
      passwords.admin_pass = admin_pass;
      passwords.admin_pass_hash = hashPassword(admin_pass);
      passwords.admin_pass_changed_at = now;
      changed = true;
    }
    
    if (friend_pass && friend_pass !== passwords.friend_pass) {
      passwords.friend_pass = friend_pass;
      passwords.friend_pass_hash = hashPassword(friend_pass);
      passwords.friend_pass_changed_at = now;
      changed = true;
    }
    
    if (changed) {
      const saved = savePasswords();
      if (!saved) {
        return res.status(500).json({ error: 'Failed to save passwords to disk' });
      }
    }
    
    res.json({ 
      success: true, 
      passwords: {
        gatekeeper_key: passwords.gatekeeper_key,
        admin_pass: passwords.admin_pass,
        friend_pass: passwords.friend_pass,
        admin_pass_changed_at: passwords.admin_pass_changed_at,
        friend_pass_changed_at: passwords.friend_pass_changed_at,
        gatekeeper_changed_at: passwords.gatekeeper_changed_at
      }
    });
  });

  app.get('/api/push/vapid-key', (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const { subscription, userType } = req.body;
    
    if (!subscription || !userType) {
      return res.status(400).json({ error: 'Missing subscription or userType' });
    }
    
    if (userType !== 'admin') {
      return res.status(403).json({ error: 'Push notifications only available for admin' });
    }
    
    const existing = pushSubscriptions.get('admin') || [];
    
    const isDuplicate = existing.some(s => s.endpoint === subscription.endpoint);
    if (!isDuplicate) {
      existing.push({
        endpoint: subscription.endpoint,
        keys: subscription.keys
      });
      pushSubscriptions.set('admin', existing);
    }
    
    res.json({ success: true });
  });

  app.post('/api/push/unsubscribe', (req, res) => {
    const { endpoint, userType } = req.body;
    
    if (!endpoint || !userType) {
      return res.status(400).json({ error: 'Missing endpoint or userType' });
    }
    
    const existing = pushSubscriptions.get(userType) || [];
    const filtered = existing.filter(s => s.endpoint !== endpoint);
    
    if (filtered.length > 0) {
      pushSubscriptions.set(userType, filtered);
    } else {
      pushSubscriptions.delete(userType);
    }
    
    res.json({ success: true });
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoom: string | null = null;
    let myProfile: { name: string; avatar: string } | undefined;
    let myUserType: string | undefined;
    let myDeviceId: string | undefined;

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        const { type, roomId } = data;

        if (type === "join") {
          currentRoom = roomId;
          myProfile = data.profile;
          myUserType = data.userType;
          myDeviceId = data.deviceId || Date.now().toString();
          
          if (!rooms.has(roomId)) {
            rooms.set(roomId, {
              clients: new Map(),
              createdAt: new Date()
            });
          }
          
          const room = rooms.get(roomId)!;
          room.clients.set(ws, { ws, profile: myProfile, userType: myUserType, deviceId: myDeviceId });
          
          const peerUserType = myUserType === 'admin' ? 'friend' : 'admin';
          
          let peerProfile: { name: string; avatar: string } | undefined;
          let peerOnline = false;
          room.clients.forEach((client, clientWs) => {
            if (client.userType === peerUserType && clientWs.readyState === WebSocket.OPEN) {
              peerOnline = true;
              if (client.profile) {
                peerProfile = client.profile;
              }
            }
          });
          
          const onlineUserTypes = new Set<string>();
          room.clients.forEach((client) => {
            if (client.userType) onlineUserTypes.add(client.userType);
          });
          
          ws.send(JSON.stringify({ 
            type: "joined", 
            roomId, 
            isInitiator: onlineUserTypes.size === 1,
            peerCount: room.clients.size,
            peerProfile: peerProfile,
            peerOnline: peerOnline
          }));
          
          room.clients.forEach((client, clientWs) => {
            if (client.userType === myUserType && clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ 
                type: "sync-request",
                targetDeviceId: myDeviceId
              }));
            }
          });
          
          const roomPendingKey = `${roomId}_${myUserType}`;
          const pending = pendingMessages.get(roomPendingKey);
          if (pending && pending.length > 0) {
            const messageIds: string[] = [];
            pending.forEach(msg => {
              ws.send(JSON.stringify({
                type: "chat-message",
                id: msg.id,
                text: msg.text,
                messageType: msg.messageType,
                mediaUrl: msg.mediaUrl,
                timestamp: msg.timestamp,
                senderName: msg.senderName,
                status: 'delivered'
              }));
              messageIds.push(msg.id);
            });
            pendingMessages.delete(roomPendingKey);
            
            const senderType = myUserType === 'admin' ? 'friend' : 'admin';
            broadcastToUserType(room, senderType, {
              type: 'message-status',
              ids: messageIds,
              status: 'delivered'
            });
          }
          
          let isFirstDeviceOfType = true;
          room.clients.forEach((client, clientWs) => {
            if (client.userType === myUserType && clientWs !== ws) {
              isFirstDeviceOfType = false;
            }
          });
          
          if (isFirstDeviceOfType) {
            room.clients.forEach((client, clientWs) => {
              if (client.userType !== myUserType && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ 
                  type: "peer-joined", 
                  roomId,
                  profile: myProfile 
                }));
              }
            });
          }

        } else if (type === "chat-message" && currentRoom) {
          const room = rooms.get(currentRoom);
          if (!room) return;
          
          let peerOnline = false;
          const targetUserType = myUserType === 'admin' ? 'friend' : 'admin';
          
          room.clients.forEach((client, clientWs) => {
            if (client.userType === targetUserType && clientWs.readyState === WebSocket.OPEN) {
              peerOnline = true;
              clientWs.send(JSON.stringify({ ...data, status: 'delivered' }));
            }
          });
          
          room.clients.forEach((client, clientWs) => {
            if (client.userType === myUserType && clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ ...data, sender: 'me', status: peerOnline ? 'delivered' : 'sent' }));
            }
          });
          
          if (peerOnline) {
            ws.send(JSON.stringify({
              type: 'message-status',
              ids: [data.id],
              status: 'delivered'
            }));
          } else {
            const roomPendingKey = `${currentRoom}_${targetUserType}`;
            if (!pendingMessages.has(roomPendingKey)) {
              pendingMessages.set(roomPendingKey, []);
            }
            
            pendingMessages.get(roomPendingKey)!.push({
              id: data.id,
              text: data.text,
              messageType: data.messageType || 'text',
              mediaUrl: data.mediaUrl,
              timestamp: data.timestamp,
              senderName: data.senderName,
              targetUserType,
              status: 'sent'
            });
            
            if (targetUserType === 'admin') {
              const msgPreview = data.messageType === 'text' 
                ? (data.text?.length > 50 ? data.text.substring(0, 50) + '...' : data.text)
                : data.messageType === 'image' ? '📷 Photo'
                : data.messageType === 'video' ? '🎥 Video'
                : data.messageType === 'audio' ? '🎤 Voice message'
                : 'New message';
              sendPushNotification('admin', `💬 ${data.senderName || 'Friend'}`, msgPreview);
            }
            
            ws.send(JSON.stringify({
              type: "message-queued",
              id: data.id,
              status: 'sent'
            }));
          }

        } else if (type === "message-read" && currentRoom) {
          const room = rooms.get(currentRoom);
          if (!room) return;
          
          const senderType = myUserType === 'admin' ? 'friend' : 'admin';
          broadcastToUserType(room, senderType, {
            type: 'message-status',
            ids: data.ids,
            status: 'read'
          });

        } else if (type === "sync-response" && currentRoom) {
          const room = rooms.get(currentRoom);
          if (!room) return;
          
          room.clients.forEach((client, clientWs) => {
            if (client.deviceId === data.targetDeviceId && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({
                type: "sync-messages",
                messages: data.messages
              }));
            }
          });

        } else if (type === "emergency-wipe" && currentRoom) {
          const room = rooms.get(currentRoom);
          if (!room) return;
          
          pendingMessages.delete(`${currentRoom}_admin`);
          pendingMessages.delete(`${currentRoom}_friend`);
          
          broadcastToAll(room, { type: 'emergency-wipe' });

        } else if (currentRoom && rooms.has(currentRoom)) {
          const room = rooms.get(currentRoom)!;
          const targetUserType = myUserType === 'admin' ? 'friend' : 'admin';
          
          if (type === "typing" || type === "profile-update") {
            broadcastToUserType(room, targetUserType, data);
          } else {
            broadcastToAll(room, data, ws);
          }
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const room = rooms.get(currentRoom)!;
        room.clients.delete(ws);
        
        let sameUserTypeStillOnline = false;
        room.clients.forEach((client) => {
          if (client.userType === myUserType) {
            sameUserTypeStillOnline = true;
          }
        });
        
        if (!sameUserTypeStillOnline) {
          room.clients.forEach((client, clientWs) => {
            if (client.userType !== myUserType && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "peer-left", roomId: currentRoom }));
            }
          });
        }
        
        if (room.clients.size === 0) {
          setTimeout(() => {
            const r = rooms.get(currentRoom!);
            if (r && r.clients.size === 0) {
              rooms.delete(currentRoom!);
            }
          }, 60000);
        }
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  return httpServer;
}
