import { prisma } from './prisma.js'

export async function getAllAccounts() {
  return prisma.account.findMany({ orderBy: { id: 'asc' } })
}

export async function getActiveAccounts() {
  return prisma.account.findMany({
    where: { isActive: true, status: 'active' },
    orderBy: { id: 'asc' }
  })
}

export async function getAccountById(id) {
  if (!id) return null
  const numId = parseInt(id)
  if (isNaN(numId)) return null
  return prisma.account.findUnique({ where: { id: numId } })
}

export async function createAccount(data) {
  const account = await prisma.account.create({
    data: { ...data, status: 'pending' }
  })
  return account.id
}

export async function updateAccountTokens(id, data) {
  if (!id) throw new Error('缺少账号 ID')
  return prisma.account.update({
    where: { id: parseInt(id) },
    data: { ...data, status: 'active' }
  })
}

export async function updateAccountStatus(id, status) {
  if (!id) throw new Error('缺少账号 ID')
  return prisma.account.update({ where: { id: parseInt(id) }, data: { status } })
}

export async function deleteAccount(id) {
  if (!id) throw new Error('缺少账号 ID')
  return prisma.account.delete({ where: { id: parseInt(id) } })
}

export async function getNextAccount(lastId) {
  const now = new Date()
  if (!lastId) {
    return prisma.account.findFirst({
      where: { isActive: true, status: 'active', expiresAt: { gt: now } },
      orderBy: { id: 'asc' }
    })
  }
  let next = await prisma.account.findFirst({
    where: { isActive: true, status: 'active', expiresAt: { gt: now }, id: { gt: parseInt(lastId) } },
    orderBy: { id: 'asc' }
  })
  if (next) return next
  return prisma.account.findFirst({
    where: { isActive: true, status: 'active', expiresAt: { gt: now } },
    orderBy: { id: 'asc' }
  })
}

export async function getLeastUsedAccount() {
  const now = new Date()
  return prisma.account.findFirst({
    where: { isActive: true, status: 'active', expiresAt: { gt: now } },
    orderBy: [{ requestCount: 'asc' }, { lastUsedAt: 'asc' }]
  })
}

export async function incrementRequestCount(id) {
  if (!id) throw new Error('缺少账号 ID')
  return prisma.account.update({
    where: { id: parseInt(id) },
    data: { requestCount: { increment: 1 }, lastUsedAt: new Date() }
  })
}

export async function getExpiredAccounts() {
  const now = new Date()
  return prisma.account.findMany({
    where: { isActive: true, status: 'active', expiresAt: { lte: now } },
    orderBy: { id: 'asc' }
  })
}

export async function toggleAccountActive(id) {
  if (!id) throw new Error('缺少账号 ID')
  const account = await getAccountById(id)
  if (!account) throw new Error('账号不存在')
  return prisma.account.update({ where: { id: parseInt(id) }, data: { isActive: !account.isActive } })
}

export async function getStats() {
  const now = new Date()
  const [total, active, expired, totalRequests] = await Promise.all([
    prisma.account.count(),
    prisma.account.count({ where: { isActive: true, status: 'active' } }),
    prisma.account.count({
      where: {
        OR: [{ status: 'expired' }, { AND: [{ status: 'active' }, { expiresAt: { lte: now } }] }]
      }
    }),
    prisma.account.aggregate({ _sum: { requestCount: true } })
  ])
  return { total, active, expired, totalRequests: totalRequests._sum.requestCount || 0 }
}

export async function addTokenUsage(id, inputTokens, outputTokens, totalTokens) {
  if (!id) return
  return prisma.account.update({
    where: { id: parseInt(id) },
    data: {
      tokenUsedInput: { increment: inputTokens },
      tokenUsedOutput: { increment: outputTokens },
      tokenUsedTotal: { increment: totalTokens },
      tokenLifetimeTotal: { increment: BigInt(totalTokens) }
    }
  })
}

export async function resetTokenUsage(id) {
  if (!id) throw new Error('缺少账号 ID')
  return prisma.account.update({
    where: { id: parseInt(id) },
    data: { tokenUsedInput: 0, tokenUsedOutput: 0, tokenUsedTotal: 0 }
  })
}
