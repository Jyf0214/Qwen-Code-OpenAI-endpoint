/**
 * Web UI 访问控制中间件
 * 当 WEB_UI_ENABLED=false 时，禁止访问管理面板和 API 路由
 * 仅允许 OpenAI 兼容端点（/v1/）
 */
function checkWebUIEnabled(req, res, next) {
  const enabled = process.env.WEB_UI_ENABLED !== 'false'

  if (!enabled) {
    return res.status(403).json({
      success: false,
      message: 'Web 管理面板已禁用',
      error: {
        type: 'forbidden',
        code: 403
      }
    })
  }

  next()
}

module.exports = {
  checkWebUIEnabled
}
