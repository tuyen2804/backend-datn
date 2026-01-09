const Debt = require("../models/debt.model");
const FcmToken = require("../models/fcm_token.model");
const { sendNotification } = require("../utils/fcm");

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

    // Send notification to the other party
    const notificationTargetId = userId === creditor_id ? debtor_id : creditor_id;
    const token = await FcmToken.getActiveToken(notificationTargetId);

    if (token) {
      const title = "Bạn có khoản nợ mới cần xác nhận";
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

    await Debt.reportPayment(id, proofImageUrl);

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

// Creditor confirms the debt request
const confirmDebt = async (req, res) => {
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
        message: "Only the creditor can confirm the debt"
      });
    }

    if (debt.debt_confirm_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Debt is not in pending status"
      });
    }

    await Debt.confirmDebt(id);

    // Notify debtor
    const token = await FcmToken.getActiveToken(debt.debtor_id);
    if (token) {
      const title = "Khoản nợ đã được xác nhận";
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
  reportPayment,
  confirmDebt,
  confirmPayment,
  rejectDebt,
  deleteDebt,
  updateDebt
};
