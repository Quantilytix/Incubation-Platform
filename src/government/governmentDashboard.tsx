import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Badge, 
  Space, 
  Table, 
  Tag, 
  Button, 
  Spin,
  Divider,
  List,
  Avatar,
  Calendar,
  Tooltip,
  Progress
} from 'antd';
import { 
  TeamOutlined, 
  RiseOutlined, 
  FileTextOutlined, 
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  BellOutlined,
  ArrowUpOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;

interface SupportProgram {
  id: string;
  participantId: string;
  participantName?: string;
  programName: string;
  programType: string;
  startDate: Timestamp;
  endDate: Timestamp;
  description: string;
  budget?: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  outcomes?: string[];
  createdBy: string;
  createdAt: Timestamp;
}

interface Participant {
  id: string;
  name: string;
  industry: string;
  location: string;
  description?: string;
  foundedYear?: number;
  teamSize?: number;
  stage?: string;
  status: string;
}

interface ImpactMetric {
  id: string;
  programId: string;
  programName?: string;
  participantId: string;
  participantName?: string;
  metricType: 'economic' | 'social' | 'environmental';
  metricName: string;
  value: number;
  unit: string;
  date: Timestamp;
  notes?: string;
}

interface Notification {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success' | 'error';
  date: Timestamp;
  read: boolean;
  link?: string;
}

export const GovernmentDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [programs, setPrograms] = useState<SupportProgram[]>([]);
  const [metrics, setMetrics] = useState<ImpactMetric[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<SupportProgram[]>([]);
  
  // Stats
  const [stats, setStats] = useState({
    totalParticipants: 0,
    activeParticipants: 0,
    totalPrograms: 0,
    activePrograms: 0,
    completedPrograms: 0,
    totalBudget: 0,
    jobsCreated: 0,
    revenueGenerated: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch participants
      const participantsData = await fetchParticipants();
      setParticipants(participantsData);
      
      // Fetch programs
      const programsData = await fetchPrograms();
      setPrograms(programsData);
      
      // Generate demo metrics
      const demoMetrics = generateDemoMetrics(programsData);
      setMetrics(demoMetrics);
      
      // Generate demo notifications
      const demoNotifications = generateDemoNotifications();
      setNotifications(demoNotifications);
      
      // Get upcoming events
      const upcoming = programsData.filter(program => 
        program.status === 'planned' || program.status === 'active'
      ).sort((a, b) => 
        a.startDate.toDate().getTime() - b.startDate.toDate().getTime()
      ).slice(0, 5);
      setUpcomingEvents(upcoming);
      
      // Calculate statistics
      calculateStats(participantsData, programsData, demoMetrics);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParticipants = async (): Promise<Participant[]> => {
    const participantsRef = collection(db, "participants");
    const participantsQuery = query(participantsRef, where("status", "!=", "deleted"));
    const participantsSnapshot = await getDocs(participantsQuery);
    
    return participantsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Participant));
  };

  const fetchPrograms = async (): Promise<SupportProgram[]> => {
    try {
      const programsRef = collection(db, "supportPrograms");
      const programsQuery = query(programsRef, orderBy("createdAt", "desc"));
      const programsSnapshot = await getDocs(programsQuery);
      
      if (programsSnapshot.empty) {
        // If no real data, return demo data
        return getDemoPrograms();
      }
      
      return programsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as SupportProgram));
    } catch (error) {
      console.error("Error fetching programs:", error);
      return getDemoPrograms();
    }
  };

  const getDemoPrograms = (): SupportProgram[] => {
    // This is just sample data for demonstration
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const oneMonthLater = new Date();
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    return [
      {
        id: "demo1",
        participantId: "demo-participant-1",
        participantName: "EcoSolutions",
        programName: "Green Innovation Grant",
        programType: "Grant Funding",
        startDate: Timestamp.fromDate(oneMonthAgo),
        endDate: Timestamp.fromDate(oneMonthLater),
        description: "Supporting renewable energy solutions",
        budget: 250000,
        status: 'active',
        createdBy: "admin",
        createdAt: Timestamp.fromDate(oneMonthAgo)
      },
      {
        id: "demo2",
        participantId: "demo-participant-2",
        participantName: "HealthTech Solutions",
        programName: "Digital Health Accelerator",
        programType: "Technical Assistance",
        startDate: Timestamp.fromDate(oneMonthAgo),
        endDate: Timestamp.fromDate(threeMonthsLater),
        description: "Providing technical support for health technology startups",
        budget: 150000,
        status: 'active',
        createdBy: "admin",
        createdAt: Timestamp.fromDate(oneMonthAgo)
      },
      {
        id: "demo3",
        participantId: "demo-participant-3",
        participantName: "AgriTech Innovations",
        programName: "Farming Technology Grant",
        programType: "Market Access Support",
        startDate: Timestamp.fromDate(currentDate),
        endDate: Timestamp.fromDate(oneMonthLater),
        description: "Supporting agricultural technology solutions",
        budget: 200000,
        status: 'planned',
        createdBy: "admin",
        createdAt: Timestamp.fromDate(currentDate)
      },
      {
        id: "demo4",
        participantId: "demo-participant-4",
        participantName: "EduTech Connect",
        programName: "Education Technology Program",
        programType: "Mentorship",
        startDate: Timestamp.fromDate(oneMonthAgo),
        endDate: Timestamp.fromDate(currentDate),
        description: "Mentorship program for education technology companies",
        budget: 100000,
        status: 'completed',
        createdBy: "admin",
        createdAt: Timestamp.fromDate(oneMonthAgo)
      },
      {
        id: "demo5",
        participantId: "demo-participant-5",
        participantName: "FinTech Solutions",
        programName: "Financial Inclusion Initiative",
        programType: "Grant Funding",
        startDate: Timestamp.fromDate(oneMonthLater),
        endDate: Timestamp.fromDate(threeMonthsLater),
        description: "Supporting financial inclusion initiatives",
        budget: 300000,
        status: 'planned',
        createdBy: "admin",
        createdAt: Timestamp.fromDate(currentDate)
      }
    ];
  };

  const generateDemoMetrics = (programs: SupportProgram[]): ImpactMetric[] => {
    const metrics: ImpactMetric[] = [];
    let id = 1;
    
    programs.forEach(program => {
      if (program.status === 'completed' || program.status === 'active') {
        // Add jobs created metric
        metrics.push({
          id: `metric-${id++}`,
          programId: program.id,
          programName: program.programName,
          participantId: program.participantId,
          participantName: program.participantName,
          metricType: 'economic',
          metricName: 'Jobs Created',
          value: Math.floor(Math.random() * 20) + 5,
          unit: 'jobs',
          date: program.endDate,
          notes: `Jobs created through ${program.programName}`
        });
        
        // Add revenue generated metric
        metrics.push({
          id: `metric-${id++}`,
          programId: program.id,
          programName: program.programName,
          participantId: program.participantId,
          participantName: program.participantName,
          metricType: 'economic',
          metricName: 'Revenue Generated',
          value: (Math.floor(Math.random() * 1000) + 100) * 1000,
          unit: 'R',
          date: program.endDate,
          notes: `Revenue generated through ${program.programName}`
        });
      }
    });
    
    return metrics;
  };

  const generateDemoNotifications = (): Notification[] => {
    const currentDate = new Date();
    const oneDayAgo = new Date(currentDate);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const twoDaysAgo = new Date(currentDate);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const threeDaysAgo = new Date(currentDate);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    return [
      {
        id: "notif1",
        title: "New Participant Registered",
        description: "TechInnovate Solutions has joined the platform",
        type: 'info',
        date: Timestamp.fromDate(oneDayAgo),
        read: false,
        link: "/government/participants"
      },
      {
        id: "notif2",
        title: "Program Completed",
        description: "Education Technology Program has been completed successfully",
        type: 'success',
        date: Timestamp.fromDate(twoDaysAgo),
        read: true,
        link: "/government/programs"
      },
      {
        id: "notif3",
        title: "Budget Alert",
        description: "Green Innovation Grant has exceeded 80% of allocated budget",
        type: 'warning',
        date: Timestamp.fromDate(threeDaysAgo),
        read: false,
        link: "/government/programs"
      },
      {
        id: "notif4",
        title: "Quarterly Report Due",
        description: "Quarterly impact report is due in 5 days",
        type: 'warning',
        date: Timestamp.fromDate(currentDate),
        read: false,
        link: "/government/reports"
      },
      {
        id: "notif5",
        title: "New Support Request",
        description: "HealthTech Solutions has requested additional technical support",
        type: 'info',
        date: Timestamp.fromDate(currentDate),
        read: true,
        link: "/government/participants"
      }
    ];
  };

  const calculateStats = (
    participants: Participant[], 
    programs: SupportProgram[], 
    metrics: ImpactMetric[]
  ) => {
    // Calculate participant stats
    const activeParticipants = participants.filter(p => p.status === 'active').length;
    
    // Calculate program stats
    const activePrograms = programs.filter(p => p.status === 'active').length;
    const completedPrograms = programs.filter(p => p.status === 'completed').length;
    const totalBudget = programs.reduce((sum, program) => sum + (program.budget || 0), 0);
    
    // Calculate metrics
    const jobsCreated = metrics
      .filter(m => m.metricName === 'Jobs Created')
      .reduce((sum, m) => sum + m.value, 0);
    
    const revenueGenerated = metrics
      .filter(m => m.metricName === 'Revenue Generated')
      .reduce((sum, m) => sum + m.value, 0);
    
    setStats({
      totalParticipants: participants.length,
      activeParticipants,
      totalPrograms: programs.length,
      activePrograms,
      completedPrograms,
      totalBudget,
      jobsCreated,
      revenueGenerated
    });
  };

  const renderNotificationIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <BellOutlined style={{ color: '#1890ff' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
        return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <BellOutlined />;
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <Title level={3}>Government Entity Dashboard</Title>
          <Text type="secondary">
            Overview of participant performance, support programs, and economic impact
          </Text>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              onClick={() => navigate('/government/reports')}
            >
              View Full Reports
            </Button>
          </Space>
        </Col>
      </Row>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading dashboard data...</div>
        </div>
      ) : (
        <>
          {/* Key Statistics Section */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Participants"
                  value={stats.totalParticipants}
                  prefix={<TeamOutlined />}
                  suffix={<Text type="secondary" style={{ fontSize: 14 }}>{stats.activeParticipants} active</Text>}
                />
                <div style={{ marginTop: 8 }}>
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => navigate('/government/participants')}
                    style={{ padding: 0 }}
                  >
                    View Directory
                  </Button>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Support Programs"
                  value={stats.totalPrograms}
                  prefix={<FileTextOutlined />}
                  suffix={
                    <Space>
                      <Badge status="success" />
                      <Text type="secondary" style={{ fontSize: 14 }}>{stats.activePrograms} active</Text>
                    </Space>
                  }
                />
                <div style={{ marginTop: 8 }}>
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => navigate('/government/programs')}
                    style={{ padding: 0 }}
                  >
                    View Programs
                  </Button>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Jobs Created"
                  value={stats.jobsCreated}
                  valueStyle={{ color: '#3f8600' }}
                  prefix={<TeamOutlined />}
                  suffix={<ArrowUpOutlined />}
                />
                <div style={{ marginTop: 8 }}>
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => navigate('/government/reports')}
                    style={{ padding: 0 }}
                  >
                    View Impact
                  </Button>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title="Total Budget"
                  value={stats.totalBudget}
                  precision={0}
                  valueStyle={{ color: '#cf1322' }}
                  prefix={<DollarOutlined />}
                  formatter={value => `R${value.toLocaleString()}`}
                />
                <div style={{ marginTop: 8 }}>
                  <Button 
                    type="link" 
                    size="small" 
                    onClick={() => navigate('/government/programs')}
                    style={{ padding: 0 }}
                  >
                    View Details
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
          
          {/* Main Content */}
          <Row gutter={[16, 16]}>
            {/* Left Column */}
            <Col xs={24} md={16}>
              {/* Program Status */}
              <Card 
                title="Program Status Overview" 
                style={{ marginBottom: 16 }}
                extra={
                  <Button 
                    type="link" 
                    onClick={() => navigate('/government/programs')}
                  >
                    View All
                  </Button>
                }
              >
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Card bordered={false}>
                      <Statistic
                        title="Active Programs"
                        value={stats.activePrograms}
                        valueStyle={{ color: '#52c41a' }}
                      />
                      <Progress 
                        percent={Math.round((stats.activePrograms / (stats.totalPrograms || 1)) * 100)} 
                        status="active" 
                        showInfo={false} 
                        strokeColor="#52c41a" 
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card bordered={false}>
                      <Statistic
                        title="Completed"
                        value={stats.completedPrograms}
                        valueStyle={{ color: '#722ed1' }}
                      />
                      <Progress 
                        percent={Math.round((stats.completedPrograms / (stats.totalPrograms || 1)) * 100)} 
                        status="success" 
                        showInfo={false} 
                        strokeColor="#722ed1" 
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card bordered={false}>
                      <Statistic
                        title="Planned"
                        value={stats.totalPrograms - stats.activePrograms - stats.completedPrograms}
                        valueStyle={{ color: '#1890ff' }}
                      />
                      <Progress 
                        percent={Math.round(((stats.totalPrograms - stats.activePrograms - stats.completedPrograms) / (stats.totalPrograms || 1)) * 100)} 
                        showInfo={false} 
                        strokeColor="#1890ff" 
                      />
                    </Card>
                  </Col>
                </Row>
                
                <Divider />
                
                <List
                  itemLayout="horizontal"
                  dataSource={programs.slice(0, 5)}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            {item.programName}
                            <Tag color={
                              item.status === 'active' ? 'green' : 
                              item.status === 'planned' ? 'blue' : 
                              item.status === 'completed' ? 'purple' : 'red'
                            }>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space>
                            <Text type="secondary">{item.programType}</Text>
                            <Divider type="vertical" />
                            <Text type="secondary">{item.participantName}</Text>
                          </Space>
                        }
                      />
                      <div>
                        <Text strong>R{(item.budget || 0).toLocaleString()}</Text>
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
              
              {/* Recent Impact */}
              <Card 
                title="Recent Economic Impact" 
                style={{ marginBottom: 16 }}
                extra={
                  <Button 
                    type="link" 
                    onClick={() => navigate('/government/reports')}
                  >
                    View Full Reports
                  </Button>
                }
              >
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Card bordered={false}>
                      <Statistic
                        title="Jobs Created"
                        value={stats.jobsCreated}
                        valueStyle={{ color: '#52c41a' }}
                        prefix={<TeamOutlined />}
                      />
                      <Progress 
                        percent={Math.min(Math.round((stats.jobsCreated / 200) * 100), 100)} 
                        status={stats.jobsCreated >= 200 ? "success" : "active"}
                        format={() => `${Math.min(Math.round((stats.jobsCreated / 200) * 100), 100)}% of goal`}
                      />
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card bordered={false}>
                      <Statistic
                        title="Revenue Generated"
                        value={stats.revenueGenerated}
                        valueStyle={{ color: '#1890ff' }}
                        prefix={<DollarOutlined />}
                        formatter={value => `R${Number(value).toLocaleString()}`}
                      />
                      <Progress 
                        percent={Math.min(Math.round((stats.revenueGenerated / 10000000) * 100), 100)}
                        status={stats.revenueGenerated >= 10000000 ? "success" : "active"}
                        format={() => `${Math.min(Math.round((stats.revenueGenerated / 10000000) * 100), 100)}% of goal`}
                      />
                    </Card>
                  </Col>
                </Row>
                
                <Divider />
                
                <List
                  itemLayout="horizontal"
                  dataSource={metrics.slice(0, 5)}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        title={item.metricName}
                        description={
                          <Space>
                            <Text type="secondary">{item.programName}</Text>
                            <Divider type="vertical" />
                            <Text type="secondary">{item.participantName}</Text>
                          </Space>
                        }
                      />
                      <div>
                        <Text strong>
                          {item.metricName.includes('Revenue') 
                            ? `R${item.value.toLocaleString()}` 
                            : `${item.value} ${item.unit}`}
                        </Text>
                      </div>
                    </List.Item>
                  )}
                />
              </Card>
            </Col>
            
            {/* Right Column */}
            <Col xs={24} md={8}>
              {/* Notifications */}
              <Card 
                title={
                  <Space>
                    <BellOutlined />
                    <span>Notifications</span>
                    <Badge count={notifications.filter(n => !n.read).length} style={{ backgroundColor: '#52c41a' }} />
                  </Space>
                } 
                style={{ marginBottom: 16 }}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={notifications}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={renderNotificationIcon(item.type)}
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong={!item.read}>{item.title}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              {dayjs(item.date.toDate()).format('MMM D, HH:mm')}
                            </Text>
                          </div>
                        }
                        description={item.description}
                      />
                    </List.Item>
                  )}
                />
              </Card>
              
              {/* Upcoming Events */}
              <Card 
                title={
                  <Space>
                    <CalendarOutlined />
                    <span>Upcoming Program Events</span>
                  </Space>
                }
              >
                <List
                  itemLayout="horizontal"
                  dataSource={upcomingEvents}
                  renderItem={item => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ backgroundColor: item.status === 'active' ? '#52c41a' : '#1890ff' }}>
                            {item.status === 'active' ? 'A' : 'P'}
                          </Avatar>
                        }
                        title={item.programName}
                        description={
                          <>
                            <Space>
                              <CalendarOutlined />
                              <Text type="secondary">
                                {item.status === 'active' 
                                  ? `Ends: ${dayjs(item.endDate.toDate()).format('MMM D, YYYY')}`
                                  : `Starts: ${dayjs(item.startDate.toDate()).format('MMM D, YYYY')}`}
                              </Text>
                            </Space>
                            <br />
                            <Text type="secondary">{item.participantName}</Text>
                          </>
                        }
                      />
                    </List.Item>
                  )}
                />
                
                <Divider />
                
                <div style={{ textAlign: 'center' }}>
                  <Button 
                    type="primary" 
                    icon={<CalendarOutlined />}
                    onClick={() => navigate('/government/programs')}
                  >
                    View All Programs
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default GovernmentDashboard; 