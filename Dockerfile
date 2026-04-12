# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder

# 安装构建依赖
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY frontend/package.json ./frontend/

# 仅安装 production 依赖，减少内存占用
RUN npm ci --omit=dev && npm cache clean --force

# 创建前端 node_modules 软链接
RUN ln -sf ../node_modules /app/frontend/node_modules

# 复制 Prisma schema 并生成客户端
COPY prisma ./prisma/
RUN npx prisma generate

# 复制前端代码并构建
COPY frontend ./frontend/
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN cd frontend && npm run build

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

# 复制 Next.js 构建产物
COPY --from=builder --chown=nodejs:nodejs /app/frontend/dist ./frontend/dist/
COPY --from=builder --chown=nodejs:nodejs /app/frontend/next.config.js ./frontend/
COPY --from=builder --chown=nodejs:nodejs /app/frontend/.next ./frontend/.next/
COPY --from=builder --chown=nodejs:nodejs /app/frontend/package.json ./frontend/

USER nodejs

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/health || exit 1

# 限制 Node.js 内存使用，防止 OOM
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "src/index.js"]
