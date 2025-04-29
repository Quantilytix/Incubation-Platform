import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Statistic,
  Row,
  Col,
  Divider,
  Table,
  Tag,
  Select,
  DatePicker,
  Space,
  Button,
  Tabs,
  Alert
} from "antd";
import {
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  CreditCardOutlined,
  PercentageOutlined,
  RiseOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  DownloadOutlined
} from "@ant-design/icons";
import { Line, Pie, Column } from '@ant-design/plots';
import { formatCurrency } from "./utils";

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

// Sample data for the portfolio performance over time
const performanceData = [
  { month: 'Jan', roi: 2.5, marketAvg: 1.8 },
  { month: 'Feb', roi: 3.1, marketAvg: 2.2 },
  { month: 'Mar', roi: 2.3, marketAvg: 2.0 },
  { month: 'Apr', roi: 4.2, marketAvg: 2.6 },
  { month: 'May', roi: 3.8, marketAvg: 2.3 },
  { month: 'Jun', roi: 5.1, marketAvg: 2.8 },
  { month: 'Jul', roi: 4.5, marketAvg: 3.0 },
  { month: 'Aug', roi: 4.8, marketAvg: 2.7 },
  { month: 'Sep', roi: 5.5, marketAvg: 3.2 },
  { month: 'Oct', roi: 6.2, marketAvg: 3.5 },
  { month: 'Nov', roi: 5.7, marketAvg: 3.4 },
  { month: 'Dec', roi: 6.5, marketAvg: 3.8 },
];

// Transform data for line chart
const lineChartData = [
  ...performanceData.map(item => ({ month: item.month, value: item.roi, category: 'Your ROI' })),
  ...performanceData.map(item => ({ month: item.month, value: item.marketAvg, category: 'Market Average' })),
];

// Sample data for industry breakdown
const industryData = [
  { industry: 'Agriculture', percentage: 15, amount: 225000, roi: 22 },
  { industry: 'Technology', percentage: 35, amount: 525000, roi: 40 },
  { industry: 'Healthcare', percentage: 20, amount: 300000, roi: 35 },
  { industry: 'Education', percentage: 10, amount: 150000, roi: 18 },
  { industry: 'Renewable Energy', percentage: 20, amount: 300000, roi: 30 },
];

// Transform data for pie chart
const pieChartData = industryData.map(item => ({
  type: item.industry,
  value: item.percentage,
}));

// Sample data for company performance
const companyPerformance = [
  { company: 'TechSolutions Inc.', industry: 'Technology', investedAmount: 200000, currentValue: 280000, roi: 40, status: 'Performing' },
  { company: 'HealthTech Innovations', industry: 'Healthcare', investedAmount: 150000, currentValue: 202500, roi: 35, status: 'Performing' },
  { company: 'GreenEnergy Startup', industry: 'Renewable Energy', investedAmount: 100000, currentValue: 130000, roi: 30, status: 'Performing' },
  { company: 'AgriTech Pioneers', industry: 'Agriculture', investedAmount: 125000, currentValue: 152500, roi: 22, status: 'Performing' },
  { company: 'EdTech Solutions', industry: 'Education', investedAmount: 75000, currentValue: 88500, roi: 18, status: 'Performing' },
];

// Sample data for historical returns
const historicalReturns = [
  { year: 2023, q1: 3.2, q2: 4.5, q3: 5.1, q4: 5.8, annual: 4.7 },
  { year: 2022, q1: 2.8, q2: 3.1, q3: 3.5, q4: 4.2, annual: 3.4 },
  { year: 2021, q1: 2.0, q2: 2.3, q3: 2.6, q4: 3.0, annual: 2.5 },
];

// Transform data for bar chart
const barChartData: Array<{year: string; quarter: string; value: number}> = [];
historicalReturns.forEach(item => {
  barChartData.push({ year: item.year.toString(), quarter: 'Q1', value: item.q1 });
  barChartData.push({ year: item.year.toString(), quarter: 'Q2', value: item.q2 });
  barChartData.push({ year: item.year.toString(), quarter: 'Q3', value: item.q3 });
  barChartData.push({ year: item.year.toString(), quarter: 'Q4', value: item.q4 });
});

export const FunderAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [timeFrame, setTimeFrame] = useState('1y');
  const [industryFilter, setIndustryFilter] = useState<string[]>([]);
  
  // Simulate loading data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Calculate metrics
  const totalInvested = companyPerformance.reduce((sum, item) => sum + item.investedAmount, 0);
  const totalCurrentValue = companyPerformance.reduce((sum, item) => sum + item.currentValue, 0);
  const totalReturn = totalCurrentValue - totalInvested;
  const avgROI = (totalReturn / totalInvested) * 100;
  
  // Get unique industries for filter
  const industries = Array.from(new Set(companyPerformance.map(item => item.industry)));
  
  // Line chart config for portfolio performance
  const lineConfig = {
    data: lineChartData,
    xField: 'month',
    yField: 'value',
    seriesField: 'category',
    yAxis: {
      title: {
        text: 'Return (%)',
      },
    },
    legend: {
      position: 'top-right' as const,
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    color: ['#1890ff', '#52c41a'],
  };

  // Pie chart config for industry allocation
  const pieConfig = {
    data: pieChartData,
    angleField: 'value',
    colorField: 'type',
    radius: 0.8,
    label: {
      type: 'outer',
      formatter: (datum: any) => `${datum.type}: ${datum.value}%`,
    },
    interactions: [{ type: 'element-active' }],
    legend: {
      position: 'bottom' as const,
    },
    animation: {
      appear: {
        animation: 'fade-in',
        duration: 1000,
      },
    },
  };

  // Bar chart config for historical returns
  const barConfig = {
    data: barChartData,
    isGroup: true,
    xField: 'quarter',
    yField: 'value',
    seriesField: 'year',
    yAxis: {
      title: {
        text: 'Return (%)',
      },
    },
    label: {
      position: 'middle' as const,
      style: {
        fill: '#fff',
        opacity: 0.6,
      },
    },
    legend: {
      position: 'top-right' as const,
    },
    animation: {
      appear: {
        animation: 'wave-in',
        duration: 1000,
      },
    },
  };
  
  // Simplified company performance table columns to fix rendering issues
  const companyColumns = [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Industry',
      dataIndex: 'industry',
      key: 'industry',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Invested Amount',
      dataIndex: 'investedAmount',
      key: 'investedAmount',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'Current Value',
      dataIndex: 'currentValue',
      key: 'currentValue',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'ROI',
      dataIndex: 'roi',
      key: 'roi',
      render: (value: number) => {
        const color = value >= 30 ? 'green' : value >= 15 ? 'blue' : 'orange';
        return <Tag color={color}>{value}%</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => {
        const color = text === 'Performing' ? 'green' : text === 'Stable' ? 'blue' : 'red';
        return <Tag color={color}>{text}</Tag>;
      },
    },
  ];
  
  // Simplified historical returns table columns
  const historicalColumns = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
    },
    {
      title: 'Q1 Return',
      dataIndex: 'q1',
      key: 'q1',
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: 'Q2 Return',
      dataIndex: 'q2',
      key: 'q2',
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: 'Q3 Return',
      dataIndex: 'q3',
      key: 'q3',
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: 'Q4 Return',
      dataIndex: 'q4',
      key: 'q4',
      render: (value: number) => `${value.toFixed(1)}%`,
    },
    {
      title: 'Annual Return',
      dataIndex: 'annual',
      key: 'annual',
      render: (value: number) => {
        const color = value >= 4 ? 'green' : value >= 3 ? 'blue' : 'orange';
        return <Tag color={color}>{value.toFixed(1)}%</Tag>;
      },
    },
  ];
  
  // Simplified industry breakdown table columns
  const industryColumns = [
    {
      title: 'Industry',
      dataIndex: 'industry',
      key: 'industry',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Allocation',
      dataIndex: 'percentage',
      key: 'percentage',
      render: (value: number) => `${value}%`,
    },
    {
      title: 'Invested Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number) => formatCurrency(value),
    },
    {
      title: 'Avg. ROI',
      dataIndex: 'roi',
      key: 'roi',
      render: (value: number) => {
        const color = value >= 30 ? 'green' : value >= 15 ? 'blue' : 'orange';
        return <Tag color={color}>{value}%</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={2}>Investment Analytics</Title>
      <Paragraph>
        Track the performance of your investments with detailed analytics and reporting.
      </Paragraph>
      
      <Divider />
      
      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <Space size={20} align="center">
          <Space>
            <Text strong>Time Period:</Text>
            <Select 
              defaultValue="1y" 
              style={{ width: 120 }}
              onChange={value => setTimeFrame(value)}
            >
              <Option value="3m">3 Months</Option>
              <Option value="6m">6 Months</Option>
              <Option value="1y">1 Year</Option>
              <Option value="3y">3 Years</Option>
              <Option value="all">All Time</Option>
            </Select>
          </Space>
          
          <Space>
            <Text strong>Custom Range:</Text>
            <RangePicker />
          </Space>
          
          <Space>
            <Text strong>Industry:</Text>
            <Select
              mode="multiple"
              style={{ width: 300 }}
              placeholder="Select industries"
              value={industryFilter}
              onChange={setIndustryFilter}
              allowClear
            >
              {industries.map(industry => (
                <Option key={industry} value={industry}>{industry}</Option>
              ))}
            </Select>
          </Space>
          
          <Button 
            icon={<FilterOutlined />}
            onClick={() => {
              setTimeFrame('1y');
              setIndustryFilter([]);
            }}
          >
            Reset Filters
          </Button>
          
          <Button icon={<DownloadOutlined />} type="primary">
            Export Report
          </Button>
        </Space>
      </Card>
      
      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Invested"
              value={formatCurrency(totalInvested)}
              prefix={<CreditCardOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        
        <Col span={6}>
          <Card>
            <Statistic
              title="Current Portfolio Value"
              value={formatCurrency(totalCurrentValue)}
              prefix={<CreditCardOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Return"
              value={formatCurrency(totalReturn)}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        
        <Col span={6}>
          <Card>
            <Statistic
              title="Average ROI"
              value={avgROI.toFixed(2)}
              suffix="%"
              prefix={<PercentageOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
      
      {/* Main Analytics Content */}
      <Tabs defaultActiveKey="performance" size="large">
        <TabPane
          tab={
            <span>
              <LineChartOutlined /> Performance
            </span>
          }
          key="performance"
        >
          <Card title="Portfolio Performance Over Time" style={{ marginBottom: 20 }}>
            <div style={{ height: 350, padding: '20px 0' }}>
              <Line {...lineConfig} />
            </div>
            
            <Table
              columns={[
                { title: 'Month', dataIndex: 'month', key: 'month' },
                { 
                  title: 'Your ROI', 
                  dataIndex: 'roi', 
                  key: 'roi',
                  render: (text: number) => `${text}%`
                },
                { 
                  title: 'Market Average', 
                  dataIndex: 'marketAvg', 
                  key: 'marketAvg',
                  render: (text: number) => `${text}%`
                },
              ]}
              dataSource={performanceData}
              pagination={false}
              size="small"
              style={{ marginTop: 20 }}
            />
          </Card>
          
          <Card title="Company Performance" style={{ marginBottom: 20 }}>
            <Table
              columns={companyColumns}
              dataSource={companyPerformance}
              rowKey="company"
              pagination={false}
            />
          </Card>
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <PieChartOutlined /> Allocation
            </span>
          }
          key="allocation"
        >
          <Card title="Portfolio Allocation by Industry" style={{ marginBottom: 20 }}>
            <div style={{ height: 350, padding: '20px 0' }}>
              <Pie {...pieConfig} />
            </div>
            
            <Table
              columns={industryColumns}
              dataSource={industryData}
              rowKey="industry"
              pagination={false}
              style={{ marginTop: 20 }}
            />
          </Card>
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <BarChartOutlined /> Historical Returns
            </span>
          }
          key="historical"
        >
          <Card title="Historical Investment Returns" style={{ marginBottom: 20 }}>
            <div style={{ height: 350, padding: '20px 0' }}>
              <Column {...barConfig} />
            </div>
            
            <Table
              columns={historicalColumns}
              dataSource={historicalReturns}
              rowKey="year"
              pagination={false}
              style={{ marginTop: 20 }}
            />
          </Card>
        </TabPane>
      </Tabs>
      
      <Card style={{ marginTop: 20 }}>
        <Alert
          message="Analytics Disclaimer"
          description="Past performance is not indicative of future results. The analytics provided are for informational purposes only and should not be considered as financial advice. Please consult with a financial advisor before making investment decisions."
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
        />
      </Card>
    </div>
  );
};

export default FunderAnalytics; 