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
import {
  TeamOutlined,
  StarOutlined,
  SolutionOutlined,
  BellOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import { motion } from 'framer-motion'
const { Title, Text } = Typography

export const ProjectAdminDashboard: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false)
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [ongoingInterventions, setOngoingInterventions] = useState(0)
  const [avgParticipation, setAvgParticipation] = useState(0)
  const [avgConsultantRating, setAvgConsultantRating] = useState(0)
  const [topConsultants, setTopConsultants] = useState<[string, number][]>([])
  const [topInterventions, setTopInterventions] = useState<[string, number][]>(
    []
  )

  useEffect(() => {
    const fetchCompanyCodeAndNotifications = async () => {
      setLoading(true)
      try {
        const user = auth.currentUser
        if (!user) {
          setCompanyCode(null)
          setLoading(false)
          return
        }

        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (!userSnap.exists()) {
          setCompanyCode(null)
          setLoading(false)
          return
        }

        const code = userSnap.data().companyCode
        setCompanyCode(code)

        // 🔄 Interventions
        const interventionsSnap = await getDocs(
          query(
            collection(db, 'assignedInterventions'),
            where('companyCode', '==', code)
          )
        )
        const interventions = interventionsSnap.docs.map(doc => doc.data())

        setOngoingInterventions(
          interventions.filter(i => i.status !== 'completed').length
        )

        const total = interventions.length
        const withMov = interventions.filter(i => i.proofOfExecutionUrl).length
        setAvgParticipation(total > 0 ? Math.round((withMov / total) * 100) : 0)

        const ratings = interventions
          .map(i => i.consultantRating)
          .filter((r): r is number => typeof r === 'number')
        const avgRating = ratings.length
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0
        setAvgConsultantRating(parseFloat(avgRating.toFixed(1)))

        const consultantMap: Record<string, number[]> = {}
        for (const i of interventions) {
          if (i.consultantName && typeof i.consultantRating === 'number') {
            if (!consultantMap[i.consultantName])
              consultantMap[i.consultantName] = []
            consultantMap[i.consultantName].push(i.consultantRating)
          }
        }
        const consultantAvgs = Object.entries(consultantMap).map(
          ([name, ratings]) => [
            name,
            parseFloat(
              (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
            )
          ]
        )
        consultantAvgs.sort((a, b) => b[1] - a[1])
        setTopConsultants(consultantAvgs.slice(0, 5))

        // Extract and count required interventions
        // 🔍 Fetch applications for this company
        const appsSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('companyCode', '==', code)
          )
        )
        const apps = appsSnap.docs.map(doc => doc.data())

        // 🔢 Count how many times each intervention title appears
        const interventionCounts: Record<string, number> = {}
        for (const app of apps) {
          const required = app.interventions?.required || []
          for (const intervention of required) {
            const title = intervention.title || intervention.name || 'Untitled'
            interventionCounts[title] = (interventionCounts[title] || 0) + 1
          }
        }

        // 🏆 Sort and select top 5
        const sortedInterventions = Object.entries(interventionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)

        setTopInterventions(sortedInterventions)

        // 🔔 Notifications
        const q = query(
          collection(db, 'notifications'),
          where('recipientRoles', 'array-contains', 'projectadmin')
        )
        const snapshot = await getDocs(q)
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setNotifications(all)
        setUnreadCount(all.filter(n => !n.readBy?.projectadmin).length)
      } catch (e) {
        console.error('Dashboard load error:', e)
        setCompanyCode(null)
      }
      setLoading(false)
    }

    fetchCompanyCodeAndNotifications()
  }, [])

  // Highcharts Configs
  const consultantRatingsChart: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Top 5 Rated Consultants' },
    credits: { enabled: false },
    plotOptions: {
      series: {
        borderRadius: 12,
        dataLabels: {
          enabled: true,
          format: '{point.y:.1f}'
        }
      }
    },
    xAxis: {
      categories: topConsultants.map(c => c[0]),
      title: { text: 'Consultants' }
    },
    yAxis: { min: 0, max: 5, title: { text: 'Average Rating' } },
    series: [
      {
        name: 'Rating',
        type: 'column',
        data: topConsultants.map(c => c[1]),
        color: '#faad14'
      }
    ]
  }

  const interventionNeedsChart: Highcharts.Options = {
    chart: { type: 'bar' },
    credits: { enabled: false },
    title: { text: 'Top 5 Needed Interventions' },
    xAxis: {
      categories: topInterventions.map(i => i[0]),
      title: { text: 'Intervention Type' }
    },
    plotOptions: {
      series: {
        borderRadius: 12, // adds the rounded caps
        dataLabels: { enabled: true }
      }
    },
    yAxis: { min: 0, title: { text: 'Number of Requests' } },
    series: [
      {
        name: 'Requests',
        type: 'bar',
        data: topInterventions.map(i => i[1]),
        color: '#1890ff'
      }
    ]
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Spin tip='Loading dashboard...' size='large' />
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
      <div style={{ padding: 24, minHeight: '100vh' }}>
        {/* KPIs */}
        <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
          {[
            {
              title: 'Ongoing Interventions',
              value: ongoingInterventions,
              icon: <SolutionOutlined />,
              color: '#1890ff',
              bgColor: '#e6f7ff'
            },
            {
              title: 'Avg Participation Rate',
              value: `${avgParticipation}%`,
              icon: <TeamOutlined />,
              color: '#52c41a',
              bgColor: '#f6ffed'
            },
            {
              title: 'Avg Consultant Rating',
              value: avgConsultantRating,
              precision: 1,
              icon: <StarOutlined />,
              color: '#faad14',
              bgColor: '#fffbe6'
            }
          ].map((metric, index) => (
            <Col xs={24} sm={8} key={metric.title}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card
                  hoverable
                  style={{
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    borderRadius: 8,
                    border: '1px solid #bae7ff',
                    height: '100%'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      marginBottom: 12
                    }}
                  >
                    <div
                      style={{
                        background: metric.bgColor,
                        padding: 8,
                        borderRadius: '50%',
                        marginRight: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {React.cloneElement(metric.icon, {
                        style: {
                          fontSize: 18,
                          color: metric.color
                        }
                      })}
                    </div>
                    <Text strong style={{ fontSize: 14 }}>
                      {metric.title}
                    </Text>
                  </div>
                  <Statistic
                    value={metric.value}
                    precision={metric.precision}
                    valueStyle={{
                      color: metric.color,
                      fontSize: 24,
                      fontWeight: 500
                    }}
                  />
                </Card>
              </motion.div>
            </Col>
          ))}
        </Row>

        {/* Charts */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <HighchartsReact
                  highcharts={Highcharts}
                  options={consultantRatingsChart}
                />
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} lg={12}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <HighchartsReact
                  highcharts={Highcharts}
                  options={interventionNeedsChart}
                />
              </Card>
            </motion.div>
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
                  description={
                    item.createdAt?.seconds
                      ? new Date(item.createdAt.seconds * 1000).toLocaleString()
                      : ''
                  }
                />
              </List.Item>
            )}
          />
        </Modal>
      </div>
    </>
  )
}
