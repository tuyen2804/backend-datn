const express = require("express");
const router = express.Router();
const monthlyBudgetController = require("../controllers/monthly_budget.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Thiết lập ngân sách
router.post("/", verifyToken, monthlyBudgetController.setBudget);

// Lấy danh sách ngân sách của user
router.get("/", verifyToken, monthlyBudgetController.getBudgets);

// Lấy ngân sách cụ thể
router.get("/:month/:year", verifyToken, monthlyBudgetController.getBudget);

// Cập nhật ngân sách
router.put("/:month/:year", verifyToken, monthlyBudgetController.updateBudget);

// Xóa ngân sách
router.delete("/:month/:year", verifyToken, monthlyBudgetController.deleteBudget);

// Lấy thống kê ngân sách tháng hiện tại
router.get("/summary/current", verifyToken, monthlyBudgetController.getCurrentBudgetSummary);

// Lấy thống kê ngân sách vs chi tiêu
router.get("/summary/:month/:year", verifyToken, monthlyBudgetController.getBudgetVsSpending);

// Lấy cảnh báo ngân sách
router.get("/alerts", verifyToken, monthlyBudgetController.getBudgetAlerts);

module.exports = router;
