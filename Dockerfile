# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app

# 1. 复制依赖文件
COPY package*.json ./
COPY frontend/package.json ./frontend/

# 2. 安装依赖
RUN npm ci --omit=dev && npm cache clean --force

# 3. 复制前端和后端源代码（在复制 node_modules 之前）
COPY frontend ./frontend/
COPY prisma ./prisma/
COPY src ./src/

# 调试：验证
RUN test -d /app/src || (echo "ERROR: /app/src 不存在！" && exit 1)
RUN test -d /app/frontend/app || (echo "ERROR: /app/frontend/app 不存在！" && exit 1)

# 4. 复制根 node_modules 到 frontend（真实目录，非 symlink）
RUN cp -r node_modules frontend/node_modules

# 5. 生成 Prisma 客户端（同时生成到根和 frontend 的 node_modules）
RUN npx prisma generate
RUN cp -r node_modules/@prisma frontend/node_modules/

# 6. 构建前端
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN cd frontend && npm run build

# 调试：验证产物
RUN echo "=== frontend/.next ===" && ls -la /app/frontend/.next

# ==================== 运行阶段 ====================
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制运行所需文件
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nodejs:nodejs /app/src ./src/
COPY --from=builder --chown=nodejs:nodejs /app/frontend ./frontend/

# 调试：验证
RUN test -d /app/src || (echo "ERROR: runner /app/src 不存在！" && exit 1)
RUN test -d /app/frontend/app || (echo "ERROR: runner /app/frontend/app 不存在！" && exit 1)

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/health || exit 1

ENV NODE_OPTIONS="--max-old-space-size=512"
CMD ["node", "src/index.js"]
