'use client'

import { useState, useEffect } from 'react'
import { 
  Table, 
  Button, 
  Card, 
  Statistic, 
  Row, 
  Col, 
  Modal, 
  Form, 
  Input, 
  message, 
  Space, 
  Tag,
  Descriptions,
  Layout,
  Menu
} from 'antd'
import { 
  PlusOutlined, 
  ReloadOutlined, 
  DeleteOutlined, 
  PoweroffOutlined,
  CheckCircleOutlined,
  LogoutOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'

const { Sider, Content, Header } = Layout

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, totalRequests: 0 })
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [authInfo, setAuthInfo] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [accountsRes, statsRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/accounts/stats')
      ])

      const accountsData = await accountsRes.json()
      const statsData = await statsRes.json()

      if (accountsData.success) {
        setAccounts(accountsData.data)
      }
      if (statsData.success) {
        setStats(statsData.data)
      }
    } catch (error) {
      message.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddAccount = async (values) => {
    try {
      const res = await fetch('/api/accounts/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name })
      })

      const data = await res.json()

      if (data.success) {
        message.success('授权流程已启动，请在浏览器中完成授权')
        setAuthInfo(data.data)
        setAddModalVisible(false)
        loadData()
      } else {
        message.error(data.message || '添加失败')
      }
    } catch (error) {
      message.error('添加失败')
    }
  }

  const handleCheckToken = async (id) => {
    try {
      const res = await fetch(`/api/accounts/${id}/check-token`, {
        method: 'POST'
      })

      const data = await res.json()

      if (data.success) {
        message.success('Token 获取成功')
        loadData()
      } else {
        message.error(data.message || '检查失败')
      }
    } catch (error) {
      message.error('检查失败')
    }
  }

  const handleRefreshToken = async (id) => {
    try {
      const res = await fetch(`/api/accounts/${id}/refresh`, {
        method: 'POST'
      })

      const data = await res.json()

      if (data.success) {
        message.success('Token 刷新成功')
        loadData()
      } else {
        message.error(data.message || '刷新失败')
      }
    } catch (error) {
      message.error('刷新失败')
    }
  }

  const handleToggleAccount = async (id) => {
    try {
      const res = await fetch(`/api/accounts/${id}/toggle`, {
        method: 'PATCH'
      })

      const data = await res.json()

      if (data.success) {
        message.success(data.data.message)
        loadData()
      }
    } catch (error) {
      message.error('操作失败')
    }
  }

  const handleDeleteAccount = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除此账号吗？',
      onOk: async () => {
        try {
          const res = await fetch(`/api/accounts/${id}`, {
            method: 'DELETE'
          })

          const data = await res.json()

          if (data.success) {
            message.success('删除成功')
            loadData()
          }
        } catch (error) {
          message.error('删除失败')
        }
      }
    })
  }

  const handleResetTokenUsage = async (id) => {
    Modal.confirm({
      title: '清除 Token 使用数据',
      content: '将清除当前 token 使用统计（输入/输出/总计），但保留总调用数。确定继续？',
      onOk: async () => {
        try {
          const res = await fetch(`/api/accounts/${id}/reset-tokens`, {
            method: 'POST'
          })

          const data = await res.json()

          if (data.success) {
            message.success(data.message)
            loadData()
          } else {
            message.error(data.message || '清除失败')
          }
        } catch (error) {
          message.error('清除失败')
        }
      }
    })
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    message.success('已退出登录')
    router.push('/login')
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
    },
    {
      title: '名称',
      dataIndex: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status) => {
        const colorMap = { pending: 'gold', active: 'green', expired: 'red', error: 'red' }
        const textMap = { pending: '待授权', active: '活跃', expired: '已过期', error: '错误' }
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>
      }
    },
    {
      title: 'Token 使用',
      key: 'tokenUsage',
      width: 200,
      render: (_, record) => (
        <div style={{ fontSize: 12 }}>
          <div>输入: {record.tokenUsedInput?.toLocaleString() || 0}</div>
          <div>输出: {record.tokenUsedOutput?.toLocaleString() || 0}</div>
          <div>总计: {record.tokenUsedTotal?.toLocaleString() || 0}</div>
          <div style={{ color: '#999' }}>Lifetime: {record.tokenLifetimeTotal?.toLocaleString() || 0}</div>
        </div>
      )
    },
    {
      title: '请求数',
      dataIndex: 'requestCount',
      width: 80,
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      render: (date) => date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_, record) => (
        <Space wrap>
          {record.status === 'pending' && (
            <Button size="small" onClick={() => handleCheckToken(record.id)}>
              检查 Token
            </Button>
          )}
          {record.status === 'active' && (
            <Button size="small" onClick={() => handleRefreshToken(record.id)}>
              刷新 Token
            </Button>
          )}
          {(record.tokenUsedInput > 0 || record.tokenUsedOutput > 0) && (
            <Button size="small" onClick={() => handleResetTokenUsage(record.id)}>
              清除 Token
            </Button>
          )}
          <Button
            size="small"
            icon={record.isActive ? <PoweroffOutlined /> : <CheckCircleOutlined />}
            onClick={() => handleToggleAccount(record.id)}
          >
            {record.isActive ? '停用' : '启用'}
          </Button>
          <Button 
            size="small" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteAccount(record.id)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ color: 'white', margin: 0 }}>🤖 Qwen OpenAI 管理面板</h1>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          退出登录
        </Button>
      </Header>
      <Content style={{ padding: '2rem' }}>
        <Row gutter={[16, 16]} style={{ marginBottom: '2rem' }}>
          <Col span={6}>
            <Card>
              <Statistic title="总账号数" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="活跃账号" value={stats.active} valueStyle={{ color: '#3f8600' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="过期账号" value={stats.expired} valueStyle={{ color: '#cf1322' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="总请求数" value={stats.totalRequests} />
            </Card>
          </Col>
        </Row>

        <Card 
          title="账号列表" 
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData}>
                刷新
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                添加账号
              </Button>
            </Space>
          }
        >
          <Table 
            columns={columns} 
            dataSource={accounts} 
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>

        <Modal
          title="添加账号"
          open={addModalVisible}
          onCancel={() => setAddModalVisible(false)}
          footer={null}
        >
          <Form onFinish={handleAddAccount}>
            <Form.Item name="name" rules={[{ required: true, message: '请输入账号名称' }]}>
              <Input placeholder="输入账号名称" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block>
                发起授权
              </Button>
            </Form.Item>
          </Form>
        </Modal>

        {authInfo && (
          <Card title="授权信息" style={{ marginTop: 16 }}>
            <Descriptions column={1}>
              <Descriptions.Item label="用户码">{authInfo.userCode}</Descriptions.Item>
              <Descriptions.Item label="授权链接">
                <a href={authInfo.verificationUriComplete} target="_blank" rel="noopener noreferrer">
                  {authInfo.verificationUriComplete}
                </a>
              </Descriptions.Item>
              <Descriptions.Item label="剩余时间">{authInfo.expiresIn} 秒</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Content>
    </Layout>
  )
}
