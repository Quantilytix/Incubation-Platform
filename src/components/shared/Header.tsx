import React from 'react'
import { Card, Row, Col, Space, Button, Typography, Tag } from 'antd'
import type { TagProps } from 'antd'
import { PlusOutlined, CalendarOutlined } from '@ant-design/icons'

const { Title, Text } = Typography

/** ---------- unified card style + motion wrapper ---------- */
const cardStyle: React.CSSProperties = {
    boxShadow: '0 12px 32px rgba(0,0,0,0.10)',
    transition: 'all 0.3s ease',
    borderRadius: 14,
    border: '1px solid #e6efff',
    backdropFilter: 'blur(3px)',
}

/** ---------- IconChip (standard) ---------- */
type IconChipProps = {
    bg?: string
    icon: React.ReactNode
    size?: number
    radius?: number
    style?: React.CSSProperties
}

const IconChipBase: React.FC<IconChipProps> = ({
    bg = 'rgba(22,119,255,.12)',
    icon,
    size = 40,
    radius = 12,
    style,
}) => (
    <div
        style={{
            width: size,
            height: size,
            borderRadius: radius,
            display: 'grid',
            placeItems: 'center',
            background: bg,
            flex: '0 0 auto',
            ...style,
        }}
    >
        {icon}
    </div>
)

/** ---------- Metric helper (optional) ---------- */
type MetricProps = {
    icon?: React.ReactNode
    iconBg?: string
    title: React.ReactNode
    value: React.ReactNode
    subtitle?: React.ReactNode
    right?: React.ReactNode
}

const MetricBase: React.FC<MetricProps> = ({ icon, iconBg, title, value, subtitle, right }) => (
    <div
        style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
        }}
    >
        <Space size="large" align="center">
            {icon ? <IconChipBase bg={iconBg} icon={icon} /> : null}
            <div>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,.45)' }}>{title}</div>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
                {subtitle ? (
                    <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(0,0,0,.45)' }}>{subtitle}</div>
                ) : null}
            </div>
        </Space>

        {right ? <div>{right}</div> : null}
    </div>
)

/** ---------- MotionCard (compound) ---------- */
type MotionCardComponent = React.FC<React.ComponentProps<typeof Card>> & {
    IconChip: React.FC<IconChipProps>
    Metric: React.FC<MetricProps>
}

export const MotionCard: MotionCardComponent = ({ children, style, ...rest }) => (
    <div
        style={{
            transform: 'translateY(10px)',
            opacity: 0,
            animation: 'enter .35s ease forwards',
        }}
    >
        <Card {...rest} style={{ ...cardStyle, ...(style || {}) }}>
            {children}
        </Card>

        <style>{`
      @keyframes enter { to { transform: translateY(0); opacity: 1; } }
    `}</style>
    </div>
)

MotionCard.IconChip = IconChipBase
MotionCard.Metric = MetricBase

/** ---------- header card ---------- */
type SubtitleTag =
    | string
    | {
        label: React.ReactNode
        color?: TagProps['color']
        icon?: React.ReactNode
        props?: Omit<TagProps, 'color' | 'icon' | 'children'>
    }

type HeaderCardProps = {
    title: React.ReactNode
    titleIcon?: React.ReactNode
    titleTag?: SubtitleTag

    subtitle?: React.ReactNode
    subtitleTags?: SubtitleTag[]

    onAddEvent?: () => void
    onOpenCalendar?: () => void
    addEventLabel?: string
    openCalendarLabel?: string
    extraRight?: React.ReactNode

    background?: string
    cardProps?: React.ComponentProps<typeof Card>
}

const renderTag = (t: SubtitleTag, key: React.Key) => {
    if (typeof t === 'string') {
        return (
            <Tag key={key} style={{ borderRadius: 999 }}>
                {t}
            </Tag>
        )
    }

    return (
        <Tag
            key={key}
            color={t.color}
            icon={t.icon}
            style={{ borderRadius: 999 }}
            {...(t.props || {})}
        >
            {t.label}
        </Tag>
    )
}

export const DashboardHeaderCard: React.FC<HeaderCardProps> = ({
    title,
    titleIcon,
    titleTag,
    subtitle,
    subtitleTags = [],

    onAddEvent,
    onOpenCalendar,
    addEventLabel = 'Add Event',
    openCalendarLabel = 'Open Calendar',
    extraRight,

    background = 'linear-gradient(90deg,#eef4ff, #f9fbff)',
    cardProps,
}) => {
    return (
        <MotionCard style={{ background, marginBottom: 10 }} {...cardProps}>
            <Row align="middle" justify="space-between" gutter={8} wrap>
                <Col>
                    <Space align="center" size={10}>
                        {titleIcon && <span style={{ display: 'inline-flex', fontSize: 18 }}>{titleIcon}</span>}

                        <Title level={4} style={{ marginBottom: 0 }}>
                            {title}
                        </Title>

                        {titleTag ? renderTag(titleTag, 'titleTag') : null}
                    </Space>

                    {(subtitle || subtitleTags.length > 0) && (
                        <div style={{ marginTop: 6 }}>
                            <Space size={8} wrap>
                                {subtitle && <Text type="secondary">{subtitle}</Text>}
                                {subtitleTags.map((t, idx) => renderTag(t, idx))}
                            </Space>
                        </div>
                    )}
                </Col>

                <Col>
                    <Space>
                        {onAddEvent && (
                            <Button type="primary" icon={<PlusOutlined />} onClick={onAddEvent}>
                                {addEventLabel}
                            </Button>
                        )}

                        {onOpenCalendar && (
                            <Button icon={<CalendarOutlined />} onClick={onOpenCalendar}>
                                {openCalendarLabel}
                            </Button>
                        )}

                        {extraRight}
                    </Space>
                </Col>
            </Row>
        </MotionCard>
    )
}
