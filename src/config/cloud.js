// src/config/cloud.js
// Cấu hình Cloudflare R2 (tương thích S3 API)
require('dotenv').config();

const R2Config = {
  // Account ID của Cloudflare R2
  ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  
  // Tên bucket R2
  BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
  
  // Access Key ID
  ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  
  // Secret Access Key
  SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  
  // Public URL của bucket (Custom Domain hoặc R2.dev URL)
  PUBLIC_URL: process.env.R2_PUBLIC_URL || '',
  
  // Region (R2 sử dụng "auto")
  REGION: 'auto',
  
  // Kiểm tra config đã đầy đủ chưa
  isConfigured: () => {
    return !!(
      R2Config.ACCOUNT_ID &&
      R2Config.BUCKET_NAME &&
      R2Config.ACCESS_KEY_ID &&
      R2Config.SECRET_ACCESS_KEY &&
      R2Config.PUBLIC_URL
    );
  },
  
  // Lấy danh sách các biến môi trường bị thiếu
  getMissingConfig: () => {
    const missing = [];
    if (!R2Config.ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
    if (!R2Config.BUCKET_NAME) missing.push('R2_BUCKET_NAME');
    if (!R2Config.ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
    if (!R2Config.SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
    if (!R2Config.PUBLIC_URL) missing.push('R2_PUBLIC_URL');
    return missing;
  }
};

module.exports = R2Config;
