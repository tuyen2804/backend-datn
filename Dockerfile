# 1. Base image
FROM node:18-alpine

# 2. Set working directory
WORKDIR /app

# 3. Copy package files first (optimize cache)
COPY package*.json ./

# 4. Install dependencies (production only)
RUN npm install --omit=dev

# 5. Copy source code
COPY . .

# 6. Expose port (đổi nếu app bạn dùng port khác)
EXPOSE 3000

# 7. Start application
CMD ["npm", "start"]
