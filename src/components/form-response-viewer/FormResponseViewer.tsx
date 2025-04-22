import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Descriptions, 
  Divider,
  message,
  Select,
  Row,
  Col,
  Empty,
  Spin,
  Badge,
  Drawer,
  Input,
  Tabs
} from 'antd';
import {
  EyeOutlined, 
  FileTextOutlined, 
  DownloadOutlined, 
  CheckOutlined, 
  CloseOutlined,
  CommentOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined
} from '@ant-design/icons';
import { collection, getDocs, getDoc, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import { CSVLink } from 'react-csv';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { Search } = Input;

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  options?: string[];
  description?: string;
}

interface FormTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  fields: FormField[];
  status: 'draft' | 'published';
}

interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  submittedBy: {
    id: string;
    name: string;
    email: string;
  };
  submittedAt: string;
  responses: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  assignedTo?: {
    id: string;
    name: string;
  };
}

interface FormResponseViewerProps {
  formId?: string; // Optional - if provided, only shows responses for a specific form
}

export const FormResponseViewer: React.FC<FormResponseViewerProps> = ({ formId }) => {
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(formId || null);
  const [selectedResponse, setSelectedResponse] = useState<FormResponse | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchText, setSearchText] = useState('');
  const [notesDrawerVisible, setNotesDrawerVisible] = useState(false);
  const [notes, setNotes] = useState('');
  const [csvData, setCsvData] = useState<any[]>([]);
  const [processTabKey, setProcessTabKey] = useState('pending');

  // Fetch data
  useEffect(() => {
    fetchTemplates();
    fetchResponses();
  }, [formId]);

  // Update CSV data when responses change
  useEffect(() => {
    if (responses.length > 0) {
      generateCsvData();
    }
  }, [responses, selectedTemplate]);

  const fetchTemplates = async () => {
    try {
      const templatesCollection = collection(db, 'formTemplates');
      const q = query(templatesCollection, where('status', '==', 'published'));
      const querySnapshot = await getDocs(q);
      
      const fetchedTemplates: FormTemplate[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedTemplates.push({
          id: docSnap.id,
          ...docSnap.data() as FormTemplate
        });
      });
      
      setTemplates(fetchedTemplates);
      
      // If formId is provided but not in the list, reset it
      if (formId && !fetchedTemplates.some(t => t.id === formId)) {
        message.error('Form template not found');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      message.error('Failed to load form templates');
    }
  };

  const fetchResponses = async () => {
    try {
      setLoading(true);
      
      const responsesCollection = collection(db, 'formResponses');
      let q;
      
      if (selectedTemplate) {
        q = query(
          responsesCollection, 
          where('formId', '==', selectedTemplate),
          orderBy('submittedAt', sortOrder)
        );
      } else {
        q = query(
          responsesCollection,
          orderBy('submittedAt', sortOrder)
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const fetchedResponses: FormResponse[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedResponses.push({
          id: docSnap.id,
          ...docSnap.data() as FormResponse
        });
      });
      
      setResponses(fetchedResponses);
    } catch (error) {
      console.error('Error fetching form responses:', error);
      message.error('Failed to load form responses');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    fetchResponses();
  };

  const handleStatusChange = (value: string | null) => {
    setFilterStatus(value);
  };

  const handleSortOrderChange = () => {
    const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(newOrder);
    fetchResponses();
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const handleViewResponse = (response: FormResponse) => {
    setSelectedResponse(response);
    setViewModalVisible(true);
  };

  const handleUpdateStatus = async (responseId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'formResponses', responseId), {
        status,
        notes: notes.trim() || undefined
      });
      
      message.success(`Form response ${status}`);
      
      // Update local state
      setResponses(prevResponses => 
        prevResponses.map(response => 
          response.id === responseId 
            ? { ...response, status, notes: notes.trim() || undefined } 
            : response
        )
      );
      
      setViewModalVisible(false);
      setNotesDrawerVisible(false);
      setNotes('');
    } catch (error) {
      console.error(`Error updating response status:`, error);
      message.error('Failed to update response status');
    }
  };

  const handleAddNotes = (responseId: string) => {
    const response = responses.find(r => r.id === responseId);
    if (response) {
      setSelectedResponse(response);
      setNotes(response.notes || '');
      setNotesDrawerVisible(true);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedResponse) return;
    
    try {
      await updateDoc(doc(db, 'formResponses', selectedResponse.id), {
        notes: notes.trim() || null
      });
      
      message.success('Notes saved successfully');
      
      // Update local state
      setResponses(prevResponses => 
        prevResponses.map(response => 
          response.id === selectedResponse.id 
            ? { ...response, notes: notes.trim() || undefined } 
            : response
        )
      );
      
      setNotesDrawerVisible(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      message.error('Failed to save notes');
    }
  };

  const generateCsvData = () => {
    if (responses.length === 0) {
      setCsvData([]);
      return;
    }
    
    // Get the current template to know field labels
    const template = templates.find(t => t.id === selectedTemplate);
    
    // Format the data for CSV
    const data = responses.map(response => {
      const flatResponse: Record<string, any> = {
        id: response.id,
        formTitle: response.formTitle,
        submitter_name: response.submittedBy.name,
        submitter_email: response.submittedBy.email,
        submittedAt: new Date(response.submittedAt).toLocaleString(),
        status: response.status
      };
      
      // Add response fields
      if (template) {
        template.fields.forEach(field => {
          if (field.type !== 'heading') {
            flatResponse[`field_${field.id}`] = 
              typeof response.responses[field.id] === 'object'
                ? JSON.stringify(response.responses[field.id])
                : response.responses[field.id] || '';
          }
        });
      } else {
        // If no template, just flatten all responses
        Object.entries(response.responses).forEach(([key, value]) => {
          flatResponse[`field_${key}`] = 
            typeof value === 'object' ? JSON.stringify(value) : value || '';
        });
      }
      
      return flatResponse;
    });
    
    setCsvData(data);
  };

  // Filter responses based on status and search text
  const filteredResponses = responses.filter(response => {
    // Filter by status
    if (filterStatus && response.status !== filterStatus) {
      return false;
    }
    
    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      return (
        response.formTitle.toLowerCase().includes(searchLower) ||
        response.submittedBy.name.toLowerCase().includes(searchLower) ||
        response.submittedBy.email.toLowerCase().includes(searchLower)
      );
    }
    
    return true;
  });

  // Group responses by status for the tabs
  const responsesByStatus = {
    pending: filteredResponses.filter(r => r.status === 'pending'),
    approved: filteredResponses.filter(r => r.status === 'approved'),
    rejected: filteredResponses.filter(r => r.status === 'rejected'),
    all: filteredResponses
  };

  const columns = [
    {
      title: 'Form',
      dataIndex: 'formTitle',
      key: 'formTitle',
    },
    {
      title: 'Submitted By',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      render: (submittedBy: FormResponse['submittedBy']) => (
        <div>
          <div>{submittedBy.name}</div>
          <Text type="secondary">{submittedBy.email}</Text>
        </div>
      ),
    },
    {
      title: 'Submitted At',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'approved') color = 'success';
        if (status === 'rejected') color = 'error';
        if (status === 'pending') color = 'warning';
        
        return <Tag color={color}>{status.toUpperCase()}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FormResponse) => (
        <Space>
          <Button 
            icon={<EyeOutlined />} 
            onClick={() => handleViewResponse(record)} 
            size="small"
          >
            View
          </Button>
          <Button 
            icon={<CommentOutlined />} 
            onClick={() => handleAddNotes(record.id)} 
            size="small"
          >
            Notes
          </Button>
        </Space>
      ),
    },
  ];

  // Render the response details
  const renderResponseDetails = () => {
    if (!selectedResponse) return null;
    
    // Find the corresponding template to get field information
    const template = templates.find(t => t.id === selectedResponse.formId);
    
    return (
      <div>
        <Descriptions title="Submission Details" bordered column={1}>
          <Descriptions.Item label="Form">{selectedResponse.formTitle}</Descriptions.Item>
          <Descriptions.Item label="Submitted By">
            {selectedResponse.submittedBy.name} ({selectedResponse.submittedBy.email})
          </Descriptions.Item>
          <Descriptions.Item label="Submitted At">
            {new Date(selectedResponse.submittedAt).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={
              selectedResponse.status === 'approved' ? 'success' : 
              selectedResponse.status === 'rejected' ? 'error' : 
              'warning'
            }>
              {selectedResponse.status.toUpperCase()}
            </Tag>
          </Descriptions.Item>
          {selectedResponse.notes && (
            <Descriptions.Item label="Notes">
              {selectedResponse.notes}
            </Descriptions.Item>
          )}
        </Descriptions>
        
        <Divider orientation="left">Responses</Divider>
        
        <Descriptions bordered column={1}>
          {template ? (
            // If we have the template, display fields in the correct order with labels
            template.fields.map(field => {
              if (field.type === 'heading') {
                return (
                  <Descriptions.Item key={field.id} label={""} className="form-heading">
                    <Title level={5}>{field.label}</Title>
                  </Descriptions.Item>
                );
              }
              
              const response = selectedResponse.responses[field.id];
              
              if (response === undefined) {
                return null;
              }
              
              return (
                <Descriptions.Item key={field.id} label={field.label}>
                  {field.type === 'file' && typeof response === 'string' ? (
                    <a href={response} target="_blank" rel="noopener noreferrer">View File</a>
                  ) : Array.isArray(response) ? (
                    response.join(', ')
                  ) : (
                    String(response)
                  )}
                </Descriptions.Item>
              );
            })
          ) : (
            // If we don't have the template, just display all responses
            Object.entries(selectedResponse.responses).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </Descriptions.Item>
            ))
          )}
        </Descriptions>
        
        {selectedResponse.status === 'pending' && (
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Button 
              type="primary" 
              icon={<CheckOutlined />} 
              onClick={() => handleUpdateStatus(selectedResponse.id, 'approved')}
            >
              Approve
            </Button>
            <Button 
              danger 
              icon={<CloseOutlined />} 
              onClick={() => handleUpdateStatus(selectedResponse.id, 'rejected')}
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <Card title="Form Responses" extra={
        <Space>
          {csvData.length > 0 && (
            <CSVLink 
              data={csvData}
              filename={`form-responses-${new Date().toISOString().slice(0, 10)}.csv`}
            >
              <Button icon={<DownloadOutlined />}>Export CSV</Button>
            </CSVLink>
          )}
        </Space>
      }>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={24} md={8}>
            <Select
              placeholder="Select Form Template"
              style={{ width: '100%' }}
              onChange={handleTemplateChange}
              value={selectedTemplate}
              allowClear
            >
              {templates.map(template => (
                <Option key={template.id} value={template.id}>{template.title}</Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Search 
              placeholder="Search by form or submitter" 
              onSearch={handleSearch}
              onChange={e => handleSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </Col>
          
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Select
                placeholder="Filter by Status"
                style={{ width: 150 }}
                onChange={handleStatusChange}
                allowClear
              >
                <Option value="pending">Pending</Option>
                <Option value="approved">Approved</Option>
                <Option value="rejected">Rejected</Option>
              </Select>
              
              <Button
                icon={sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                onClick={handleSortOrderChange}
              >
                {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
              </Button>
            </Space>
          </Col>
        </Row>
        
        <Divider />
        
        <Tabs activeKey={processTabKey} onChange={setProcessTabKey}>
          <TabPane 
            tab={
              <Badge count={responsesByStatus.pending.length} offset={[10, 0]}>
                <span>Pending</span>
              </Badge>
            } 
            key="pending"
          >
            <Table
              dataSource={responsesByStatus.pending}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="No pending form responses found" />
              }}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <Badge count={responsesByStatus.approved.length} offset={[10, 0]}>
                <span>Approved</span>
              </Badge>
            } 
            key="approved"
          >
            <Table
              dataSource={responsesByStatus.approved}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="No approved form responses" />
              }}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <Badge count={responsesByStatus.rejected.length} offset={[10, 0]}>
                <span>Rejected</span>
              </Badge>
            } 
            key="rejected"
          >
            <Table
              dataSource={responsesByStatus.rejected}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="No rejected form responses" />
              }}
            />
          </TabPane>
          
          <TabPane tab="All Responses" key="all">
            <Table
              dataSource={responsesByStatus.all}
              columns={columns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              locale={{
                emptyText: <Empty description="No form responses found" />
              }}
            />
          </TabPane>
        </Tabs>
      </Card>
      
      <Modal
        title="Form Response Details"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {renderResponseDetails()}
      </Modal>
      
      <Drawer
        title="Add Notes"
        placement="right"
        onClose={() => setNotesDrawerVisible(false)}
        open={notesDrawerVisible}
        width={400}
      >
        <div>
          <p>Add notes about this submission:</p>
          <Input.TextArea
            rows={6}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Enter notes about this submission"
          />
          <div style={{ marginTop: 16 }}>
            <Space>
              <Button onClick={() => setNotesDrawerVisible(false)}>
                Cancel
              </Button>
              <Button type="primary" onClick={handleSaveNotes}>
                Save Notes
              </Button>
            </Space>
          </div>
        </div>
      </Drawer>
    </div>
  );
};

export default FormResponseViewer; 
