const { PrismaClient } = require('@prisma/client');

// 创建全局 Prisma 实例
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 连接数据库并验证
async function connectAndVerify() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma 数据库连接成功');
    
    // 测试查询
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ 数据库查询测试通过');
  } catch (error) {
    console.error('❌ Prisma 数据库连接失败:', error.message);
    throw error;
  }
}

// 断开连接
async function disconnect() {
  await prisma.$disconnect();
  console.log('Prisma 连接已关闭');
}

module.exports = {
  prisma,
  connectAndVerify,
  disconnect
};
