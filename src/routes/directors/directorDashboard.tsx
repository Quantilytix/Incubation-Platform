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
  Tooltip
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
  AreaChartOutlined
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

// Sample data - in a real application, this would come from Firebase
const sampleIncubateesData = [
  {
    id: 1,
    name: 'TechInnovate',
    status: 'Active',
    compliance: 95,
    sector: 'FinTech',
    progress: 72,
    risk: 'Low'
  },
  {
    id: 2,
    name: 'GreenSolutions',
    status: 'Active',
    compliance: 87,
    sector: 'CleanEnergy',
    progress: 56,
    risk: 'Medium'
  },
  {
    id: 3,
    name: 'HealthPlus',
    status: 'Warning',
    compliance: 73,
    sector: 'HealthTech',
    progress: 45,
    risk: 'High'
  },
  {
    id: 4,
    name: 'EduConnect',
    status: 'Active',
    compliance: 91,
    sector: 'EdTech',
    progress: 81,
    risk: 'Low'
  },
  {
    id: 5,
    name: 'AgriTech Systems',
    status: 'Warning',
    compliance: 68,
    sector: 'Agriculture',
    progress: 38,
    risk: 'High'
  }
]

const sampleProgramsData = [
  {
    id: 1,
    name: 'Accelerator 2024',
    startups: 12,
    progress: 65,
    status: 'Active',
    budget: 250000,
    spent: 180000
  },
  {
    id: 2,
    name: 'Scale-Up Cohort',
    startups: 8,
    progress: 92,
    status: 'Ending',
    budget: 180000,
    spent: 162000
  },
  {
    id: 3,
    name: 'Early Stage Ventures',
    startups: 15,
    progress: 38,
    status: 'Active',
    budget: 300000,
    spent: 110000
  }
]

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
                          value={3}
                          prefix={<ProjectOutlined />}
                        />
                      </Card>
                    </Col>
                    <Col xs={24} md={6}>
                      <Card>
                        <Statistic
                          title='Active Startups'
                          value={sampleAnalytics.totalIncubatees}
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
                          value={sampleAnalytics.complianceRate}
                          suffix='%'
                          prefix={<CheckCircleOutlined />}
                          valueStyle={{
                            color:
                              sampleAnalytics.complianceRate > 80
                                ? '#3f8600'
                                : '#cf1322'
                          }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Card title='Incubation Programs' style={{ marginTop: 16 }}>
                    <Table
                      dataSource={sampleProgramsData}
                      rowKey='id'
                      pagination={false}
                    >
                      <Table.Column
                        title='Program'
                        dataIndex='name'
                        key='name'
                      />
                      <Table.Column
                        title='Startups'
                        dataIndex='startups'
                        key='startups'
                      />
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
                                percent={utilization}
                                size='small'
                                status={
                                  utilization > 90 ? 'exception' : 'normal'
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
                          title='Active Projects'
                          value={sampleAnalytics.activeProjects}
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
      <div>
        {/* Key Metrics */}
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Total Incubatees'
                value={sampleAnalytics.totalIncubatees}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Active Projects'
                value={sampleAnalytics.activeProjects}
                prefix={<BarChartOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic
                title='Compliance Rate'
                value={sampleAnalytics.complianceRate}
                suffix='%'
                prefix={<CheckCircleOutlined />}
                valueStyle={{
                  color:
                    sampleAnalytics.complianceRate > 80 ? '#3f8600' : '#cf1322'
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

        <Row gutter={[16, 16]}>
          {/* Attention Required */}
          <Col xs={24} md={12}>
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: '#ff4d4f' }} />
                  <span>Attention Required</span>
                </Space>
              }
              style={{ marginBottom: '24px' }}
            >
              <List
                size='small'
                dataSource={[
                  //   {
                  //     text: 'Pending approvals',
                  //     count: sampleAnalytics.pendingApprovals
                  //   },
                  {
                    text: 'Upcoming deadlines',
                    count: sampleAnalytics.upcomingDeadlines
                  },
                  { text: 'Compliance Issues', count: 3 },
                  { text: 'Recommended Interventions Reviews', count: 5 }
                ]}
                renderItem={item => (
                  <List.Item>
                    <Space>
                      <ClockCircleOutlined />
                      <Text>{item.text}</Text>
                    </Space>
                    <Tag color='red'>{item.count}</Tag>
                  </List.Item>
                )}
              />
            </Card>
          </Col>

          {/* Incubatees Status */}
          <Col xs={24} md={12}>
            <Card
              title={
                <Space>
                  <TeamOutlined />
                  <span>Incubatees Status</span>
                </Space>
              }
              style={{ marginBottom: '24px' }}
            >
              <List
                size='small'
                dataSource={sampleIncubateesData}
                renderItem={item => (
                  <List.Item>
                    <div>
                      <Text strong>{item.name}</Text>
                      <br />
                      <Text type='secondary'>{item.sector}</Text>
                    </div>
                    <Space>
                      <Tag
                        color={
                          item.compliance > 80
                            ? 'green'
                            : item.compliance > 70
                            ? 'orange'
                            : 'red'
                        }
                      >
                        {item.compliance}% Compliance
                      </Tag>
                      <Tag
                        color={item.status === 'Active' ? 'blue' : 'volcano'}
                      >
                        {item.status}
                      </Tag>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </div>
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
  )
}
