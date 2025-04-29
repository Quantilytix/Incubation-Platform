import React, { useEffect, useState } from 'react'
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
  Button,
  Tabs,
  Space,
  Divider,
  Progress,
  Tooltip,
  Avatar,
  List,
  Badge,
  Modal,
  Form,
  InputNumber,
  Alert,
  Descriptions,
  message
} from 'antd'
import {
  DollarOutlined,
  UserOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  RiseOutlined,
  WalletOutlined,
  BarChartOutlined,
  BankOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  LineChartOutlined
} from '@ant-design/icons'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useNavigate } from 'react-router-dom'
import {
  getPortfolioData,
  calculatePortfolioMetrics,
  PortfolioInvestment
} from './services/portfolioService'
import { formatCurrency, getStatusColor } from './utils'

const { Title, Text, Paragraph } = Typography
const { TabPane } = Tabs

// Interface for investment opportunities
interface InvestmentOpportunity {
  id: string
  name: string
  logo?: string
  industry?: string
  location?: string
  description?: string
  fundingGoal?: number
  fundingRaised?: number
  progress?: number
  daysLeft?: number
  status?: string
  stage?: string
  team?: number
  requiredFunding?: number
  valuation?: number
  riskLevel?: string
  financialHistory?: FinancialData[]
  documents?: Document[]
}

// Interface for financial data
interface FinancialData {
  year: number
  quarter: number
  revenue: number
  expenses: number
  profit: number
}

// Interface for document
interface Document {
  id: string
  name: string
  type: string
  uploadDate: string
  size: string
  url: string
}

export const FunderDashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>(
    []
  )
  const [portfolio, setPortfolio] = useState<PortfolioInvestment[]>([])
  const [portfolioMetrics, setPortfolioMetrics] = useState({
    totalInvested: 0,
    totalCurrentValue: 0,
    totalROI: 0,
    averageROI: 0,
    investmentCount: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedOpportunity, setSelectedOpportunity] =
    useState<InvestmentOpportunity | null>(null)
  const [investModalVisible, setInvestModalVisible] = useState(false)
  const [investAmount, setInvestAmount] = useState<number>(0)
  const [potentialEquity, setPotentialEquity] = useState<number>(0)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false)
  const navigate = useNavigate()

  // Fetch investment opportunities and portfolio
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)

        // Sample investment opportunities
        const sampleOpportunities: InvestmentOpportunity[] = [
          {
            id: '1',
            name: 'TechSolutions Inc.',
            logo: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60',
            industry: 'Software',
            stage: 'Early',
            location: 'Cape Town, SA',
            description:
              'Cloud-based software solutions for small businesses with focus on automation and efficiency',
            status: 'active',
            progress: 32,
            fundingGoal: 750000,
            fundingRaised: 240000,
            daysLeft: 45,
            team: 4,
            requiredFunding: 500000,
            valuation: 2500000,
            riskLevel: 'Medium',
            financialHistory: [
              {
                year: 2022,
                quarter: 4,
                revenue: 120000,
                expenses: 90000,
                profit: 30000
              },
              {
                year: 2023,
                quarter: 1,
                revenue: 150000,
                expenses: 100000,
                profit: 50000
              },
              {
                year: 2023,
                quarter: 2,
                revenue: 180000,
                expenses: 110000,
                profit: 70000
              }
            ],
            documents: [
              {
                id: 'd1',
                name: 'Business Plan',
                type: 'PDF',
                uploadDate: '2023-06-15',
                size: '2.4MB',
                url: '#'
              },
              {
                id: 'd2',
                name: 'Financial Projections',
                type: 'Excel',
                uploadDate: '2023-07-02',
                size: '1.8MB',
                url: '#'
              },
              {
                id: 'd3',
                name: 'Pitch Deck',
                type: 'PowerPoint',
                uploadDate: '2023-07-10',
                size: '3.5MB',
                url: '#'
              }
            ]
          },
          {
            id: '2',
            name: 'GreenEnergy Startup',
            logo: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&auto=format&fit=crop&q=60',
            industry: 'Renewable Energy',
            stage: 'Growth',
            location: 'Johannesburg, SA',
            description:
              'Affordable solar solutions for residential and commercial properties with innovative financing models',
            status: 'active',
            progress: 68,
            fundingGoal: 1200000,
            fundingRaised: 816000,
            daysLeft: 30,
            team: 7,
            requiredFunding: 400000,
            valuation: 4200000,
            riskLevel: 'Low',
            financialHistory: [
              {
                year: 2022,
                quarter: 3,
                revenue: 350000,
                expenses: 280000,
                profit: 70000
              },
              {
                year: 2022,
                quarter: 4,
                revenue: 420000,
                expenses: 310000,
                profit: 110000
              },
              {
                year: 2023,
                quarter: 1,
                revenue: 480000,
                expenses: 320000,
                profit: 160000
              },
              {
                year: 2023,
                quarter: 2,
                revenue: 520000,
                expenses: 340000,
                profit: 180000
              }
            ],
            documents: [
              {
                id: 'd4',
                name: 'Business Plan',
                type: 'PDF',
                uploadDate: '2023-04-20',
                size: '3.1MB',
                url: '#'
              },
              {
                id: 'd5',
                name: 'Market Research',
                type: 'PDF',
                uploadDate: '2023-05-12',
                size: '4.2MB',
                url: '#'
              },
              {
                id: 'd6',
                name: 'Financial Statements',
                type: 'Excel',
                uploadDate: '2023-06-05',
                size: '2.0MB',
                url: '#'
              }
            ]
          },
          {
            id: '3',
            name: 'HealthTech Innovations',
            logo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60',
            industry: 'Healthcare',
            stage: 'Scaling',
            location: 'Durban, SA',
            description:
              'AI-powered diagnostic tools for rural healthcare facilities with limited access to specialists',
            status: 'warning',
            progress: 75,
            fundingGoal: 500000,
            fundingRaised: 375000,
            daysLeft: 15,
            team: 5,
            requiredFunding: 125000,
            valuation: 3500000,
            riskLevel: 'Medium',
            financialHistory: [
              {
                year: 2022,
                quarter: 3,
                revenue: 220000,
                expenses: 180000,
                profit: 40000
              },
              {
                year: 2022,
                quarter: 4,
                revenue: 280000,
                expenses: 200000,
                profit: 80000
              },
              {
                year: 2023,
                quarter: 1,
                revenue: 320000,
                expenses: 230000,
                profit: 90000
              }
            ],
            documents: [
              {
                id: 'd7',
                name: 'Business Plan',
                type: 'PDF',
                uploadDate: '2023-03-10',
                size: '2.8MB',
                url: '#'
              },
              {
                id: 'd8',
                name: 'Clinical Validation',
                type: 'PDF',
                uploadDate: '2023-04-22',
                size: '5.1MB',
                url: '#'
              }
            ]
          }
        ]

        // Get portfolio data from the service
        const portfolioData = await getPortfolioData()
        const metrics = calculatePortfolioMetrics(portfolioData)

        setOpportunities(sampleOpportunities)
        setPortfolio(portfolioData)
        setPortfolioMetrics(metrics)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // View opportunity details
  const handleViewDetails = (opportunity: InvestmentOpportunity) => {
    setSelectedOpportunity(opportunity)
    setDetailsModalVisible(true)
  }

  // Open investment modal
  const handleInvest = (opportunity: InvestmentOpportunity) => {
    setSelectedOpportunity(opportunity)
    setInvestModalVisible(true)

    // Reset investment amount
    setInvestAmount(0)
    setPotentialEquity(0)
  }

  // Calculate potential equity based on investment amount
  const calculatePotentialEquity = (amount: number) => {
    if (!selectedOpportunity || !amount) {
      setPotentialEquity(0)
      return
    }

    const valuation = selectedOpportunity.valuation || 1000000
    const equity = (amount / valuation) * 100
    setPotentialEquity(Number(equity.toFixed(2)))
  }

  // Handle investment submission
  const handleInvestmentSubmit = () => {
    if (!selectedOpportunity || !investAmount) {
      message.error('Please specify an investment amount')
      return
    }

    if (
      investAmount >
      (selectedOpportunity.fundingGoal || 0) -
        (selectedOpportunity.fundingRaised || 0)
    ) {
      message.error('Investment amount exceeds remaining funding needs')
      return
    }

    // In a real implementation, this would submit the investment to the backend
    message.success(
      `Investment of ${formatCurrency(investAmount)} in ${
        selectedOpportunity.name
      } initiated successfully!`
    )
    setInvestModalVisible(false)

    // For demo purposes, add to portfolio
    const newPortfolioItem: PortfolioInvestment = {
      id: `p${portfolio.length + 1}`,
      companyName: selectedOpportunity.name,
      companyLogo: selectedOpportunity.logo,
      industry: selectedOpportunity.industry || 'Technology',
      investedAmount: investAmount,
      equityPercentage: potentialEquity,
      currentValuation: investAmount, // Initial valuation equals investment
      investmentDate: new Date().toISOString().split('T')[0],
      performanceMetric: 0,
      status: 'New Investment',
      roi: 0
    }

    setPortfolio([...portfolio, newPortfolioItem])
  }

  // Render opportunity table
  const renderOpportunityTable = () => (
    <Table
      loading={loading}
      dataSource={opportunities}
      rowKey='id'
      columns={[
        {
          title: 'Company',
          dataIndex: 'name',
          render: (text, record) => (
            <Space>
              <Avatar
                src={record.logo}
                size='large'
                shape='square'
                style={{ marginRight: 8 }}
              />
              <div>
                <Text strong>{text}</Text>
                <div>
                  <Tag color='blue'>{record.industry}</Tag>
                  <Tag>{record.stage}</Tag>
                </div>
              </div>
            </Space>
          )
        },
        {
          title: 'Funding',
          dataIndex: 'fundingRaised',
          render: (_, record) => (
            <div>
              <Text>
                {formatCurrency(record.fundingRaised)} /{' '}
                {formatCurrency(record.fundingGoal)}
              </Text>
              <Progress
                percent={record.progress}
                size='small'
                status={
                  record.status === 'closed'
                    ? 'success'
                    : (record.progress || 0) < 30
                    ? 'exception'
                    : 'active'
                }
              />
            </div>
          )
        },
        {
          title: 'Valuation',
          dataIndex: 'valuation',
          render: valuation => formatCurrency(valuation)
        },
        {
          title: 'Risk Level',
          dataIndex: 'riskLevel',
          render: risk => {
            const color =
              risk === 'Low' ? 'green' : risk === 'Medium' ? 'orange' : 'red'
            return <Tag color={color}>{risk}</Tag>
          }
        },
        {
          title: 'Status',
          dataIndex: 'status',
          render: status => (
            <Tag color={getStatusColor(status)}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Tag>
          )
        },
        {
          title: 'Actions',
          render: (_, record) => (
            <Space>
              <Button
                type='primary'
                ghost
                icon={<EyeOutlined />}
                onClick={() => handleViewDetails(record)}
              >
                Details
              </Button>
              <Button
                type='primary'
                icon={<DollarOutlined />}
                disabled={record.status === 'closed'}
                onClick={() => handleInvest(record)}
              >
                Invest
              </Button>
            </Space>
          )
        }
      ]}
    />
  )

  // Render portfolio table
  const renderPortfolioTable = () => (
    <Table
      loading={loading}
      dataSource={portfolio}
      rowKey='id'
      columns={[
        {
          title: 'Company',
          dataIndex: 'companyName',
          render: (text, record) => (
            <Space>
              <Avatar
                src={record.companyLogo}
                size='large'
                shape='square'
                style={{ marginRight: 8 }}
              />
              <Text strong>{text}</Text>
            </Space>
          )
        },
        {
          title: 'Industry',
          dataIndex: 'industry',
          render: industry => <Tag color='blue'>{industry}</Tag>
        },
        {
          title: 'Investment',
          dataIndex: 'investedAmount',
          render: amount => formatCurrency(amount)
        },
        {
          title: 'Equity',
          dataIndex: 'equityPercentage',
          render: equity => `${equity}%`
        },
        {
          title: 'Current Value',
          dataIndex: 'currentValuation',
          render: (value, record) => (
            <Space>
              {formatCurrency(value)}
              {record.roi > 0 ? (
                <Tag color='green'>
                  <ArrowUpOutlined /> {record.roi}%
                </Tag>
              ) : record.roi < 0 ? (
                <Tag color='red'>
                  <ArrowDownOutlined /> {Math.abs(record.roi)}%
                </Tag>
              ) : (
                <Tag color='default'>0%</Tag>
              )}
            </Space>
          )
        },
        {
          title: 'Status',
          dataIndex: 'status',
          render: status => <Tag color={getStatusColor(status)}>{status}</Tag>
        },
        {
          title: 'Investment Date',
          dataIndex: 'investmentDate'
        },
        {
          title: 'Actions',
          render: (_, record) => (
            <Button
              type='link'
              icon={<LineChartOutlined />}
              onClick={() =>
                console.log('View performance metrics for', record.id)
              }
            >
              Performance
            </Button>
          )
        }
      ]}
    />
  )

  // Render details modal
  const renderDetailsModal = () => {
    if (!selectedOpportunity) return null

    return (
      <Modal
        title={`Investment Opportunity: ${selectedOpportunity.name}`}
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key='close' onClick={() => setDetailsModalVisible(false)}>
            Close
          </Button>,
          <Button
            key='invest'
            type='primary'
            onClick={() => {
              setDetailsModalVisible(false)
              handleInvest(selectedOpportunity)
            }}
            disabled={selectedOpportunity.status === 'closed'}
          >
            Invest Now
          </Button>
        ]}
        width={800}
      >
        <div style={{ display: 'flex', marginBottom: 20 }}>
          <Avatar
            src={selectedOpportunity.logo}
            size={100}
            shape='square'
            style={{ marginRight: 20 }}
          />
          <div>
            <Title level={4}>{selectedOpportunity.name}</Title>
            <Space>
              <Tag color='blue'>{selectedOpportunity.industry}</Tag>
              <Tag>{selectedOpportunity.stage}</Tag>
              <Tag
                color={getStatusColor(selectedOpportunity.status || 'active')}
              >
                {selectedOpportunity.status?.charAt(0).toUpperCase() +
                  selectedOpportunity.status?.slice(1) || 'Active'}
              </Tag>
            </Space>
            <Paragraph style={{ marginTop: 10 }}>
              {selectedOpportunity.description}
            </Paragraph>
          </div>
        </div>

        <Divider />

        <Descriptions title='Funding Information' bordered>
          <Descriptions.Item label='Required Funding'>
            {formatCurrency(selectedOpportunity.requiredFunding)}
          </Descriptions.Item>
          <Descriptions.Item label='Company Valuation'>
            {formatCurrency(selectedOpportunity.valuation)}
          </Descriptions.Item>
          <Descriptions.Item label='Risk Level'>
            <Tag
              color={
                selectedOpportunity.riskLevel === 'Low'
                  ? 'green'
                  : selectedOpportunity.riskLevel === 'Medium'
                  ? 'orange'
                  : 'red'
              }
            >
              {selectedOpportunity.riskLevel}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label='Current Progress' span={3}>
            <div style={{ width: '100%' }}>
              <Text>
                {formatCurrency(selectedOpportunity?.fundingRaised)} /{' '}
                {formatCurrency(selectedOpportunity?.fundingGoal)}
              </Text>
              <Progress
                percent={selectedOpportunity?.progress}
                status={
                  selectedOpportunity?.status === 'closed'
                    ? 'success'
                    : (selectedOpportunity?.progress || 0) < 30
                    ? 'exception'
                    : 'active'
                }
              />
            </div>
          </Descriptions.Item>
          <Descriptions.Item label='Team Size'>
            {selectedOpportunity.team} members
          </Descriptions.Item>
          <Descriptions.Item label='Location'>
            {selectedOpportunity.location}
          </Descriptions.Item>
          <Descriptions.Item label='Time Remaining'>
            {selectedOpportunity.daysLeft} days
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        <Title level={5}>Financial History</Title>
        <Table
          dataSource={selectedOpportunity.financialHistory}
          pagination={false}
          columns={[
            {
              title: 'Period',
              render: (_, record) => `Q${record.quarter} ${record.year}`
            },
            {
              title: 'Revenue',
              dataIndex: 'revenue',
              render: value => formatCurrency(value)
            },
            {
              title: 'Expenses',
              dataIndex: 'expenses',
              render: value => formatCurrency(value)
            },
            {
              title: 'Profit',
              dataIndex: 'profit',
              render: value => formatCurrency(value)
            }
          ]}
        />

        <Divider />

        <Title level={5}>Documents</Title>
        <List
          dataSource={selectedOpportunity.documents}
          renderItem={item => (
            <List.Item
              actions={[
                <Button type='link' icon={<DownloadOutlined />}>
                  Download
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                title={item.name}
                description={`${item.type} • ${item.size} • Uploaded: ${item.uploadDate}`}
              />
            </List.Item>
          )}
        />
      </Modal>
    )
  }

  // Render investment modal
  const renderInvestmentModal = () => {
    if (!selectedOpportunity) return null

    const remainingFunding =
      (selectedOpportunity.fundingGoal || 0) -
      (selectedOpportunity.fundingRaised || 0)

    return (
      <Modal
        title={`Invest in ${selectedOpportunity.name}`}
        open={investModalVisible}
        onCancel={() => setInvestModalVisible(false)}
        footer={[
          <Button key='cancel' onClick={() => setInvestModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key='invest'
            type='primary'
            onClick={handleInvestmentSubmit}
            disabled={
              !investAmount ||
              investAmount <= 0 ||
              investAmount > remainingFunding
            }
          >
            Confirm Investment
          </Button>
        ]}
      >
        <div style={{ marginBottom: 20 }}>
          <Alert
            message='Investment Terms & Conditions'
            description="By proceeding with this investment, you acknowledge that you have read and agree to the platform's terms and conditions, including the risks associated with startup investments."
            type='info'
            showIcon
            style={{ marginBottom: 20 }}
          />

          <Descriptions bordered>
            <Descriptions.Item label='Company' span={3}>
              {selectedOpportunity.name}
            </Descriptions.Item>
            <Descriptions.Item label='Stage'>
              {selectedOpportunity.stage}
            </Descriptions.Item>
            <Descriptions.Item label='Valuation'>
              {formatCurrency(selectedOpportunity.valuation)}
            </Descriptions.Item>
            <Descriptions.Item label='Risk Level'>
              {selectedOpportunity.riskLevel}
            </Descriptions.Item>
            <Descriptions.Item label='Remaining Funding' span={3}>
              {formatCurrency(remainingFunding)}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Form layout='vertical'>
          <Form.Item
            label='Investment Amount (ZAR)'
            rules={[
              { required: true, message: 'Please enter an investment amount' }
            ]}
            extra={`Minimum investment: R10,000. Maximum available: ${formatCurrency(
              remainingFunding
            )}`}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={value =>
                `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              }
              parser={value => Number(value!.replace(/R\s?|(,*)/g, ''))}
              min={10000}
              max={remainingFunding}
              onChange={value => {
                setInvestAmount(Number(value) || 0)
                calculatePotentialEquity(Number(value) || 0)
              }}
            />
          </Form.Item>

          <Divider />

          <div style={{ marginBottom: 20 }}>
            <Title level={5}>Investment Summary</Title>
            <Descriptions bordered>
              <Descriptions.Item label='Investment Amount'>
                {formatCurrency(investAmount)}
              </Descriptions.Item>
              <Descriptions.Item label='Potential Equity'>
                {potentialEquity}%
              </Descriptions.Item>
              <Descriptions.Item label='Company Valuation'>
                {formatCurrency(selectedOpportunity.valuation)}
              </Descriptions.Item>
            </Descriptions>
          </div>
        </Form>
      </Modal>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Portfolio Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title='Portfolio Value'
              value={formatCurrency(portfolioMetrics.totalCurrentValue)}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<BankOutlined />}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title='Total Invested'
              value={formatCurrency(portfolioMetrics.totalInvested)}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<WalletOutlined />}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title='Portfolio ROI'
              value={portfolioMetrics.totalROI}
              precision={2}
              suffix='%'
              valueStyle={{
                color:
                  portfolioMetrics.totalROI > 0
                    ? '#3f8600'
                    : portfolioMetrics.totalROI < 0
                    ? '#cf1322'
                    : '#1890ff'
              }}
              prefix={
                portfolioMetrics.totalROI > 0 ? (
                  <ArrowUpOutlined />
                ) : portfolioMetrics.totalROI < 0 ? (
                  <ArrowDownOutlined />
                ) : (
                  <BarChartOutlined />
                )
              }
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title='Investments'
              value={portfolioMetrics.investmentCount}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs defaultActiveKey='opportunities'>
        <TabPane
          tab={
            <span>
              <EyeOutlined /> Investment Opportunities
            </span>
          }
          key='opportunities'
        >
          <Card>
            <Title level={4}>Available Investment Opportunities</Title>
            <Paragraph>
              Browse vetted opportunities that match your investment criteria.
            </Paragraph>
            {renderOpportunityTable()}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <RiseOutlined /> My Portfolio
            </span>
          }
          key='portfolio'
        >
          <Card>
            <Title level={4}>Your Investment Portfolio</Title>
            <Paragraph>Track and manage your current investments.</Paragraph>
            {renderPortfolioTable()}
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <BarChartOutlined /> Analytics
            </span>
          }
          key='analytics'
        >
          <Card>
            <Title level={4}>Investment Analytics</Title>
            <Paragraph>
              In-depth analysis of your investment performance.
            </Paragraph>
            <Alert
              message='Analytics Dashboard Coming Soon'
              description="Our analytics dashboard is under development. Soon you'll be able to view in-depth performance metrics, ROI analysis, and investment insights."
              type='info'
              showIcon
            />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <FileTextOutlined /> Documents
            </span>
          }
          key='documents'
        >
          <Card>
            <Title level={4}>Investment Documents</Title>
            <Paragraph>
              Access your investment agreements, reports, and legal documents.
            </Paragraph>
            <Alert
              message='Document Repository Coming Soon'
              description="Our document management system is under development. Here you'll be able to access all your investment agreements, quarterly reports, and other important documentation."
              type='info'
              showIcon
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Render modals */}
      {renderDetailsModal()}
      {renderInvestmentModal()}
    </div>
  )
}

export default FunderDashboard
