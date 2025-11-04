import React from 'react'
import {
  LineChartOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  RiseOutlined,
  RocketOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'

const icons = [
  { Icon: BarChartOutlined, delay: 0, radius: 80, angle: 0 },
  { Icon: BulbOutlined, delay: 1, radius: 95, angle: 60 },
  { Icon: RiseOutlined, delay: 2, radius: 70, angle: 120 },
  { Icon: RocketOutlined, delay: 3, radius: 105, angle: 180 },
  { Icon: LineChartOutlined, delay: 4, radius: 75, angle: 240 },
  { Icon: ThunderboltOutlined, delay: 5, radius: 100, angle: 300 }
]

export default function AnimatedSpiral () {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Spiral Path */}
      <svg
        viewBox='0 0 200 200'
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          opacity: 0.18,
          animation: 'spin 30s linear infinite'
        }}
      >
        <defs>
          <linearGradient
            id='spiralGradient'
            x1='0%'
            y1='0%'
            x2='100%'
            y2='100%'
          >
            <stop offset='0%' stopColor='#0f766e' />
            <stop offset='100%' stopColor='#10b981' />
          </linearGradient>
        </defs>
        <path
          d='M100,100 Q120,80 140,100 T160,140 T140,180 T100,200 T60,180 T40,140 T60,100 T100,60 T140,40 T180,60'
          fill='none'
          stroke='url(#spiralGradient)'
          strokeWidth='2'
          strokeLinecap='round'
        />
      </svg>

      {/* Floating Icons */}
      {icons.map(({ Icon, delay, radius, angle }, i) => {
        const x = Math.cos((angle * Math.PI) / 180) * radius
        const y = Math.sin((angle * Math.PI) / 180) * radius
        return (
          <motion.div
            key={i}
            initial={{ y: 0 }}
            animate={{ y: [0, -8, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: delay * 0.4,
              ease: 'easeInOut'
            }}
            style={{
              position: 'absolute',
              left: `calc(50% + ${x}px)`,
              top: `calc(50% + ${y}px)`
            }}
          >
            <div
              style={{
                background: 'rgba(15,118,110,0.1)',
                backdropFilter: 'blur(6px)',
                border: '1px solid rgba(15,118,110,0.2)',
                borderRadius: 12,
                padding: 10,
                boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                transition: 'transform 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.transform = 'scale(1.1)')
              }
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <Icon style={{ fontSize: 18, color: '#0f766e' }} />
            </div>
          </motion.div>
        )
      })}

      {/* Center Glow */}
      <div
        style={{
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: '50%',
          background:
            'radial-gradient(circle at center, rgba(16,185,129,0.2), rgba(15,118,110,0.05))',
          filter: 'blur(20px)'
        }}
      />

      {/* Spin Animation */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
