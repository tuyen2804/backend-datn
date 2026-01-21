const MonthlyBudget = require("../models/monthly_budget.model");

// Set or update budget
const setBudget = async (req, res) => {
  try {
    const { category_id, month, year, limit_amount } = req.body;
    const userId = req.user.id;

    if (!category_id || !month || !year || !limit_amount) {
      return res.status(400).json({
        success: false,
        message: "category_id, month, year, and limit_amount are required"
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12"
      });
    }

    if (year < 2020 || year > 2030) {
      return res.status(400).json({
        success: false,
        message: "Year must be between 2020 and 2030"
      });
    }

    if (isNaN(limit_amount) || parseFloat(limit_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Limit amount must be a positive number"
      });
    }

    await MonthlyBudget.setBudget({
      account_id: userId,
      category_id: parseInt(category_id),
      month: parseInt(month),
      year: parseInt(year),
      limit_amount: parseFloat(limit_amount)
    });

    res.json({
      success: true,
      message: "Budget set successfully"
    });
  } catch (err) {
    console.error("Error setting budget:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user's budgets
const getBudgets = async (req, res) => {
  try {
    const userId = req.user.id;
    const budgets = await MonthlyBudget.getByUserId(userId);

    res.json({ success: true, budgets });
  } catch (err) {
    console.error("Error getting budgets:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get specific budget
const getBudget = async (req, res) => {
  try {
    const { categoryId, month, year } = req.params;
    const userId = req.user.id;

    if (!categoryId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "Category, month and year are required"
      });
    }

    const budget = await MonthlyBudget.getBudget(userId, parseInt(categoryId), parseInt(month), parseInt(year));

    res.json({ success: true, budget });
  } catch (err) {
    console.error("Error getting budget:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update budget
const updateBudget = async (req, res) => {
  try {
    const { categoryId, month, year } = req.params;
    const { limit_amount } = req.body;
    const userId = req.user.id;

    if (!limit_amount) {
      return res.status(400).json({
        success: false,
        message: "Limit amount is required"
      });
    }

    if (isNaN(limit_amount) || parseFloat(limit_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Limit amount must be a positive number"
      });
    }

    await MonthlyBudget.updateBudget(
      userId,
      parseInt(categoryId),
      parseInt(month),
      parseInt(year),
      parseFloat(limit_amount)
    );

    res.json({ success: true, message: "Budget updated successfully" });
  } catch (err) {
    console.error("Error updating budget:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete budget
const deleteBudget = async (req, res) => {
  try {
    const { categoryId, month, year } = req.params;
    const userId = req.user.id;

    await MonthlyBudget.deleteBudget(userId, parseInt(categoryId), parseInt(month), parseInt(year));

    res.json({ success: true, message: "Budget deleted successfully" });
  } catch (err) {
    console.error("Error deleting budget:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get current month budget vs spending
const getCurrentBudgetSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const summary = await MonthlyBudget.getCurrentMonthSummary(userId);

    res.json({ success: true, summary });
  } catch (err) {
    console.error("Error getting budget summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get budget vs spending for specific month
const getBudgetVsSpending = async (req, res) => {
  try {
    const { categoryId, month, year } = req.params;
    const userId = req.user.id;

    if (!categoryId || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "Category, month and year are required"
      });
    }

    const summary = await MonthlyBudget.getBudgetVsSpending(
      userId,
      parseInt(categoryId),
      parseInt(month),
      parseInt(year)
    );

    res.json({ success: true, summary });
  } catch (err) {
    console.error("Error getting budget vs spending:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get budget alerts
const getBudgetAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const alerts = await MonthlyBudget.getBudgetAlerts(userId);

    res.json({ success: true, alerts });
  } catch (err) {
    console.error("Error getting budget alerts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  setBudget,
  getBudgets,
  getBudget,
  updateBudget,
  deleteBudget,
  getCurrentBudgetSummary,
  getBudgetVsSpending,
  getBudgetAlerts
};
