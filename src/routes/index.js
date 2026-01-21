const express = require("express");
const router = express.Router();

// Import route modules
const authRoutes = require("./auth.route");
const userRoutes = require("./user.route");
const debtRoutes = require("./debt.route");
const expenseGroupRoutes = require("./expense_group.route");
const groupExpenseRoutes = require("./group_expense.route");
const monthlyBudgetRoutes = require("./monthly_budget.route");
const fcmTokenRoutes = require("./fcm_token.route");
const backupRoutes = require("./backup.route");

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/debts", debtRoutes);
router.use("/groups", expenseGroupRoutes);
router.use("/expenses", groupExpenseRoutes);
router.use("/budgets", monthlyBudgetRoutes);
router.use("/fcm", fcmTokenRoutes);
router.use("/backup", backupRoutes);

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

module.exports = router;
