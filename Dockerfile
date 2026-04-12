FROM node:18-alpine

# 安装构建依赖
RUN apk add --no-cache python3 make g++ openssl

# 设置工作目录
WORKDIR /app

# 复制后端依赖
COPY package*.json ./
RUN npm ci && npm cache clean --force

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma/
RUN npx prisma generate

# 复制后端代码
COPY src ./src/

# 复制前端代码并构建
COPY frontend ./frontend/
RUN cd frontend && npm run build

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/health || exit 1

# 启动应用
CMD ["node", "src/index.js"]
