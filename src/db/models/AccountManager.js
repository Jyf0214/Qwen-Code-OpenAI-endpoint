const { prisma } = require('./prismaClient');

class AccountManager {
  // 获取所有账号
  static async getAllAccounts() {
    return await prisma.account.findMany({
      orderBy: { id: 'asc' }
    });
  }

  // 获取活跃的账号
  static async getActiveAccounts() {
    return await prisma.account.findMany({
      where: {
        isActive: true,
        status: 'active'
      },
      orderBy: { id: 'asc' }
    });
  }

  // 根据ID获取账号
  static async getAccountById(id) {
    return await prisma.account.findUnique({
      where: { id: parseInt(id) }
    });
  }

  // 创建新账号记录
  static async createAccount({ name, deviceCode, userCode, verificationUri, verificationUriComplete, pkceVerifier, pkceChallenge }) {
    const account = await prisma.account.create({
      data: {
        name,
        deviceCode,
        userCode,
        verificationUri,
        verificationUriComplete,
        pkceVerifier,
        pkceChallenge,
        status: 'pending'
      }
    });
    return account.id;
  }

  // 更新账号的 token 信息
  static async updateAccountTokens(id, { accessToken, refreshToken, tokenType, expiresAt, scope }) {
    await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        accessToken,
        refreshToken,
        tokenType,
        expiresAt: new Date(expiresAt),
        scope,
        status: 'active'
      }
    });
  }

  // 更新账号状态
  static async updateAccountStatus(id, status) {
    await prisma.account.update({
      where: { id: parseInt(id) },
      data: { status }
    });
  }

  // 删除账号
  static async deleteAccount(id) {
    await prisma.account.delete({
      where: { id: parseInt(id) }
    });
  }

  // 获取用于轮询的下一个账号
  static async getNextAccountForPollen(lastAccountId = null) {
    const now = new Date();
    
    if (!lastAccountId) {
      // 获取第一个活跃账号
      return await prisma.account.findFirst({
        where: {
          isActive: true,
          status: 'active',
          expiresAt: { gt: now }
        },
        orderBy: { id: 'asc' }
      });
    }

    // 获取下一个账号（ID 大于当前账号的最小 ID）
    let nextAccount = await prisma.account.findFirst({
      where: {
        isActive: true,
        status: 'active',
        expiresAt: { gt: now },
        id: { gt: parseInt(lastAccountId) }
      },
      orderBy: { id: 'asc' }
    });

    if (nextAccount) return nextAccount;

    // 如果没有，则循环回到第一个
    return await prisma.account.findFirst({
      where: {
        isActive: true,
        status: 'active',
        expiresAt: { gt: now }
      },
      orderBy: { id: 'asc' }
    });
  }

  // 获取使用最少的账号（least-used 策略）
  static async getLeastUsedAccount() {
    const now = new Date();
    
    return await prisma.account.findFirst({
      where: {
        isActive: true,
        status: 'active',
        expiresAt: { gt: now }
      },
      orderBy: [
        { requestCount: 'asc' },
        { lastUsedAt: 'asc' }
      ]
    });
  }

  // 更新账号使用统计
  static async incrementRequestCount(id) {
    await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        requestCount: { increment: 1 },
        lastUsedAt: new Date()
      }
    });
  }

  // 检查 token 是否过期
  static async getExpiredAccounts() {
    const now = new Date();
    
    return await prisma.account.findMany({
      where: {
        isActive: true,
        status: 'active',
        expiresAt: { lte: now }
      },
      orderBy: { id: 'asc' }
    });
  }

  // 更新账号的 PKCE 信息
  static async updateAccountPKCE(id, { pkceVerifier, pkceChallenge }) {
    await prisma.account.update({
      where: { id: parseInt(id) },
      data: {
        pkceVerifier,
        pkceChallenge
      }
    });
  }

  // 切换账号激活状态
  static async toggleAccountActive(id) {
    const account = await this.getAccountById(id);
    if (!account) {
      throw new Error('账号不存在');
    }
    
    const newStatus = !account.isActive;
    await prisma.account.update({
      where: { id: parseInt(id) },
      data: { isActive: newStatus }
    });
    return newStatus;
  }

  // 获取统计信息
  static async getStats() {
    const now = new Date();
    
    const [total, active, expired, totalRequests] = await Promise.all([
      prisma.account.count(),
      prisma.account.count({
        where: {
          isActive: true,
          status: 'active'
        }
      }),
      prisma.account.count({
        where: {
          OR: [
            { status: 'expired' },
            {
              AND: [
                { status: 'active' },
                { expiresAt: { lte: now } }
              ]
            }
          ]
        }
      }),
      prisma.account.aggregate({
        _sum: { requestCount: true }
      })
    ]);

    return {
      total,
      active,
      expired,
      totalRequests: totalRequests._sum.requestCount || 0
    };
  }
}

module.exports = AccountManager;
