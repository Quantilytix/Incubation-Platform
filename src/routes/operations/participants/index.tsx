import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Divider,
  Typography,
  Badge,
  Tabs,
  Select,
  Row,
  Col,
  Statistic,
  Tooltip
} from 'antd';
import { 
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  StarOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface Participant {
  id: string;
  name: string;
  industry: string;
  stage: string;
  joinDate: string;
  status: string;
  mentorAssigned: boolean;
  mentorName?: string;
  nextReview: string;
  team: number;
  progress: number;
}

const OperationsParticipantsManagement: React.FC = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      // Sample data for demonstration
      const sampleParticipants: Participant[] = [
        {
          id: '1',
          name: 'TechSolutions Inc.',
          industry: 'Software',
          stage: 'Early',
          joinDate: '2023-06-15',
          status: 'active',
          mentorAssigned: true,
          mentorName: 'John Doe',
          nextReview: '2023-11-15',
          team: 4,
          progress: 32
        },
        {
          id: '2',
          name: 'GreenEnergy Startup',
          industry: 'Renewable Energy',
          stage: 'Growth',
          joinDate: '2023-04-10',
          status: 'active',
          mentorAssigned: true,
          mentorName: 'Jane Smith',
          nextReview: '2023-11-10',
          team: 7,
          progress: 68
        },
        {
          id: '3',
          name: 'HealthTech Innovations',
          industry: 'Healthcare',
          stage: 'Scaling',
          joinDate: '2023-02-22',
          status: 'warning',
          mentorAssigned: false,
          nextReview: '2023-11-20',
          team: 5,
          progress: 75
        },
        {
          id: '4',
          name: 'EdTech Solutions',
          industry: 'Education',
          stage: 'Early',
          joinDate: '2023-07-05',
          status: 'active',
          mentorAssigned: true,
          mentorName: 'Robert Johnson',
          nextReview: '2023-12-05',
          team: 3,
          progress: 15
        },
        {
          id: '5',
          name: 'FinTech Revolution',
          industry: 'Finance',
          stage: 'Growth',
          joinDate: '2023-03-18',
          status: 'warning',
          mentorAssigned: false,
          nextReview: '2023-11-25',
          team: 6,
          progress: 52
        },
        {
          id: '6',
          name: 'AgriTech Pioneers',
          industry: 'Agriculture',
          stage: 'Early',
          joinDate: '2023-08-01',
          status: 'active',
          mentorAssigned: true,
          mentorName: 'Sarah Williams',
          nextReview: '2023-12-10',
          team: 4,
          progress: 10
        },
        {
          id: '7',
          name: 'Logistics Optimization',
          industry: 'Transportation',
          stage: 'Growth',
          joinDate: '2023-05-12',
          status: 'inactive',
          mentorAssigned: true,
          mentorName: 'David Miller',
          nextReview: '2023-11-30',
          team: 5,
          progress: 45
        },
      ];
      
      setParticipants(sampleParticipants);
    } catch (error) {
      console.error('Error fetching participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const getFilteredParticipants = () => {
    let filtered = [...participants];
    
    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(
        participant => 
          participant.name.toLowerCase().includes(searchText.toLowerCase()) ||
          participant.industry.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Filter by tab status
    if (activeTab !== 'all') {
      filtered = filtered.filter(participant => participant.status === activeTab);
    }
    
    return filtered;
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <Badge status="success" text="Active" />;
      case 'warning':
        return <Badge status="warning" text="At Risk" />;
      case 'inactive':
        return <Badge status="default" text="Inactive" />;
      default:
        return <Badge status="default" text={status} />;
    }
  };

  const getStageBadge = (stage: string) => {
    let color = '';
    switch(stage) {
      case 'Early':
        color = 'blue';
        break;
      case 'Growth':
        color = 'green';
        break;
      case 'Scaling':
        color = 'purple';
        break;
      default:
        color = 'default';
    }
    
    return <Tag color={color}>{stage}</Tag>;
  };

  const columns = [
    {
      title: 'Participant Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Participant) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.industry}</Text>
        </Space>
      ),
    },
    {
      title: 'Stage',
      dataIndex: 'stage',
      key: 'stage',
      render: (stage: string) => getStageBadge(stage),
    },
    {
      title: 'Team Size',
      dataIndex: 'team',
      key: 'team',
      sorter: (a: Participant, b: Participant) => a.team - b.team,
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Tooltip title={`${progress}% Complete`}>
          <div style={{ width: 100, backgroundColor: '#f0f0f0', borderRadius: 10, height: 8 }}>
            <div 
              style={{ 
                width: `${progress}%`, 
                backgroundColor: progress < 30 ? '#ff4d4f' : progress < 70 ? '#faad14' : '#52c41a', 
                borderRadius: 10, 
                height: 8 
              }} 
            />
          </div>
        </Tooltip>
      ),
      sorter: (a: Participant, b: Participant) => a.progress - b.progress,
    },
    {
      title: 'Mentor',
      key: 'mentor',
      render: (text: string, record: Participant) => (
        record.mentorAssigned ? (
          <Text type="success">{record.mentorName}</Text>
        ) : (
          <Text type="danger">Not Assigned</Text>
        )
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
      render: (status: string) => getStatusBadge(status),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Participant) => (
        <Space size="small">
          <Button type="primary" size="small">
            View Details
          </Button>
          <Button size="small">
            Assign Mentor
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>
        <TeamOutlined /> Participant Management
      </Title>
      <Text type="secondary">
        Manage and track incubatee companies and their progress
      </Text>
      
      <Divider />
      
      {/* Stats Overview */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Total Participants" 
              value={participants.length} 
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Need Mentor Assignment" 
              value={participants.filter(p => !p.mentorAssigned).length} 
              prefix={<UserOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Companies at Risk" 
              value={participants.filter(p => p.status === 'warning').length} 
              prefix={<ApartmentOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Upcoming Reviews" 
              value={participants.filter(p => {
                const reviewDate = new Date(p.nextReview);
                const today = new Date();
                const timeDiff = reviewDate.getTime() - today.getTime();
                const dayDiff = timeDiff / (1000 * 3600 * 24);
                return dayDiff <= 7 && dayDiff > 0;
              }).length} 
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Card>
        <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <Input
              placeholder="Search participants..."
              prefix={<SearchOutlined />}
              allowClear
              onChange={e => handleSearch(e.target.value)}
              style={{ width: 250 }}
            />
            <Select 
              placeholder="Filter by industry" 
              style={{ width: 180 }}
              allowClear
            >
              <Option value="software">Software</Option>
              <Option value="healthcare">Healthcare</Option>
              <Option value="education">Education</Option>
              <Option value="finance">Finance</Option>
              <Option value="energy">Energy</Option>
              <Option value="agriculture">Agriculture</Option>
              <Option value="transportation">Transportation</Option>
            </Select>
            <Select 
              placeholder="Filter by stage" 
              style={{ width: 150 }}
              allowClear
            >
              <Option value="early">Early</Option>
              <Option value="growth">Growth</Option>
              <Option value="scaling">Scaling</Option>
            </Select>
          </Space>
          <Button 
            type="primary" 
            icon={<TeamOutlined />}
          >
            Add Participant
          </Button>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="All Participants" key="all" />
          <TabPane tab="Active" key="active" />
          <TabPane tab="At Risk" key="warning" />
          <TabPane tab="Inactive" key="inactive" />
        </Tabs>
        
        <Table
          dataSource={getFilteredParticipants()}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default OperationsParticipantsManagement; 
