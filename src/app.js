const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const routes = require("./routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static('src/uploads'));

// API routes
app.use("/api", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

module.exports = app;
