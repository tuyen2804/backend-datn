// src/websocket/chat.ws.js
const WebSocket = require("ws");
const db = require("../config/db");

const clients = new Map(); // userId → ws

const initChatWebSocket = (server) => {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/chat"
  });

  console.log("WebSocket Chat đã sẵn sàng tại /ws/chat");

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true });

    ws.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // JOIN: khi user login app
        if (msg.type === "join" && msg.userId) {
          const userId = Number(msg.userId);
          clients.set(userId, ws);
          ws.userId = userId;
          console.log(`User ${userId} online (chat)`);
          return;
        }

        // LOAD_MESSAGES: lấy các tin nhắn đã có
        if (msg.type === "load_messages" && ws.userId) {
          const currentUserId = ws.userId;
          const otherUserId = Number(msg.other_user_id);
          const limit = parseInt(msg.limit) || 50; // Mặc định 50 tin nhắn
          const offset = parseInt(msg.offset) || 0;

          if (!otherUserId || isNaN(otherUserId)) {
            ws.send(JSON.stringify({
              type: "error",
              message: "other_user_id is required"
            }));
            return;
          }

          try {
            // Lấy tin nhắn giữa 2 user (cả 2 chiều)
            // Sắp xếp theo id (auto-increment = thứ tự thời gian) hoặc created_at nếu có
            // Đảm bảo limit và offset là số nguyên dương (an toàn vì đã validate)
            const safeLimit = Math.max(1, Math.min(parseInt(limit) || 50, 100)); // Tối đa 100
            const safeOffset = Math.max(0, parseInt(offset) || 0);
            
            const [messages] = await db.execute(
              `SELECT id, from_account_id, to_account_id, content, created_at
               FROM messages
               WHERE (from_account_id = ? AND to_account_id = ?)
                  OR (from_account_id = ? AND to_account_id = ?)
               ORDER BY id ASC
               LIMIT ${safeLimit} OFFSET ${safeOffset}`,
              [currentUserId, otherUserId, otherUserId, currentUserId]
            );

            // Chuyển đổi timestamp về ISO string
            const formattedMessages = messages.map(msg => ({
              id: msg.id,
              from_account_id: msg.from_account_id,
              to_account_id: msg.to_account_id,
              message: msg.content,
              timestamp: msg.created_at
                ? new Date(msg.created_at).toISOString()
                : new Date().toISOString()
            }));

            ws.send(JSON.stringify({
              type: "load_messages",
              other_user_id: otherUserId,
              messages: formattedMessages,
              limit: safeLimit,
              offset: safeOffset
            }));
          } catch (err) {
            console.error("Lỗi load messages:", err);
            ws.send(JSON.stringify({
              type: "error",
              message: "Failed to load messages"
            }));
          }
          return;
        }

        // CHAT: gửi tin nhắn
        if (msg.type === "chat" && ws.userId) {
          const fromUserId = ws.userId;
          const toUserId = Number(msg.to_account_id);
          const messageText = (msg.content || "").trim();

          if (!toUserId || !messageText || messageText.length > 5000) return;

          // Lưu vào DB
          await db.execute(
            `INSERT INTO messages (from_account_id, to_account_id, content) VALUES (?, ?, ?)`,
            [fromUserId, toUserId, messageText]
          );

          const payload = {
            type: "chat",
            from_account_id: fromUserId,
            to_account_id: toUserId,
            content: messageText,
            timestamp: new Date().toISOString()
          };

          // Gửi cho người nhận nếu online
          const recipient = clients.get(toUserId);
          if (recipient?.readyState === WebSocket.OPEN) {
            recipient.send(JSON.stringify(payload));
          }

          // Gửi lại cho người gửi (optimistic UI)
          ws.send(JSON.stringify(payload));
        }
      } catch (err) {
        console.error("Lỗi WebSocket chat:", err.message);
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        clients.delete(ws.userId);
        console.log(`User ${ws.userId} offline`);
      }
    });
  });

  // Keep alive
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
};

module.exports = { initChatWebSocket };