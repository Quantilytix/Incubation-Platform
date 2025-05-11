import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Layout, Card, Row, Col, Button } from 'antd'
import {
  RocketOutlined,
  TeamOutlined,
  LineChartOutlined,
  UserAddOutlined,
  LoginOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography
const { Content } = Layout

const roleFeatures = {
  sme: {
    title: 'Small & Medium Enterprises (SMEs)',
    highlight: 'Are you an SME looking for incubation programs?',
    color: '#1890ff',
    icon: <RocketOutlined />,
    features: [
      { icon: <RocketOutlined />, text: 'AI-matched funding opportunities' },
      { icon: <TeamOutlined />, text: 'Smart mentorship scheduling' },
      { icon: <LineChartOutlined />, text: 'Real-time performance insights' }
    ]
  },
  incubate: {
    title: 'Incubate Implementors',
    highlight: 'Accelerate your incubation impact with AI-driven tools.',
    color: '#52c41a',
    icon: <TeamOutlined />,
    features: [
      { icon: <LineChartOutlined />, text: 'Automated progress tracking' },
      { icon: <UserAddOutlined />, text: 'AI-based mentee matching' },
      { icon: <RocketOutlined />, text: 'Program analytics dashboard' }
    ]
  },
  government: {
    title: 'Government Stakeholders',
    highlight: 'Leverage data to guide policy and support incubators.',
    color: '#faad14',
    icon: <LineChartOutlined />,
    features: [
      { icon: <RocketOutlined />, text: 'AI-informed impact reports' },
      { icon: <TeamOutlined />, text: 'Policy planning support tools' },
      { icon: <UserAddOutlined />, text: 'Stakeholder collaboration mapping' }
    ]
  },
  investor: {
    title: 'Investors & Funders',
    highlight: 'Connect with high-potential ventures and incubators.',
    color: '#722ed1',
    icon: <LineChartOutlined />,
    features: [
      {
        icon: <LineChartOutlined />,
        text: 'Access curated incubatee pipelines'
      },
      { icon: <RocketOutlined />, text: 'Portfolio performance tracking' },
      { icon: <UserAddOutlined />, text: 'Co-investment & impact analytics' }
    ]
  }
}

const RoleDetailPage = () => {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const role = roleFeatures[roleId]

  if (!role) {
    return <Paragraph>Role not found</Paragraph>
  }

  return (
    <Content
      style={{
        padding: '40px 20px',
        minHeight: '100vh',
        background: `url("/assets/images/wave-bg.gif")`
      }}
    >
      <Card
        style={{
          maxWidth: 900,
          margin: 'auto',
          borderRadius: 12,
          border: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}
        bodyStyle={{ padding: 32 }}
      >
        {/* Back Button */}
        <Button
          type='link'
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 20 }}
        >
          Back
        </Button>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{ fontSize: 50, color: role.color }}>{role.icon}</div>
          <Title level={2}>{role.title}</Title>
          <Paragraph type='secondary'>{role.highlight}</Paragraph>
        </div>

        <Row gutter={[16, 16]}>
          {role.features.map((feature, index) => (
            <Col xs={24} sm={12} key={index}>
              <Card
                hoverable
                style={{
                  background: '#fff',
                  borderRadius: 8,
                  textAlign: 'center',
                  minHeight: 100
                }}
              >
                <div
                  style={{ fontSize: 30, color: role.color, marginBottom: 10 }}
                >
                  {feature.icon}
                </div>
                <Text strong>{feature.text}</Text>
              </Card>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <Button
            type='primary'
            icon={<UserAddOutlined />}
            size='large'
            style={{ marginRight: 16 }}
            onClick={() => navigate(`/registration?role=${roleId}`)}
          >
            Register
          </Button>
          <Button
            icon={<LoginOutlined />}
            size='large'
            onClick={() => navigate('/login')}
          >
            Login
          </Button>
        </div>
      </Card>
    </Content>
  )
}

export default RoleDetailPage
