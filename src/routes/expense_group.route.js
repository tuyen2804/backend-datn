const express = require("express");
const router = express.Router();
const expenseGroupController = require("../controllers/expense_group.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Tạo nhóm chi tiêu
router.post("/", verifyToken, expenseGroupController.createGroup);
// Chấp nhận lời mời tham gia nhóm
router.patch("/:groupId/accept-invitation", verifyToken, expenseGroupController.acceptInvitation);

// Từ chối lời mời
router.patch("/:groupId/reject-invitation", verifyToken, expenseGroupController.rejectInvitation);

// Lấy danh sách nhóm của user
router.get("/", verifyToken, expenseGroupController.getUserGroups);

// Báo cáo chỉ tiêu nhóm theo tháng (theo userId) - đặt trước "/:groupId" để tránh conflict
router.get("/report/targets/:userId", verifyToken, expenseGroupController.getUserMonthlyGroupTargetReport);

// API cho trưởng nhóm: Xem các nhóm có thành viên chưa trả/quá hạn
router.get("/owner/unpaid-members", verifyToken, expenseGroupController.getOwnerGroupsWithUnpaidMembers);

// API cho thành viên: Xem trạng thái thanh toán các nhóm (chưa trả/đã trả/quá hạn)
router.get("/member/payment-status", verifyToken, expenseGroupController.getMemberPaymentStatus);

// Lấy chi tiết nhóm
router.get("/:groupId", verifyToken, expenseGroupController.getGroupDetails);

// Cập nhật thông tin nhóm
router.put("/:groupId", verifyToken, expenseGroupController.updateGroup);

// Thêm thành viên vào nhóm
router.post("/:groupId/members", verifyToken, expenseGroupController.addMember);

// Xóa thành viên khỏi nhóm
router.delete("/:groupId/members/:memberId", verifyToken, expenseGroupController.removeMember);

// Cập nhật số tiền của thành viên
router.put("/:groupId/members/:memberId/amount", verifyToken, expenseGroupController.updateMemberAmount);

// Cập nhật ảnh chứng minh thanh toán của thành viên
router.put("/:groupId/members/:memberId/proof", verifyToken, expenseGroupController.updateMemberProof);

// Trưởng nhóm xác nhận trạng thái thanh toán của thành viên (thành công/thất bại)
// Body: { status: 'confirmed' | 'rejected' }
router.patch("/:groupId/members/:memberId/confirm-payment", verifyToken, expenseGroupController.confirmMemberPayment);

// Rời khỏi nhóm
router.post("/:groupId/leave", verifyToken, expenseGroupController.leaveGroup);

module.exports = router;
