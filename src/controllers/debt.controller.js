const Debt = require("../models/debt.model");
const FcmToken = require("../models/fcm_token.model");
const { sendNotification } = require("../utils/fcm");

// (phần định nghĩa report được đặt phía trên, tránh trùng lặp)

// Debt summary report for current user
// Query params:
// - from (optional, ISO date)
// - to (optional, ISO date)
// - debt_confirm_status (optional: pending|accepted|rejected)
// - paid_status (optional: unpaid|paid)
// - payment_confirm_status (optional: unconfirmed|confirmed)
const getDebtSummaryReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, debt_confirm_status, paid_status, payment_confirm_status } = req.query;

    // Validate dates if provided
    if (from && isNaN(new Date(from).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid from date format" });
    }
    if (to && isNaN(new Date(to).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid to date format" });
    }

    const [rows] = await Debt.getSummaryReport({
      userId,
      from: from || null,
      to: to || null,
      debt_confirm_status: debt_confirm_status || null,
      paid_status: paid_status || null,
      payment_confirm_status: payment_confirm_status || null
    });

    res.json({ success: true, summary: rows[0] || {} });
  } catch (err) {
    console.error("Error getting debt summary report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Debt report grouped by counterparty for current user
// Query params:
// - from (optional, ISO date)
// - to (optional, ISO date)
// - debt_confirm_status (optional)
// - paid_status (optional)
// - payment_confirm_status (optional)
const getDebtByCounterpartyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { from, to, debt_confirm_status, paid_status, payment_confirm_status } = req.query;

    if (from && isNaN(new Date(from).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid from date format" });
    }
    if (to && isNaN(new Date(to).getTime())) {
      return res.status(400).json({ success: false, message: "Invalid to date format" });
    }

    const [rows] = await Debt.getByCounterpartyReport({
      userId,
      from: from || null,
      to: to || null,
      debt_confirm_status: debt_confirm_status || null,
      paid_status: paid_status || null,
      payment_confirm_status: payment_confirm_status || null
    });

    res.json({ success: true, counterparties: rows });
  } catch (err) {
    console.error("Error getting debt by counterparty report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Monthly aggregation within a year
const getDebtMonthlyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const { year } = req.query;
    const parsedYear = year ? parseInt(year, 10) : new Date().getFullYear();

    if (parsedYear < 2020 || parsedYear > 2035) {
      return res.status(400).json({ success: false, message: "Year must be between 2020 and 2035" });
    }

    const [rows] = await Debt.getMonthlyReport({ userId, year: parsedYear });
    res.json({ success: true, months: rows });
  } catch (err) {
    console.error("Error getting monthly debt report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Yearly aggregation
const getDebtYearlyReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await Debt.getYearlyReport({ userId });
    res.json({ success: true, years: rows });
  } catch (err) {
    console.error("Error getting yearly debt report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Báo cáo đầy đủ cho người cho vay (creditor)
// - Liệt kê các email nợ chưa trả
// - Các email nợ quá hạn
// - Số tiền đã được trả
// - Tổng số tiền chưa được trả
const getCreditorFullReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await Debt.getCreditorFullReport({ userId });
    const result = rows[0] || {};

    // Parse emails từ string sang array (loại bỏ null/empty)
    const unpaidEmails = result.unpaid_emails 
      ? result.unpaid_emails.split(', ').filter(e => e && e.trim())
      : [];
    const overdueEmails = result.overdue_emails
      ? result.overdue_emails.split(', ').filter(e => e && e.trim())
      : [];

    res.json({
      success: true,
      data: {
        total_paid_amount: parseFloat(result.total_paid_amount || 0),
        total_unpaid_amount: parseFloat(result.total_unpaid_amount || 0),
        unpaid_emails: [...new Set(unpaidEmails)], // Remove duplicates
        overdue_emails: [...new Set(overdueEmails)] // Remove duplicates
      }
    });
  } catch (err) {
    console.error("Error getting creditor full report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Báo cáo đầy đủ cho người vay (debtor)
// - Liệt kê các email chưa trả (người cho vay)
// - Các email quá hạn
// - Tổng số tiền chưa trả
const getDebtorFullReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await Debt.getDebtorFullReport({ userId });
    const result = rows[0] || {};

    // Parse emails từ string sang array (loại bỏ null/empty)
    const unpaidEmails = result.unpaid_emails
      ? result.unpaid_emails.split(', ').filter(e => e && e.trim())
      : [];
    const overdueEmails = result.overdue_emails
      ? result.overdue_emails.split(', ').filter(e => e && e.trim())
      : [];

    res.json({
      success: true,
      data: {
        total_unpaid_amount: parseFloat(result.total_unpaid_amount || 0),
        unpaid_emails: [...new Set(unpaidEmails)], // Remove duplicates
        overdue_emails: [...new Set(overdueEmails)] // Remove duplicates
      }
    });
  } catch (err) {
    console.error("Error getting debtor full report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const createDebt = async (req, res) => {
  try {
    const { creditor_id, debtor_id, amount, note, due_date } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!creditor_id || !debtor_id || !amount) {
      return res.status(400).json({
        success: false,
        message: "creditor_id, debtor_id, and amount are required"
      });
    }

    // Validate amount
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number"
      });
    }

    // Validate due date if provided
    if (due_date && isNaN(new Date(due_date).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date format"
      });
    }

    // Only creditor or debtor can create debt
    if (userId !== creditor_id && userId !== debtor_id) {
      return res.status(403).json({
        success: false,
        message: "You can only create debts involving yourself"
      });
    }

    const [result] = await Debt.create({
      creditor_id,
      debtor_id,
      amount: parseFloat(amount),
      note,
      due_date
    });

    // Gửi thông báo cho NGƯỜI VAY (debtor) để xác nhận khoản nợ
    const token = await FcmToken.getActiveToken(debtor_id);

    if (token) {
      const title = "Bạn có khoản vay mới cần xác nhận";
      const body = `Số tiền: ${amount} VNĐ`;
      await sendNotification(token, title, body, { debtId: result.insertId.toString() });
    }

    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error("Error creating debt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getDebts = async (req, res) => {
  try {
    const userId = req.params.userId;
    const [rows] = await Debt.getByUser(userId);
    res.json({ success: true, debts: rows });
  } catch (err) {
    console.error("Error getting debts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Debtor reports payment with proof
const reportPayment = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;
    const { proof_image_url } = req.body;

    if (!proof_image_url) {
      return res.status(400).json({ success: false, message: "Missing proof image URL" });
    }

    // Check if user is the debtor
    const [debtRows] = await Debt.getById(id);
    if (!debtRows || debtRows.length === 0) {
      return res.status(404).json({ success: false, message: "Debt not found" });
    }

    const debt = debtRows[0];
    if (debt.debtor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the debtor can report payment"
      });
    }

    // Check if debt is already paid
    if (debt.paid_status === 'paid') {
      return res.status(400).json({
        success: false,
        message: "Debt is already marked as paid"
      });
    }

    await Debt.reportPayment(id, proof_image_url);

    // Notify creditor
    const token = await FcmToken.getActiveToken(debt.creditor_id);
    if (token) {
      const title = "Đã nhận được báo cáo thanh toán";
      const body = `Số tiền: ${debt.amount} VNĐ - Chờ xác nhận`;
      await sendNotification(token, title, body, { debtId: id.toString() });
    }

    res.json({ success: true, message: "Payment reported successfully" });
  } catch (err) {
    console.error("Error reporting payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Debtor (người vay) confirms the debt request
const confirmDebt = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    // Check if user is the debtor
    const [debtRows] = await Debt.getById(id);
    if (!debtRows || debtRows.length === 0) {
      return res.status(404).json({ success: false, message: "Debt not found" });
    }

    const debt = debtRows[0];
    if (debt.debtor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the debtor can confirm the debt"
      });
    }

    if (debt.debt_confirm_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Debt is not in pending status"
      });
    }

    await Debt.confirmDebt(id);

    // Notify creditor (người cho vay) khi người vay đã xác nhận
    const token = await FcmToken.getActiveToken(debt.creditor_id);
    if (token) {
      const title = "Khoản vay đã được người vay xác nhận";
      const body = `Số tiền: ${debt.amount} VNĐ`;
      await sendNotification(token, title, body, { debtId: id.toString() });
    }

    res.json({ success: true, message: "Debt confirmed successfully" });
  } catch (err) {
    console.error("Error confirming debt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Creditor confirms payment
const confirmPayment = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    // Check if user is the creditor
    const [debtRows] = await Debt.getById(id);
    if (!debtRows || debtRows.length === 0) {
      return res.status(404).json({ success: false, message: "Debt not found" });
    }

    const debt = debtRows[0];
    if (debt.creditor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the creditor can confirm payment"
      });
    }

    if (debt.payment_confirm_status !== 'unconfirmed') {
      return res.status(400).json({
        success: false,
        message: "Payment is not waiting for confirmation"
      });
    }

    await Debt.confirmPayment(id);

    // Notify debtor
    const token = await FcmToken.getActiveToken(debt.debtor_id);
    if (token) {
      const title = "Thanh toán đã được xác nhận";
      const body = `Số tiền: ${debt.amount} VNĐ`;
      await sendNotification(token, title, body, { debtId: id.toString() });
    }

    res.json({ success: true, message: "Payment confirmed successfully" });
  } catch (err) {
    console.error("Error confirming payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reject debt request
const rejectDebt = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    // Check if user is the creditor
    const [debtRows] = await Debt.getById(id);
    if (!debtRows || debtRows.length === 0) {
      return res.status(404).json({ success: false, message: "Debt not found" });
    }

    const debt = debtRows[0];
    if (debt.creditor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the creditor can reject the debt"
      });
    }

    if (debt.debt_confirm_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Debt is not in pending status"
      });
    }

    await Debt.rejectDebt(id);

    // Notify debtor
    const token = await FcmToken.getActiveToken(debt.debtor_id);
    if (token) {
      const title = "Khoản nợ đã bị từ chối";
      const body = `Số tiền: ${debt.amount} VNĐ`;
      await sendNotification(token, title, body, { debtId: id.toString() });
    }

    res.json({ success: true, message: "Debt rejected successfully" });
  } catch (err) {
    console.error("Error rejecting debt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deleteDebt = async (req, res) => {
  try {
    const id = req.params.id;
    await Debt.delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
const updateDebt = async (req, res) => {
  try {
    const id = req.params.id;
    const { amount, note, due_date } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required"
      });
    }

    // Validate amount
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a positive number"
      });
    }

    // Validate due date if provided
    if (due_date && isNaN(new Date(due_date).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid due date format"
      });
    }

    // Check if debt exists and user has permission
    const [debtRows] = await Debt.getById(id);
    if (!debtRows || debtRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Debt not found"
      });
    }

    const debt = debtRows[0];

    // Only creditor or debtor can update
    if (debt.creditor_id !== userId && debt.debtor_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update this debt"
      });
    }

    // Cannot update if payment is confirmed
    if (debt.payment_confirm_status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: "Cannot update a debt that has been paid"
      });
    }

    // Update debt
    await Debt.update(id, {
      amount: parseFloat(amount),
      note,
      due_date
    });

    res.json({ success: true, message: "Debt updated successfully" });
  } catch (err) {
    console.error("Error updating debt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  createDebt,
  getDebts,
  // reports
  getDebtSummaryReport,
  getDebtByCounterpartyReport,
  getDebtMonthlyReport,
  getDebtYearlyReport,
  getCreditorFullReport,
  getDebtorFullReport,
  reportPayment,
  confirmDebt,
  confirmPayment,
  rejectDebt,
  deleteDebt,
  updateDebt
};
