const express = require("express");
const router = express.Router();
const backupController = require("../controllers/backup.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Sao lưu dữ liệu chi tiêu cá nhân, nhóm và ngân sách theo tháng
// GET /api/backup/personal-spending?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get("/personal-spending", verifyToken, backupController.getPersonalSpendingBackup);

// Sao lưu dữ liệu chi tiêu cá nhân (các bảng personal_*)
// GET /api/backup/personal-finance
router.get("/personal-finance", verifyToken, backupController.getPersonalFinanceBackup);

// Phục hồi dữ liệu chi tiêu cá nhân
// POST /api/backup/personal-finance/restore
router.post("/personal-finance/restore", verifyToken, backupController.restorePersonalFinanceBackup);

module.exports = router;

