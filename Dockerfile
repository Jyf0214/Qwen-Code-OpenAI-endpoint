# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl
WORKDIR /app

# 1. 复制依赖文件并安装
COPY package*.json ./
COPY frontend/package.json ./frontend/
RUN npm ci --omit=dev && npm cache clean --force

# 2. 复制所有源代码
COPY frontend ./frontend/
COPY prisma ./prisma/
COPY src ./src/

# 3. 生成 Prisma 客户端到根 node_modules
RUN npx prisma generate

# 4. 将包含已生成 Prisma Client 的 node_modules 复制到 frontend
RUN cp -r node_modules frontend/node_modules

# 5. 构建前端
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN cd frontend && npm run build

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

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/system/health || exit 1

ENV NODE_OPTIONS="--max-old-space-size=512"
CMD ["node", "src/index.js"]
