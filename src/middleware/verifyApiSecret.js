/**
 * API Secret 验证中间件
 * 用于管理面板和管理 API 的验证
 */
function verifyApiSecret(req, res, next) {
  // 跳过健康检查端点
  if (req.path === '/health') {
    return next();
  }

  // 从 Header 或 Query 获取 secret
  const secret = req.headers['x-api-secret'] || req.query.api_secret;

  if (!secret) {
    return res.status(401).json({
      success: false,
      message: '未提供 API 密钥',
      error: {
        type: 'unauthorized',
        code: 401,
        hint: '请在请求头中添加 X-API-Secret 或在查询参数中添加 api_secret'
      }
    });
  }

  // 验证密钥
  if (secret !== process.env.API_SECRET) {
    return res.status(403).json({
      success: false,
      message: 'API 密钥无效',
      error: {
        type: 'forbidden',
        code: 403
      }
    });
  }

  // 验证通过
  next();
}

module.exports = {
  verifyApiSecret
};
