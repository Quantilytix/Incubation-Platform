import React, { useEffect, useState } from 'react'
import {
  Card,
  Col,
  Row,
  Typography,
  Statistic,
  Tooltip,
  List,
  Modal,
  Badge,
  Button,
  Spin
} from 'antd'
import { Helmet } from 'react-helmet'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import { TeamOutlined, StarOutlined, SolutionOutlined, BellOutlined } from '@ant-design/icons'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/firebase'
const { Title } = Typography

export const ProjectAdminDashboard: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationModalVisible, setNotificationModalVisible] = useState(false)
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCompanyCodeAndNotifications = async () => {
      setLoading(true)
      try {
        // Get companyCode
        const user = auth.currentUser
        if (user) {
          const userRef = doc(db, 'users', user.uid)
          const userSnap = await getDoc(userRef)
          if (userSnap.exists()) {
            setCompanyCode(userSnap.data().companyCode)
          } else {
            setCompanyCode(null)
          }
        } else {
          setCompanyCode(null)
        }
        // Notifications (unchanged)
        const q = query(
          collection(db, 'notifications'),
          where('recipientRoles', 'array-contains', 'projectadmin')
        )
        const snapshot = await getDocs(q)
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setNotifications(all)
        const unread = all.filter(n => !n.readBy?.projectadmin).length
        setUnreadCount(unread)
      } catch (e) {
        setCompanyCode(null)
      }
      setLoading(false)
    }
    fetchCompanyCodeAndNotifications()
  }, [])

  // Dummy Data
  const isQTX = companyCode === 'QTX'
  const ongoingInterventions = isQTX ? 42 : 0
  const avgParticipation = isQTX ? 87 : 0 // in percent
  const avgConsultantRating = isQTX ? 4.5 : 0.0

  const topConsultants = isQTX
    ? [
        ['Dr. Brown', 4.8],
        ['Jane Wilson', 4.7],
        ['Amir Khan', 4.5],
        ['Thando Ndlovu', 4.3],
        ['Lerato M.', 4.2]
      ]
    : [
        ['Dr. Brown', 0],
        ['Jane Wilson', 0],
        ['Amir Khan', 0],
        ['Thando Ndlovu', 0],
        ['Lerato M.', 0]
      ]

  const topInterventions = isQTX
    ? [
        ['Website Development', 12],
        ['Market Research', 9],
        ['Branding Support', 8],
        ['Financial Literacy', 6],
        ['Product Testing', 5]
      ]
    : [
        ['Website Development', 0],
        ['Market Research', 0],
        ['Branding Support', 0],
        ['Financial Literacy', 0],
        ['Product Testing', 0]
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
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
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

  if (loading) {
    return (
      <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin tip="Loading dashboard..." size="large" />
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Project Admin Dashboard | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Monitor participation, consultant performance, and top intervention needs across the platform.'
        />
      </Helmet>
      <div style={{ padding: 24 }}>
        <Title level={3}>Project Admin Dashboard</Title>
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
        <div style={{ position: 'fixed', bottom: 48, right: 48, zIndex: 1000 }}>
          <Tooltip title='Notifications'>
            <Badge count={unreadCount} offset={[-4, 4]}>
              <Button
                shape='circle'
                icon={<BellOutlined />}
                size='large'
                onClick={() => setNotificationModalVisible(true)}
              />
            </Badge>
          </Tooltip>
        </div>
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
                  description={item.createdAt?.seconds
                    ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                    : ''}
                />
              </List.Item>
            )}
          />
        </Modal>
      </div>
    </>
  )
}
