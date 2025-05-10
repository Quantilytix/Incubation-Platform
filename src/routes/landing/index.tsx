import React from 'react'
import { Layout, Button, Row, Col, Card, Typography } from 'antd'
import { UserOutlined, LoginOutlined } from '@ant-design/icons'
import './LandingPage.css' // Import your styles
import { useNavigate } from 'react-router-dom'

const { Header, Content } = Layout
const { Title, Paragraph } = Typography

const cardData = [
  {
    title: 'SME',
    image: '/assets/images/icons/Company.png',
    description: 'Support and opportunities for Small and Medium Enterprises.'
  },
  {
    title: 'Incubate Implementor',
    image: '/assets/images/icons/Business presentation.png',
    description: 'Tools and resources for incubation program implementors.'
  },
  {
    title: 'Government',
    image: '/assets/images/icons/Government Building.png',
    description: 'Policies and partnerships for government stakeholders.'
  }
]

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <Layout>
      <Header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div className='logo' style={{ color: 'white', fontSize: 20 }}>
          Smart Incubation Platform
        </div>
        <div>
          <Button
            icon={<UserOutlined />}
            type='primary'
            style={{ marginRight: 10 }}
          >
            Register
          </Button>
          <Button icon={<LoginOutlined />} onClick={() => navigate('/login')}>
            Login
          </Button>
        </div>
      </Header>

      <Content
        style={{
          padding: '50px 20px',
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

        <Row gutter={[24, 24]} justify='center' style={{ width: '100%' }}>
          {cardData.map((card, index) => (
            <Col xs={24} sm={12} md={8} key={index}>
              <div className='hover-card'>
                <Card
                  hoverable
                  cover={
                    <img
                      alt={card.title}
                      src={card.image}
                      className='card-img'
                    />
                  }
                  bodyStyle={{ padding: 0 }}
                >
                  <div className='card-overlay'>
                    <h3>{card.title}</h3>
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
