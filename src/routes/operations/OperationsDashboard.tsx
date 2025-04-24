import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Typography, List, Tag, Space, Divider, Progress, Button, Timeline, Badge, Tabs, Table } from 'antd';
import { 
  CalendarOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  FileSearchOutlined,
  ClockCircleOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  FormOutlined,
  ApartmentOutlined,
  TeamOutlined,
  BarsOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

// Sample data for tasks and activities
const sampleTasks = [
  { id: 1, title: 'Review quarterly reports', dueDate: '2023-10-25', priority: 'High', status: 'In Progress' },
  { id: 2, title: 'Schedule mentorship session', dueDate: '2023-10-30', priority: 'Medium', status: 'To Do' },
  { id: 3, title: 'Prepare compliance update', dueDate: '2023-11-05', priority: 'High', status: 'To Do' },
  { id: 4, title: 'Update incubatee database', dueDate: '2023-10-20', priority: 'Low', status: 'Completed' },
  { id: 5, title: 'Organize workshop', dueDate: '2023-11-15', priority: 'Medium', status: 'In Progress' },
];

const upcomingEvents = [
  { date: '2023-10-20', title: 'Incubatee Onboarding', time: '10:00 AM', type: 'meeting' },
  { date: '2023-10-22', title: 'Quarterly Review Deadline', time: 'All Day', type: 'deadline' },
  { date: '2023-10-25', title: 'Mentor Matching Session', time: '2:00 PM', type: 'event' },
  { date: '2023-10-28', title: 'Pitch Practice Workshop', time: '11:00 AM', type: 'workshop' },
  { date: '2023-11-01', title: 'Investor Networking Event', time: '3:00 PM', type: 'event' },
];

// Compliance data
const complianceData = {
  upToDate: 22,
  needsReview: 8,
  overdue: 5,
  total: 35
};

// Form submission data
const formSubmissions = [
  { id: 1, formName: 'Incubatee Application', submissions: 24, pending: 8, status: 'Active' },
  { id: 2, formName: 'Mentor Registration', submissions: 18, pending: 3, status: 'Active' },
  { id: 3, formName: 'Quarterly Progress Report', submissions: 15, pending: 10, status: 'Active' },
  { id: 4, formName: 'Resource Request', submissions: 12, pending: 5, status: 'Active' },
  { id: 5, formName: 'Feedback Survey', submissions: 30, pending: 0, status: 'Closed' },
];

// Resource allocation data
const resourceAllocation = [
  { id: 1, resource: 'Conference Room A', allocated: 80, available: 20, allocatedTo: 'Startup Pitches' },
  { id: 2, resource: 'Workshop Space', allocated: 65, available: 35, allocatedTo: 'Technical Training' },
  { id: 3, resource: 'Mentorship Hours', allocated: 45, available: 55, allocatedTo: 'Early Stage Startups' },
  { id: 4, resource: 'Lab Equipment', allocated: 90, available: 10, allocatedTo: 'R&D Teams' },
];

// Participant data
const participants = [
  { id: 1, name: 'TechSolutions Inc.', stage: 'Early', mentorAssigned: 'Yes', nextReview: '2023-11-15', status: 'Active' },
  { id: 2, name: 'GreenEnergy Startup', stage: 'Growth', mentorAssigned: 'Yes', nextReview: '2023-11-10', status: 'Active' },
  { id: 3, name: 'HealthTech Innovations', stage: 'Scaling', mentorAssigned: 'No', nextReview: '2023-11-20', status: 'Warning' },
  { id: 4, name: 'EdTech Solutions', stage: 'Early', mentorAssigned: 'Yes', nextReview: '2023-12-05', status: 'Active' },
  { id: 5, name: 'FinTech Revolution', stage: 'Growth', mentorAssigned: 'No', nextReview: '2023-11-25', status: 'Warning' },
];

export const OperationsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('1');
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'success';
      case 'In Progress': return 'processing';
      case 'To Do': return 'default';
      case 'Active': return 'success';
      case 'Warning': return 'warning';
      case 'Closed': return 'default';
      default: return 'default';
    }
  };
  
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'red';
      case 'Medium': return 'orange';
      case 'Low': return 'green';
      default: return 'blue';
    }
  };
  
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting': return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      case 'deadline': return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'event': return <CalendarOutlined style={{ color: '#52c41a' }} />;
      case 'workshop': return <FileTextOutlined style={{ color: '#722ed1' }} />;
      default: return <CalendarOutlined style={{ color: '#1890ff' }} />;
    }
  };

  // Navigate to form management
  const goToFormManagement = () => {
    navigate('/operations/forms');
  };

  // Navigate to form responses
  const goToFormResponses = () => {
    navigate('/operations/form-responses');
  };

  // Navigate to resource management
  const goToResourceManagement = () => {
    navigate('/operations/resources');
  };

  // Navigate to participant management
  const goToParticipantManagement = () => {
    navigate('/operations/participants');
  };

  // Columns for form submissions table
  const formColumns = [
    {
      title: 'Form Name',
      dataIndex: 'formName',
      key: 'formName',
    },
    {
      title: 'Total Submissions',
      dataIndex: 'submissions',
      key: 'submissions',
      sorter: (a: any, b: any) => a.submissions - b.submissions,
    },
    {
      title: 'Pending Review',
      dataIndex: 'pending',
      key: 'pending',
      render: (pending: number) => (
        <Badge 
          count={pending} 
          style={{ 
            backgroundColor: pending > 0 ? '#faad14' : '#52c41a',
            marginRight: '5px'
          }} 
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'green' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" type="primary" onClick={goToFormResponses}>
            View Responses
          </Button>
        </Space>
      ),
    },
  ];

  // Columns for resource allocation table
  const resourceColumns = [
    {
      title: 'Resource',
      dataIndex: 'resource',
      key: 'resource',
    },
    {
      title: 'Allocation',
      dataIndex: 'allocated',
      key: 'allocated',
      render: (allocated: number) => (
        <Progress 
          percent={allocated} 
          size="small" 
          status={allocated > 90 ? 'exception' : 'normal'}
        />
      ),
    },
    {
      title: 'Allocated To',
      dataIndex: 'allocatedTo',
      key: 'allocatedTo',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size="small" type="primary" onClick={goToResourceManagement}>
          Manage
        </Button>
      ),
    },
  ];

  // Columns for participants table
  const participantColumns = [
    {
      title: 'Participant',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: string) => (
        <Tag color={
          stage === 'Early' ? 'blue' :
          stage === 'Growth' ? 'green' :
          'purple'
        }>
          {stage}
        </Tag>
      ),
    },
    {
      title: 'Mentor Assigned',
      dataIndex: 'mentorAssigned',
      key: 'mentorAssigned',
      render: (assigned: string) => (
        <Badge 
          status={assigned === 'Yes' ? 'success' : 'warning'} 
          text={assigned} 
        />
      ),
    },
    {
      title: 'Next Review',
      dataIndex: 'nextReview',
      key: 'nextReview',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge 
          status={getStatusColor(status) as any} 
          text={status} 
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button size="small" type="primary" onClick={goToParticipantManagement}>
          View Details
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Operations Dashboard</Title>
      <Text type="secondary">Manage daily operations and track incubatee progress</Text>
      
      <Divider />
      
      {/* High-level Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic 
              title="Pending Tasks" 
              value={12} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic 
              title="Form Submissions" 
              value={26} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<FormOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic 
              title="Active Participants" 
              value={38} 
              valueStyle={{ color: '#722ed1' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6} lg={6}>
          <Card>
            <Statistic 
              title="Resource Utilization" 
              value={72} 
              suffix="%" 
              valueStyle={{ color: '#faad14' }}
              prefix={<ApartmentOutlined />}
            />
          </Card>
        </Col>
      </Row>
      
      {/* Main dashboard tabs */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane 
          tab={
            <span>
              <BarsOutlined />
              Daily Operations
            </span>
          } 
          key="1"
        >
          <Row gutter={[16, 16]}>
            {/* Task Management */}
            <Col xs={24} lg={14}>
              <Card 
                title={
                  <Space>
                    <CheckCircleOutlined />
                    <span>Task Management</span>
                  </Space>
                }
                extra={<Button type="primary" size="small">Add Task</Button>}
                style={{ marginBottom: '24px' }}
              >
                <List
                  size="small"
                  dataSource={sampleTasks}
                  renderItem={(task) => (
                    <List.Item
                      actions={[
                        task.status !== 'Completed' && 
                        <Button key="complete" type="link" size="small">
                          Complete
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text 
                              style={{ 
                                textDecoration: task.status === 'Completed' ? 'line-through' : 'none' 
                              }}
                            >
                              {task.title}
                            </Text>
                            <Tag color={getPriorityColor(task.priority)}>{task.priority}</Tag>
                          </Space>
                        }
                        description={`Due: ${task.dueDate}`}
                      />
                      <Badge status={getStatusColor(task.status) as any} text={task.status} />
                    </List.Item>
                  )}
                />
              </Card>
              
              {/* Compliance Tracking */}
              <Card 
                title={
                  <Space>
                    <FileSearchOutlined />
                    <span>Compliance Tracking</span>
                  </Space>
                }
                style={{ marginBottom: '24px' }}
              >
                <Row gutter={[16, 16]} align="middle">
                  <Col span={12}>
                    <Paragraph>
                      <Text strong>Overall Compliance Status</Text>
                    </Paragraph>
                    <Progress 
                      percent={Math.round((complianceData.upToDate / complianceData.total) * 100)} 
                      success={{ percent: Math.round((complianceData.upToDate / complianceData.total) * 100) }}
                      format={percent => `${percent}% Compliant`}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic 
                      title="Up-to-date" 
                      value={complianceData.upToDate} 
                      suffix={`/ ${complianceData.total}`}
                      valueStyle={{ color: '#52c41a' }} 
                    />
                    <Statistic 
                      title="Needs Review" 
                      value={complianceData.needsReview} 
                      suffix={`/ ${complianceData.total}`}
                      valueStyle={{ color: '#faad14' }} 
                    />
                    <Statistic 
                      title="Overdue" 
                      value={complianceData.overdue} 
                      suffix={`/ ${complianceData.total}`}
                      valueStyle={{ color: '#ff4d4f' }} 
                    />
                  </Col>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Button type="primary">
                  Generate Compliance Report
                </Button>
              </Card>
            </Col>
            
            {/* Calendar & Events */}
            <Col xs={24} lg={10}>
              <Card 
                title={
                  <Space>
                    <ScheduleOutlined />
                    <span>Upcoming Events</span>
                  </Space>
                }
                extra={<Button type="primary" size="small">Add Event</Button>}
                style={{ marginBottom: '24px' }}
              >
                <Timeline mode="left">
                  {upcomingEvents.map((event, index) => (
                    <Timeline.Item 
                      key={index} 
                      dot={getEventIcon(event.type)}
                    >
                      <Text strong>{event.date} - {event.title}</Text>
                      <br />
                      <Text type="secondary">{event.time}</Text>
                      <Tag color={
                        event.type === 'meeting' ? 'blue' :
                        event.type === 'deadline' ? 'red' :
                        event.type === 'event' ? 'green' :
                        'purple'
                      }>
                        {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                      </Tag>
                    </Timeline.Item>
                  ))}
                </Timeline>
                <Button type="link" style={{ padding: 0 }}>
                  View Full Calendar
                </Button>
              </Card>
              
            </Col>
          </Row>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <FormOutlined />
              Form Management
            </span>
          } 
          key="2"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card 
                title="Forms & Submissions"
                extra={<Button type="primary" onClick={goToFormManagement}>Manage All Forms</Button>}
              >
                <Table 
                  dataSource={formSubmissions} 
                  columns={formColumns} 
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <ApartmentOutlined />
              Resource Management
            </span>
          } 
          key="3"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card 
                title="Resource Allocation" 
                extra={<Button type="primary" onClick={goToResourceManagement}>Manage Resources</Button>}
              >
                <Table 
                  dataSource={resourceAllocation} 
                  columns={resourceColumns} 
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <TeamOutlined />
              Participants
            </span>
          } 
          key="4"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card 
                title="Participant Tracking" 
                extra={<Button type="primary" onClick={goToParticipantManagement}>Manage Participants</Button>}
              >
                <Table 
                  dataSource={participants} 
                  columns={participantColumns} 
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default OperationsDashboard; 
