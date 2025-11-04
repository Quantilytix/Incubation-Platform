// TopBar.tsx
import React from 'react'
import { Button, Space } from 'antd'
import { LoginOutlined, RocketOutlined } from '@ant-design/icons'

const TopBar: React.FC = () => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: '100%',
        maxWidth: 1200,
        padding: '0 16px'
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: 9999,
          padding: '10px 24px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <span style={{ fontSize: 14, color: '#666', fontWeight: 500 }}>
          Powered by{' '}
          <a
            href='https://quantilytix.co.za'
            target='_blank'
            rel='noopener noreferrer'
            style={{
              color: '#1677ff',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            Quantilytix
          </a>
        </span>

        <Space size='middle'>
          <Button
            icon={<LoginOutlined />}
            iconPosition='end'
            color='cyan'
            variant='filled'
            size='small'
            style={{ padding: '15px 10px' }}
          >
            Sign In
          </Button>
          <span style={{ color: '#999' }}>|</span>
          <Button
            size='small'
            type='primary'
            icon={<RocketOutlined />}
            iconPosition='end'
            style={{
              background: 'linear-gradient(90deg, #1677ff, #13c2c2)',
              border: 'none',
              color: '#fff',
              padding: '15px 10px'
            }}
          >
            Get Started
          </Button>
        </Space>
      </div>
    </div>
  )
}

export default TopBar
