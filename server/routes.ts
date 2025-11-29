import type { Express } from "express";
import { type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";

interface ClientData {
  ws: WebSocket;
  profile?: { name: string; avatar: string };
}

interface RoomData {
  clients: Map<WebSocket, ClientData>;
  createdAt: Date;
}

const rooms = new Map<string, RoomData>();

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // WebSocket signaling server
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoom: string | null = null;
    let myProfile: { name: string; avatar: string } | undefined;

    ws.on("message", (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        const { type, roomId } = data;

        if (type === "join") {
          currentRoom = roomId;
          myProfile = data.profile;
          
          // Create room if doesn't exist
          if (!rooms.has(roomId)) {
            rooms.set(roomId, {
              clients: new Map(),
              createdAt: new Date()
            });
          }
          
          const room = rooms.get(roomId)!;
          room.clients.set(ws, { ws, profile: myProfile });
          
          const roomSize = room.clients.size;
          
          // Get peer profile if exists
          let peerProfile: { name: string; avatar: string } | undefined;
          room.clients.forEach((client, clientWs) => {
            if (clientWs !== ws && client.profile) {
              peerProfile = client.profile;
            }
          });
          
          // Send joined confirmation with peer info
          ws.send(JSON.stringify({ 
            type: "joined", 
            roomId, 
            isInitiator: roomSize === 1,
            peerCount: roomSize,
            peerProfile: peerProfile
          }));
          
          // Notify existing members with new user's profile
          if (roomSize >= 2) {
            room.clients.forEach((client, clientWs) => {
              if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ 
                  type: "peer-joined", 
                  roomId,
                  profile: myProfile 
                }));
              }
            });
          }
        } else if (currentRoom && rooms.has(currentRoom)) {
          // Relay all other messages to peers in the room
          const room = rooms.get(currentRoom)!;
          room.clients.forEach((client, clientWs) => {
            if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify(data));
            }
          });
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const room = rooms.get(currentRoom)!;
        room.clients.delete(ws);
        
        // Notify remaining peers
        room.clients.forEach((client, clientWs) => {
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "peer-left", roomId: currentRoom }));
          }
        });
        
        // Clean up empty rooms
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
