const ExpenseGroup = require("../models/expense_group.model");
const ExpenseGroupMember = require("../models/expense_group_member.model");
const Account = require("../models/account.model");
const FcmToken = require("../models/fcm_token.model");
const { sendNotification } = require("../utils/fcm");

// Báo cáo chỉ tiêu nhóm theo tháng (theo userId)
// GET /api/groups/report/targets/:userId?month=MM&year=YYYY
const getUserMonthlyGroupTargetReport = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    let { month, year } = req.query;

    const now = new Date();
    year = year ? parseInt(year, 10) : now.getFullYear();
    month = month ? parseInt(month, 10) : now.getMonth() + 1;

    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }
    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "Month must be between 1 and 12" });
    }
    if (year < 2020 || year > 2035) {
      return res.status(400).json({ success: false, message: "Year must be between 2020 and 2035" });
    }

    // Chỉ cho phép xem report của chính mình (tránh lộ dữ liệu)
    if (req.user.id !== userId) {
      return res.status(403).json({ success: false, message: "You can only view your own report" });
    }

    const result = await ExpenseGroup.getUserMonthlyTargetReport(userId, year, month);

    return res.json({
      success: true,
      month,
      year,
      totals: result.totals,
      groups: result.rows
    });
  } catch (err) {
    console.error("Error getting user monthly group target report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Create expense group
const createGroup = async (req, res) => {
  try {
    const { group_name, payment_deadline, member_ids } = req.body;
    const ownerId = req.user.id;

    if (!group_name) {
      return res.status(400).json({
        success: false,
        message: "Group name is required"
      });
    }

    // Validate payment deadline if provided
    if (payment_deadline && isNaN(new Date(payment_deadline).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment deadline format"
      });
    }

    // Create the group
    const groupId = await ExpenseGroup.create({
      group_name,
      owner_id: ownerId,
      payment_deadline
    });

    // Add owner as first member
    await ExpenseGroupMember.addMember({
      group_id: groupId,
      account_id: ownerId,
      amount: 0,
      payment_deadline
    });

    // Add other members if provided
    if (member_ids && Array.isArray(member_ids)) {
      const membersToAdd = member_ids.map(memberId => ({
        group_id: groupId,
        account_id: memberId,
        amount: 0,
        payment_deadline
      }));

      await ExpenseGroupMember.bulkAddMembers(membersToAdd);

      // Send notifications to new members
      for (const memberId of member_ids) {
        const token = await FcmToken.getActiveToken(memberId);
        if (token) {
          const title = "Bạn được mời tham gia nhóm";
          const body = `Nhóm: ${group_name}`;
          await sendNotification(token, title, body, { groupId: groupId.toString() });
        }
      }
    }

    res.json({
      success: true,
      groupId,
      message: "Group created successfully"
    });
  } catch (err) {
    console.error("Error creating group:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get user's groups
const getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await ExpenseGroup.getByUserId(userId);

    res.json({ success: true, groups });
  } catch (err) {
    console.error("Error getting user groups:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get group details
const getGroupDetails = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user is a member
    const memberInfo = await ExpenseGroupMember.getMember(groupId, userId);
    if (!memberInfo && group.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group"
      });
    }

    const members = await ExpenseGroup.getGroupMembers(groupId);
    const stats = await ExpenseGroup.getGroupStats(groupId);

    res.json({
      success: true,
      group: { ...group, ...stats },
      members,
      isOwner: group.owner_id === userId
    });
  } catch (err) {
    console.error("Error getting group details:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update group
const updateGroup = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;
    const { group_name, payment_deadline } = req.body;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only group owner can update group details"
      });
    }

    if (payment_deadline && isNaN(new Date(payment_deadline).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment deadline format"
      });
    }

    await ExpenseGroup.update(groupId, { group_name, payment_deadline });

    res.json({ success: true, message: "Group updated successfully" });
  } catch (err) {
    console.error("Error updating group:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Add member to group
const addMember = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;
    const { account_id, amount, payment_deadline } = req.body;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only group owner can add members"
      });
    }

    // Check if user exists
    const user = await Account.getById(account_id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if already a member
    const existingMember = await ExpenseGroupMember.getMember(groupId, account_id);
    if (existingMember) {
      return res.status(400).json({
        success: false,
        message: "User is already a member of this group"
      });
    }

    await ExpenseGroupMember.addMember({
      group_id: groupId,
      account_id,
      amount: amount || 0,
      payment_deadline: payment_deadline || group.payment_deadline
    });

    // Send notification
    const token = await FcmToken.getActiveToken(account_id);
    if (token) {
      const title = "Bạn được thêm vào nhóm";
      const body = `Nhóm: ${group.group_name}`;
      await sendNotification(token, title, body, { groupId: groupId.toString() });
    }

    res.json({ success: true, message: "Member added successfully" });
  } catch (err) {
    console.error("Error adding member:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Remove member from group
const removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user.id;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.owner_id !== userId && parseInt(memberId) !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to remove this member"
      });
    }

    // Cannot remove owner
    if (parseInt(memberId) === group.owner_id) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove group owner"
      });
    }

    await ExpenseGroupMember.removeMember(groupId, memberId);

    res.json({ success: true, message: "Member removed successfully" });
  } catch (err) {
    console.error("Error removing member:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update member amount
const updateMemberAmount = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const memberId = req.params.memberId;
    const userId = req.user.id;
    const { amount, payment_deadline } = req.body;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only group owner can update member amounts"
      });
    }

    if (isNaN(amount) || parseFloat(amount) < 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be a non-negative number"
      });
    }

    await ExpenseGroupMember.updateMemberDetails(groupId, memberId, {
      amount: parseFloat(amount),
      payment_deadline
    });

    res.json({ success: true, message: "Member amount updated successfully" });
  } catch (err) {
    console.error("Error updating member amount:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update member proof image
const updateMemberProof = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const memberId = req.params.memberId;
    const userId = req.user.id;
    const { proof_image_url } = req.body;

    if (!proof_image_url) {
      return res.status(400).json({
        success: false,
        message: "Proof image URL is required"
      });
    }

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user is the member themselves
    if (parseInt(memberId) !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own proof image"
      });
    }

    await ExpenseGroupMember.updateMemberDetails(groupId, memberId, {
      proof_image_url
    });
    await ExpenseGroupMember.updateMemberStatus(groupId, memberId, {
      payment_status: "paid"
    });
    res.json({ success: true, message: "Proof image updated successfully" });
  } catch (err) {
    console.error("Error updating member proof:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Accept group invitation
const acceptInvitation = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user is a pending member
    const memberInfo = await ExpenseGroupMember.getMember(groupId, userId);
    if (!memberInfo) {
      return res.status(404).json({ success: false, message: "You are not invited to this group" });
    }

    if (memberInfo.join_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Invitation is not pending"
      });
    }

    await ExpenseGroupMember.updateMemberStatus(groupId, userId, { join_status: 'accepted' });

    // Send notification to group owner
    const token = await FcmToken.getActiveToken(group.owner_id);
    if (token) {
      const user = await Account.getById(userId);
      const title = "Thành viên đã chấp nhận lời mời";
      const body = `${user.username} đã tham gia nhóm: ${group.group_name}`;
      await sendNotification(token, title, body, { groupId: groupId.toString() });
    }

    res.json({ success: true, message: "Invitation accepted successfully" });
  } catch (err) {
    console.error("Error accepting invitation:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reject group invitation
const rejectInvitation = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Check if user is a pending member
    const memberInfo = await ExpenseGroupMember.getMember(groupId, userId);
    if (!memberInfo) {
      return res.status(404).json({ success: false, message: "You are not invited to this group" });
    }

    if (memberInfo.join_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: "Invitation is not pending"
      });
    }

    await ExpenseGroupMember.updateMemberStatus(groupId, userId, { join_status: 'rejected' });

    // Send notification to group owner
    const token = await FcmToken.getActiveToken(group.owner_id);
    if (token) {
      const user = await Account.getById(userId);
      const title = "Thành viên đã từ chối lời mời";
      const body = `${user.username} đã từ chối tham gia nhóm: ${group.group_name}`;
      await sendNotification(token, title, body, { groupId: groupId.toString() });
    }

    res.json({ success: true, message: "Invitation rejected successfully" });
  } catch (err) {
    console.error("Error rejecting invitation:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Leave group
const leaveGroup = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const userId = req.user.id;

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    if (group.owner_id === userId) {
      return res.status(400).json({
        success: false,
        message: "Group owner cannot leave the group"
      });
    }

    await ExpenseGroupMember.removeMember(groupId, userId);

    // Send notification to group owner
    const token = await FcmToken.getActiveToken(group.owner_id);
    if (token) {
      const user = await Account.getById(userId);
      const title = "Thành viên đã rời nhóm";
      const body = `${user.username} đã rời khỏi nhóm: ${group.group_name}`;
      await sendNotification(token, title, body, { groupId: groupId.toString() });
    }

    res.json({ success: true, message: "Left group successfully" });
  } catch (err) {
    console.error("Error leaving group:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Trưởng nhóm xác nhận trạng thái thanh toán của thành viên (thành công hoặc thất bại)
// Body: { status: 'confirmed' | 'rejected' }
const confirmMemberPayment = async (req, res) => {
  try {
    const groupId = req.params.groupId;
    const memberId = req.params.memberId;
    const userId = req.user.id;
    const { status } = req.body;

    if (!status || (status !== 'confirmed' && status !== 'rejected')) {
      return res.status(400).json({
        success: false,
        message: "status must be 'confirmed' or 'rejected'"
      });
    }

    const group = await ExpenseGroup.getById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    // Chỉ trưởng nhóm mới được xác nhận
    if (group.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only group owner can confirm member payment"
      });
    }

    // Kiểm tra thành viên có tồn tại không
    const memberInfo = await ExpenseGroupMember.getMember(groupId, memberId);
    if (!memberInfo) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this group"
      });
    }

    // Chỉ xác nhận khi thành viên đã báo thanh toán (payment_status = 'paid')
    if (memberInfo.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: "Member has not reported payment yet"
      });
    }

    // Cập nhật owner_confirm_status
    const ownerConfirmStatus = status === 'confirmed' ? 'confirmed' : 'rejected';
    await ExpenseGroupMember.updateMemberStatus(groupId, memberId, {
      owner_confirm_status: ownerConfirmStatus
    });

    // Gửi thông báo cho thành viên
    const token = await FcmToken.getActiveToken(memberId);
    if (token) {
      const title = status === 'confirmed' 
        ? "Thanh toán đã được xác nhận" 
        : "Thanh toán bị từ chối";
      const body = status === 'confirmed'
        ? `Nhóm ${group.group_name}: Thanh toán của bạn đã được xác nhận thành công`
        : `Nhóm ${group.group_name}: Thanh toán của bạn bị từ chối, vui lòng kiểm tra lại`;
      await sendNotification(token, title, body, { 
        groupId: groupId.toString(),
        memberId: memberId.toString()
      });
    }

    res.json({ 
      success: true, 
      message: status === 'confirmed' 
        ? "Payment confirmed successfully" 
        : "Payment rejected successfully"
    });
  } catch (err) {
    console.error("Error confirming member payment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// API cho trưởng nhóm: Hiển thị các nhóm có thành viên chưa hoàn thành trả nợ
// - Các nhóm có thành viên chưa trả
// - Các nhóm có thành viên quá hạn
// - Tổng số tiền chưa trả
// - Liệt kê các email chưa trả
const getOwnerGroupsWithUnpaidMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await ExpenseGroup.getOwnerGroupsWithUnpaidMembers(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("Error getting owner groups with unpaid members:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// API cho thành viên: Trả về các nhóm chưa trả, đã trả, quá hạn và tổng số tiền chưa trả
const getMemberPaymentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await ExpenseGroup.getMemberPaymentStatus(userId);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error("Error getting member payment status:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getUserMonthlyGroupTargetReport,
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  addMember,
  acceptInvitation,
  rejectInvitation,
  removeMember,
  updateMemberAmount,
  updateMemberProof,
  confirmMemberPayment,
  getOwnerGroupsWithUnpaidMembers,
  getMemberPaymentStatus,
  leaveGroup
};
