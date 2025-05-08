import React, { useState, useEffect } from "react";
import { 
  Card, 
  Table, 
  Tag, 
  Typography, 
  Button, 
  Space, 
  Avatar, 
  Statistic, 
  Row, 
  Col,
  Divider,
  Progress
} from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  LineChartOutlined,
  BankOutlined,
  WalletOutlined,
  BarChartOutlined
} from "@ant-design/icons";
import { formatCurrency, getStatusColor } from "./utils";
import { getPortfolioData, calculatePortfolioMetrics, PortfolioInvestment } from "./services/portfolioService";

const { Title, Text, Paragraph } = Typography;

export const FunderPortfolio: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PortfolioInvestment[]>([]);
  const [portfolioMetrics, setPortfolioMetrics] = useState({
    totalInvested: 0,
    totalCurrentValue: 0,
    totalROI: 0,
    averageROI: 0,
    investmentCount: 0
  });
  const [loading, setLoading] = useState(true);

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setLoading(true);
        
        // Get portfolio data from the service
        const portfolioData = await getPortfolioData();
        const metrics = calculatePortfolioMetrics(portfolioData);
        
        setPortfolio(portfolioData);
        setPortfolioMetrics(metrics);
      } catch (error) {
        console.error("Error fetching portfolio data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  // Columns for the portfolio table
  const columns = [
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName',
      render: (text: string, record: PortfolioInvestment) => (
        <Space>
          <Avatar 
            src={record.companyLogo} 
            size="large" 
            shape="square"
            style={{ marginRight: 8 }}
          />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Industry',
      dataIndex: 'industry',
      key: 'industry',
      render: (industry: string) => <Tag color="blue">{industry}</Tag>,
    },
    {
      title: 'Investment',
      dataIndex: 'investedAmount',
      key: 'investedAmount',
      render: (amount: number) => formatCurrency(amount),
      sorter: (a: PortfolioInvestment, b: PortfolioInvestment) => a.investedAmount - b.investedAmount,
    },
    {
      title: 'Equity',
      dataIndex: 'equityPercentage',
      key: 'equityPercentage',
      render: (equity: number) => `${equity}%`,
    },
    {
      title: 'Current Value',
      dataIndex: 'currentValuation',
      key: 'currentValuation',
      render: (value: number, record: PortfolioInvestment) => (
        <Space>
          {formatCurrency(value)}
          {record.roi > 0 ? (
            <Tag color="green"><ArrowUpOutlined /> {record.roi}%</Tag>
          ) : record.roi < 0 ? (
            <Tag color="red"><ArrowDownOutlined /> {Math.abs(record.roi)}%</Tag>
          ) : (
            <Tag color="default">0%</Tag>
          )}
        </Space>
      ),
      sorter: (a: PortfolioInvestment, b: PortfolioInvestment) => a.currentValuation - b.currentValuation,
    },
    {
      title: 'ROI',
      dataIndex: 'roi',
      key: 'roi',
      render: (roi: number) => (
        <Space>
          {roi > 0 ? (
            <Tag color="green"><ArrowUpOutlined /> {roi}%</Tag>
          ) : roi < 0 ? (
            <Tag color="red"><ArrowDownOutlined /> {Math.abs(roi)}%</Tag>
          ) : (
            <Tag color="default">0%</Tag>
          )}
        </Space>
      ),
      sorter: (a: PortfolioInvestment, b: PortfolioInvestment) => a.roi - b.roi,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Investment Date',
      dataIndex: 'investmentDate',
      key: 'investmentDate',
      sorter: (a: PortfolioInvestment, b: PortfolioInvestment) => 
        new Date(a.investmentDate).getTime() - new Date(b.investmentDate).getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: PortfolioInvestment) => (
        <Button
          type="link"
          icon={<LineChartOutlined />}
          onClick={() => console.log('View performance metrics for', record.id)}
        >
          Performance
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={2}>Investment Portfolio</Title>
      <Paragraph>
        Track the performance of your investments across different companies and sectors.
      </Paragraph>

      <Divider />

      {/* Portfolio Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Portfolio Value"
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
              title="Total Invested"
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
              title="Portfolio ROI"
              value={portfolioMetrics.totalROI}
              precision={2}
              suffix="%"
              valueStyle={{ 
                color: portfolioMetrics.totalROI > 0 ? '#3f8600' : portfolioMetrics.totalROI < 0 ? '#cf1322' : '#1890ff'
              }}
              prefix={portfolioMetrics.totalROI > 0 ? <ArrowUpOutlined /> : portfolioMetrics.totalROI < 0 ? <ArrowDownOutlined /> : <BarChartOutlined />}
            />
          </Card>
        </Col>

        <Col span={6}>
          <Card>
            <Statistic
              title="Total Investments"
              value={portfolioMetrics.investmentCount}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Portfolio Breakdown */}
      <Card title="Investment Portfolio" style={{ marginBottom: 20 }}>
        <Table 
          columns={columns} 
          dataSource={portfolio} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Performance Metrics */}
      <Card title="Portfolio Performance">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Paragraph>
              <Text strong>Overall Growth:</Text>
            </Paragraph>
            <Progress 
              percent={portfolioMetrics.totalROI} 
              status={portfolioMetrics.totalROI >= 0 ? "active" : "exception"}
              strokeColor={portfolioMetrics.totalROI >= 0 ? "#52c41a" : "#f5222d"}
              format={percent => `${(percent || 0).toFixed(2)}%`}
            />
          </Col>
          <Col span={24}>
            <Text type="secondary">
              * Performance metrics show the return on investment (ROI) for each company in your portfolio.
            </Text>
          </Col>
        </Row>
      </Card>
    </div>
  );
}; 