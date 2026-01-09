const app = require("./app");
const dotenv = require("dotenv");
const http = require("http");
const { initChatWebSocket } = require("../src/websocket/chat.ws");

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

// KHỞI ĐỘNG WEBSOCKET CHAT
initChatWebSocket(server);
server.listen(PORT, () => {
    console.log("DB_USER:", process.env.DB_USER);
    console.log("DB_PASSWORD:", process.env.DB_PASSWORD ? "có" : "không có");
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
