const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { database } = require("./database");
const { startSNMPCollector } = require("./snmpCollector");
const logger = require("./logger");

// Import routes
const deviceRoutes = require("./routes/devices");
const dataRoutes = require("./routes/data");
const healthRoutes = require("./routes/health");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:2002", "http://127.0.0.1:2002"],
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Routes
app.use("/api/devices", deviceRoutes);
app.use("/api", dataRoutes);
app.use("/api/health", healthRoutes);

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({
    message: "Backend is running!",
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await database.connect();
    logger.info("Database initialized successfully");

    // Start SNMP collector
    startSNMPCollector();
    logger.info("SNMP collector started");

    // Start server
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:3000`);
      logger.info(`🔧 API: http://localhost:${PORT}/api`);
      logger.info(`❤️  Health: http://localhost:${PORT}/api/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  logger.info("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

startServer();
