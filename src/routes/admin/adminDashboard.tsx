import React, { useState } from 'react';
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
  Tabs,
  Spin
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  SettingOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { UserManagement } from '@/components/user-management';
import { useFullIdentity } from '@/hooks/src/useFullIdentity';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const sampleForms = [
  { id: 1, name: 'Incubatee Application', submissions: 24, lastUpdated: '2023-10-15' },
  { id: 2, name: 'Quarterly Report', submissions: 18, lastUpdated: '2023-09-30' },
  { id: 3, name: 'Compliance Checklist', submissions: 35, lastUpdated: '2023-10-05' },
  { id: 4, name: 'Funding Request', submissions: 12, lastUpdated: '2023-10-12' }
];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const { user, loading } = useFullIdentity();

  if (loading) {
    return <Spin tip="Loading dashboard..." style={{ marginTop: 80 }} />;
  }

  if (!user?.companyCode) {
    return <Text type="danger">⚠️ No company code found for user.</Text>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Admin Dashboard</Title>
      <Text type="secondary">System administration and user management</Text>

      <Divider />

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Total Users" value={35} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Forms & Templates" value={12} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="System Configurations" value={8} prefix={<SettingOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Audit Logs" value={157} prefix={<FileSearchOutlined />} />
            <Text type="secondary">Last 30 days</Text>
          </Card>
        </Col>
      </Row>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        style={{ marginBottom: '16px' }}
      >
        <TabPane
          tab={
            <span>
              <UserOutlined />
              User Management
            </span>
          }
          key="users"
        >
          <Card>
            <UserManagement companyCode={user.companyCode} />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <FileTextOutlined />
              Forms & Templates
            </span>
          }
          key="forms"
        >
          <Card
            title="Forms & Templates"
            extra={
              <Button type="primary" icon={<FileTextOutlined />}>
                Create Form
              </Button>
            }
          >
            <List
              dataSource={sampleForms}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button key="edit" type="link">Edit</Button>,
                    <Button key="view" type="link">View Submissions</Button>
                  ]}
                >
                  <List.Item.Meta
                    title={item.name}
                    description={`Last updated: ${item.lastUpdated}`}
                  />
                  <div>
                    <Tag color="blue">{item.submissions} submissions</Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <SettingOutlined />
              Settings
            </span>
          }
          key="settings"
        >
          <Card title="System Configuration">
            <p>This section is under development.</p>
            <p>Here you will be able to manage system-wide settings, customize the platform appearance, and configure notifications.</p>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};
