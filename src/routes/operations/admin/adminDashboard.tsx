import React, { useState } from 'react'
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

const { Title, Text } = Typography
const { TabPane } = Tabs

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users')

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
              value={35}
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

        <TabPane
          tab={
            <span>
              <SettingOutlined />
              Settings
            </span>
          }
          key='settings'
        >
          <Card title='System Configuration'>
            <p>This section is under development.</p>
            <p>
              Here you will be able to manage system-wide settings, customize
              the platform appearance, and configure notifications.
            </p>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}
