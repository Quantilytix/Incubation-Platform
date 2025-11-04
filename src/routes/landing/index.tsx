import React from 'react'
import { Row, Col, Typography } from 'antd'
import AnimatedSpiral from './AnimatedSpiral'
import RoleCarousel from './RoleCarousel'
import TopBar from './TopBar'

const { Title, Paragraph } = Typography

const Index: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100svh',
        background:
          'linear-gradient(to bottom, #ffffff, rgba(22,119,255,0.05))',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <TopBar />

      <div
        style={{
          flex: 1,
          maxWidth: 1650, // ← wider container
          margin: '0 auto',
          padding: '110px 32px 40px', // a bit more room
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <Row
          gutter={[96, 64]}
          align='middle'
          style={{ width: '100%' }}
          wrap={false}
        >
          {/* Left: Spiral */}
          <Col xs={0} lg={10}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <div style={{ width: '100%', maxWidth: 420, aspectRatio: '1/1' }}>
                <AnimatedSpiral />
              </div>
            </div>
          </Col>

          {/* Right: Heading + Carousel */}
          <Col xs={24} lg={14}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <Title
                  level={1}
                  style={{
                    fontSize: 'clamp(28px, 4vw, 46px)',
                    lineHeight: 1.1,
                    color: '#2c3e50', // ✅ pure black text
                    fontWeight: 800,
                    marginBottom: 16,
                    whiteSpace: 'nowrap', // keeps on one line
                    textAlign: 'center' // centers the text
                  }}
                >
                  Smart Incubation Platform
                </Title>

                <Paragraph
                  style={{
                    fontSize: 18,
                    color: '#666',
                    maxWidth: 680,
                    margin: '0 auto', // ✅ centers the block horizontally
                    textAlign: 'center' // ✅ centers the text itself
                  }}
                >
                  Empowering innovation ecosystems with AI-driven insights and
                  seamless collaboration.
                </Paragraph>
              </div>

              <div>
                {/* Give the carousel real width to use */}
                <RoleCarousel cardMax={1040} wrapMax={1160} />
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Floating badge */}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          height: 46,
          width: 110,
          zIndex: 99,
          backgroundColor: 'rgba(0,0,0,0.8)',
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 6,
          boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
        }}
      >
        <img
          src='/assets/images/QuantilytixO.png'
          alt='QuantO Logo'
          style={{ height: '100%', width: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Decorative blobs */}
      <div
        style={{
          position: 'fixed',
          top: '20%',
          right: 0,
          width: 520,
          height: 520,
          background: 'rgba(22,119,255,0.08)',
          borderRadius: '50%',
          filter: 'blur(140px)',
          zIndex: -10
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '20%',
          left: 0,
          width: 520,
          height: 520,
          background: 'rgba(19,194,194,0.08)',
          borderRadius: '50%',
          filter: 'blur(140px)',
          zIndex: -10
        }}
      />

      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes slideIn { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
        `}
      </style>
    </div>
  )
}

export default Index
