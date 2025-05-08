import React, { useState, useEffect } from "react";
import { 
  Card, 
  Row, 
  Col, 
  Table, 
  Tag, 
  Button, 
  Typography, 
  Space, 
  Tooltip, 
  Badge, 
  Spin,
  Divider,
  Input,
  Select,
  DatePicker,
  Statistic
} from "antd";
import {
  PlusOutlined,
  FileTextOutlined,
  CalendarOutlined,
  DollarOutlined,
  TeamOutlined,
  FilterOutlined,
  SearchOutlined,
  ExportOutlined
} from "@ant-design/icons";
import { collection, getDocs, query, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "@/firebase";
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Search } = Input;

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
}

export const ProgramsDirectory: React.FC = () => {
  // State variables
  const [supportPrograms, setSupportPrograms] = useState<SupportProgram[]>([]);
  const [filteredPrograms, setFilteredPrograms] = useState<SupportProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  
  // Stats for dashboard cards
  const [stats, setStats] = useState({
    totalPrograms: 0,
    activePrograms: 0,
    plannedPrograms: 0,
    completedPrograms: 0,
    totalBudget: 0,
    participantsSupported: 0
  });

  // Fetch programs and participants data
  useEffect(() => {
    fetchSupportPrograms();
    fetchParticipants();
  }, []);

  // Apply filters whenever filter conditions change
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedStatus, selectedTypes, selectedParticipants, dateRange, supportPrograms]);

  // Fetch all support programs
  const fetchSupportPrograms = async () => {
    setLoading(true);
    try {
      const programsRef = collection(db, "supportPrograms");
      const programsQuery = query(programsRef, orderBy("createdAt", "desc"));
      const programsSnapshot = await getDocs(programsQuery);
      
      const programsData = programsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as SupportProgram));
      
      setSupportPrograms(programsData);
      setFilteredPrograms(programsData);
      
      // Calculate statistics
      calculateStats(programsData);
    } catch (error) {
      console.error("Error fetching support programs:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all participants for filters and program details
  const fetchParticipants = async () => {
    try {
      const participantsRef = collection(db, "participants");
      const participantsQuery = query(participantsRef, where("status", "!=", "deleted"));
      const participantsSnapshot = await getDocs(participantsQuery);
      
      const participantsData = participantsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      } as Participant));
      
      setParticipants(participantsData);
      
      // Add participant names to programs
      if (supportPrograms.length > 0) {
        const updatedPrograms = supportPrograms.map(program => {
          const participant = participantsData.find(p => p.id === program.participantId);
          return {
            ...program,
            participantName: participant?.name || "Unknown Participant"
          };
        });
        
        setSupportPrograms(updatedPrograms);
        setFilteredPrograms(updatedPrograms);
      }
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  };

  // Calculate statistics for dashboard cards
  const calculateStats = (programs: SupportProgram[]) => {
    const activePrograms = programs.filter(p => p.status === 'active');
    const plannedPrograms = programs.filter(p => p.status === 'planned');
    const completedPrograms = programs.filter(p => p.status === 'completed');
    
    // Calculate total budget
    const totalBudget = programs.reduce((sum, program) => sum + (program.budget || 0), 0);
    
    // Count unique participants supported
    const uniqueParticipantIds = new Set(programs.map(p => p.participantId));
    
    setStats({
      totalPrograms: programs.length,
      activePrograms: activePrograms.length,
      plannedPrograms: plannedPrograms.length,
      completedPrograms: completedPrograms.length,
      totalBudget: totalBudget,
      participantsSupported: uniqueParticipantIds.size
    });
  };

  // Apply all filters
  const applyFilters = () => {
    if (!supportPrograms.length) return;
    
    let filtered = [...supportPrograms];
    
    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      filtered = filtered.filter(p => 
        p.programName.toLowerCase().includes(lowerCaseSearch) ||
        p.description.toLowerCase().includes(lowerCaseSearch) ||
        p.programType.toLowerCase().includes(lowerCaseSearch) ||
        p.participantName?.toLowerCase().includes(lowerCaseSearch)
      );
    }
    
    // Apply status filter
    if (selectedStatus.length > 0) {
      filtered = filtered.filter(p => selectedStatus.includes(p.status));
    }
    
    // Apply program type filter
    if (selectedTypes.length > 0) {
      filtered = filtered.filter(p => selectedTypes.includes(p.programType));
    }
    
    // Apply participant filter
    if (selectedParticipants.length > 0) {
      filtered = filtered.filter(p => selectedParticipants.includes(p.participantId));
    }
    
    // Apply date range filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].startOf('day').toDate().getTime();
      const endDate = dateRange[1].endOf('day').toDate().getTime();
      
      filtered = filtered.filter(p => {
        const programStartTime = p.startDate.toDate().getTime();
        const programEndTime = p.endDate.toDate().getTime();
        
        // Program date range overlaps with selected date range
        return (programStartTime <= endDate && programEndTime >= startDate);
      });
    }
    
    setFilteredPrograms(filtered);
  };

  // Render status tag with color
  const renderStatusTag = (status: string) => {
    const statusColors = {
      'planned': 'blue',
      'active': 'green',
      'completed': 'purple',
      'cancelled': 'red'
    };
    
    return (
      <Tag color={statusColors[status as keyof typeof statusColors]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Tag>
    );
  };

  // Get participant name by ID
  const getParticipantName = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    return participant?.name || "Unknown Participant";
  };

  // Export programs list
  const exportProgramsList = () => {
    console.log("Exporting programs list:", filteredPrograms);
    // In a real app, this would generate a CSV or Excel file
  };

  // Table columns
  const columns = [
    {
      title: 'Program Name',
      dataIndex: 'programName',
      key: 'programName',
      render: (text: string, record: SupportProgram) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary">{record.programType}</Text>
        </Space>
      ),
    },
    {
      title: 'Participant',
      dataIndex: 'participantId',
      key: 'participant',
      render: (participantId: string, record: SupportProgram) => (
        <Text>{record.participantName || getParticipantName(participantId)}</Text>
      )
    },
    {
      title: 'Timeline',
      key: 'timeline',
      render: (_: any, record: SupportProgram) => (
        <Space direction="vertical" size={0}>
          <Text>Start: {record.startDate.toDate().toLocaleDateString()}</Text>
          <Text>End: {record.endDate.toDate().toLocaleDateString()}</Text>
        </Space>
      )
    },
    {
      title: 'Budget',
      dataIndex: 'budget',
      key: 'budget',
      render: (budget?: number) => budget ? `R${budget.toLocaleString()}` : 'N/A',
      sorter: (a: SupportProgram, b: SupportProgram) => (a.budget || 0) - (b.budget || 0)
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => renderStatusTag(status),
      filters: [
        { text: 'Planned', value: 'planned' },
        { text: 'Active', value: 'active' },
        { text: 'Completed', value: 'completed' },
        { text: 'Cancelled', value: 'cancelled' }
      ],
      onFilter: (value: any, record: SupportProgram) => record.status === value
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: SupportProgram) => (
        <Space>
          <Button type="link" onClick={() => console.log('View details', record.id)}>
            Details
          </Button>
          <Button type="link" onClick={() => console.log('Edit program', record.id)}>
            Edit
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <Title level={3}>Support Programs</Title>
          <Text type="secondary">
            Manage and track support programs for incubated participants
          </Text>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => console.log('Add program clicked')}
            >
              Create Program
            </Button>
            <Button 
              type="default" 
              icon={<ExportOutlined />}
              onClick={exportProgramsList}
            >
              Export List
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Statistics Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Total Programs"
              value={stats.totalPrograms}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Active Programs"
              value={stats.activePrograms}
              valueStyle={{ color: '#52c41a' }}
              prefix={<Badge status="success" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Planned Programs"
              value={stats.plannedPrograms}
              valueStyle={{ color: '#1890ff' }}
              prefix={<Badge status="processing" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Completed Programs"
              value={stats.completedPrograms}
              valueStyle={{ color: '#722ed1' }}
              prefix={<Badge status="default" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Total Budget"
              value={stats.totalBudget}
              valueStyle={{ color: '#faad14' }}
              prefix={<DollarOutlined />}
              formatter={value => `R${Number(value).toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic
              title="Participants Supported"
              value={stats.participantsSupported}
              valueStyle={{ color: '#eb2f96' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters Section */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Search
              placeholder="Search programs..."
              allowClear
              enterButton={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          
          <Col xs={24} md={6}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Filter by Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              maxTagCount={2}
            >
              <Option value="planned">Planned</Option>
              <Option value="active">Active</Option>
              <Option value="completed">Completed</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          
          <Col xs={24} md={6}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Filter by Program Type"
              value={selectedTypes}
              onChange={setSelectedTypes}
              maxTagCount={2}
            >
              <Option value="Grant Funding">Grant Funding</Option>
              <Option value="Technical Assistance">Technical Assistance</Option>
              <Option value="Mentorship">Mentorship</Option>
              <Option value="Market Access Support">Market Access Support</Option>
              <Option value="Infrastructure Access">Infrastructure Access</Option>
              <Option value="Training & Skills Development">Training & Skills Development</Option>
              <Option value="Regulatory Support">Regulatory Support</Option>
            </Select>
          </Col>
          
          <Col xs={24} md={6}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Filter by Participant"
              value={selectedParticipants}
              onChange={setSelectedParticipants}
              maxTagCount={2}
              showSearch
              optionFilterProp="children"
            >
              {participants.map(participant => (
                <Option key={participant.id} value={participant.id}>
                  {participant.name}
                </Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} md={12}>
            <Space>
              <Text>Date Range:</Text>
              <RangePicker 
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
              />
            </Space>
          </Col>
          
          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Button 
              onClick={() => {
                setSearchText("");
                setSelectedStatus([]);
                setSelectedTypes([]);
                setSelectedParticipants([]);
                setDateRange(null);
              }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Results Section */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 100 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>Loading support programs...</div>
          </div>
        ) : (
          <Table 
            dataSource={filteredPrograms} 
            columns={columns}
            rowKey="id"
            pagination={{ 
              pageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} programs` 
            }}
          />
        )}
      </Card>
    </div>
  );
};

export default ProgramsDirectory; 