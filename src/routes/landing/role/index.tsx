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
import { Helmet } from 'react-helmet' // ✅ Helmet imported
import './RoleDetailPage.css'

const { Title, Paragraph, Text } = Typography
const { Content } = Layout

const roleFeatures = {
  sme: {
    title: 'Small & Medium Enterprises (SMEs)',
    highlight: 'Are you an SME looking for incubation programs?',
    color: '#1890ff',
    icon: <RocketOutlined />,
    features: [
      {
        icon: <RocketOutlined />,
        text: 'AI-matched funding opportunities',
        desc: 'Smart algorithms match your needs with suitable funders.'
      },
      {
        icon: <TeamOutlined />,
        text: 'Smart mentorship scheduling',
        desc: 'Book and manage mentor sessions efficiently.'
      },
      {
        icon: <LineChartOutlined />,
        text: 'Real-time performance insights',
        desc: 'Visualize progress and key performance indicators.'
      }
    ]
  },
  incubate: {
    title: 'Incubate Implementors',
    highlight: 'Accelerate your incubation impact with AI-driven tools.',
    color: '#52c41a',
    icon: <TeamOutlined />,
    features: [
      {
        icon: <LineChartOutlined />,
        text: 'Automated progress tracking',
        desc: 'Monitor incubatee performance with zero overhead.'
      },
      {
        icon: <UserAddOutlined />,
        text: 'AI-based mentee matching',
        desc: 'Get intelligent mentee/mentor recommendations.'
      },
      {
        icon: <RocketOutlined />,
        text: 'Program analytics dashboard',
        desc: 'View and export aggregated analytics.'
      }
    ]
  },
  government: {
    title: 'Government Stakeholders',
    highlight: 'Leverage data to guide policy and support incubators.',
    color: '#faad14',
    icon: <LineChartOutlined />,
    features: [
      {
        icon: <RocketOutlined />,
        text: 'AI-informed impact reports',
        desc: 'Data-driven summaries for transparency and impact.'
      },
      {
        icon: <TeamOutlined />,
        text: 'Policy planning support tools',
        desc: 'Insights for shaping regional innovation policy.'
      },
      {
        icon: <UserAddOutlined />,
        text: 'Stakeholder collaboration mapping',
        desc: 'Understand your ecosystem and partners.'
      }
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
        text: 'Access curated incubatee pipelines',
        desc: 'Only verified and matched profiles are shown.'
      },
      {
        icon: <RocketOutlined />,
        text: 'Portfolio performance tracking',
        desc: 'Follow your impact and metrics in one view.'
      },
      {
        icon: <UserAddOutlined />,
        text: 'Co-investment & impact analytics',
        desc: 'Leverage insights for smarter funding decisions.'
      }
    ]
  }
}

const RoleDetailPage = () => {
  const { roleId } = useParams()
  const navigate = useNavigate()
  const role = roleFeatures[roleId as keyof typeof roleFeatures]

  if (!role) return <Paragraph>Role not found</Paragraph>

  return (
    <Content
      style={{
        padding: '40px 20px',
        minHeight: '100vh',
        background: '#f5f7fa',
        color: '#000',
        position: 'relative'
      }}
    >
      {/* ✅ Helmet with dynamic title/description */}
      <Helmet>
        <title>{role.title} | Smart Incubation Platform</title>
        <meta
          name='description'
          content={`Explore features and tools tailored for ${role.title}.`}
        />
      </Helmet>

      <Card
        style={{
          maxWidth: 1100,
          margin: 'auto',
          borderRadius: 16,
          border: 'none',
          background: '#fff',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
        }}
        bodyStyle={{ padding: 32 }}
      >
        <Button
          type='link'
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ marginBottom: 20, color: '#999' }}
        >
          Back
        </Button>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, color: role.color }}>{role.icon}</div>
          <Title level={2} style={{ color: '#000', marginBottom: 4 }}>
            {role.title}
          </Title>
          <Paragraph style={{ color: '#000' }}>{role.highlight}</Paragraph>
        </div>

        <Row gutter={[16, 16]} justify='center'>
          {role.features.map((feature, index) => (
            <Col xs={24} sm={12} md={8} key={index}>
              <div className='role-hover-card'>
                <Card
                  hoverable
                  className='role-card'
                  bodyStyle={{
                    textAlign: 'center',
                    padding: '24px',
                    minHeight: 180
                  }}
                >
                  <div
                    style={{
                      fontSize: 32,
                      color: role.color,
                      marginBottom: 12
                    }}
                  >
                    {feature.icon}
                  </div>
                  <Text strong style={{ color: '#000', fontSize: 15 }}>
                    {feature.text}
                  </Text>
                </Card>
                <div className='role-card-overlay'>
                  <p>{feature.desc}</p>
                </div>
              </div>
            </Col>
          ))}
        </Row>

        <div style={{ marginTop: 50, textAlign: 'center' }}>
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

      <img
        src='/assets/images/QuantilytixO.png'
        alt='Quantilytix Logo'
        className='role-logo'
      />
    </Content>
  )
}

export default RoleDetailPage
