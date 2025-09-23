import React, { useState } from 'react'
import {
  Card,
  Tabs,
  Button,
  Typography,
  Space,
  Divider,
  Row,
  Col,
  Statistic,
  Badge,
  Menu,
  Dropdown
} from 'antd'
import {
  FormOutlined,
  FileTextOutlined,
  UserOutlined,
  DownOutlined,
  PlusOutlined,
  AreaChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import FormBuilder from '@/components/form-builder/FormBuilder'
import FormResponseViewer from '@/components/form-response-viewer/FormResponseViewer'
import { useGetIdentity } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'

const { Title, Text } = Typography
const { TabPane } = Tabs

interface UserIdentity {
  id?: string
  name?: string
  email?: string
  role?: string
  avatar?: string
}

interface FormStatistics {
  totalForms: number
  publishedForms: number
  draftForms: number
  totalSubmissions: number
  pendingSubmissions: number
  approvedSubmissions: number
  rejectedSubmissions: number
}

const FormManagement: React.FC = () => {
  const { data: user } = useGetIdentity<UserIdentity>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('forms')

  // Mock statistics - in a real app, these would come from the database
  const statistics: FormStatistics = {
    totalForms: 12,
    publishedForms: 8,
    draftForms: 4,
    totalSubmissions: 143,
    pendingSubmissions: 15,
    approvedSubmissions: 112,
    rejectedSubmissions: 16
  }

  // Check if user is admin or director
  const isAdmin = user?.role === 'Admin' || user?.role === 'Director'

  if (!isAdmin) {
    return (
      <Card>
        <Title level={4}>Access Denied</Title>
        <Text>
          You don't have permission to access the form management section.
          Please contact an administrator if you believe this is an error.
        </Text>
      </Card>
    )
  }

  // Template creation menu
  const createTemplateMenu = (
    <Menu>
      <Menu.Item key='1'>Application Form</Menu.Item>
      <Menu.Item key='2'>Compliance Checklist</Menu.Item>
      <Menu.Item key='3'>Progress Report</Menu.Item>
      <Menu.Item key='4'>Feedback Form</Menu.Item>
      <Menu.Item key='5'>Evaluation Form</Menu.Item>
      <Menu.Item key='6'>Due Diligence</Menu.Item>
      <Menu.Item key='7'>Blank Template</Menu.Item>
    </Menu>
  )

  const handleCreateTemplate = () => {
    setActiveTab('builder')
  }

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={3}>Form Management</Title>
        <Text type='secondary'>
          Create, manage, and analyze form templates and submissions
        </Text>

        <Divider />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Total Forms'
                value={statistics.totalForms}
                prefix={<FormOutlined />}
              />
              <div style={{ marginTop: 8 }}>
                <Badge
                  status='success'
                  text={`${statistics.publishedForms} Published`}
                />
                <br />
                <Badge
                  status='warning'
                  text={`${statistics.draftForms} Drafts`}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Total Submissions'
                value={statistics.totalSubmissions}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title='Pending'
                value={statistics.pendingSubmissions}
                valueStyle={{ color: '#faad14' }}
                prefix={<ClockCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title='Approved'
                value={statistics.approvedSubmissions}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={4}>
            <Card>
              <Statistic
                title='Rejected'
                value={statistics.rejectedSubmissions}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between'
        }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ flex: 1 }}>
          <TabPane
            tab={
              <span>
                <FormOutlined />
                Form Templates
              </span>
            }
            key='forms'
          />
          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                Submissions
              </span>
            }
            key='submissions'
          />
          <TabPane
            tab={
              <span>
                <AreaChartOutlined />
                Analytics
              </span>
            }
            key='analytics'
          />
          <TabPane
            tab={
              <span>
                <FormOutlined />
                Form Builder
              </span>
            }
            key='builder'
          />
        </Tabs>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Dropdown overlay={createTemplateMenu} trigger={['click']}>
            <Button
              type='primary'
              icon={<PlusOutlined />}
              onClick={handleCreateTemplate}
            >
              Create Template <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </div>

      {activeTab === 'forms' && (
        <Card>
          <FormBuilder />
        </Card>
      )}

      {activeTab === 'submissions' && (
        <Card>
          <FormResponseViewer />
        </Card>
      )}

      {activeTab === 'analytics' && (
        <Card>
          <Title level={4}>Form Analytics</Title>
          <Text type='secondary'>
            Coming soon: Advanced analytics and reporting for form submissions
          </Text>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <img
              src='/placeholder-chart.png'
              alt='Analytics Chart Placeholder'
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        </Card>
      )}

      {activeTab === 'builder' && (
        <Card>
          <FormBuilder />
        </Card>
      )}
    </div>
  )
}

export default FormManagement
