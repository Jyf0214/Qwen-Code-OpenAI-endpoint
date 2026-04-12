/**
 * OpenAI 端点验证中间件
 * 支持标准的 OpenAI Authorization 头格式
 * Authorization: Bearer <api_secret>
 */
function verifyOpenAIEndpoint(req, res, next) {
  // 支持标准的 Authorization: Bearer 格式
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: {
        message: '未提供 API 密钥',
        type: 'unauthorized',
        code: 401,
        hint: '请在请求头中添加 Authorization: Bearer <api_secret>'
      }
    });
  }

  // 解析 Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: {
        message: '无效的授权格式',
        type: 'unauthorized',
        code: 401,
        hint: '请使用 Authorization: Bearer <api_secret> 格式'
      }
    });
  }

  const apiKey = parts[1];

  // 验证密钥
  if (apiKey !== process.env.API_SECRET) {
    return res.status(403).json({
      error: {
        message: 'API 密钥无效',
        type: 'forbidden',
        code: 403
      }
    });
  }

  // 验证通过
  next();
}

module.exports = {
  verifyOpenAIEndpoint
};
