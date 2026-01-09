const admin = require("../config/firebase");

/**
 * Gửi thông báo FCM đến 1 device token
 * @param {string} token - device token của người nhận
 * @param {string} title - tiêu đề thông báo
 * @param {string} body - nội dung thông báo
 * @param {Object} data - dữ liệu bổ sung (tuỳ chọn)
 */
const sendNotification = async (token, title, body, data = {}) => {
  try {
    const message = {
      token,
      notification: { title, body },
      data: data, // key/value string
    };
    await admin.messaging().send(message);
    console.log("FCM sent successfully");
  } catch (err) {
    console.error("FCM error:", err);
  }
};

module.exports = { sendNotification };
