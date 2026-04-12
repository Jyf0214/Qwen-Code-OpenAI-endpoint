FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app

# 1. 复制依赖并安装
COPY package*.json ./
RUN npm ci && npm cache clean --force

# 2. 复制所有代码
COPY . .

# 3. 生成 Prisma 客户端
RUN npx prisma generate

# 4. 构建
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# ==================== 运行阶段 ====================
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# 复制所有文件
COPY --from=builder --chown=nodejs:nodejs /app .

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/health || exit 1

ENV NODE_OPTIONS="--max-old-space-size=512"
CMD ["npx", "next", "start"]
