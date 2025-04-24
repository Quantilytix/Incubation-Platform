import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Typography, 
  Table, 
  Space, 
  Button, 
  Tabs, 
  Statistic, 
  Row, 
  Col,
  DatePicker,
  Select,
  Form,
  Input,
  Divider
} from 'antd';
import { 
  BarChartOutlined, 
  LineChartOutlined, 
  PieChartOutlined, 
  DownloadOutlined,
  FilterOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  TeamOutlined,
  ApartmentOutlined,
  DollarOutlined,
  AuditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

// Mock data
import { Column } from '@ant-design/plots';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

// Define report types
const reportTypes = [
  { value: 'participant', label: 'Participant Reports' },
  { value: 'resource', label: 'Resource Utilization' },
  { value: 'compliance', label: 'Compliance Status' },
  { value: 'mentorship', label: 'Mentorship Progress' },
  { value: 'financials', label: 'Financial Reports' },
];

// Define time periods
const timePeriods = [
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Yearly' },
  { value: 'custom', label: 'Custom Range' },
];

// Mock data for participant metrics
const participantMetrics = [
  { month: 'Jan', active: 35, new: 12, graduated: 5 },
  { month: 'Feb', active: 40, new: 15, graduated: 3 },
  { month: 'Mar', active: 48, new: 18, graduated: 2 },
  { month: 'Apr', active: 58, new: 22, graduated: 4 },
  { month: 'May', active: 70, new: 25, graduated: 6 },
  { month: 'Jun', active: 85, new: 28, graduated: 7 },
];

// Mock data for compliance status
const complianceStatus = [
  { type: 'Valid', count: 120 },
  { type: 'Expiring Soon', count: 15 },
  { type: 'Expired', count: 8 },
  { type: 'Missing', count: 12 },
  { type: 'Pending Review', count: 22 },
];

// Mock data for resource utilization
const resourceUtilization = [
  { resource: 'Workshop Space', utilization: 78 },
  { resource: 'Meeting Rooms', utilization: 85 },
  { resource: 'Equipment', utilization: 62 },
  { resource: 'Mentorship Hours', utilization: 90 },
  { resource: 'Funding', utilization: 45 },
];

const OperationsReports: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState('participant');
  const [timePeriod, setTimePeriod] = useState('month');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [form] = Form.useForm();
  
  useEffect(() => {
    // In a real app, fetch report data based on selected criteria
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 500);
  }, [reportType, timePeriod, customDateRange]);

  // Handle report type change
  const handleReportTypeChange = (value: string) => {
    setReportType(value);
  };

  // Handle time period change
  const handleTimePeriodChange = (value: string) => {
    setTimePeriod(value);
  };

  // Handle date range change
  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setCustomDateRange(dates);
    } else {
      setCustomDateRange(null);
    }
  };

  // Generate report
  const handleGenerateReport = (values: any) => {
    console.log('Generating report with values:', values);
    // In a real app, this would fetch data based on the form values
  };

  // Export report
  const handleExport = (format: 'excel' | 'pdf') => {
    console.log(`Exporting report as ${format}`);
    // In a real app, this would trigger a download
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Reports & Analytics</Title>
      <Text>Generate and analyze reports for operations management.</Text>
      
      {/* Report Filters */}
      <Card style={{ marginTop: '20px', marginBottom: '20px' }}>
        <Form 
          form={form}
          layout="vertical"
          onFinish={handleGenerateReport}
          initialValues={{
            reportType: 'participant',
            timePeriod: 'month',
          }}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item 
                name="reportType" 
                label="Report Type"
                rules={[{ required: true, message: 'Please select a report type' }]}
              >
                <Select
                  placeholder="Select report type"
                  onChange={handleReportTypeChange}
                >
                  {reportTypes.map(type => (
                    <Option key={type.value} value={type.value}>{type.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item 
                name="timePeriod" 
                label="Time Period"
                rules={[{ required: true, message: 'Please select a time period' }]}
              >
                <Select
                  placeholder="Select time period"
                  onChange={handleTimePeriodChange}
                >
                  {timePeriods.map(period => (
                    <Option key={period.value} value={period.value}>{period.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              {timePeriod === 'custom' && (
                <Form.Item 
                  name="dateRange" 
                  label="Date Range"
                  rules={[{ required: true, message: 'Please select date range' }]}
                >
                  <RangePicker
                    style={{ width: '100%' }}
                    onChange={handleDateRangeChange}
                  />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Row>
            <Col span={24} style={{ textAlign: 'right' }}>
              <Space>
                <Button 
                  icon={<FilterOutlined />} 
                  type="primary"
                  htmlType="submit"
                >
                  Generate Report
                </Button>
                <Button 
                  icon={<FileExcelOutlined />}
                  onClick={() => handleExport('excel')}
                >
                  Export Excel
                </Button>
                <Button 
                  icon={<FilePdfOutlined />}
                  onClick={() => handleExport('pdf')}
                >
                  Export PDF
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Card>
      
      {/* Dashboard Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '20px' }}>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Total Participants" 
              value={85} 
              prefix={<TeamOutlined />} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Resources Allocated" 
              value={68} 
              prefix={<ApartmentOutlined />}
              suffix="%" 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Funding Utilized" 
              value={2450000} 
              prefix={<DollarOutlined />} 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="Compliance Rate" 
              value={92} 
              prefix={<AuditOutlined />}
              suffix="%" 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
      
      {/* Report Content */}
      <Card>
        <Tabs defaultActiveKey="1">
          <TabPane 
            tab={<span><BarChartOutlined />Participant Statistics</span>} 
            key="1"
          >
            <Title level={4}>Participant Growth Over Time</Title>
            <Paragraph>Tracks active, new, and graduated participants over time.</Paragraph>
            
            <div style={{ height: '350px', marginTop: '20px' }}>
              {/* In a real implementation, this would use an actual chart library */}
              <div>
                {/* Placeholder for a chart - in a real app use a library like Ant Design Charts */}
                <div style={{ 
                  display: 'flex', 
                  height: '300px', 
                  borderBottom: '1px solid #ddd',
                  position: 'relative'
                }}>
                  {participantMetrics.map((data, index) => (
                    <div 
                      key={index}
                      style={{ 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        flex: 1,
                        padding: '0 10px'
                      }}
                    >
                      <div style={{ 
                        height: `${data.active * 3}px`, 
                        width: '30px', 
                        backgroundColor: '#1890ff',
                        marginBottom: '5px'
                      }} />
                      <Text>{data.month}</Text>
                    </div>
                  ))}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}>
                    <Text>100</Text>
                    <Text>75</Text>
                    <Text>50</Text>
                    <Text>25</Text>
                    <Text>0</Text>
                  </div>
                </div>
              </div>
            </div>
            
            <Divider />
            
            <Title level={4}>Participant Metrics</Title>
            <Table 
              dataSource={participantMetrics}
              rowKey="month"
              pagination={false}
              loading={loading}
              columns={[
                {
                  title: 'Month',
                  dataIndex: 'month',
                  key: 'month',
                },
                {
                  title: 'Active Participants',
                  dataIndex: 'active',
                  key: 'active',
                  sorter: (a: any, b: any) => a.active - b.active,
                },
                {
                  title: 'New Participants',
                  dataIndex: 'new',
                  key: 'new',
                  sorter: (a: any, b: any) => a.new - b.new,
                },
                {
                  title: 'Graduated',
                  dataIndex: 'graduated',
                  key: 'graduated',
                  sorter: (a: any, b: any) => a.graduated - b.graduated,
                },
              ]}
            />
          </TabPane>
          
          <TabPane 
            tab={<span><LineChartOutlined />Resource Utilization</span>} 
            key="2"
          >
            <Title level={4}>Resource Usage Analysis</Title>
            <Paragraph>Tracks the usage of different resources across the incubation program.</Paragraph>
            
            <Table 
              dataSource={resourceUtilization}
              rowKey="resource"
              pagination={false}
              loading={loading}
              columns={[
                {
                  title: 'Resource',
                  dataIndex: 'resource',
                  key: 'resource',
                },
                {
                  title: 'Utilization %',
                  dataIndex: 'utilization',
                  key: 'utilization',
                  sorter: (a: any, b: any) => a.utilization - b.utilization,
                  render: (utilization: number) => (
                    <div style={{ width: '300px' }}>
                      <div style={{ 
                        height: '20px', 
                        background: '#f0f0f0', 
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          height: '100%', 
                          width: `${utilization}%`, 
                          background: utilization > 90 ? '#ff4d4f' : 
                                      utilization > 70 ? '#faad14' : '#52c41a',
                          borderRadius: '10px'
                        }} />
                      </div>
                      <div style={{ textAlign: 'right' }}>{utilization}%</div>
                    </div>
                  ),
                },
              ]}
            />
          </TabPane>
          
          <TabPane 
            tab={<span><PieChartOutlined />Compliance Status</span>} 
            key="3"
          >
            <Title level={4}>Document Compliance Analysis</Title>
            <Paragraph>Overview of the compliance status of all participant documents.</Paragraph>
            
            <Table 
              dataSource={complianceStatus}
              rowKey="type"
              pagination={false}
              loading={loading}
              columns={[
                {
                  title: 'Document Status',
                  dataIndex: 'type',
                  key: 'type',
                },
                {
                  title: 'Count',
                  dataIndex: 'count',
                  key: 'count',
                  sorter: (a: any, b: any) => a.count - b.count,
                },
                {
                  title: 'Percentage',
                  key: 'percentage',
                  render: (_, record) => {
                    const total = complianceStatus.reduce((sum, item) => sum + item.count, 0);
                    const percentage = ((record.count / total) * 100).toFixed(1);
                    return `${percentage}%`;
                  },
                },
              ]}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default OperationsReports; 