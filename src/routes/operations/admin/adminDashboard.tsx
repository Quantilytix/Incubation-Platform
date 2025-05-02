import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Space,
  Divider,
  Button,
  Tabs
} from 'antd'
import {
  UserOutlined,
  FileTextOutlined,
  SettingOutlined,
  FileSearchOutlined,
  UserAddOutlined
} from '@ant-design/icons'
import { UserManagement } from '@/components/user-management'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase'

const { Title, Text } = Typography
const { TabPane } = Tabs

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users')
  const [userCount, setUserCount] = useState<number>(0)

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), snapshot => {
      setUserCount(snapshot.size)
    })

    return () => unsubscribe() // 🧹 cleanup when component unmounts
  }, [])

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Admin Dashboard</Title>
      <Text type='secondary'>System administration and user management</Text>

      <Divider />

      {/* Stats Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic
              title='Total Users'
              value={userCount}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type='card'
        size='large'
        style={{ marginBottom: '16px' }}
      >
        <TabPane
          tab={
            <span>
              <UserOutlined />
              User Management
            </span>
          }
          key='users'
        >
          <Card>
            <UserManagement />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}
