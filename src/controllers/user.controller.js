const Account = require("../models/account.model");
const GroupExpenseShare = require("../models/group_expense_share.model");

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await Account.getById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Get user's balance
    const balance = await GroupExpenseShare.getUserBalance(userId);

    res.json({
      success: true,
      user: {
        id: user.id,
        uid: user.uid,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      balance
    });
  } catch (err) {
    console.error("Error getting profile:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;

    if (!username && !email) {
      return res.status(400).json({
        success: false,
        message: "At least one field (username or email) must be provided"
      });
    }

    // Check if email is already taken
    if (email) {
      const existingUser = await Account.getByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          message: "Email is already in use"
        });
      }
    }

    await Account.updateProfile(userId, { username, email });

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Search users
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user.id;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters"
      });
    }

    const users = await Account.searchUsers(q, userId);

    res.json({ success: true, users });
  } catch (err) {
    console.error("Error searching users:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  searchUsers
};
