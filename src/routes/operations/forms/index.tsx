import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Modal, 
  Form, 
  Select, 
  Radio, 
  Divider,
  Tabs,
  Typography,
  Badge,
  Tooltip,
  notification
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  CopyOutlined,
  SearchOutlined,
  FormOutlined,
  QuestionCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface FormTemplate {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  fields: any[];
  category: string;
  submissionCount: number;
}

const OperationsFormsManagement: React.FC = () => {
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'clone'>('create');
  const [currentForm, setCurrentForm] = useState<FormTemplate | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    setLoading(true);
    try {
      // Sample data for demonstration
      const sampleForms: FormTemplate[] = [
        {
          id: '1',
          title: 'Incubatee Application Form',
          description: 'Application form for new incubatees to join the program',
          status: 'active',
          createdAt: Timestamp.fromDate(new Date('2023-09-01')),
          updatedAt: Timestamp.fromDate(new Date('2023-09-15')),
          fields: [
            { type: 'text', label: 'Full Name', required: true },
            { type: 'email', label: 'Email Address', required: true },
            { type: 'textarea', label: 'Business Description', required: true },
          ],
          category: 'application',
          submissionCount: 24
        },
        {
          id: '2',
          title: 'Mentor Registration Form',
          description: 'Registration form for industry mentors',
          status: 'active',
          createdAt: Timestamp.fromDate(new Date('2023-08-15')),
          updatedAt: Timestamp.fromDate(new Date('2023-08-20')),
          fields: [
            { type: 'text', label: 'Full Name', required: true },
            { type: 'email', label: 'Email Address', required: true },
            { type: 'select', label: 'Area of Expertise', required: true, options: ['Technology', 'Finance', 'Marketing', 'Operations'] },
          ],
          category: 'registration',
          submissionCount: 18
        },
        {
          id: '3',
          title: 'Quarterly Progress Report',
          description: 'Quarterly progress reporting form for active incubatees',
          status: 'active',
          createdAt: Timestamp.fromDate(new Date('2023-07-01')),
          updatedAt: Timestamp.fromDate(new Date('2023-07-10')),
          fields: [
            { type: 'text', label: 'Company Name', required: true },
            { type: 'textarea', label: 'Progress Summary', required: true },
            { type: 'number', label: 'Revenue (USD)', required: false },
          ],
          category: 'reporting',
          submissionCount: 15
        },
        {
          id: '4',
          title: 'Resource Request Form',
          description: 'Form for requesting additional resources or facilities',
          status: 'active',
          createdAt: Timestamp.fromDate(new Date('2023-06-15')),
          updatedAt: Timestamp.fromDate(new Date('2023-06-20')),
          fields: [
            { type: 'text', label: 'Company Name', required: true },
            { type: 'select', label: 'Resource Type', required: true, options: ['Meeting Room', 'Equipment', 'Mentorship', 'Funding'] },
            { type: 'textarea', label: 'Justification', required: true },
          ],
          category: 'resource',
          submissionCount: 12
        },
        {
          id: '5',
          title: 'Exit Interview Form',
          description: 'Form for collecting feedback from graduating incubatees',
          status: 'draft',
          createdAt: Timestamp.fromDate(new Date('2023-05-10')),
          updatedAt: Timestamp.fromDate(new Date('2023-05-15')),
          fields: [
            { type: 'text', label: 'Company Name', required: true },
            { type: 'rating', label: 'Overall Experience', required: true, max: 5 },
            { type: 'textarea', label: 'Feedback', required: true },
          ],
          category: 'feedback',
          submissionCount: 0
        },
      ];
      
      setForms(sampleForms);
    } catch (error) {
      console.error('Error fetching forms:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch forms. Please try again later.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  const showModal = (type: 'create' | 'edit' | 'clone', record?: FormTemplate) => {
    setModalType(type);
    
    if (type === 'create') {
      setCurrentForm(null);
      form.resetFields();
    } else {
      setCurrentForm(record || null);
      
      if (record) {
        form.setFieldsValue({
          title: type === 'clone' ? `Copy of ${record.title}` : record.title,
          description: record.description,
          category: record.category,
          status: record.status,
        });
      }
    }
    
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleFormSubmit = () => {
    form.validateFields().then(async (values) => {
      try {
        // In a real implementation, this would save to Firestore
        if (modalType === 'create' || modalType === 'clone') {
          notification.success({
            message: 'Success',
            description: 'Form template created successfully',
          });
        } else {
          notification.success({
            message: 'Success',
            description: 'Form template updated successfully',
          });
        }
        
        setIsModalVisible(false);
        form.resetFields();
        fetchForms(); // Refresh the forms list
      } catch (error) {
        console.error('Error saving form:', error);
        notification.error({
          message: 'Error',
          description: 'Failed to save form. Please try again later.',
        });
      }
    });
  };

  const handleDeleteForm = (record: FormTemplate) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this form?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // In a real implementation, this would delete from Firestore
          notification.success({
            message: 'Success',
            description: 'Form template deleted successfully',
          });
          fetchForms(); // Refresh the forms list
        } catch (error) {
          console.error('Error deleting form:', error);
          notification.error({
            message: 'Error',
            description: 'Failed to delete form. Please try again later.',
          });
        }
      },
    });
  };

  const handleEditForm = (record: FormTemplate) => {
    navigate(`/operations/forms/edit/${record.id}`);
  };

  const handlePreviewForm = (record: FormTemplate) => {
    navigate(`/operations/forms/preview/${record.id}`);
  };

  const handleViewResponses = (record: FormTemplate) => {
    navigate(`/operations/form-responses/${record.id}`);
  };

  const getFilteredForms = () => {
    let filtered = [...forms];
    
    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(
        form => 
          form.title.toLowerCase().includes(searchText.toLowerCase()) ||
          form.description.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Filter by tab status
    if (activeTab !== 'all') {
      filtered = filtered.filter(form => form.status === activeTab);
    }
    
    return filtered;
  };

  const columns = [
    {
      title: 'Form Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: FormTemplate) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>{record.category.charAt(0).toUpperCase() + record.category.slice(1)}</Text>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        let icon = null;
        
        switch (status) {
          case 'active':
            color = 'success';
            icon = <CheckCircleOutlined />;
            break;
          case 'draft':
            color = 'default';
            icon = <EditOutlined />;
            break;
          case 'archived':
            color = 'warning';
            icon = <WarningOutlined />;
            break;
        }
        
        return (
          <Tag color={color} icon={icon}>
            {status.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Submissions',
      dataIndex: 'submissionCount',
      key: 'submissionCount',
      render: (count: number) => (
        <Badge 
          count={count} 
          showZero 
          style={{ 
            backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9',
            fontSize: '12px',
            padding: '0 8px'
          }} 
        />
      ),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (updatedAt: any) => new Date(updatedAt.seconds * 1000).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: FormTemplate) => (
        <Space size="small">
          <Tooltip title="Edit Form">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => handleEditForm(record)} 
            />
          </Tooltip>
          <Tooltip title="Preview Form">
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => handlePreviewForm(record)} 
            />
          </Tooltip>
          <Tooltip title="View Responses">
            <Button 
              type="text" 
              icon={<FormOutlined />} 
              onClick={() => handleViewResponses(record)}
              disabled={record.submissionCount === 0}
            />
          </Tooltip>
          <Tooltip title="Clone Form">
            <Button 
              type="text" 
              icon={<CopyOutlined />} 
              onClick={() => showModal('clone', record)}
            />
          </Tooltip>
          <Tooltip title="Delete Form">
            <Button 
              type="text" 
              danger
              icon={<DeleteOutlined />} 
              onClick={() => handleDeleteForm(record)} 
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const getCategoryOptions = () => {
    const categories = [
      { value: 'application', label: 'Application' },
      { value: 'registration', label: 'Registration' },
      { value: 'reporting', label: 'Reporting' },
      { value: 'feedback', label: 'Feedback' },
      { value: 'resource', label: 'Resource Request' },
      { value: 'other', label: 'Other' },
    ];
    
    return categories.map(category => (
      <Option key={category.value} value={category.value}>{category.label}</Option>
    ));
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>
        <FormOutlined /> Form Management
      </Title>
      <Text type="secondary">
        Create and manage forms for incubatees, mentors, and program operations
      </Text>
      
      <Divider />
      
      <Card>
        <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Input
            placeholder="Search forms..."
            prefix={<SearchOutlined />}
            allowClear
            onChange={e => handleSearch(e.target.value)}
            style={{ width: 250 }}
          />
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => showModal('create')}
          >
            Create Form
          </Button>
        </Space>

        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="All Forms" key="all" />
          <TabPane tab="Active" key="active" />
          <TabPane tab="Drafts" key="draft" />
          <TabPane tab="Archived" key="archived" />
        </Tabs>
        
        <Table
          dataSource={getFilteredForms()}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>
      
      <Modal
        title={
          modalType === 'create' ? 'Create New Form' : 
          modalType === 'edit' ? 'Edit Form' : 
          'Clone Form'
        }
        open={isModalVisible}
        onCancel={handleCancel}
        onOk={handleFormSubmit}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Form Title"
            rules={[{ required: true, message: 'Please enter a form title' }]}
          >
            <Input placeholder="Enter form title" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter a description' }]}
          >
            <Input.TextArea 
              placeholder="Enter form description" 
              rows={3} 
            />
          </Form.Item>
          
          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Select placeholder="Select a category">
              {getCategoryOptions()}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
            initialValue="draft"
          >
            <Radio.Group>
              <Radio value="active">Active</Radio>
              <Radio value="draft">Draft</Radio>
              <Radio value="archived">Archived</Radio>
            </Radio.Group>
          </Form.Item>
          
          {modalType === 'create' || modalType === 'clone' ? (
            <Text type="secondary">
              After creating this form, you will be redirected to the form builder to add fields.
            </Text>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
};

export default OperationsFormsManagement; 
