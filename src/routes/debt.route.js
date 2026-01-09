const express = require("express");
const router = express.Router();
const debtController = require("../controllers/debt.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Tạo khoản nợ
router.post("/", verifyToken, debtController.createDebt);

// Lấy danh sách khoản nợ theo user
router.get("/:userId", verifyToken, debtController.getDebts);

// Báo cáo đã trả (debtor uploads proof)
router.post("/report-payment/:id", verifyToken, debtController.reportPayment);

// Xác nhận khoản nợ (creditor accepts)
router.patch("/confirm/:id", verifyToken, debtController.confirmDebt);

// Xác nhận thanh toán (creditor confirms payment)
router.patch("/confirm-payment/:id", verifyToken, debtController.confirmPayment);

// Từ chối khoản nợ
router.patch("/reject/:id", verifyToken, debtController.rejectDebt);

// Cập nhật khoản nợ
router.put("/:id", verifyToken, debtController.updateDebt);

// Xóa khoản nợ
router.delete("/:id", verifyToken, debtController.deleteDebt);

module.exports = router;
