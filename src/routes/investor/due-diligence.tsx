import React, { useState, useEffect } from "react";
import {
  Card,
  Typography,
  Steps,
  Button,
  Table,
  Tag,
  Space,
  Progress,
  Collapse,
  Checkbox,
  List,
  Divider,
  Input,
  Upload,
  Tabs,
  Tooltip,
  Modal,
  message,
  Select,
  DatePicker,
  Row,
  Col,
  Descriptions
} from "antd";
import {
  FileOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UploadOutlined,
  PlusOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  FileDoneOutlined,
  QuestionCircleOutlined
} from "@ant-design/icons";
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import type { UploadProps } from 'antd';
import { formatCurrency } from "./utils";
import Todo, { TodoItem } from "../../components/Todo";

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Panel } = Collapse;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Option } = Select;

// Types and interfaces
interface Company {
  id: string;
  name: string;
  industry: string;
  stage: string;
  fundingRequired: number;
  valuation: number;
  pitch: string;
  status: string;
}

// Using TodoItem directly from the Todo component for consistency
// interface ChecklistItem {
//   id: string;
//   text: string;
//   isCompleted: boolean;
//   category: string;
//   notes?: string;
// }

interface DueDiligenceTemplate {
  id: string;
  name: string;
  description: string;
  categories: string[];
  items: TodoItem[];
}

interface DueDiligenceProcess {
  id: string;
  companyId: string;
  companyName: string;
  startDate: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold';
  currentStep: number;
  progress: number;
  assignedTo: string;
  templateId: string;
  checklistItems: TodoItem[];
  documents: DueDiligenceDocument[];
  notes: string;
}

interface DueDiligenceDocument {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  category: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  url: string;
}

// Sample data
const sampleCompanies: Company[] = [
  {
    id: 'c1',
    name: 'TechSolutions Inc.',
    industry: 'Software',
    stage: 'Early',
    fundingRequired: 500000,
    valuation: 2500000,
    pitch: 'Cloud-based software solutions for small businesses with focus on automation and efficiency',
    status: 'active'
  },
  {
    id: 'c2',
    name: 'GreenEnergy Startup',
    industry: 'Renewable Energy',
    stage: 'Growth',
    fundingRequired: 400000,
    valuation: 4200000,
    pitch: 'Affordable solar solutions for residential and commercial properties with innovative financing models',
    status: 'active'
  },
  {
    id: 'c3',
    name: 'HealthTech Innovations',
    industry: 'Healthcare',
    stage: 'Scaling',
    fundingRequired: 125000,
    valuation: 3500000,
    pitch: 'AI-powered diagnostic tools for rural healthcare facilities with limited access to specialists',
    status: 'active'
  }
];

const dueDiligenceTemplates: DueDiligenceTemplate[] = [
  {
    id: 't1',
    name: 'Standard Due Diligence',
    description: 'Standard template for early-stage startups',
    categories: ['Financial', 'Legal', 'Market', 'Team', 'Technology'],
    items: [
      { id: 'i1', text: 'Review financial statements for the past 3 years', isCompleted: false, category: 'Financial' },
      { id: 'i2', text: 'Verify cash flow projections', isCompleted: false, category: 'Financial' },
      { id: 'i3', text: 'Analyze revenue model and pricing strategy', isCompleted: false, category: 'Financial' },
      { id: 'i4', text: 'Review cap table and equity structure', isCompleted: false, category: 'Financial' },
      { id: 'i5', text: 'Check for any pending legal disputes', isCompleted: false, category: 'Legal' },
      { id: 'i6', text: 'Verify intellectual property ownership', isCompleted: false, category: 'Legal' },
      { id: 'i7', text: 'Review key contracts and agreements', isCompleted: false, category: 'Legal' },
      { id: 'i8', text: 'Analyze market size and growth potential', isCompleted: false, category: 'Market' },
      { id: 'i9', text: 'Identify key competitors and market positioning', isCompleted: false, category: 'Market' },
      { id: 'i10', text: 'Evaluate target customer segments', isCompleted: false, category: 'Market' },
      { id: 'i11', text: 'Assess founding team experience and expertise', isCompleted: false, category: 'Team' },
      { id: 'i12', text: 'Review team structure and key hires', isCompleted: false, category: 'Team' },
      { id: 'i13', text: 'Evaluate technical architecture', isCompleted: false, category: 'Technology' },
      { id: 'i14', text: 'Review product roadmap', isCompleted: false, category: 'Technology' },
      { id: 'i15', text: 'Assess scalability of technology', isCompleted: false, category: 'Technology' }
    ]
  },
  {
    id: 't2',
    name: 'Tech Startup Due Diligence',
    description: 'Specialized for software and tech startups',
    categories: ['Financial', 'Legal', 'Technology', 'Product', 'Market'],
    items: [
      { id: 'i1', text: 'Review financial statements', isCompleted: false, category: 'Financial' },
      { id: 'i2', text: 'Verify cash burn rate', isCompleted: false, category: 'Financial' },
      { id: 'i3', text: 'Analyze customer acquisition costs', isCompleted: false, category: 'Financial' },
      { id: 'i4', text: 'Review IP portfolio and patents', isCompleted: false, category: 'Legal' },
      { id: 'i5', text: 'Assess technical debt', isCompleted: false, category: 'Technology' },
      { id: 'i6', text: 'Review security practices and compliance', isCompleted: false, category: 'Technology' },
      { id: 'i7', text: 'Evaluate scalability of architecture', isCompleted: false, category: 'Technology' },
      { id: 'i8', text: 'Assess dev team skills and capacity', isCompleted: false, category: 'Technology' },
      { id: 'i9', text: 'Review product-market fit evidence', isCompleted: false, category: 'Product' },
      { id: 'i10', text: 'Analyze user metrics and engagement', isCompleted: false, category: 'Product' },
      { id: 'i11', text: 'Evaluate competitive landscape', isCompleted: false, category: 'Market' }
    ]
  },
  {
    id: 't3',
    name: 'Pre-Seed Investment Checklist',
    description: 'Lightweight due diligence for very early stage startups',
    categories: ['Team', 'Product', 'Market', 'Legal'],
    items: [
      { id: 'i1', text: 'Evaluate founder experience and background', isCompleted: false, category: 'Team' },
      { id: 'i2', text: 'Assess founder commitment and vision', isCompleted: false, category: 'Team' },
      { id: 'i3', text: 'Review MVP or prototype', isCompleted: false, category: 'Product' },
      { id: 'i4', text: 'Evaluate product roadmap', isCompleted: false, category: 'Product' },
      { id: 'i5', text: 'Assess market size and opportunity', isCompleted: false, category: 'Market' },
      { id: 'i6', text: 'Review company incorporation documents', isCompleted: false, category: 'Legal' },
      { id: 'i7', text: 'Verify equity structure and cap table', isCompleted: false, category: 'Legal' }
    ]
  }
];

const sampleDueDiligenceProcesses: DueDiligenceProcess[] = [
  {
    id: 'dd1',
    companyId: 'c1',
    companyName: 'TechSolutions Inc.',
    startDate: '2023-08-01',
    status: 'in-progress',
    currentStep: 2,
    progress: 45,
    assignedTo: 'John Doe',
    templateId: 't1',
    checklistItems: dueDiligenceTemplates[0].items.map(item => ({...item})),
    documents: [
      {
        id: 'd1',
        name: 'Financial Statements 2022',
        type: 'PDF',
        uploadDate: '2023-08-03',
        category: 'Financial',
        status: 'reviewed',
        url: '#'
      },
      {
        id: 'd2',
        name: 'Cap Table',
        type: 'Excel',
        uploadDate: '2023-08-05',
        category: 'Financial',
        status: 'approved',
        url: '#'
      },
      {
        id: 'd3',
        name: 'Intellectual Property Overview',
        type: 'PDF',
        uploadDate: '2023-08-10',
        category: 'Legal',
        status: 'pending',
        url: '#'
      }
    ],
    notes: 'Initial review shows promising financial indicators. Need to follow up on IP ownership questions.'
  },
  {
    id: 'dd2',
    companyId: 'c2',
    companyName: 'GreenEnergy Startup',
    startDate: '2023-07-15',
    status: 'in-progress',
    currentStep: 3,
    progress: 78,
    assignedTo: 'Sarah Johnson',
    templateId: 't2',
    checklistItems: dueDiligenceTemplates[1].items.map(item => ({...item, isCompleted: Math.random() > 0.3})),
    documents: [
      {
        id: 'd1',
        name: 'Business Plan',
        type: 'PDF',
        uploadDate: '2023-07-20',
        category: 'Financial',
        status: 'approved',
        url: '#'
      },
      {
        id: 'd2',
        name: 'Market Analysis Report',
        type: 'PDF',
        uploadDate: '2023-07-25',
        category: 'Market',
        status: 'approved',
        url: '#'
      },
      {
        id: 'd3',
        name: 'Technical Architecture Document',
        type: 'PDF',
        uploadDate: '2023-08-01',
        category: 'Technology',
        status: 'reviewed',
        url: '#'
      }
    ],
    notes: 'Green Energy Startup shows strong market positioning and solid team. Technology implementation appears scalable.'
  },
  {
    id: 'dd3',
    companyId: 'c3',
    companyName: 'HealthTech Innovations',
    startDate: '2023-08-10',
    status: 'not-started',
    currentStep: 0,
    progress: 0,
    assignedTo: 'Michael Brown',
    templateId: 't3',
    checklistItems: dueDiligenceTemplates[2].items.map(item => ({...item})),
    documents: [],
    notes: 'Initial inquiry stage. Scheduled kick-off meeting for August 15th.'
  }
];

// Main component
export const FunderDueDiligence: React.FC = () => {
  const [activeTab, setActiveTab] = useState('processes');
  const [processes, setProcesses] = useState<DueDiligenceProcess[]>(sampleDueDiligenceProcesses);
  const [companies, setCompanies] = useState<Company[]>(sampleCompanies);
  const [templates, setTemplates] = useState<DueDiligenceTemplate[]>(dueDiligenceTemplates);
  const [selectedProcess, setSelectedProcess] = useState<DueDiligenceProcess | null>(null);
  const [activeAccordion, setActiveAccordion] = useState<string | string[]>([]);
  const [newProcessModal, setNewProcessModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // Handle checklist item changes
  const handleChecklistChange = (updatedItems: TodoItem[]) => {
    if (!selectedProcess) return;
    
    // Calculate new progress
    const completedItems = updatedItems.filter(item => item.isCompleted).length;
    const totalItems = updatedItems.length;
    const newProgress = Math.round((completedItems / totalItems) * 100);
    
    const updatedProcess = {
      ...selectedProcess,
      checklistItems: updatedItems,
      progress: newProgress
    };
    
    // Update processes state
    const newProcesses = processes.map(process => 
      process.id === selectedProcess.id ? updatedProcess : process
    );
    
    setProcesses(newProcesses);
    setSelectedProcess(updatedProcess);
  };
  
  // Handle document status change
  const handleDocumentStatusChange = (processId: string, documentId: string, status: 'pending' | 'reviewed' | 'approved' | 'rejected') => {
    const newProcesses = processes.map(process => {
      if (process.id === processId) {
        const newDocuments = process.documents.map(doc => {
          if (doc.id === documentId) {
            return { ...doc, status };
          }
          return doc;
        });
        
        return { ...process, documents: newDocuments };
      }
      return process;
    });
    
    setProcesses(newProcesses);
    
    // Update selected process
    if (selectedProcess && selectedProcess.id === processId) {
      const updatedProcess = newProcesses.find(p => p.id === processId);
      if (updatedProcess) {
        setSelectedProcess(updatedProcess);
      }
    }
    
    message.success(`Document status updated to ${status}`);
  };
  
  // Create new due diligence process
  const handleCreateProcess = () => {
    if (!selectedCompany || !selectedTemplate) {
      message.error('Please select a company and template');
      return;
    }
    
    const company = companies.find(c => c.id === selectedCompany);
    const template = templates.find(t => t.id === selectedTemplate);
    
    if (!company || !template) {
      message.error('Invalid company or template selection');
      return;
    }
    
    const newProcess: DueDiligenceProcess = {
      id: `dd${Date.now()}`,
      companyId: company.id,
      companyName: company.name,
      startDate: new Date().toISOString().split('T')[0],
      status: 'not-started',
      currentStep: 0,
      progress: 0,
      assignedTo: 'Current User', // In a real app, this would be the current user
      templateId: template.id,
      checklistItems: template.items.map(item => ({...item})),
      documents: [],
      notes: `Initial due diligence process for ${company.name} using ${template.name} template.`
    };
    
    setProcesses([...processes, newProcess]);
    setNewProcessModal(false);
    message.success(`Due diligence process created for ${company.name}`);
  };
  
  // Get status tag for process
  const getStatusTag = (status: string) => {
    switch (status) {
      case 'not-started':
        return <Tag color="default">Not Started</Tag>;
      case 'in-progress':
        return <Tag color="processing">In Progress</Tag>;
      case 'completed':
        return <Tag color="success">Completed</Tag>;
      case 'on-hold':
        return <Tag color="warning">On Hold</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };
  
  // Get status tag for document
  const getDocumentStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag color="default">Pending Review</Tag>;
      case 'reviewed':
        return <Tag color="processing">Reviewed</Tag>;
      case 'approved':
        return <Tag color="success">Approved</Tag>;
      case 'rejected':
        return <Tag color="error">Rejected</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };
  
  // Get document icon based on type
  const getDocumentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />;
      case 'excel':
        return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 16 }} />;
      default:
        return <FileOutlined style={{ color: '#1890ff', fontSize: 16 }} />;
    }
  };
  
  // Process table columns
  const processColumns = [
    {
      title: 'Company',
      dataIndex: 'companyName',
      key: 'companyName',
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Progress',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number) => (
        <Progress percent={progress} size="small" />
      ),
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: DueDiligenceProcess) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            onClick={() => setSelectedProcess(record)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];
  
  // Upload props for document upload
  const uploadProps: UploadProps = {
    name: 'file',
    action: 'https://www.mocky.io/v2/5cc8019d300000980a055e76', // Mock endpoint
    headers: {
      authorization: 'authorization-text',
    },
    onChange(info) {
      if (info.file.status !== 'uploading') {
        console.log(info.file, info.fileList);
      }
      if (info.file.status === 'done') {
        message.success(`${info.file.name} file uploaded successfully`);
        
        // Add the document to the selected process
        if (selectedProcess) {
          const newDocument: DueDiligenceDocument = {
            id: `d${Date.now()}`,
            name: info.file.name,
            type: info.file.name.split('.').pop()?.toUpperCase() || 'PDF',
            uploadDate: new Date().toISOString().split('T')[0],
            category: 'General', // This would be selected by user in a real app
            status: 'pending',
            url: '#'
          };
          
          const updatedProcess = {
            ...selectedProcess,
            documents: [...selectedProcess.documents, newDocument]
          };
          
          // Update processes state
          const newProcesses = processes.map(process => 
            process.id === selectedProcess.id ? updatedProcess : process
          );
          
          setProcesses(newProcesses);
          setSelectedProcess(updatedProcess);
        }
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
  };
  
  // Process details view
  const renderProcessDetails = () => {
    if (!selectedProcess) return null;
    
    // Extract unique categories from checklist items and filter out undefined values
    const categories = Array.from(
      new Set(selectedProcess.checklistItems.map(item => item.category))
    ).filter(category => category !== undefined) as string[];
    
    return (
      <Card title={`Due Diligence: ${selectedProcess.companyName}`} 
        extra={
          <Button onClick={() => setSelectedProcess(null)}>
            Back to List
          </Button>
        }>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small" title="Status">
              {getStatusTag(selectedProcess.status)}
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="Progress">
              <Progress percent={selectedProcess.progress} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="Started">
              {selectedProcess.startDate}
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="Assigned To">
              {selectedProcess.assignedTo}
            </Card>
          </Col>
        </Row>
        
        <Tabs defaultActiveKey="checklist">
          <TabPane tab="Checklist" key="checklist">
            <Todo 
              title="Due Diligence Checklist"
              description={`Checklist for ${selectedProcess.companyName}`}
              items={selectedProcess.checklistItems}
              categories={categories}
              showCategories={true}
              showProgress={true}
              onChange={handleChecklistChange}
            />
          </TabPane>
          
          <TabPane tab="Documents" key="documents">
            <Row style={{ marginBottom: 16 }}>
              <Col span={24}>
                <Upload {...uploadProps}>
                  <Button icon={<UploadOutlined />}>Upload Document</Button>
                </Upload>
              </Col>
            </Row>
            
            <Table
              dataSource={selectedProcess.documents}
              rowKey="id"
              columns={[
                {
                  title: 'Document',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text, record) => (
                    <Space>
                      {getDocumentIcon(record.type)}
                      <Text>{text}</Text>
                    </Space>
                  )
                },
                {
                  title: 'Category',
                  dataIndex: 'category',
                  key: 'category',
                },
                {
                  title: 'Upload Date',
                  dataIndex: 'uploadDate',
                  key: 'uploadDate',
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => getDocumentStatusTag(status)
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="View">
                        <Button
                          icon={<EyeOutlined />}
                          size="small"
                          onClick={() => {
                            // In a real app, this would open the document
                            message.info(`Viewing document: ${record.name}`);
                          }}
                        />
                      </Tooltip>
                      <Select
                        defaultValue={record.status}
                        style={{ width: 120 }}
                        onChange={(value) => handleDocumentStatusChange(selectedProcess.id, record.id, value)}
                        size="small"
                      >
                        <Option value="pending">Pending</Option>
                        <Option value="reviewed">Reviewed</Option>
                        <Option value="approved">Approved</Option>
                        <Option value="rejected">Rejected</Option>
                      </Select>
                    </Space>
                  )
                }
              ]}
            />
          </TabPane>
          
          <TabPane tab="Notes" key="notes">
            <TextArea
              rows={6}
              value={selectedProcess.notes}
              onChange={(e) => {
                const newProcesses = processes.map(process => {
                  if (process.id === selectedProcess.id) {
                    return { ...process, notes: e.target.value };
                  }
                  return process;
                });
                
                setProcesses(newProcesses);
                setSelectedProcess({...selectedProcess, notes: e.target.value});
              }}
              placeholder="Enter notes about this due diligence process..."
            />
            <Button 
              type="primary" 
              style={{ marginTop: 16 }}
              onClick={() => message.success('Notes saved successfully')}
            >
              Save Notes
            </Button>
          </TabPane>
          
          <TabPane tab="Company Info" key="company">
            {(() => {
              const company = companies.find(c => c.id === selectedProcess.companyId);
              if (!company) return <Text>Company information not available</Text>;
              
              return (
                <>
                  <Descriptions bordered column={2}>
                    <Descriptions.Item label="Company Name">{company.name}</Descriptions.Item>
                    <Descriptions.Item label="Industry">{company.industry}</Descriptions.Item>
                    <Descriptions.Item label="Stage">{company.stage}</Descriptions.Item>
                    <Descriptions.Item label="Funding Required">{formatCurrency(company.fundingRequired)}</Descriptions.Item>
                    <Descriptions.Item label="Valuation">{formatCurrency(company.valuation)}</Descriptions.Item>
                    <Descriptions.Item label="Status">{getStatusTag(company.status)}</Descriptions.Item>
                  </Descriptions>
                  
                  <Divider orientation="left">Pitch</Divider>
                  <Paragraph>{company.pitch}</Paragraph>
                </>
              );
            })()}
          </TabPane>
        </Tabs>
      </Card>
    );
  };
  
  // Templates tab
  const renderTemplatesTab = () => {
    return (
      <div>
        <Row gutter={[16, 16]}>
          {templates.map(template => (
            <Col span={8} key={template.id}>
              <Card
                title={template.name}
                extra={
                  <Tooltip title="View Details">
                    <Button
                      type="text"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        // In a real app, this would open a modal with template details
                        Modal.info({
                          title: template.name,
                          content: (
                            <div>
                              <p>{template.description}</p>
                              <Divider />
                              <p><strong>Categories:</strong> {template.categories.join(', ')}</p>
                              <Divider />
                              <p><strong>Items:</strong> {template.items.length}</p>
                              <List
                                size="small"
                                dataSource={template.items.slice(0, 5)}
                                renderItem={item => <List.Item>{item.text}</List.Item>}
                                footer={
                                  template.items.length > 5 ? 
                                  `And ${template.items.length - 5} more items...` : 
                                  null
                                }
                              />
                            </div>
                          ),
                          width: 600,
                        });
                      }}
                    />
                  </Tooltip>
                }
              >
                <p>{template.description}</p>
                <p><strong>Categories:</strong> {template.categories.join(', ')}</p>
                <p><strong>Items:</strong> {template.items.length}</p>
                <Space style={{ marginTop: 16 }}>
                  <Button 
                    type="primary"
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setNewProcessModal(true);
                    }}
                  >
                    Use Template
                  </Button>
                  <Button>Edit</Button>
                </Space>
              </Card>
            </Col>
          ))}
          <Col span={8}>
            <Card 
              style={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'center', 
                alignItems: 'center',
                border: '1px dashed #d9d9d9',
                backgroundColor: '#fafafa',
              }}
            >
              <Button 
                type="dashed" 
                icon={<PlusOutlined />}
                style={{ marginBottom: 16 }}
                onClick={() => {
                  // In a real app, this would open a template editor
                  message.info('Template creation feature would open here');
                }}
              >
                Create New Template
              </Button>
              <Text type="secondary">Create a custom due diligence template</Text>
            </Card>
          </Col>
        </Row>
      </div>
    );
  };
  
  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={2}>Due Diligence Workflow</Title>
        <Button
          type="primary"
          onClick={() => setNewProcessModal(true)}
        >
          Start New Due Diligence
        </Button>
      </div>
      
      <Paragraph>
        Manage and track your due diligence processes for potential investments.
      </Paragraph>
      
      <Divider />
      
      {selectedProcess ? (
        renderProcessDetails()
      ) : (
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
        >
          <TabPane 
            tab={<span><FileDoneOutlined /> Active Processes</span>} 
            key="processes"
          >
            <Table
              dataSource={processes}
              columns={processColumns}
              rowKey="id"
            />
          </TabPane>
          
          <TabPane 
            tab={<span><QuestionCircleOutlined /> Templates</span>} 
            key="templates"
          >
            {renderTemplatesTab()}
          </TabPane>
        </Tabs>
      )}
      
      <Modal
        title="Start New Due Diligence Process"
        open={newProcessModal}
        onCancel={() => setNewProcessModal(false)}
        onOk={handleCreateProcess}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Select Company:</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Select a company"
            value={selectedCompany}
            onChange={setSelectedCompany}
          >
            {companies.map(company => (
              <Option key={company.id} value={company.id}>{company.name}</Option>
            ))}
          </Select>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <Text strong>Select Template:</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Select a template"
            value={selectedTemplate}
            onChange={setSelectedTemplate}
          >
            {templates.map(template => (
              <Option key={template.id} value={template.id}>{template.name}</Option>
            ))}
          </Select>
        </div>
        
        <div>
          <Text strong>Assigned To:</Text>
          <Input 
            style={{ marginTop: 8 }}
            defaultValue="Current User"
            disabled 
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            In a real app, you could select from team members
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default FunderDueDiligence; 