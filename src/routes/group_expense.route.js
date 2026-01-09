const express = require("express");
const router = express.Router();
const groupExpenseController = require("../controllers/group_expense.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Tạo chi phí nhóm
router.post("/", verifyToken, groupExpenseController.createExpense);

// Lấy chi phí của nhóm
router.get("/group/:groupId", verifyToken, groupExpenseController.getGroupExpenses);

// Lấy chi phí của user (tất cả nhóm)
router.get("/user", verifyToken, groupExpenseController.getUserExpenses);

// Cập nhật chi phí
router.put("/:expenseId", verifyToken, groupExpenseController.updateExpense);

// Xóa chi phí
router.delete("/:expenseId", verifyToken, groupExpenseController.deleteExpense);

// Cập nhật cách chia chi phí
router.put("/:expenseId/shares", verifyToken, groupExpenseController.updateExpenseShares);

module.exports = router;
