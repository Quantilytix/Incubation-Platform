import React, { useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Space,
  Divider,
  Tabs,
  Progress,
  Button,
  Table,
  Avatar,
  Badge,
  Tooltip,
  Alert,
  Timeline,
  Drawer,
  message,
  Spin
} from 'antd'
import {
  BarChartOutlined,
  TeamOutlined,
  RiseOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  FundOutlined,
  PieChartOutlined,
  ProjectOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  ApartmentOutlined,
  BellOutlined,
  AreaChartOutlined
} from '@ant-design/icons'
import { useEffect } from 'react'
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'
import { getAuth } from 'firebase/auth'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

const sampleFinancialData = [
  {
    category: 'Project Management',
    allocated: 120000,
    spent: 95000,
    remaining: 25000
  },
  {
    category: 'Facilities',
    allocated: 200000,
    spent: 170000,
    remaining: 30000
  },
  {
    category: 'Program Marketing',
    allocated: 80000,
    spent: 65000,
    remaining: 15000
  },
  { category: 'Events', allocated: 50000, spent: 42000, remaining: 8000 },
  {
    category: 'Technology',
    allocated: 150000,
    spent: 110000,
    remaining: 40000
  },
  {
    category: 'General Admin',
    allocated: 180000,
    spent: 160000,
    remaining: 20000
  }
]

const sampleKPIData = [
  {
    metric: 'Revenue Growth',
    target: 25,
    actual: 32,
    unit: '%',
    status: 'Exceeding'
  },
  {
    metric: 'Funding Secured',
    target: 5000000,
    actual: 4200000,
    unit: '$',
    status: 'On Track'
  },
  {
    metric: 'Job Creation',
    target: 120,
    actual: 97,
    unit: 'jobs',
    status: 'At Risk'
  },
  {
    metric: 'Market Expansion',
    target: 3,
    actual: 4,
    unit: 'markets',
    status: 'Exceeding'
  },
  {
    metric: 'Product Launches',
    target: 12,
    actual: 10,
    unit: 'products',
    status: 'On Track'
  }
]

const sampleResourcesData = [
  { resource: 'Mentors', allocated: 45, utilized: 38, utilization: 84 },
  { resource: 'Meeting Rooms', allocated: 8, utilized: 7, utilization: 92 },
  { resource: 'Event Spaces', allocated: 3, utilized: 2, utilization: 65 },
  { resource: 'Lab Equipment', allocated: 12, utilized: 8, utilization: 72 },
  {
    resource: 'Software Licenses',
    allocated: 200,
    utilized: 185,
    utilization: 93
  }
]

const sampleAnalytics = {
  totalIncubatees: 35,
  activeProjects: 28,
  complianceRate: 84,
  averageProgress: 72,
  pendingApprovals: 7,
  upcomingDeadlines: 12,
  successRate: 76,
  avgFundingSecured: 850000,
  activeMentors: 42,
  resourceUtilization: 78,
  totalBudget: 1500000,
  budgetUtilized: 1150000,
  roi: 2.4
}

// Sample portfolio data
const samplePortfolioData = [
  {
    id: 1,
    name: 'TechInnovate',
    sector: 'FinTech',
    stage: 'Growth',
    valuation: 4500000,
    investment: 750000,
    progress: 72,
    metrics: {
      revenue: 1200000,
      customers: 5800,
      employees: 32,
      growthRate: 68
    },
    status: 'Active',
    risk: 'Low'
  },
  {
    id: 2,
    name: 'GreenSolutions',
    sector: 'CleanEnergy',
    stage: 'Early Growth',
    valuation: 2800000,
    investment: 500000,
    progress: 56,
    metrics: {
      revenue: 840000,
      customers: 1200,
      employees: 18,
      growthRate: 42
    },
    status: 'Active',
    risk: 'Medium'
  },
  {
    id: 3,
    name: 'HealthPlus',
    sector: 'HealthTech',
    stage: 'Seed',
    valuation: 1200000,
    investment: 300000,
    progress: 45,
    metrics: {
      revenue: 320000,
      customers: 1500,
      employees: 12,
      growthRate: 85
    },
    status: 'Warning',
    risk: 'High'
  },
  {
    id: 4,
    name: 'EduConnect',
    sector: 'EdTech',
    stage: 'Growth',
    valuation: 3800000,
    investment: 650000,
    progress: 81,
    metrics: {
      revenue: 950000,
      customers: 8500,
      employees: 27,
      growthRate: 74
    },
    status: 'Active',
    risk: 'Low'
  },
  {
    id: 5,
    name: 'AgriTech Systems',
    sector: 'Agriculture',
    stage: 'Seed',
    valuation: 950000,
    investment: 250000,
    progress: 38,
    metrics: {
      revenue: 180000,
      customers: 450,
      employees: 8,
      growthRate: 28
    },
    status: 'Warning',
    risk: 'High'
  }
]

const sampleSectorData = [
  {
    sector: 'FinTech',
    companies: 8,
    totalInvestment: 3200000,
    averageValuation: 4100000,
    performance: 72
  },
  {
    sector: 'HealthTech',
    companies: 6,
    totalInvestment: 2400000,
    averageValuation: 2800000,
    performance: 65
  },
  {
    sector: 'CleanEnergy',
    companies: 5,
    totalInvestment: 2100000,
    averageValuation: 3100000,
    performance: 58
  },
  {
    sector: 'EdTech',
    companies: 7,
    totalInvestment: 2800000,
    averageValuation: 3600000,
    performance: 81
  },
  {
    sector: 'Agriculture',
    companies: 4,
    totalInvestment: 1500000,
    averageValuation: 1200000,
    performance: 42
  },
  {
    sector: 'E-commerce',
    companies: 5,
    totalInvestment: 1900000,
    averageValuation: 2500000,
    performance: 63
  }
]

const sampleMilestoneData = [
  {
    id: 1,
    company: 'TechInnovate',
    milestone: 'Series A Funding',
    target: '2024-08-15',
    progress: 85,
    status: 'On Track'
  },
  {
    id: 2,
    company: 'GreenSolutions',
    milestone: 'Market Expansion',
    target: '2024-09-30',
    progress: 62,
    status: 'At Risk'
  },
  {
    id: 3,
    company: 'HealthPlus',
    milestone: 'Product Launch',
    target: '2024-07-20',
    progress: 45,
    status: 'Delayed'
  },
  {
    id: 4,
    company: 'EduConnect',
    milestone: 'User Growth Target',
    target: '2024-08-01',
    progress: 92,
    status: 'Ahead'
  },
  {
    id: 5,
    company: 'AgriTech Systems',
    milestone: 'Pilot Program',
    target: '2024-10-15',
    progress: 38,
    status: 'Delayed'
  }
]

export const DirectorDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview')
  const [programs, setPrograms] = useState<any[]>([])
  const [incubatees, setIncubatees] = useState<any[]>([])
  const [complianceRecords, setComplianceRecords] = useState<any[]>([])
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerContent, setDrawerContent] = useState<React.ReactNode>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [notificationDrawerVisible, setNotificationDrawerVisible] =
    useState(false)
  const [tasks, setTasks] = useState<any[]>([])
  const [pendingApplications, setPendingApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([])
  const [overdueTasks, setOverdueTasks] = useState<any[]>([])
  const auth = getAuth()
  const currentUser = auth.currentUser

  useEffect(() => {
    const fetchData = async () => {
      try {
        const programSnap = await getDocs(collection(db, 'programs'))
        const participantSnap = await getDocs(collection(db, 'participants'))

        setPrograms(
          programSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        )

        const updatedParticipants = participantSnap.docs.map(doc => {
          const data = doc.data()
          const docs = data.complianceDocuments || []
          const validDocs = docs.filter(doc => doc.status === 'valid')
          const totalTypes = 7 // or use your documentTypes.length if consistent
          const complianceRate = Math.round(
            (validDocs.length / totalTypes) * 100
          )

          return {
            id: doc.id,
            ...data,
            complianceRate
          }
        })

        setIncubatees(updatedParticipants)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      }
    }

    fetchData()
  }, [])
  // 🔽 Load notifications on mount
  useEffect(() => {
    const fetchNotifications = async () => {
      const q = query(
        collection(db, 'notifications'),
        where('recipientRoles', 'array-contains', 'director')
      )
      const snapshot = await getDocs(q)
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setNotifications(all)
    }

    fetchNotifications()
  }, [])
  useEffect(() => {
    const fetchTasksAndApplications = async () => {
      setLoading(true)
      try {
        const taskSnap = await getDocs(collection(db, 'tasks'))
        const applicationSnap = await getDocs(collection(db, 'applications'))

        const now = dayjs()
        const upcoming: any[] = []
        const overdue: any[] = []

        taskSnap.docs.forEach(doc => {
          const task = { id: doc.id, ...doc.data() }
          const dueDate = task.dueDate?.toDate?.()

          if (!dueDate) return

          const due = dayjs(dueDate)
          if (due.isBefore(now, 'day')) {
            overdue.push(task)
          } else if (due.isBefore(now.add(7, 'days'), 'day')) {
            upcoming.push(task)
          }
        })

        const pendingApps = applicationSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(app => app.applicationStatus?.toLowerCase() === 'pending')

        setPendingApplications(pendingApps)

        setTasks([...overdue, ...upcoming])
        setOverdueTasks(overdue)
        setUpcomingTasks(upcoming)
        setPendingApplications(pendingApps)
      } catch (err) {
        console.error('Failed to fetch overview data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTasksAndApplications()
  }, [])

  const getCurrentUserCompanyCode = async () => {
    const email = currentUser?.email
    if (!email) return null

    const userSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', email))
    )

    return userSnap.docs[0]?.data()?.companyCode || null
  }

  const getRelevantOpsUsers = async (companyCode: string) => {
    const opsSnap = await getDocs(
      query(
        collection(db, 'users'),
        where('role', '==', 'operations'),
        where('companyCode', '==', companyCode)
      )
    )
    return opsSnap.docs.map(doc => doc.id) // these are user IDs
  }

  const getOverallComplianceRate = () => {
    if (incubatees.length === 0) return 0
    const total = incubatees.reduce(
      (sum, p) => sum + (p.complianceRate || 0),
      0
    )
    return Math.round(total / incubatees.length)
  }

  const getComplianceRate = (participant: any): number => {
    const docs = participant.complianceDocuments || []
    const totalRequired = 7 // adjust to match your required doc count
    const validDocs = docs.filter(doc => doc.status === 'valid')
    return Math.round((validDocs.length / totalRequired) * 100)
  }

  const sendNotification = async (payload: any) => {
    console.log('[🔔 Sending Notification]', payload) // ✅ Add this

    try {
      await addDoc(collection(db, 'notifications'), {
        ...payload,
        createdAt: new Date(),
        readBy: {}
      })
      message.success('Reminder sent.')
    } catch (err) {
      console.error('[❌ Failed to send notification]', err)
      message.error('Could not send notification.')
    }
  }

  const remindUser = (task: any) => {
    if (!task.assignedRole || !task.assignedTo) {
      console.warn('[⚠️ Missing assignment info] Task:', task)
      return message.warning('Task must have an assigned user and role.')
    }

    const isOverdue = dayjs(task.dueDate.toDate()).isBefore(dayjs(), 'day')
    const formattedDate = dayjs(task.dueDate.toDate()).format('YYYY-MM-DD')

    const role = task.assignedRole
    const messageText = isOverdue
      ? `🚨 Your task "${task.title}" is OVERDUE (was due ${formattedDate}). Please take action.`
      : `⏳ Reminder: Your task "${task.title}" is due on ${formattedDate}.`

    sendNotification({
      message: {
        [role]: messageText
      },
      recipientRoles: [role],
      recipientIds: [task.assignedTo]
    })
  }

  const remindReviewApplications = async () => {
    try {
      const companyCode = await getCurrentUserCompanyCode()
      if (!companyCode) {
        console.warn('[⚠️ Missing Company Code]')
        return message.warning('Company code not found.')
      }

      const opsUserIds = await getRelevantOpsUsers(companyCode)

      if (!opsUserIds.length) {
        console.info(
          '[ℹ️ No operations users found for this company]',
          companyCode
        )
        return message.info('No operations users found for your company.')
      }

      console.log('[🔔 Notifying Ops IDs]', opsUserIds)

      const reminderText = `There are ${pendingApplications.length} pending applications awaiting review.`

      await sendNotification({
        message: {
          operations: reminderText
        },
        recipientRoles: ['operations'],
        recipientIds: opsUserIds,
        type: 'application-reminder'
      })
    } catch (err) {
      console.error('Failed to send reminder to ops:', err)
      message.error('Could not send notification.')
    }
  }

  const calculateParticipantCompliance = participant => {
    const docs = participant.complianceDocuments || []
    const validDocs = docs.filter(doc => doc.status === 'valid')
    const totalTypes = 7 // or get this dynamically if needed

    return Math.round((validDocs.length / totalTypes) * 100)
  }

  const overallCompliance = () => {
    if (!complianceRecords.length) return 0
    const avg =
      complianceRecords.reduce((acc, r) => acc + (r.complianceRate || 0), 0) /
      complianceRecords.length
    return Math.round(avg)
  }

  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Strategic Dashboard Content
  const renderStrategicDashboard = () => {
    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24}>
            <Card>
              <Tabs
                defaultActiveKey='program'
                onChange={key => console.log(key)}
              >
                <TabPane
                  tab={
                    <span>
                      <ProjectOutlined />
                      Program Overview
                    </span>
                  }
                  key='program'
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Total Programs'
                          value={programs.length}
                          prefix={<ProjectOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Active Startups'
                          value={
                            incubatees.filter(p => p.stage === 'Startup').length
                          }
                          prefix={<TeamOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Success Rate'
                          value={sampleAnalytics.successRate}
                          suffix='%'
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Program Compliance'
                          value={getOverallComplianceRate()}
                          suffix='%'
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{
                            color:
                              getOverallComplianceRate() > 80
                                ? '#3f8600'
                                : '#cf1322'
                          }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title='Incubation Programs' style={{ marginTop: 16 }}>
                    <Table dataSource={programs} rowKey='id' pagination={false}>
                      <Table.Column
                        title='Program'
                        dataIndex='name'
                        key='name'
                      />
                      <Table.Column title='Type' dataIndex='type' key='type' />
                      <Table.Column
                        title='Progress'
                        dataIndex='progress'
                        key='progress'
                        render={progress => (
                          <Progress
                            percent={progress}
                            size='small'
                            status={
                              progress < 50
                                ? 'exception'
                                : progress < 80
                                ? 'active'
                                : 'success'
                            }
                          />
                        )}
                      />

                      <Table.Column
                        title='Status'
                        dataIndex='status'
                        key='status'
                        filters={[
                          { text: 'Active', value: 'Active' },
                          { text: 'Completed', value: 'Completed' },
                          { text: 'Upcoming', value: 'Upcoming' }
                        ]}
                        onFilter={(value, record) => record.status === value}
                        render={status => (
                          <Tag
                            color={
                              status === 'Active'
                                ? 'green'
                                : status === 'Ending'
                                ? 'orange'
                                : 'red'
                            }
                          >
                            {status}
                          </Tag>
                        )}
                      />
                      <Table.Column
                        title='Budget Utilization'
                        key='budget'
                        render={record => {
                          const utilization = Math.round(
                            (record.spent / record.budget) * 100
                          )
                          return (
                            <div>
                              <Progress
                                percent={Math.round(
                                  (record.spent / record.budget) * 100
                                )}
                                size='small'
                                status={
                                  record.spent / record.budget > 0.9
                                    ? 'exception'
                                    : 'normal'
                                }
                              />

                              <div style={{ fontSize: '12px', color: '#888' }}>
                                {formatCurrency(record.spent)} of{' '}
                                {formatCurrency(record.budget)}
                              </div>
                            </div>
                          )
                        }}
                      />
                      <Table.Column
                        title='Actions'
                        key='actions'
                        render={() => (
                          <Space>
                            <Button size='small'>Details</Button>
                            <Button size='small' type='primary'>
                              Manage
                            </Button>
                          </Space>
                        )}
                      />
                    </Table>
                  </Card>
                </TabPane>

                <TabPane
                  tab={
                    <span>
                      <AreaChartOutlined />
                      Success Metrics
                    </span>
                  }
                  key='kpis'
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Average Funding Secured'
                          value={sampleAnalytics.avgFundingSecured}
                          prefix={<DollarOutlined />}
                          formatter={value => formatCurrency(Number(value))}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Active Mentors'
                          value={sampleAnalytics.activeMentors}
                          prefix={<TeamOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Productivity Ratio'
                          value={sampleAnalytics.roi}
                          prefix={<FundOutlined />}
                          precision={1}
                          suffix='x'
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card
                    title='Key Performance Indicators'
                    style={{ marginTop: 16 }}
                  >
                    <Table
                      dataSource={sampleKPIData}
                      rowKey='metric'
                      pagination={false}
                    >
                      <Table.Column
                        title='Metric'
                        dataIndex='metric'
                        key='metric'
                        render={text => <Text strong>{text}</Text>}
                      />
                      <Table.Column
                        title='Target'
                        key='target'
                        render={record => (
                          <span>
                            {record.metric.includes('Funding')
                              ? formatCurrency(record.target)
                              : `${record.target.toLocaleString()} ${
                                  record.unit
                                }`}
                          </span>
                        )}
                      />
                      <Table.Column
                        title='Actual'
                        key='actual'
                        render={record => (
                          <span>
                            {record.metric.includes('Funding')
                              ? formatCurrency(record.actual)
                              : `${record.actual.toLocaleString()} ${
                                  record.unit
                                }`}
                          </span>
                        )}
                      />
                      <Table.Column
                        title='Progress'
                        key='progress'
                        render={record => {
                          const progress = Math.round(
                            (record.actual / record.target) * 100
                          )
                          let status:
                            | 'success'
                            | 'exception'
                            | 'active'
                            | 'normal' = 'normal'

                          if (progress >= 100) {
                            status = 'success'
                          } else if (progress < 80) {
                            status = 'exception'
                          } else {
                            status = 'active'
                          }

                          return (
                            <Progress
                              percent={progress}
                              size='small'
                              status={status}
                            />
                          )
                        }}
                      />
                      <Table.Column
                        title='Status'
                        dataIndex='status'
                        key='status'
                        render={status => {
                          let color = 'blue'
                          if (status === 'Exceeding') color = 'green'
                          if (status === 'At Risk') color = 'red'

                          return <Tag color={color}>{status}</Tag>
                        }}
                      />
                    </Table>
                  </Card>
                </TabPane>

                <TabPane
                  tab={
                    <span>
                      <ApartmentOutlined />
                      Resource Utilization
                    </span>
                  }
                  key='resources'
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Resource Utilization'
                          value={sampleAnalytics.resourceUtilization}
                          suffix='%'
                          prefix={<PieChartOutlined />}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Active Programs'
                          value={
                            programs.filter(p => p.status === 'Active').length
                          }
                          prefix={<ProjectOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Capacity Usage'
                          value={81}
                          suffix='%'
                          prefix={<PieChartOutlined />}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title='Resource Allocation' style={{ marginTop: 16 }}>
                    <Table
                      dataSource={sampleResourcesData}
                      rowKey='resource'
                      pagination={false}
                    >
                      <Table.Column
                        title='Resource'
                        dataIndex='resource'
                        key='resource'
                      />
                      <Table.Column
                        title='Total Available'
                        dataIndex='available'
                        key='available'
                      />
                      <Table.Column
                        title='Currently Utilized'
                        dataIndex='utilized'
                        key='utilized'
                      />
                      <Table.Column
                        title='Utilization'
                        key='utilization'
                        render={record => (
                          <Progress
                            percent={record.utilization}
                            size='small'
                            status={
                              record.utilization < 60
                                ? 'exception'
                                : record.utilization > 90
                                ? 'success'
                                : 'active'
                            }
                          />
                        )}
                      />
                      <Table.Column
                        title='Status'
                        key='status'
                        render={record => {
                          let status = 'Optimal'
                          let color = 'green'

                          if (record.utilization < 60) {
                            status = 'Underutilized'
                            color = 'orange'
                          } else if (record.utilization > 90) {
                            status = 'Near Capacity'
                            color = 'gold'
                          }

                          return <Tag color={color}>{status}</Tag>
                        }}
                      />
                    </Table>
                  </Card>
                </TabPane>

                <TabPane
                  tab={
                    <span>
                      <DollarOutlined />
                      Financial Tracking
                    </span>
                  }
                  key='financial'
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Total Budget'
                          value={sampleAnalytics.totalBudget}
                          prefix={<DollarOutlined />}
                          formatter={value => formatCurrency(Number(value))}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Budget Utilized'
                          value={sampleAnalytics.budgetUtilized}
                          prefix={<DollarOutlined />}
                          formatter={value => formatCurrency(Number(value))}
                        />
                        <div style={{ marginTop: 8 }}>
                          <Progress
                            percent={Math.round(
                              (sampleAnalytics.budgetUtilized /
                                sampleAnalytics.totalBudget) *
                                100
                            )}
                            size='small'
                          />
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Remaining Budget'
                          value={
                            sampleAnalytics.totalBudget -
                            sampleAnalytics.budgetUtilized
                          }
                          prefix={<DollarOutlined />}
                          formatter={value => formatCurrency(Number(value))}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card
                    title='Budget Allocation by Category'
                    style={{ marginTop: 16 }}
                  >
                    <Table
                      dataSource={sampleFinancialData}
                      rowKey='category'
                      pagination={false}
                      summary={pageData => {
                        let totalAllocated = 0
                        let totalSpent = 0
                        let totalRemaining = 0

                        pageData.forEach(({ allocated, spent, remaining }) => {
                          totalAllocated += allocated
                          totalSpent += spent
                          totalRemaining += remaining
                        })

                        return (
                          <Table.Summary.Row style={{ fontWeight: 'bold' }}>
                            <Table.Summary.Cell index={0}>
                              Total
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1}>
                              {formatCurrency(totalAllocated)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2}>
                              {formatCurrency(totalSpent)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={3}>
                              {formatCurrency(totalRemaining)}
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4}>
                              <Progress
                                percent={Math.round(
                                  (totalSpent / totalAllocated) * 100
                                )}
                                size='small'
                              />
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        )
                      }}
                    >
                      <Table.Column
                        title='Category'
                        dataIndex='category'
                        key='category'
                      />
                      <Table.Column
                        title='Allocated'
                        dataIndex='allocated'
                        key='allocated'
                        render={value => formatCurrency(value)}
                      />
                      <Table.Column
                        title='Spent'
                        dataIndex='spent'
                        key='spent'
                        render={value => formatCurrency(value)}
                      />
                      <Table.Column
                        title='Remaining'
                        dataIndex='remaining'
                        key='remaining'
                        render={value => formatCurrency(value)}
                      />
                      <Table.Column
                        title='Utilization'
                        key='utilization'
                        render={record => (
                          <Progress
                            percent={Math.round(
                              (record.spent / record.allocated) * 100
                            )}
                            size='small'
                            status={
                              record.spent / record.allocated > 0.9
                                ? 'exception'
                                : 'normal'
                            }
                          />
                        )}
                      />
                    </Table>
                  </Card>
                </TabPane>
              </Tabs>
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  // Main Dashboard Overview
  const renderDashboardOverview = () => {
    return (
      <>
        {' '}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Total Incubatees'
                value={incubatees.length}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Active Programs'
                value={programs.filter(p => p.status === 'Active').length}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Compliance Rate'
                value={overallCompliance()}
                suffix='%'
                prefix={<CheckCircleOutlined />}
                valueStyle={{
                  color: overallCompliance() > 80 ? '#3f8600' : '#cf1322'
                }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Average Progress'
                value={sampleAnalytics.averageProgress}
                suffix='%'
                prefix={<RiseOutlined />}
              />
            </Card>
          </Col>
        </Row>
        <Spin spinning={loading}>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card title='🔴 Overdue Tasks'>
                <List
                  dataSource={overdueTasks}
                  renderItem={item => (
                    <List.Item
                      actions={[
                        <Button size='small' onClick={() => remindUser(item)}>
                          Remind
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={item.title}
                        description={`Due: ${dayjs(
                          item.dueDate.toDate()
                        ).format('YYYY-MM-DD')}`}
                      />
                      <Tag color='red'>Overdue</Tag>
                      <Tag>{item.assignedRole}</Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                title='📩 Applications Needing Review'
                extra={
                  <Button
                    size='small'
                    type='primary'
                    icon={<BellOutlined />}
                    onClick={remindReviewApplications}
                  >
                    Remind Ops
                  </Button>
                }
              >
                <List
                  dataSource={pendingApplications}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          item.beneficiaryName ||
                          item.participantName ||
                          'Unnamed'
                        }
                        description={item.email}
                      />
                      <Tag color='gold'>Pending</Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
          </Row>
        </Spin>
      </>
    )
  }

  // Portfolio Management Content
  const renderPortfolioManagement = () => {
    return (
      <div>
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24}>
            <Card>
              <Tabs
                defaultActiveKey='companies'
                onChange={key => console.log(key)}
              >
                <TabPane
                  tab={
                    <span>
                      <TeamOutlined />
                      Portfolio Companies
                    </span>
                  }
                  key='companies'
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Total Portfolio Companies'
                          value={samplePortfolioData.length}
                          prefix={<TeamOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Total Portfolio Value'
                          value={samplePortfolioData.reduce(
                            (sum, company) => sum + company.valuation,
                            0
                          )}
                          prefix={<DollarOutlined />}
                          formatter={value => formatCurrency(Number(value))}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Avg. Growth Rate'
                          value={Math.round(
                            samplePortfolioData.reduce(
                              (sum, company) =>
                                sum + company.metrics.growthRate,
                              0
                            ) / samplePortfolioData.length
                          )}
                          suffix='%'
                          prefix={<RiseOutlined />}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='High Risk Companies'
                          value={
                            samplePortfolioData.filter(
                              company => company.risk === 'High'
                            ).length
                          }
                          prefix={<WarningOutlined />}
                          valueStyle={{ color: '#cf1322' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title='Portfolio Companies' style={{ marginTop: 16 }}>
                    <Table
                      dataSource={samplePortfolioData}
                      rowKey='id'
                      pagination={{ pageSize: 10 }}
                    >
                      <Table.Column
                        title='Company'
                        key='name'
                        render={record => (
                          <Space>
                            <Avatar style={{ backgroundColor: '#1890ff' }}>
                              {record.name.charAt(0)}
                            </Avatar>
                            <span>{record.name}</span>
                          </Space>
                        )}
                        sorter={(a, b) => a.name.localeCompare(b.name)}
                      />
                      <Table.Column
                        title='Sector'
                        dataIndex='sector'
                        key='sector'
                        filters={[
                          { text: 'FinTech', value: 'FinTech' },
                          { text: 'HealthTech', value: 'HealthTech' },
                          { text: 'CleanEnergy', value: 'CleanEnergy' },
                          { text: 'EdTech', value: 'EdTech' },
                          { text: 'Agriculture', value: 'Agriculture' }
                        ]}
                        onFilter={(value, record) => record.sector === value}
                        render={sector => <Tag color='blue'>{sector}</Tag>}
                      />
                      <Table.Column
                        title='Stage'
                        dataIndex='stage'
                        key='stage'
                        filters={[
                          { text: 'Seed', value: 'Seed' },
                          { text: 'Early Growth', value: 'Early Growth' },
                          { text: 'Growth', value: 'Growth' }
                        ]}
                        onFilter={(value, record) => record.stage === value}
                      />
                      <Table.Column
                        title='Valuation'
                        dataIndex='valuation'
                        key='valuation'
                        render={valuation => formatCurrency(valuation)}
                        sorter={(a, b) => a.valuation - b.valuation}
                      />
                      {/* <Table.Column
                        title='Required Funding'
                        dataIndex='investment'
                        key='investment'
                        render={investment => formatCurrency(investment)}
                        sorter={(a, b) => a.investment - b.investment}
                      /> */}
                      <Table.Column
                        title='Progress'
                        dataIndex='progress'
                        key='progress'
                        render={progress => (
                          <Progress
                            percent={progress}
                            size='small'
                            status={
                              progress < 50
                                ? 'exception'
                                : progress < 80
                                ? 'active'
                                : 'success'
                            }
                          />
                        )}
                        sorter={(a, b) => a.progress - b.progress}
                      />
                      <Table.Column
                        title='Risk'
                        dataIndex='risk'
                        key='risk'
                        render={risk => {
                          let color = 'green'
                          if (risk === 'Medium') color = 'orange'
                          if (risk === 'High') color = 'red'

                          return <Tag color={color}>{risk}</Tag>
                        }}
                        filters={[
                          { text: 'Low', value: 'Low' },
                          { text: 'Medium', value: 'Medium' },
                          { text: 'High', value: 'High' }
                        ]}
                        onFilter={(value, record) => record.risk === value}
                      />
                      <Table.Column
                        title='Actions'
                        key='actions'
                        render={() => (
                          <Space>
                            <Button size='small'>Details</Button>
                            <Button size='small' type='primary'>
                              Metrics
                            </Button>
                          </Space>
                        )}
                      />
                    </Table>
                  </Card>
                </TabPane>

                <TabPane
                  tab={
                    <span>
                      <PieChartOutlined />
                      Sector Analysis
                    </span>
                  }
                  key='sectors'
                >
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Total Sectors'
                          value={sampleSectorData.length}
                          prefix={<ApartmentOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Best Performing Sector'
                          value='EdTech'
                          prefix={<RiseOutlined />}
                          valueStyle={{ color: '#3f8600' }}
                        />
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>
                          Performance Score: 81%
                        </div>
                      </Card>
                    </Col>
                    <Col xs={24} md={8}>
                      <Card>
                        <Statistic
                          title='Strategic Focus Recommendation'
                          value='FinTech & EdTech'
                          prefix={<FundOutlined />}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title='Sector Performance' style={{ marginTop: 16 }}>
                    <Table
                      dataSource={sampleSectorData}
                      rowKey='sector'
                      pagination={false}
                    >
                      <Table.Column
                        title='Sector'
                        dataIndex='sector'
                        key='sector'
                        render={sector => <Tag color='blue'>{sector}</Tag>}
                      />
                      <Table.Column
                        title='Companies'
                        dataIndex='companies'
                        key='companies'
                        sorter={(a, b) => a.companies - b.companies}
                      />
                      <Table.Column
                        title='Total Funding Received'
                        dataIndex='totalInvestment'
                        key='totalInvestment'
                        render={value => formatCurrency(value)}
                        sorter={(a, b) => a.totalInvestment - b.totalInvestment}
                      />
                      <Table.Column
                        title='Average Valuation'
                        dataIndex='averageValuation'
                        key='averageValuation'
                        render={value => formatCurrency(value)}
                        sorter={(a, b) =>
                          a.averageValuation - b.averageValuation
                        }
                      />
                      <Table.Column
                        title='Performance Score'
                        dataIndex='performance'
                        key='performance'
                        render={performance => (
                          <Progress
                            percent={performance}
                            size='small'
                            status={
                              performance < 50
                                ? 'exception'
                                : performance < 70
                                ? 'active'
                                : 'success'
                            }
                          />
                        )}
                        sorter={(a, b) => a.performance - b.performance}
                      />
                      <Table.Column
                        title='Status'
                        key='status'
                        render={record => {
                          let status = 'Average'
                          let color = 'blue'

                          if (record.performance < 50) {
                            status = 'Underperforming'
                            color = 'red'
                          } else if (record.performance >= 75) {
                            status = 'High Performing'
                            color = 'green'
                          }

                          return <Tag color={color}>{status}</Tag>
                        }}
                      />
                    </Table>
                  </Card>
                </TabPane>
              </Tabs>
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Director Dashboard | Incubation Platform</title>
      </Helmet>
      <div style={{ padding: '20px' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <BarChartOutlined />
                Overview
              </span>
            }
            key='overview'
          >
            {renderDashboardOverview()}
          </TabPane>

          <TabPane
            tab={
              <span>
                <FundOutlined />
                Strategic Dashboard
              </span>
            }
            key='strategic'
          >
            {renderStrategicDashboard()}
          </TabPane>

          <TabPane
            tab={
              <span>
                <ProjectOutlined />
                Portfolio Management
              </span>
            }
            key='portfolio'
          >
            {renderPortfolioManagement()}
          </TabPane>

          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                Strategic Decisions
              </span>
            }
            key='decisions'
          >
            <Paragraph>
              Strategic Decision-Making content will be implemented next
            </Paragraph>
          </TabPane>
        </Tabs>
      </div>
      <Drawer
        title='Director Notifications'
        placement='right'
        width={400}
        onClose={() => setNotificationDrawerVisible(false)}
        open={notificationDrawerVisible}
      >
        <List
          itemLayout='horizontal'
          dataSource={notifications}
          renderItem={item => (
            <List.Item>
              <List.Item.Meta
                title={item.message?.director || 'Untitled'}
                description={new Date(
                  item.createdAt?.seconds * 1000
                ).toLocaleString()}
              />
            </List.Item>
          )}
        />
      </Drawer>

      <Drawer
        title='Details'
        placement='bottom'
        height={320}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
      >
        {drawerContent}
      </Drawer>
    </>
  )
}
