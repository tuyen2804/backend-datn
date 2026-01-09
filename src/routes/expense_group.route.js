const express = require("express");
const router = express.Router();
const expenseGroupController = require("../controllers/expense_group.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

// Tạo nhóm chi tiêu
router.post("/", verifyToken, expenseGroupController.createGroup);

// Lấy danh sách nhóm của user
router.get("/", verifyToken, expenseGroupController.getUserGroups);

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

// Rời khỏi nhóm
router.post("/:groupId/leave", verifyToken, expenseGroupController.leaveGroup);

module.exports = router;
