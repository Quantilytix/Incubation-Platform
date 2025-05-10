import React, { useEffect, useState } from 'react'
import {
  Card,
  Col,
  Row,
  Typography,
  Statistic,
  FloatButton,
  Tooltip,
  List,
  Modal
} from 'antd'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { TeamOutlined, StarOutlined, SolutionOutlined } from '@ant-design/icons'
import { BellOutlined } from '@ant-design/icons'
import { Badge, Button } from 'antd'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
const { Title } = Typography

export const ProjectAdminDashboard: React.FC = () => {
  // Dummy Data
  const ongoingInterventions = 42
  const avgParticipation = 87 // in percent
  const avgConsultantRating = 4.5
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false)

  useEffect(() => {
    const fetchNotifications = async () => {
      const q = query(
        collection(db, 'notifications'),
        where('recipientRoles', 'array-contains', 'projectadmin')
      )

      const snapshot = await getDocs(q)
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      setNotifications(all)

      const unread = all.filter(n => !n.readBy?.projectadmin).length
      setUnreadCount(unread)
    }

    fetchNotifications()
  }, [])

  const topConsultants = [
    ['Dr. Brown', 4.8],
    ['Jane Wilson', 4.7],
    ['Amir Khan', 4.5],
    ['Thando Ndlovu', 4.3],
    ['Lerato M.', 4.2]
  ]

  const topInterventions = [
    ['Website Development', 12],
    ['Market Research', 9],
    ['Branding Support', 8],
    ['Financial Literacy', 6],
    ['Product Testing', 5]
  ]

  // Highcharts Configs
  const consultantRatingsChart: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Top Rated Consultants' },
    xAxis: {
      categories: topConsultants.map(c => c[0]),
      title: { text: 'Consultants' }
    },
    yAxis: {
      min: 0,
      max: 5,
      title: { text: 'Average Rating' }
    },
    series: [
      {
        name: 'Rating',
        type: 'column',
        data: topConsultants.map(c => c[1]),
        color: '#faad14',
        dataLabels: {
          enabled: true,
          format: '{point.y:.1f}'
        }
      }
    ]
  }

  const interventionNeedsChart: Highcharts.Options = {
    chart: { type: 'bar' },
    title: { text: 'Most Needed Interventions' },
    xAxis: {
      categories: topInterventions.map(i => i[0]),
      title: { text: 'Intervention Type' }
    },
    yAxis: {
      min: 0,
      title: { text: 'Number of Requests' }
    },
    series: [
      {
        name: 'Requests',
        type: 'bar',
        data: topInterventions.map(i => i[1]),
        color: '#1890ff',
        dataLabels: {
          enabled: true
        }
      }
    ]
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Project Admin Dashboard </Title>

      {/* KPIs */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Ongoing Interventions'
              value={ongoingInterventions}
              prefix={<SolutionOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Avg Participation Rate'
              value={`${avgParticipation}%`}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Avg Consultant Rating'
              value={avgConsultantRating}
              precision={1}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={consultantRatingsChart}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact
              highcharts={Highcharts}
              options={interventionNeedsChart}
            />
          </Card>
        </Col>
      </Row>
      <Tooltip title='Notifications'>
        <Badge count={unreadCount}>
          <FloatButton
            icon={<BellOutlined />}
            onClick={() => setNotificationModalVisible(true)}
          />
        </Badge>
      </Tooltip>
      <Modal
        title='Notifications'
        open={notificationModalVisible}
        onCancel={() => setNotificationModalVisible(false)}
        footer={null}
      >
        <List
          itemLayout='horizontal'
          dataSource={notifications}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                title={item.message?.projectadmin || 'No message'}
                description={new Date(
                  item.createdAt?.seconds * 1000
                ).toLocaleString()}
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}
