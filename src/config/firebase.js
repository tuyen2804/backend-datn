const admin = require("firebase-admin");
const serviceAccount = require("../path/to/key_fcm.json"); // tải từ Firebase console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
