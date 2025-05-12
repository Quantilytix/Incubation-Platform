import React from 'react'
import { Layout, Row, Col, Card, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

const { Content } = Layout
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
    image: '/assets/images/icons/Investor.jpg',
    description: 'Discover and support high-potential incubatees and programs.'
  }
]

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <Layout style={{ minHeight: '100vh', position: 'relative' }}>
      <Content
        style={{
          padding: '40px 20px 80px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Title level={2}>Welcome to the Smart Incubation Platform</Title>
        <Paragraph
          style={{ maxWidth: 700, textAlign: 'center', marginBottom: 40 }}
        >
          Choose your role below to explore tools, resources, and support
          tailored for you.
        </Paragraph>

        {/* Flex container for cards */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            justifyContent: 'center',
            maxWidth: '1100px',
            width: '100%'
          }}
        >
          <Row gutter={[24, 24]} justify='center' style={{ width: '100%' }}>
            {cardData.map((card, index) => (
              <Col xs={24} sm={12} md={6} key={index}>
                {' '}
                {/* Try md={12} for 2-per-row */}
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
        </div>
      </Content>

      {/* ✅ Logo in bottom-right */}
      <img
        src='/assets/images/QuantilytixO.png'
        alt='Quantilytix Logo'
        className='role-logo'
      />
    </Layout>
  )
}

export default LandingPage
