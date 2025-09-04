import React from 'react'
import { Card, Row, Col, Space, Button, Typography } from 'antd'
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

/** ---------- unified card style + motion wrapper ---------- */
const cardStyle: React.CSSProperties = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
  transition: 'all 0.3s ease',
  borderRadius: 14,
  border: '1px solid #e6efff',
  backdropFilter: 'blur(3px)'
}

export const MotionCard: React.FC<React.ComponentProps<typeof Card>> = ({
  children,
  style,
  ...rest
}) => (
  <div
    style={{
      transform: 'translateY(10px)',
      opacity: 0,
      animation: 'enter .35s ease forwards'
    }}
  >
    <Card {...rest} style={{ ...cardStyle, ...(style || {}) }}>
      {children}
    </Card>

    {/* tiny keyframes so we don't need another dep */}
    <style>{`
      @keyframes enter { to { transform: translateY(0); opacity: 1; } }
    `}</style>
  </div>
)

/** ---------- reusable header card ---------- */
type HeaderCardProps = {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Shown if provided */
  onAddEvent?: () => void
  /** Shown if provided */
  onOpenCalendar?: () => void
  /** Override button labels if you want */
  addEventLabel?: string
  openCalendarLabel?: string
  /** Right-side extra content (optional) */
  extraRight?: React.ReactNode
  /** Background override (defaults to gentle gradient) */
  background?: string
  /** Pass through additional Card props if needed */
  cardProps?: React.ComponentProps<typeof Card>
}

export const DashboardHeaderCard: React.FC<HeaderCardProps> = ({
  title,
  subtitle,
  onAddEvent,
  onOpenCalendar,
  addEventLabel = 'Add Event',
  openCalendarLabel = 'Open Calendar',
  extraRight,
  background = 'linear-gradient(90deg,#eef4ff, #f9fbff)',
  cardProps
}) => {
  return (
    <MotionCard style={{ background, marginBottom: 10 }} {...cardProps}>
      <Row align='middle' justify='space-between' gutter={8}>
        <Col>
          <Title level={4} style={{ marginBottom: 0 }}>
            {title}
          </Title>
          {subtitle && <Text type='secondary'>{subtitle}</Text>}
        </Col>
        <Col>
          <Space>
            {onAddEvent && (
              <Button
                type='primary'
                icon={<PlusOutlined />}
                onClick={onAddEvent}
              >
                {addEventLabel}
              </Button>
            )}
            {onOpenCalendar && (
              <Button icon={<CalendarOutlined />} onClick={onOpenCalendar}>
                {openCalendarLabel}
              </Button>
            )}
            {extraRight /* anything else you want on the right */}
          </Space>
        </Col>
      </Row>
    </MotionCard>
  )
}
