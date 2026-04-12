'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons'

export default function RegisterPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onFinish = async (values) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: values.username, password: values.password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        message.success('注册成功')
        router.push('/dashboard')
      } else {
        message.error(data.message || '注册失败')
      }
    } catch {
      message.error('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card title="创建管理员账户" style={{ width: 360 }}>
        <p style={{ color: '#999', marginBottom: 16, fontSize: 14 }}>首次访问，请创建您的管理员账户</p>
        <Form name="register" onFinish={onFinish} size="large" layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }, { min: 2, message: '至少 2 个字符' }]}>
            <Input prefix={<UserOutlined />} placeholder="输入用户名" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 个字符' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="输入密码" />
          </Form.Item>
          <Form.Item name="confirmPassword" label="确认密码" rules={[{ required: true, message: '请再次输入密码' }, ({ getFieldValue }) => ({ validator(_, value) { if (!value || getFieldValue('password') === value) return Promise.resolve(); return Promise.reject(new Error('密码不一致')) } })]}>
            <Input.Password prefix={<SafetyOutlined />} placeholder="再次输入密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              创建账户
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
