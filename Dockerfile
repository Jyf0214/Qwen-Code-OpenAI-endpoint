# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY frontend/package.json ./frontend/

# 调试：验证文件已复制
RUN ls -la /app && ls -la /app/frontend

# 仅安装 production 依赖，减少内存占用
RUN npm ci --omit=dev && npm cache clean --force

# 创建前端 node_modules 软链接
RUN ln -sf ../node_modules /app/frontend/node_modules

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma/
RUN ls -la /app/prisma
RUN npx prisma generate

# 复制前端和后端源代码
COPY frontend ./frontend/
COPY src ./src/

# 调试：验证源代码已复制
RUN echo "=== 验证 frontend/app 目录 ===" && ls -la /app/frontend/app && echo "=== 验证 src 目录 ===" && ls -la /app/src
RUN test -d /app/src || (echo "ERROR: /app/src 不存在！构建失败" && exit 1)
RUN test -d /app/frontend/app || (echo "ERROR: /app/frontend/app 不存在！构建失败" && exit 1)

ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN cd frontend && npm run build

# 调试：验证构建产物
RUN echo "=== 验证 frontend/.next 目录 ===" && ls -la /app/frontend/.next

# ==================== 运行阶段 ====================
FROM node:22-alpine AS runner

# 仅安装运行时需要
RUN apk add --no-cache openssl

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制生产依赖
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma/
COPY --from=builder --chown=nodejs:nodejs /app/src ./src/

# 复制 Next.js 构建产物和源代码（Next.js 需要 app 目录）
COPY --from=builder --chown=nodejs:nodejs /app/frontend ./frontend/

# 调试：验证运行阶段文件
RUN echo "=== 验证 runner /app/src ===" && ls -la /app/src
RUN echo "=== 验证 runner /app/frontend ===" && ls -la /app/frontend
RUN test -d /app/src || (echo "ERROR: runner /app/src 不存在！" && exit 1)
RUN test -d /app/frontend/app || (echo "ERROR: runner /app/frontend/app 不存在！" && exit 1)

USER nodejs

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/health || exit 1

# 限制 Node.js 内存使用，防止 OOM
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "src/index.js"]
