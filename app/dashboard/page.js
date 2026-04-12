'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Card, Statistic, Row, Col, Modal, Form, Input, message, Space, Tag, Layout } from 'antd'
import { PlusOutlined, ReloadOutlined, DeleteOutlined, PoweroffOutlined, CheckCircleOutlined, LogoutOutlined } from '@ant-design/icons'

const { Header, Content } = Layout
const statusMap = { pending: { color: 'gold', text: '待授权' }, active: { color: 'green', text: '活跃' }, expired: { color: 'red', text: '已过期' }, error: { color: 'red', text: '错误' } }

const safeJson = async (res) => {
  if (!res || !res.json) return { success: false, message: '无响应' }
  try { return await res.json() }
  catch { return { success: false, message: '服务器响应格式错误' } }
}

const apiCall = async (url, options) => {
  try {
    const res = await fetch(url, options)
    const data = await safeJson(res)
    return { ok: res.ok, status: res.status, data }
  } catch (err) {
    return { ok: false, status: 0, data: { success: false, message: `网络连接失败: ${err.message}` } }
  }
}

const columns = [
  { title: '名称', dataIndex: 'name', ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 80, render: (s) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag> },
  { title: 'Token', key: 'token', render: (_, r) => (<div style={{ fontSize: 12 }}><div>输入: {r.tokenUsedInput?.toLocaleString() || 0}</div><div>输出: {r.tokenUsedOutput?.toLocaleString() || 0}</div><div>总计: {r.tokenUsedTotal?.toLocaleString() || 0}</div><div style={{ color: '#999' }}>Lifetime: {r.tokenLifetimeTotal?.toLocaleString() || 0}</div></div>) },
  { title: '请求数', dataIndex: 'requestCount', width: 80 },
  { title: '操作', key: 'action', render: (_, r, actions) => (<Space wrap>
    {r.status === 'pending' && <Button size="small" onClick={() => actions.onCheckToken(r.id)}>检查</Button>}
    {r.status === 'active' && <Button size="small" onClick={() => actions.onRefresh(r.id)}>刷新</Button>}
    {(r.tokenUsedInput > 0 || r.tokenUsedOutput > 0) && <Button size="small" onClick={() => actions.onReset(r.id)}>清除</Button>}
    <Button size="small" icon={r.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />} onClick={() => actions.onToggle(r.id)}>{r.isActive ? '停用' : '启用'}</Button>
    <Button size="small" danger icon={<DeleteOutlined />} onClick={() => actions.onDelete(r.id)}>删除</Button>
  </Space>) }
]

const mobileColumns = [
  { title: '名称', dataIndex: 'name' },
  { title: '状态', dataIndex: 'status', render: (s) => <Tag color={statusMap[s]?.color}>{statusMap[s]?.text}</Tag> },
  { title: 'Token', key: 'token', render: (_, r) => (<div style={{ fontSize: 11 }}><div>总计: {r.tokenUsedTotal?.toLocaleString() || 0}</div><div style={{ color: '#999' }}>Lifetime: {r.tokenLifetimeTotal?.toLocaleString() || 0}</div></div>) },
  { title: '操作', key: 'action', render: (_, r, actions) => (<Space direction="vertical" size="small">
    {r.status === 'pending' && <Button size="small" block onClick={() => actions.onCheckToken(r.id)}>检查 Token</Button>}
    {r.status === 'active' && <Button size="small" block onClick={() => actions.onRefresh(r.id)}>刷新 Token</Button>}
    {(r.tokenUsedInput > 0 || r.tokenUsedOutput > 0) && <Button size="small" block onClick={() => actions.onReset(r.id)}>清除使用量</Button>}
    <Button size="small" block icon={r.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />} onClick={() => actions.onToggle(r.id)}>{r.isActive ? '停用' : '启用'}</Button>
    <Button size="small" danger block onClick={() => actions.onDelete(r.id)}>删除</Button>
  </Space>) }
]

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, totalRequests: 0 })
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    loadData()
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([apiCall('/api/accounts'), apiCall('/api/accounts/stats')])
      if (a.data?.success) setAccounts(a.data.data || [])
      else message.error(`加载账号列表失败: ${a.data?.message || '未知错误'}`)
      if (s.data?.success) setStats(s.data.data || { total: 0, active: 0, expired: 0, totalRequests: 0 })
      else message.error(`加载统计失败: ${s.data?.message || '未知错误'}`)
    } catch (err) { message.error(`加载失败: ${err.message}`) }
    finally { setLoading(false) }
  }

  const handleAdd = async (values) => {
    try {
      const res = await apiCall('/api/accounts/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name }) })
      if (res.ok && res.data?.success) { message.success('授权流程已启动，请在浏览器中完成授权'); setAddModalVisible(false); loadData() }
      else message.error(`添加失败: ${res.data?.message || '未知错误'}`)
    } catch (err) { message.error(`添加失败: ${err.message}`) }
  }

  const handleCheckToken = async (id) => {
    try {
      const res = await apiCall(`/api/accounts/${id}/check-token`, { method: 'POST' })
      if (res.ok && res.data?.success) { message.success('Token 获取成功'); loadData() }
      else message.error(`检查失败: ${res.data?.message || '未知错误'}`)
    } catch (err) { message.error(`检查失败: ${err.message}`) }
  }

  const handleRefreshToken = async (id) => {
    try {
      const res = await apiCall(`/api/accounts/${id}/refresh`, { method: 'POST' })
      if (res.ok && res.data?.success) { message.success('Token 刷新成功'); loadData() }
      else if (res.data?.needReauth) message.error('Refresh Token 已失效，请删除后重新添加账号')
      else message.error(`刷新失败: ${res.data?.message || '未知错误'}`)
    } catch (err) { message.error(`刷新失败: ${err.message}`) }
  }

  const handleToggle = async (id) => {
    try {
      const res = await apiCall(`/api/accounts/${id}/toggle`, { method: 'PATCH' })
      if (res.ok && res.data?.success) { message.success(res.data.data?.message); loadData() }
      else message.error(`操作失败: ${res.data?.message || '未知错误'}`)
    } catch (err) { message.error(`操作失败: ${err.message}`) }
  }

  const handleDelete = async (id) => {
    Modal.confirm({ title: '确认删除', content: '删除后不可恢复', okText: '删除', okType: 'danger', cancelText: '取消', onOk: async () => {
      try {
        const res = await apiCall(`/api/accounts/${id}`, { method: 'DELETE' })
        if (res.ok && res.data?.success) { message.success('删除成功'); loadData() }
        else message.error(`删除失败: ${res.data?.message || '未知错误'}`)
      } catch (err) { message.error(`删除失败: ${err.message}`) }
    }})
  }

  const handleResetTokens = async (id) => {
    Modal.confirm({ title: '清除 Token 使用数据', content: '将清除当前使用统计（输入/输出/总计），但保留总调用数。确定继续？', onOk: async () => {
      try {
        const res = await apiCall(`/api/accounts/${id}`, { method: 'POST' })
        if (res.ok && res.data?.success) { message.success(res.data.message); loadData() }
        else message.error(`清除失败: ${res.data?.message || '未知错误'}`)
      } catch (err) { message.error(`清除失败: ${err.message}`) }
    }})
  }

  const handleLogout = async () => { try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {} message.success('已退出'); router.push('/login') }

  const actionHandlers = { onCheckToken: handleCheckToken, onRefresh: handleRefreshToken, onToggle: handleToggle, onDelete: handleDelete, onReset: handleResetTokens }

  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 24px' }}>
        <span style={{ fontSize: isMobile ? 16 : 18, fontWeight: 600 }}>Qwen OpenAI</span>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>{isMobile ? '' : '退出'}</Button>
      </Header>
      <Content style={{ padding: isMobile ? 16 : 24 }}>
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="总账号" value={stats.total} valueStyle={{ fontSize: isMobile ? 20 : 24 }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="活跃" value={stats.active} valueStyle={{ color: '#3f8600', fontSize: isMobile ? 20 : 24 }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="过期" value={stats.expired} valueStyle={{ color: '#cf1322', fontSize: isMobile ? 20 : 24 }} /></Card></Col>
          <Col xs={12} sm={6}><Card size="small"><Statistic title="请求" value={stats.totalRequests} valueStyle={{ fontSize: isMobile ? 20 : 24 }} /></Card></Col>
        </Row>
        <Card title="账号列表" extra={<Space><Button icon={<ReloadOutlined />} onClick={loadData}>{isMobile ? '' : '刷新'}</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>{isMobile ? '' : '添加'}</Button></Space>} size={isMobile ? 'small' : 'default'}>
          <Table columns={isMobile ? mobileColumns : columns} dataSource={accounts} rowKey="id" loading={loading} pagination={false} size={isMobile ? 'small' : 'middle'} />
        </Card>
        <Modal title="添加账号" open={addModalVisible} onCancel={() => setAddModalVisible(false)} footer={null}>
          <Form onFinish={handleAdd}><Form.Item name="name" rules={[{ required: true, message: '请输入账号名称' }]}><Input placeholder="输入账号名称" /></Form.Item><Form.Item><Button type="primary" htmlType="submit" block>发起授权</Button></Form.Item></Form>
        </Modal>
      </Content>
    </Layout>
  )
}
