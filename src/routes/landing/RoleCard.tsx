// src/components/RoleCard.tsx
import React from 'react'
import { Card, Typography, Space } from 'antd'
import {
  ApartmentOutlined,
  TeamOutlined,
  BankOutlined,
  DollarCircleOutlined,
  RocketOutlined,
  BarChartOutlined,
  RiseOutlined,
  UserAddOutlined
} from '@ant-design/icons'

const { Title, Text } = Typography

type RoleKey = 'sme' | 'incubate' | 'government' | 'investor'

interface Feature {
  icon: string
  text: string
  desc: string
}

interface RoleCardProps {
  title: string
  highlight: string
  type: RoleKey
  features: Feature[]
  maxWidth?: number
}

const iconMap: Record<RoleKey, React.ComponentType<any>> = {
  sme: ApartmentOutlined,
  incubate: TeamOutlined,
  government: BankOutlined,
  investor: DollarCircleOutlined
}

const featureIconMap: Record<string, React.ComponentType<any>> = {
  rocket: RocketOutlined,
  users: TeamOutlined,
  chart: BarChartOutlined,
  trending: RiseOutlined,
  userplus: UserAddOutlined
}

const colorMap: Record<RoleKey, string> = {
  sme: '#1677ff',
  incubate: '#13c2c2',
  government: '#722ed1',
  investor: '#fa8c16'
}

const RoleCard: React.FC<RoleCardProps> = ({
  title,
  highlight,
  type,
  features,
  maxWidth = 680 // same as "max-w-2xl"
}) => {
  const RoleIcon = iconMap[type]
  const color = colorMap[type]

  return (
    <Card
      hoverable
      bordered
      style={{
        width: '100%',
        maxWidth,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.05)',
        background: 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(6px)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        transition: 'all 0.3s ease'
      }}
      bodyStyle={{ padding: 32 }}
    >
      {/* Header with Icon */}
      <Space
        align='start'
        size={16}
        style={{ display: 'flex', marginBottom: 24 }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: color,
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <RoleIcon style={{ fontSize: 32, color: '#fff' }} />
        </div>
        <div>
          <Title
            level={3}
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: 24,
              lineHeight: 1.2,
              color: '#111',
              transition: 'color .3s'
            }}
          >
            {title}
          </Title>
          <Text type='secondary' italic style={{ fontSize: 14 }}>
            {highlight}
          </Text>
        </div>
      </Space>

      {/* Features List */}
      <Space direction='vertical' size={16} style={{ width: '100%' }}>
        {features.map((feature, idx) => {
          const FIcon = featureIconMap[feature.icon] || RocketOutlined
          return (
            <Space
              key={idx}
              align='start'
              size={12}
              style={{
                display: 'flex',
                width: '100%'
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `${color}20`, // soft translucent background
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <FIcon style={{ fontSize: 18, color }} />
              </div>

              <div style={{ flex: 1 }}>
                <Text
                  strong
                  style={{ display: 'block', fontSize: 16, marginBottom: 4 }}
                >
                  {feature.text}
                </Text>
                <Text
                  type='secondary'
                  style={{ fontSize: 14, lineHeight: 1.6 }}
                >
                  {feature.desc}
                </Text>
              </div>
            </Space>
          )
        })}
      </Space>
    </Card>
  )
}

export default RoleCard
