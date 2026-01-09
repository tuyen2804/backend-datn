const express = require("express");
const router = express.Router();
const { googleLogin, protectedRoute,updateDeviceToken } = require("../controllers/auth.controller");
const { verifyToken } = require("../middlewares/auth.middleware");

router.post("/google", googleLogin);
router.get("/protected", verifyToken, protectedRoute);
router.post("/device-token", verifyToken, updateDeviceToken);  
module.exports = router;
