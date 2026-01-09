const FcmToken = require("../models/fcm_token.model");

// Register/update FCM token
const registerToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    await FcmToken.upsert(userId, token);

    res.json({
      success: true,
      message: "FCM token registered successfully"
    });
  } catch (err) {
    console.error("Error registering FCM token:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Deactivate FCM token
const deactivateToken = async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "FCM token is required"
      });
    }

    // Verify the token belongs to the user before deactivating
    const activeToken = await FcmToken.getActiveToken(userId);
    if (activeToken !== token) {
      return res.status(400).json({
        success: false,
        message: "Token does not belong to this user"
      });
    }

    await FcmToken.deactivateToken(token);

    res.json({
      success: true,
      message: "FCM token deactivated successfully"
    });
  } catch (err) {
    console.error("Error deactivating FCM token:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  registerToken,
  deactivateToken
};
