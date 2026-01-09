const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Lấy thông tin profile
router.get("/profile", verifyToken, userController.getProfile);

// Cập nhật profile
router.put("/profile", verifyToken, userController.updateProfile);

// Tìm kiếm users
router.get("/search", verifyToken, userController.searchUsers);

module.exports = router;
