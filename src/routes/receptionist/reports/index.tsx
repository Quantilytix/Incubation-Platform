import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  DatePicker, 
  Select, 
  Button, 
  Space, 
  Table,
  Breadcrumb,
  message,
  Spin
} from 'antd'
import { 
  BarChartOutlined, 
  PieChartOutlined, 
  RiseOutlined, 
  DownloadOutlined,
  HomeOutlined,
  CalendarOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { inquiryService } from '@/services/inquiryService'
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns'
import { Line, Column, Pie } from '@ant-design/plots'
import type { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'

const { RangePicker } = DatePicker
const { Option } = Select

interface ReportData {
  inquiriesByStatus: { status: string; count: number }[]
  inquiriesBySource: { source: string; count: number }[]
  inquiriesByDay: { date: string; count: number }[]
  conversionRate: number
  averageResponseTime: number
  totalInquiries: number
  topPerformingDays: { date: string; count: number }[]
  inquiryTrends: { period: string; count: number }[]
}

interface PerformanceMetric {
  metric: string
  thisMonth: number
  lastMonth: number
  change: number
  changePercent: string
}

const ReceptionistReports: React.FC = () => {
  const { user, loading: userLoading } = useAuth()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [reportType, setReportType] = useState<string>('summary')

  const loadReportData = React.useCallback(async () => {
    if (!user?.assignedBranch) {
      console.error('ReceptionistReports: No branch assigned to user')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('ReceptionistReports: Generating report for branch:', user.assignedBranch)
      
      // Get all inquiries for the branch
      const inquiries = await inquiryService.getInquiriesByBranch(user.assignedBranch)
      
      // Filter inquiries by date range if selected
      let filteredInquiries = inquiries
      if (dateRange && dateRange[0] && dateRange[1]) {
        const startDate = startOfDay(dateRange[0].toDate())
        const endDate = endOfDay(dateRange[1].toDate())
        filteredInquiries = inquiries.filter(inquiry => {
          const inquiryDate = new Date(inquiry.submittedAt)
          return inquiryDate >= startDate && inquiryDate <= endDate
        })
      }

      // Generate report data
      const statusCounts = new Map<string, number>()
      const sourceCounts = new Map<string, number>()
      const dailyCounts = new Map<string, number>()

      filteredInquiries.forEach(inquiry => {
        // Status breakdown
        const status = inquiry.status
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1)

        // Source breakdown
        const source = inquiry.source
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1)

        // Daily breakdown
        const date = format(new Date(inquiry.submittedAt), 'yyyy-MM-dd')
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1)
      })

      // Calculate metrics
      const totalInquiries = filteredInquiries.length
      const completedInquiries = filteredInquiries.filter(i => i.status === 'Converted').length
      const conversionRate = totalInquiries > 0 ? (completedInquiries / totalInquiries) * 100 : 0

      // Average response time (mock calculation - would need actual timestamps)
      const averageResponseTime = 24 // hours

      const reportData: ReportData = {
        inquiriesByStatus: Array.from(statusCounts.entries()).map(([status, count]) => ({
          status,
          count
        })),
        inquiriesBySource: Array.from(sourceCounts.entries()).map(([source, count]) => ({
          source,
          count
        })),
        inquiriesByDay: Array.from(dailyCounts.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({
            date: format(new Date(date), 'MMM dd'),
            count
          })),
        conversionRate,
        averageResponseTime,
        totalInquiries,
        topPerformingDays: Array.from(dailyCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([date, count]) => ({
            date: format(new Date(date), 'MMM dd, yyyy'),
            count
          })),
        inquiryTrends: Array.from(dailyCounts.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({
            period: format(new Date(date), 'MMM dd'),
            count
          }))
      }

      // Calculate performance metrics (current vs previous period)
      const currentMonth = new Date()
      const lastMonth = subMonths(currentMonth, 1)
      
      const currentMonthInquiries = inquiries.filter(i => {
        const date = new Date(i.submittedAt)
        return date >= startOfMonth(currentMonth) && date <= endOfMonth(currentMonth)
      })
      
      const lastMonthInquiries = inquiries.filter(i => {
        const date = new Date(i.submittedAt)
        return date >= startOfMonth(lastMonth) && date <= endOfMonth(lastMonth)
      })

      const metrics: PerformanceMetric[] = [
        {
          metric: 'Total Inquiries',
          thisMonth: currentMonthInquiries.length,
          lastMonth: lastMonthInquiries.length,
          change: currentMonthInquiries.length - lastMonthInquiries.length,
          changePercent: lastMonthInquiries.length > 0 
            ? (((currentMonthInquiries.length - lastMonthInquiries.length) / lastMonthInquiries.length) * 100).toFixed(1)
            : '0'
        },
        {
          metric: 'Conversion Rate',
          thisMonth: currentMonthInquiries.filter(i => i.status === 'Converted').length,
          lastMonth: lastMonthInquiries.filter(i => i.status === 'Converted').length,
          change: currentMonthInquiries.filter(i => i.status === 'Converted').length - 
                  lastMonthInquiries.filter(i => i.status === 'Converted').length,
          changePercent: lastMonthInquiries.filter(i => i.status === 'Converted').length > 0
            ? (((currentMonthInquiries.filter(i => i.status === 'Converted').length - 
                 lastMonthInquiries.filter(i => i.status === 'Converted').length) / 
                 lastMonthInquiries.filter(i => i.status === 'Converted').length) * 100).toFixed(1)
            : '0'
        }
      ]

      console.log('ReceptionistReports: Generated report data')
      setReportData(reportData)
      setPerformanceMetrics(metrics)
    } catch (error) {
      console.error('Error loading report data:', error)
      message.error('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }, [user?.assignedBranch, dateRange])

  useEffect(() => {
    if (user && user.assignedBranch) {
      loadReportData()
    }
  }, [user?.assignedBranch, loadReportData])

  const handleExportReport = () => {
    // Here you would implement actual export functionality
    message.success('Report export functionality will be implemented')
  }

  const performanceColumns: ColumnsType<PerformanceMetric> = [
    {
      title: 'Metric',
      dataIndex: 'metric',
      key: 'metric',
    },
    {
      title: 'This Month',
      dataIndex: 'thisMonth',
      key: 'thisMonth',
    },
    {
      title: 'Last Month',
      dataIndex: 'lastMonth',
      key: 'lastMonth',
    },
    {
      title: 'Change',
      key: 'change',
      render: (_, record) => (
        <span style={{ 
          color: record.change >= 0 ? '#52c41a' : '#ff4d4f',
          fontWeight: 500 
        }}>
          {record.change >= 0 ? '+' : ''}{record.change} ({record.changePercent}%)
        </span>
      ),
    },
  ]

  // Show loading while user data is being fetched
  if (userLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Card>
          <div style={{ padding: '40px 20px' }}>
            <h3>Loading user data...</h3>
          </div>
        </Card>
      </div>
    )
  }

  // Show proper message if user has no assigned branch
  if (user && !user.assignedBranch) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Card style={{ maxWidth: 500, margin: '0 auto' }}>
          <div style={{ padding: '40px 20px' }}>
            <h2>🏢 Branch Assignment Required</h2>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>
              You need to be assigned to a branch to access reports.
            </p>
            <p style={{ fontSize: '14px', color: '#888' }}>
              Please contact your <strong>Director</strong> to assign you to a branch through the User Management system.
            </p>
            <p style={{ fontSize: '12px', color: '#aaa', marginTop: '20px' }}>
              Directors can assign branches via: <em>User Management → Edit User → Select Branch</em>
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (loading || !reportData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Card>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>
            <h3>Generating reports...</h3>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/receptionist">
            <HomeOutlined /> Dashboard
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <BarChartOutlined /> Reports
        </Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px' 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
            Reception Reports
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            Analytics and insights for your branch performance
          </p>
        </div>
        <Button 
          type="primary" 
          icon={<DownloadOutlined />}
          onClick={handleExportReport}
        >
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: '8px' }}>
              <label>Report Type:</label>
            </div>
            <Select
              style={{ width: '100%' }}
              value={reportType}
              onChange={setReportType}
            >
              <Option value="summary">Summary Report</Option>
              <Option value="detailed">Detailed Analysis</Option>
              <Option value="performance">Performance Metrics</Option>
            </Select>
          </Col>
          <Col xs={24} sm={10}>
            <div style={{ marginBottom: '8px' }}>
              <label>Date Range:</label>
            </div>
            <RangePicker
              style={{ width: '100%' }}
              value={dateRange}
              onChange={setDateRange}
              placeholder={['Start Date', 'End Date']}
            />
          </Col>
          <Col xs={24} sm={6}>
            <div style={{ marginBottom: '8px' }}>
              <label>&nbsp;</label>
            </div>
            <Button 
              type="default" 
              onClick={() => {
                setDateRange(null)
                setReportType('summary')
              }}
            >
              Reset Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Key Metrics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Total Inquiries"
              value={reportData.totalInquiries}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Conversion Rate"
              value={reportData.conversionRate}
              precision={1}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Avg Response Time"
              value={reportData.averageResponseTime}
              suffix="hrs"
              prefix={<CalendarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Converted"
              value={reportData.inquiriesByStatus.find(s => s.status === 'Converted')?.count || 0}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        {/* Inquiries Trend */}
        <Col xs={24} lg={12}>
          <Card title="Inquiries Trend" extra={<BarChartOutlined />}>
            <Line
              data={reportData.inquiriesByDay}
              xField="date"
              yField="count"
              point={{ size: 5, shape: 'diamond' }}
              color="#1890ff"
              height={300}
            />
          </Card>
        </Col>

        {/* Status Breakdown */}
        <Col xs={24} lg={12}>
          <Card title="Status Breakdown" extra={<PieChartOutlined />}>
            <Pie
              data={reportData.inquiriesByStatus}
              angleField="count"
              colorField="status"
              radius={0.8}
              label={{
                type: 'outer',
                content: '{name} ({percentage})',
              }}
              height={300}
            />
          </Card>
        </Col>

        {/* Source Analysis */}
        <Col xs={24} lg={12}>
          <Card title="Inquiry Sources" extra={<BarChartOutlined />}>
            <Column
              data={reportData.inquiriesBySource}
              xField="source"
              yField="count"
              color="#52c41a"
              height={300}
            />
          </Card>
        </Col>

        {/* Performance Comparison */}
        <Col xs={24} lg={12}>
          <Card title="Month-over-Month Performance">
            <Table
              columns={performanceColumns}
              dataSource={performanceMetrics}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* Top Performing Days */}
      <Row gutter={16}>
        <Col xs={24}>
          <Card title="Top Performing Days">
            <Table
              columns={[
                {
                  title: 'Date',
                  dataIndex: 'date',
                  key: 'date',
                },
                {
                  title: 'Inquiries',
                  dataIndex: 'count',
                  key: 'count',
                  sorter: (a, b) => a.count - b.count,
                },
              ]}
              dataSource={reportData.topPerformingDays}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default ReceptionistReports 