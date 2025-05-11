import React from 'react'
import { Layout, Button, Row, Col, Card, Typography } from 'antd'
import { UserOutlined, LoginOutlined } from '@ant-design/icons'
import './LandingPage.css' // Import your styles
import { useNavigate } from 'react-router-dom'

const { Header, Content } = Layout
const { Title, Paragraph } = Typography

const cardData = [
  {
    key: 'sme',
    title: 'Startup | SMME | Cooperative',
    image: '/assets/images/icons/Sme.jpg',
    description: 'Support and opportunities for Small and Medium Enterprises.'
  },
  {
    key: 'incubate',
    title: 'Incubation | ESD Program Implementor',
    image: '/assets/images/icons/Business presentation.png',
    description: 'Tools and resources for incubation program implementors.'
  },
  {
    key: 'government',
    title: 'Public Sector | International and Supranational Entity',
    image: '/assets/images/icons/Government.jpg',
    description: 'Policies and partnerships for government stakeholders.'
  },
  {
    key: 'investor',
    title: 'Investor | Funder | Capital Partner',
    image: '/assets/images/icons/Investor.jpg', // ✅ Add this image to your assets
    description: 'Discover and support high-potential incubatees and programs.'
  }
]

const LandingPage = () => {
  const navigate = useNavigate()
  const cardData = [
    {
      key: 'sme',
      title: 'Startup  | SMME | Cooperative ',
      image: '/assets/images/icons/Company.png',
      description: 'Support and opportunities for Small and Medium Enterprises.'
    },
    {
      key: 'incubate',
      title: 'Incubation | ESD Program Implementor',
      image: '/assets/images/icons/Business presentation.png',
      description: 'Tools and resources for incubation program implementors.'
    },
    {
      key: 'government',
      title: 'Public Sector | International and Supranational Entity',
      image: '/assets/images/icons/Government Building.png',
      description: 'Policies and partnerships for government stakeholders.'
    }
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingInline: 20
        }}
      >
        <div className='logo' style={{ color: 'white', fontSize: 20 }}>
          Smart Incubation Platform
        </div>
      </Header>

      <Content
        style={{
          padding: '50px 20px',
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'auto'
        }}
      >
        <Title level={2}>Welcome to the Smart Incubation Platform</Title>
        <Paragraph
          style={{ maxWidth: 700, textAlign: 'center', marginBottom: 40 }}
        >
          Choose your role below to explore tools, resources, and support
          tailored for you.
        </Paragraph>

        <Row gutter={[24, 24]} justify='center' style={{ width: '100%' }}>
          {cardData.map((card, index) => (
            <Col xs={24} sm={12} md={8} key={index}>
              <div className='hover-card'>
                <Card
                  hoverable
                  className='custom-card'
                  onClick={() => navigate(`/role/${card.key}`)}
                  cover={
                    <img
                      alt={card.title}
                      src={card.image}
                      className='card-img'
                    />
                  }
                >
                  <div className='card-title'>{card.title}</div>
                  <div className='card-overlay'>
                    <p>{card.description}</p>
                  </div>
                </Card>
              </div>
            </Col>
          ))}
        </Row>
      </Content>
    </Layout>
  )
}

export default LandingPage
