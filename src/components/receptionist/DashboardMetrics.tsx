import React from 'react'
import { Card, Row, Col, Statistic } from 'antd'
import { 
  CalendarOutlined, 
  FileTextOutlined, 
  ClockCircleOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons'
import { ReceptionistDashboardData } from '@/types/inquiry'

interface DashboardMetricsProps {
  dashboardData: ReceptionistDashboardData
}

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ dashboardData }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Today's Inquiries"
            value={dashboardData.todayInquiries}
            prefix={<CalendarOutlined style={{ color: '#1890ff' }} />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="This Week"
            value={dashboardData.weekInquiries}
            prefix={<FileTextOutlined style={{ color: '#52c41a' }} />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="This Month"
            value={dashboardData.monthInquiries}
            prefix={<FileTextOutlined style={{ color: '#722ed1' }} />}
            valueStyle={{ color: '#722ed1' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="Pending Follow-ups"
            value={dashboardData.pendingFollowUps}
            prefix={<ClockCircleOutlined style={{ color: '#fa8c16' }} />}
            valueStyle={{ color: dashboardData.pendingFollowUps > 0 ? '#fa8c16' : '#52c41a' }}
          />
        </Card>
      </Col>
    </Row>
  )
}

export default DashboardMetrics 