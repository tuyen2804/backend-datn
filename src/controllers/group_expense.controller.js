const GroupExpense = require("../models/group_expense.model");
const GroupExpenseShare = require("../models/group_expense_share.model");
const ExpenseGroup = require("../models/expense_group.model");
const ExpenseGroupMember = require("../models/expense_group_member.model");
const FcmToken = require("../models/fcm_token.model");
const { sendNotification } = require("../utils/fcm");

// Create group expense
const createExpense = async (req, res) => {
  try {
    const { group_id, total_amount, description, expense_date, shares } = req.body;
    const userId = req.user.id;

    if (!group_id || !total_amount || !expense_date) {
      return res.status(400).json({
        success: false,
        message: "group_id, total_amount, and expense_date are required"
      });
    }

    // Validate amount
    if (isNaN(total_amount) || parseFloat(total_amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total amount must be a positive number"
      });
    }

    // Check if user is a member of the group
    const memberInfo = await ExpenseGroupMember.getMember(group_id, userId);
    if (!memberInfo) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    // Create the expense
    const expenseId = await GroupExpense.create({
      group_id,
      payer_id: userId,
      total_amount: parseFloat(total_amount),
      description,
      expense_date
    });

    // Handle expense shares
    if (shares && Array.isArray(shares) && shares.length > 0) {
      // Validate shares total
      const sharesTotal = shares.reduce((sum, share) => sum + parseFloat(share.shared_amount || 0), 0);
      if (Math.abs(sharesTotal - parseFloat(total_amount)) > 0.01) {
        // Clean up created expense
        await GroupExpense.delete(expenseId);
        return res.status(400).json({
          success: false,
          message: "Sum of shares must equal total amount"
        });
      }

      await GroupExpenseShare.addShares(
        shares.map(share => ({
          group_expense_id: expenseId,
          account_id: share.account_id,
          shared_amount: parseFloat(share.shared_amount)
        }))
      );
    } else {
      // Auto-split equally among all group members
      const members = await ExpenseGroup.getGroupMembers(group_id);
      const acceptedMembers = members.filter(m => m.join_status === 'accepted');
      const shareAmount = parseFloat(total_amount) / acceptedMembers.length;

      const autoShares = acceptedMembers.map(member => ({
        group_expense_id: expenseId,
        account_id: member.account_id,
        shared_amount: shareAmount
      }));

      await GroupExpenseShare.addShares(autoShares);
    }

    // Send notifications to other group members
    const members = await ExpenseGroup.getGroupMembers(group_id);
    const group = await ExpenseGroup.getById(group_id);

    for (const member of members) {
      if (member.account_id !== userId && member.join_status === 'accepted') {
        const token = await FcmToken.getActiveToken(member.account_id);
        if (token) {
          const title = "Chi phí mới trong nhóm";
          const body = `${group.group_name}: ${total_amount} VNĐ`;
          await sendNotification(token, title, body, {
            groupId: group_id.toString(),
            expenseId: expenseId.toString()
          });
        }
      }
    }

    res.json({
      success: true,
      expenseId,
      message: "Expense created successfully"
    });
  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get group expenses
const getGroupExpenses = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    // Check if user is a member
    const memberInfo = await ExpenseGroupMember.getMember(groupId, userId);
    const group = await ExpenseGroup.getById(groupId);

    if (!memberInfo && group.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const expenses = await GroupExpense.getByGroupId(groupId);

    // Get shares for each expense
    for (const expense of expenses) {
      expense.shares = await GroupExpense.getExpenseShares(expense.id);
    }

    res.json({ success: true, expenses });
  } catch (err) {
    console.error("Error getting group expenses:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user's expenses (across all groups)
const getUserExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const expenses = await GroupExpense.getByUserId(userId);

    // Get shares for each expense
    for (const expense of expenses) {
      if (expense.user_role === 'participant') {
        expense.shares = await GroupExpense.getExpenseShares(expense.id);
      }
    }

    res.json({ success: true, expenses });
  } catch (err) {
    console.error("Error getting user expenses:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Monthly group-expense report for current user (across all groups)
// Query params: year, month (optional: default = current month/year)
const getUserMonthlyGroupExpenseSummary = async (req, res) => {
  try {
    const userId = req.user.id;
    let { year, month } = req.query;

    const now = new Date();
    year = year ? parseInt(year, 10) : now.getFullYear();
    month = month ? parseInt(month, 10) : now.getMonth() + 1;

    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Month must be between 1 and 12" });
    }

    if (year < 2020 || year > 2035) {
      return res.status(400).json({ success: false, message: "Year must be between 2020 and 2035" });
    }

    const summary = await GroupExpense.getUserMonthlySummary(userId, year, month);

    return res.json({ success: true, summary });
  } catch (err) {
    console.error("Error getting user monthly group expense summary:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update expense
const updateExpense = async (req, res) => {
  try {
    const expenseId = req.params.expenseId;
    const userId = req.user.id;
    const { total_amount, description, expense_date } = req.body;

    const expense = await GroupExpense.getById(expenseId);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    if (expense.payer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the payer can update the expense"
      });
    }

    if (total_amount && (isNaN(total_amount) || parseFloat(total_amount) <= 0)) {
      return res.status(400).json({
        success: false,
        message: "Total amount must be a positive number"
      });
    }

    await GroupExpense.update(expenseId, {
      total_amount: total_amount ? parseFloat(total_amount) : undefined,
      description,
      expense_date
    });

    res.json({ success: true, message: "Expense updated successfully" });
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Delete expense
const deleteExpense = async (req, res) => {
  try {
    const expenseId = req.params.expenseId;
    const userId = req.user.id;

    const expense = await GroupExpense.getById(expenseId);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    if (expense.payer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the payer can delete the expense"
      });
    }

    // Delete shares first
    await GroupExpenseShare.removeAllShares(expenseId);
    // Delete expense
    await GroupExpense.delete(expenseId);

    res.json({ success: true, message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update expense shares
const updateExpenseShares = async (req, res) => {
  try {
    const expenseId = req.params.expenseId;
    const userId = req.user.id;
    const { shares } = req.body;

    const expense = await GroupExpense.getById(expenseId);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    if (expense.payer_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the payer can update expense shares"
      });
    }

    if (!shares || !Array.isArray(shares) || shares.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Shares array is required"
      });
    }

    // Validate shares total
    const sharesTotal = shares.reduce((sum, share) => sum + parseFloat(share.shared_amount || 0), 0);
    if (Math.abs(sharesTotal - expense.total_amount) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "Sum of shares must equal total amount"
      });
    }

    // Remove existing shares
    await GroupExpenseShare.removeAllShares(expenseId);

    // Add new shares
    await GroupExpenseShare.addShares(
      shares.map(share => ({
        group_expense_id: expenseId,
        account_id: share.account_id,
        shared_amount: parseFloat(share.shared_amount)
      }))
    );

    res.json({ success: true, message: "Expense shares updated successfully" });
  } catch (err) {
    console.error("Error updating expense shares:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createExpense,
  getGroupExpenses,
  getUserExpenses,
  getUserMonthlyGroupExpenseSummary,
  updateExpense,
  deleteExpense,
  updateExpenseShares
};
