const express = require("express");
const router = express.Router();
const fcmTokenController = require("../controllers/fcm_token.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Đăng ký FCM token
router.post("/register-token", verifyToken, fcmTokenController.registerToken);

// Hủy kích hoạt FCM token
router.post("/deactivate-token", verifyToken, fcmTokenController.deactivateToken);

module.exports = router;
