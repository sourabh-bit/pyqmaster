# Message Status Revert Task

## Pending Tasks
- [ ] Update schema.ts: Replace status and isRead fields with delivered: boolean
- [x] Update server/routes.ts: Change WebSocket event from "mark-as-read" to "message-read"
- [ ] Update server/routes.ts: Update message sending logic to use delivered boolean
- [ ] Update server/routes.ts: Update message status handling and fetching
- [x] Update client/src/hooks/use-chat-connection.ts: Change WebSocket event to "message-read"
- [x] Update client/src/hooks/use-chat-connection.ts: Update message status logic for tick display
- [x] Update client/src/hooks/use-chat-connection.ts: Update message loading to use getMessageReadStatuses()
