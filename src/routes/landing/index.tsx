import React from 'react'
import { Layout, Row, Col, Card, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet' // ✅ Import Helmet
import './LandingPage.css'
import { motion } from 'framer-motion'

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

const blobVariants = {
  initial: { opacity: 0, scale: 0.95, y: 40 },
  animate: {
    opacity: 0.83,
    scale: 1,
    y: 0,
    transition: { duration: 1.2, ease: 'easeOut' }
  }
}

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.15, delayChildren: 0.3 } }
}

const cardVariants = {
  initial: { opacity: 0, y: 40, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: 'easeOut' }
  }
}

const LandingPage = () => {
  const navigate = useNavigate()

  return (
    <Layout
      className={'page-bg'}
      style={{ minHeight: '100vh', position: 'relative' }}
    >
      {/* ✅ Helmet added here */}
      <Helmet>
        <title>Landing | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Choose your role to access tailored tools, programs, and resources on the Smart Incubation Platform.'
        />
      </Helmet>
      <>
        {/* Animated Blobs with Framer Motion */}
        <motion.svg
          className='animated-blob blob-bottom-left'
          viewBox='0 0 400 400'
          initial='initial'
          animate='animate'
          variants={blobVariants}
        >
          <defs>
            <linearGradient id='blob1' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#38bdf8' />
              <stop offset='100%' stopColor='#818cf8' />
            </linearGradient>
          </defs>
          <path
            fill='url(#blob1)'
            d='M326.9,309Q298,378,218.5,374.5Q139,371,81,312.5Q23,254,56.5,172Q90,90,180.5,63.5Q271,37,322.5,118.5Q374,200,326.9,309Z'
          />
        </motion.svg>
        <motion.svg
          className='animated-blob blob-top-right'
          viewBox='0 0 400 400'
          initial='initial'
          animate='animate'
          variants={blobVariants}
        >
          <defs>
            <linearGradient id='blob2' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#fbc2eb' />
              <stop offset='100%' stopColor='#a6c1ee' />
            </linearGradient>
          </defs>
          <path
            fill='url(#blob2)'
            d='M343,294.5Q302,389,199.5,371Q97,353,71.5,226.5Q46,100,154,72.5Q262,45,315,122.5Q368,200,343,294.5Z'
          />
        </motion.svg>
      </>

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

        <motion.div
          className='card-row-flex'
          variants={containerVariants}
          initial='initial'
          animate='animate'
        >
          {cardData.map((card, index) => (
            <motion.div
              className='hover-card'
              variants={cardVariants}
              whileHover={{
                scale: 1.045,
                boxShadow: '0 16px 48px rgba(30,0,120,0.13)'
              }}
              key={card.key}
            >
              <Card
                hoverable
                className='custom-card glass-card'
                onClick={() => navigate(`/role/${card.key}`)}
                cover={
                  <img alt={card.title} src={card.image} className='card-img' />
                }
              >
                <div className='card-title'>{card.title}</div>
                <div className='card-overlay'>
                  <p>{card.description}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </Content>

      {/* ✅ Bottom-right logo */}
      <img
        src='/assets/images/QuantilytixO.png'
        alt='Quantilytix Logo'
        className='role-logo'
      />
    </Layout>
  )
}

export default LandingPage
