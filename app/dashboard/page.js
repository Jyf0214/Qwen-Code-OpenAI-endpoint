'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Table, Button, Card, Statistic, Row, Col, Modal, Form, Input, message, Space, Tag, Descriptions, Layout } from 'antd'
import { PlusOutlined, ReloadOutlined, DeleteOutlined, PoweroffOutlined, CheckCircleOutlined, LogoutOutlined } from '@ant-design/icons'

const { Header, Content } = Layout

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, totalRequests: 0 })
  const [addModalVisible, setAddModalVisible] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([fetch('/api/accounts').then(r => r.json()), fetch('/api/accounts/stats').then(r => r.json())])
      if (a.success) setAccounts(a.data)
      if (s.success) setStats(s.data)
    } catch { message.error('加载失败') }
    finally { setLoading(false) }
  }

  const handleAdd = async (values) => {
    const res = await fetch('/api/accounts/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name }) })
    const data = await res.json()
    if (data.success) { message.success('授权流程已启动'); setAddModalVisible(false); loadData() }
    else message.error(data.message || '添加失败')
  }

  const handleCheckToken = async (id) => {
    const res = await fetch(`/api/accounts/${id}/check-token`, { method: 'POST' })
    const data = await res.json()
    if (data.success) { message.success('Token 获取成功'); loadData() }
    else message.error(data.message || '检查失败')
  }

  const handleRefreshToken = async (id) => {
    const res = await fetch(`/api/accounts/${id}/refresh`, { method: 'POST' })
    const data = await res.json()
    if (data.success) { message.success('Token 刷新成功'); loadData() }
    else message.error(data.message || '刷新失败')
  }

  const handleToggle = async (id) => {
    const res = await fetch(`/api/accounts/${id}/toggle`, { method: 'PATCH' })
    const data = await res.json()
    if (data.success) { message.success(data.data.message); loadData() }
  }

  const handleDelete = async (id) => {
    Modal.confirm({ title: '确认删除', content: '删除后不可恢复', onOk: async () => {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) { message.success('删除成功'); loadData() }
    }})
  }

  const handleResetTokens = async (id) => {
    Modal.confirm({ title: '清除 Token 使用数据', content: '将清除当前使用统计，保留总调用数', onOk: async () => {
      const res = await fetch(`/api/accounts/${id}/reset-tokens`, { method: 'POST' })
      const data = await res.json()
      if (data.success) { message.success(data.message); loadData() }
    }})
  }

  const handleLogout = async () => { await fetch('/api/auth/logout', { method: 'POST' }); message.success('已退出'); router.push('/login') }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name' },
    { title: '状态', dataIndex: 'status', render: (s) => { const m = { pending: 'gold', active: 'green', expired: 'red', error: 'red' }; const t = { pending: '待授权', active: '活跃', expired: '已过期', error: '错误' }; return <Tag color={m[s]}>{t[s]}</Tag> }},
    { title: 'Token', key: 'token', width: 180, render: (_, r) => (<div style={{ fontSize: 12 }}><div>输入: {r.tokenUsedInput?.toLocaleString() || 0}</div><div>输出: {r.tokenUsedOutput?.toLocaleString() || 0}</div><div>总计: {r.tokenUsedTotal?.toLocaleString() || 0}</div><div style={{ color: '#999' }}>Lifetime: {r.tokenLifetimeTotal?.toLocaleString() || 0}</div></div>) },
    { title: '请求数', dataIndex: 'requestCount', width: 80 },
    { title: '过期时间', dataIndex: 'expiresAt', render: (d) => d ? new Date(d).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'action', width: 300, render: (_, r) => (<Space wrap>
      {r.status === 'pending' && <Button size="small" onClick={() => handleCheckToken(r.id)}>检查 Token</Button>}
      {r.status === 'active' && <Button size="small" onClick={() => handleRefreshToken(r.id)}>刷新 Token</Button>}
      {(r.tokenUsedInput > 0 || r.tokenUsedOutput > 0) && <Button size="small" onClick={() => handleResetTokens(r.id)}>清除</Button>}
      <Button size="small" icon={r.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />} onClick={() => handleToggle(r.id)}>{r.isActive ? '停用' : '启用'}</Button>
      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r.id)}>删除</Button>
    </Space>) }
  ]

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>Qwen OpenAI</span>
        <Space><Button icon={<LogoutOutlined />} onClick={handleLogout}>退出</Button></Space>
      </Header>
      <Content style={{ padding: 24 }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}><Card><Statistic title="总账号数" value={stats.total} /></Card></Col>
          <Col span={6}><Card><Statistic title="活跃账号" value={stats.active} valueStyle={{ color: '#3f8600' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="过期账号" value={stats.expired} valueStyle={{ color: '#cf1322' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="总请求数" value={stats.totalRequests} /></Card></Col>
        </Row>
        <Card title="账号列表" extra={<Space><Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>添加</Button></Space>}>
          <Table columns={columns} dataSource={accounts} rowKey="id" loading={loading} pagination={false} />
        </Card>
        <Modal title="添加账号" open={addModalVisible} onCancel={() => setAddModalVisible(false)} footer={null}>
          <Form onFinish={handleAdd}><Form.Item name="name" rules={[{ required: true, message: '请输入账号名称' }]}><Input placeholder="输入账号名称" /></Form.Item><Form.Item><Button type="primary" htmlType="submit" block>发起授权</Button></Form.Item></Form>
        </Modal>
      </Content>
    </Layout>
  )
}
