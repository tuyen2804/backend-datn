const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const Account = require("../models/account.model");
const dotenv = require("dotenv");
dotenv.config();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Login Google, tạo JWT riêng
exports.googleLogin = async (req, res) => {
    try {
        const { tokenId } = req.body;
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const { sub: uid, email, name: username } = ticket.getPayload();

        // Kiểm tra user đã tồn tại chưa
        let user = await Account.getByUid(uid) || await Account.getByEmail(email);

        if(!user){
            // Tạo user mới
            const userId = await Account.create({
                uid,
                email,
                username,
                password: null // Google login doesn't use password
            });
            user = await Account.getById(userId);
        }

        // Tạo JWT app
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                uid: user.uid,
                username: user.username,
                email: user.email
            },
            token
        });

    } catch (err) {
        console.error("Google login error:", err);
        res.status(400).json({ success: false, message: "Google login failed" });
    }
};
// This method is now handled by FCM token controller
exports.updateDeviceToken = async (req, res) => {
    res.status(410).json({
        success: false,
        message: "This endpoint is deprecated. Use /api/fcm/register-token instead"
    });
};

// Route test protected
exports.protectedRoute = (req, res) => {
    res.json({ message: `Hello ${req.user.email}, bạn đã vào route bảo vệ!` });
};
