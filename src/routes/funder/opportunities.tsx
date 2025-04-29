import React, { useState, useEffect } from "react";
import { 
  Card, 
  Table, 
  Tag, 
  Typography, 
  Button, 
  Space, 
  Avatar, 
  Progress,
  Row,
  Col,
  Divider,
  Select,
  Input,
  Modal,
  Descriptions
} from "antd";
import {
  EyeOutlined,
  DollarOutlined,
  SearchOutlined,
  FilterOutlined
} from "@ant-design/icons";
import { formatCurrency, getStatusColor } from "./utils";

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Interface for investment opportunities
interface InvestmentOpportunity {
  id: string;
  name: string;
  logo?: string;
  industry?: string;
  location?: string;
  description?: string;
  fundingGoal?: number;
  fundingRaised?: number;
  progress?: number;
  daysLeft?: number;
  status?: string;
  stage?: string;
  team?: number;
  requiredFunding?: number;
  valuation?: number;
  riskLevel?: string;
}

export const FunderOpportunities: React.FC = () => {
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpportunity, setSelectedOpportunity] = useState<InvestmentOpportunity | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // Fetch opportunities data
  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        setLoading(true);
        
        // Sample investment opportunities - in a real app, this would come from an API/Firebase
        const sampleOpportunities: InvestmentOpportunity[] = [
          {
            id: '1',
            name: 'TechSolutions Inc.',
            logo: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60',
            industry: 'Software',
            stage: 'Early',
            location: 'Cape Town, SA',
            description: 'Cloud-based software solutions for small businesses with focus on automation and efficiency',
            status: 'active',
            progress: 32,
            fundingGoal: 750000,
            fundingRaised: 240000,
            daysLeft: 45,
            team: 4,
            requiredFunding: 500000,
            valuation: 2500000,
            riskLevel: 'Medium'
          },
          {
            id: '2',
            name: 'GreenEnergy Startup',
            logo: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&auto=format&fit=crop&q=60',
            industry: 'Renewable Energy',
            stage: 'Growth',
            location: 'Johannesburg, SA',
            description: 'Affordable solar solutions for residential and commercial properties with innovative financing models',
            status: 'active',
            progress: 68,
            fundingGoal: 1200000,
            fundingRaised: 816000,
            daysLeft: 30,
            team: 7,
            requiredFunding: 400000,
            valuation: 4200000,
            riskLevel: 'Low'
          },
          {
            id: '3',
            name: 'HealthTech Innovations',
            logo: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=60',
            industry: 'Healthcare',
            stage: 'Scaling',
            location: 'Durban, SA',
            description: 'AI-powered diagnostic tools for rural healthcare facilities with limited access to specialists',
            status: 'warning',
            progress: 75,
            fundingGoal: 500000,
            fundingRaised: 375000,
            daysLeft: 15,
            team: 5,
            requiredFunding: 125000,
            valuation: 3500000,
            riskLevel: 'Medium'
          },
          {
            id: '4',
            name: 'AgriTech Pioneers',
            logo: 'https://placehold.co/300x200/16a34a/ffffff?text=AgriTech&font=open-sans',
            industry: 'Agriculture',
            stage: 'Early',
            location: 'Stellenbosch, SA',
            description: 'Smart farming solutions using IoT and data analytics to optimize crop yields and reduce resource usage',
            status: 'active',
            progress: 25,
            fundingGoal: 600000,
            fundingRaised: 150000,
            daysLeft: 60,
            team: 6,
            requiredFunding: 450000,
            valuation: 2200000,
            riskLevel: 'High'
          },
          {
            id: '5',
            name: 'EdTech Solutions',
            logo: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=60',
            industry: 'Education',
            stage: 'Early',
            location: 'Cape Town, SA',
            description: 'Digital platform connecting students with tutors and educational resources tailored for African curriculum',
            status: 'active',
            progress: 15,
            fundingGoal: 300000,
            fundingRaised: 45000,
            daysLeft: 60,
            team: 3,
            requiredFunding: 255000,
            valuation: 1200000,
            riskLevel: 'Medium'
          }
        ];
        
        setOpportunities(sampleOpportunities);
      } catch (error) {
        console.error("Error fetching opportunities data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunities();
  }, []);

  // Filter opportunities based on search and filter criteria
  const filteredOpportunities = opportunities.filter(opp => {
    // Search filter
    const searchMatch = searchText === '' || 
      opp.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (opp.description && opp.description.toLowerCase().includes(searchText.toLowerCase())) ||
      (opp.industry && opp.industry.toLowerCase().includes(searchText.toLowerCase()));
    
    // Industry filter
    const industryMatch = !filterIndustry || opp.industry === filterIndustry;
    
    // Risk level filter
    const riskMatch = !filterRisk || opp.riskLevel === filterRisk;
    
    return searchMatch && industryMatch && riskMatch;
  });

  // Get unique industries for filter
  const industries = Array.from(new Set(opportunities.map(opp => opp.industry))).filter(Boolean);
  
  // Get unique risk levels for filter
  const riskLevels = Array.from(new Set(opportunities.map(opp => opp.riskLevel))).filter(Boolean);

  // View opportunity details
  const handleViewDetails = (opportunity: InvestmentOpportunity) => {
    setSelectedOpportunity(opportunity);
    setDetailsModalVisible(true);
  };

  // Handle investing in an opportunity (redirects to dashboard for now)
  const handleInvest = (opportunity: InvestmentOpportunity) => {
    window.location.href = `/funder?invest=${opportunity.id}`;
  };

  // Columns for the opportunities table
  const columns = [
    {
      title: 'Company',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: InvestmentOpportunity) => (
        <Space>
          <Avatar 
            src={record.logo} 
            size="large" 
            shape="square"
            style={{ marginRight: 8 }}
          />
          <div>
            <Text strong>{text}</Text>
            <div>
              <Tag color="blue">{record.industry}</Tag>
              <Tag>{record.stage}</Tag>
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Funding',
      dataIndex: 'fundingRaised',
      key: 'fundingRaised',
      render: (_: any, record: InvestmentOpportunity) => (
        <div>
          <Text>{formatCurrency(record.fundingRaised)} / {formatCurrency(record.fundingGoal)}</Text>
          <Progress 
            percent={record.progress} 
            size="small" 
            status={
              record.status === 'closed' ? 'success' : 
              (record.progress || 0) < 30 ? 'exception' : 
              'active'
            }
          />
        </div>
      ),
      sorter: (a: InvestmentOpportunity, b: InvestmentOpportunity) => 
        (a.progress || 0) - (b.progress || 0),
    },
    {
      title: 'Valuation',
      dataIndex: 'valuation',
      key: 'valuation',
      render: (valuation: number) => formatCurrency(valuation),
      sorter: (a: InvestmentOpportunity, b: InvestmentOpportunity) => 
        (a.valuation || 0) - (b.valuation || 0),
    },
    {
      title: 'Risk Level',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (risk: string) => {
        const color = risk === 'Low' ? 'green' : risk === 'Medium' ? 'orange' : 'red';
        return <Tag color={color}>{risk}</Tag>;
      },
      filters: riskLevels.map(risk => ({ text: risk, value: risk })),
      onFilter: (value: string, record: InvestmentOpportunity) => 
        record.riskLevel === value,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Tag>
      ),
    },
    {
      title: 'Time Left',
      dataIndex: 'daysLeft',
      key: 'daysLeft',
      render: (days: number) => `${days} days`,
      sorter: (a: InvestmentOpportunity, b: InvestmentOpportunity) => 
        (a.daysLeft || 0) - (b.daysLeft || 0),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: InvestmentOpportunity) => (
        <Space>
          <Button
            type="primary"
            ghost
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
          >
            Details
          </Button>
          <Button
            type="primary"
            icon={<DollarOutlined />}
            disabled={record.status === 'closed'}
            onClick={() => handleInvest(record)}
          >
            Invest
          </Button>
        </Space>
      ),
    },
  ];

  // Render details modal
  const renderDetailsModal = () => {
    if (!selectedOpportunity) return null;

    return (
      <Modal
        title={`Investment Opportunity: ${selectedOpportunity.name}`}
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailsModalVisible(false)}>
            Close
          </Button>,
          <Button 
            key="invest" 
            type="primary" 
            onClick={() => handleInvest(selectedOpportunity)}
            disabled={selectedOpportunity.status === 'closed'}
          >
            Invest Now
          </Button>,
        ]}
        width={800}
      >
        <div style={{ display: 'flex', marginBottom: 20 }}>
          <Avatar 
            src={selectedOpportunity.logo} 
            size={100} 
            shape="square"
            style={{ marginRight: 20 }}
          />
          <div>
            <Title level={4}>{selectedOpportunity.name}</Title>
            <Space>
              <Tag color="blue">{selectedOpportunity.industry}</Tag>
              <Tag>{selectedOpportunity.stage}</Tag>
              <Tag color={getStatusColor(selectedOpportunity.status || 'active')}>
                {selectedOpportunity.status?.charAt(0).toUpperCase() + selectedOpportunity.status?.slice(1) || 'Active'}
              </Tag>
            </Space>
            <Paragraph style={{ marginTop: 10 }}>{selectedOpportunity.description}</Paragraph>
          </div>
        </div>
        
        <Divider />
        
        <Descriptions title="Funding Information" bordered>
          <Descriptions.Item label="Required Funding">{formatCurrency(selectedOpportunity.requiredFunding)}</Descriptions.Item>
          <Descriptions.Item label="Company Valuation">{formatCurrency(selectedOpportunity.valuation)}</Descriptions.Item>
          <Descriptions.Item label="Risk Level">
            <Tag color={
              selectedOpportunity.riskLevel === 'Low' ? 'green' : 
              selectedOpportunity.riskLevel === 'Medium' ? 'orange' : 
              'red'
            }>{selectedOpportunity.riskLevel}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Current Progress" span={3}>
            <div style={{ width: '100%' }}>
              <Text>{formatCurrency(selectedOpportunity?.fundingRaised)} / {formatCurrency(selectedOpportunity?.fundingGoal)}</Text>
              <Progress 
                percent={selectedOpportunity?.progress} 
                status={
                  selectedOpportunity?.status === 'closed' ? 'success' : 
                  (selectedOpportunity?.progress || 0) < 30 ? 'exception' : 
                  'active'
                }
              />
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Team Size">{selectedOpportunity.team} members</Descriptions.Item>
          <Descriptions.Item label="Location">{selectedOpportunity.location}</Descriptions.Item>
          <Descriptions.Item label="Time Remaining">{selectedOpportunity.daysLeft} days</Descriptions.Item>
        </Descriptions>
      </Modal>
    );
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={2}>Investment Opportunities</Title>
      <Paragraph>
        Browse and filter vetted investment opportunities across various sectors.
      </Paragraph>

      <Divider />

      {/* Filters */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="Search opportunities"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="Filter by Industry"
              style={{ width: '100%' }}
              allowClear
              value={filterIndustry}
              onChange={value => setFilterIndustry(value)}
            >
              {industries.map((industry, index) => (
                <Option key={index} value={industry}>{industry}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="Filter by Risk Level"
              style={{ width: '100%' }}
              allowClear
              value={filterRisk}
              onChange={value => setFilterRisk(value)}
            >
              {riskLevels.map((risk, index) => (
                <Option key={index} value={risk}>{risk}</Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Button 
              icon={<FilterOutlined />}
              onClick={() => {
                setFilterIndustry(null);
                setFilterRisk(null);
                setSearchText('');
              }}
            >
              Reset Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Opportunities Table */}
      <Card title={`Available Opportunities (${filteredOpportunities.length})`}>
        <Table 
          columns={columns} 
          dataSource={filteredOpportunities} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Details Modal */}
      {renderDetailsModal()}
    </div>
  );
};

export default FunderOpportunities; 