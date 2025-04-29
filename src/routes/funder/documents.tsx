import React, { useState, useEffect } from "react";
import { 
  Card, 
  Typography, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Divider, 
  Select,
  Modal,
  Upload,
  message,
  Empty,
  Tooltip,
  Dropdown
} from "antd";
import { 
  FileOutlined, 
  FileExcelOutlined, 
  FilePptOutlined,
  DownloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  FilterOutlined,
  MoreOutlined,
  FilePdfOutlined
} from "@ant-design/icons";
import type { UploadProps } from 'antd';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Document interface
interface Document {
  id: string;
  name: string;
  type: string;
  uploadDate: string;
  size: string;
  category: string;
  company?: string;
  status: string;
  url: string;
}

export const FunderDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  
  // Fetch documents data
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        
        // Sample documents - in a real app, this would come from an API/Firebase
        const sampleDocuments: Document[] = [
          {
            id: 'd1',
            name: 'TechSolutions Investment Agreement',
            type: 'PDF',
            uploadDate: '2023-06-15',
            size: '2.4MB',
            category: 'Legal',
            company: 'TechSolutions Inc.',
            status: 'Signed',
            url: '#'
          },
          {
            id: 'd2',
            name: 'TechSolutions Financial Projections',
            type: 'Excel',
            uploadDate: '2023-07-02',
            size: '1.8MB',
            category: 'Financial',
            company: 'TechSolutions Inc.',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd3',
            name: 'TechSolutions Pitch Deck',
            type: 'PowerPoint',
            uploadDate: '2023-07-10',
            size: '3.5MB',
            category: 'Presentation',
            company: 'TechSolutions Inc.',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd4',
            name: 'GreenEnergy Business Plan',
            type: 'PDF',
            uploadDate: '2023-04-20',
            size: '3.1MB',
            category: 'Business Plan',
            company: 'GreenEnergy Startup',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd5',
            name: 'GreenEnergy Market Research',
            type: 'PDF',
            uploadDate: '2023-05-12',
            size: '4.2MB',
            category: 'Research',
            company: 'GreenEnergy Startup',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd6',
            name: 'GreenEnergy Investment Term Sheet',
            type: 'PDF',
            uploadDate: '2023-06-05',
            size: '1.2MB',
            category: 'Legal',
            company: 'GreenEnergy Startup',
            status: 'Signed',
            url: '#'
          },
          {
            id: 'd7',
            name: 'HealthTech Due Diligence Report',
            type: 'PDF',
            uploadDate: '2023-03-10',
            size: '2.8MB',
            category: 'Due Diligence',
            company: 'HealthTech Innovations',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd8',
            name: 'HealthTech Quarterly Report Q2 2023',
            type: 'PDF',
            uploadDate: '2023-07-15',
            size: '1.9MB',
            category: 'Report',
            company: 'HealthTech Innovations',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd9',
            name: 'Investment Portfolio Summary',
            type: 'PDF',
            uploadDate: '2023-08-01',
            size: '1.4MB',
            category: 'Report',
            status: 'Active',
            url: '#'
          },
          {
            id: 'd10',
            name: 'Tax Documentation 2023',
            type: 'PDF',
            uploadDate: '2023-01-30',
            size: '3.2MB',
            category: 'Tax',
            status: 'Active',
            url: '#'
          }
        ];
        
        setDocuments(sampleDocuments);
      } catch (error) {
        console.error("Error fetching documents data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Filter documents based on search and filter criteria
  const filteredDocuments = documents.filter(doc => {
    // Search filter
    const searchMatch = searchText === '' || 
      doc.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (doc.company && doc.company.toLowerCase().includes(searchText.toLowerCase())) ||
      doc.category.toLowerCase().includes(searchText.toLowerCase());
    
    // Category filter
    const categoryMatch = !categoryFilter || doc.category === categoryFilter;
    
    // Type filter
    const typeMatch = !typeFilter || doc.type === typeFilter;
    
    return searchMatch && categoryMatch && typeMatch;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(documents.map(doc => doc.category)));
  
  // Get unique types for filter
  const types = Array.from(new Set(documents.map(doc => doc.type)));

  // Handle document preview
  const handlePreview = (document: Document) => {
    setPreviewDocument(document);
    setPreviewVisible(true);
  };

  // Handle document download
  const handleDownload = (document: Document) => {
    message.success(`Downloading ${document.name}...`);
    // In a real app, this would trigger an actual file download
  };

  // Handle document deletion
  const handleDelete = (documentId: string) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this document?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        setDocuments(documents.filter(doc => doc.id !== documentId));
        message.success('Document deleted successfully');
      }
    });
  };

  // Upload props
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
      } else if (info.file.status === 'error') {
        message.error(`${info.file.name} file upload failed.`);
      }
    },
  };

  // Get icon for file type
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />;
      case 'excel':
        return <FileExcelOutlined style={{ color: '#52c41a', fontSize: 20 }} />;
      case 'powerpoint':
        return <FilePptOutlined style={{ color: '#fa8c16', fontSize: 20 }} />;
      default:
        return <FileOutlined style={{ color: '#1890ff', fontSize: 20 }} />;
    }
  };

  // Get color for document status
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'signed':
        return 'green';
      case 'pending':
        return 'orange';
      case 'expired':
        return 'red';
      default:
        return 'blue';
    }
  };

  // Simplified columns for the documents table to avoid filtering issues
  const columns = [
    {
      title: 'Document Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Document) => (
        <Space>
          {getFileIcon(record.type)}
          <Text
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handlePreview(record)}
          >
            {text}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
    },
    {
      title: 'Upload Date',
      dataIndex: 'uploadDate',
      key: 'uploadDate',
      sorter: (a: Document, b: Document) => 
        new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime(),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => <Tag color={getStatusColor(text)}>{text}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Document) => (
        <Space>
          <Tooltip title="View">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="Download">
            <Button
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={2}>Document Management</Title>
      <Paragraph>
        Access and manage all your investment-related documents in one place.
      </Paragraph>

      <Divider />

      {/* Filters and Actions */}
      <Card style={{ marginBottom: 20 }}>
        <Space size={20} wrap>
          <Input
            placeholder="Search documents"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
          />
          
          <Select
            placeholder="Filter by Category"
            style={{ width: 200 }}
            allowClear
            value={categoryFilter}
            onChange={value => setCategoryFilter(value)}
          >
            {categories.map((category, index) => (
              <Option key={index} value={category}>{category}</Option>
            ))}
          </Select>
          
          <Select
            placeholder="Filter by Type"
            style={{ width: 200 }}
            allowClear
            value={typeFilter}
            onChange={value => setTypeFilter(value)}
          >
            {types.map((type, index) => (
              <Option key={index} value={type}>{type}</Option>
            ))}
          </Select>
          
          <Button 
            icon={<FilterOutlined />}
            onClick={() => {
              setSearchText('');
              setCategoryFilter(null);
              setTypeFilter(null);
            }}
          >
            Reset Filters
          </Button>
          
          <Button 
            type="primary" 
            icon={<UploadOutlined />}
            onClick={() => setUploadModalVisible(true)}
          >
            Upload Document
          </Button>
        </Space>
      </Card>

      {/* Documents Table */}
      <Card>
        <Table 
          columns={columns} 
          dataSource={filteredDocuments} 
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: (
              <Empty 
                description="No documents found" 
                image={Empty.PRESENTED_IMAGE_SIMPLE} 
              />
            )
          }}
        />
      </Card>

      {/* Upload Modal */}
      <Modal
        title="Upload Document"
        open={uploadModalVisible}
        onCancel={() => setUploadModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Upload.Dragger {...uploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">Click or drag file to this area to upload</p>
            <p className="ant-upload-hint">
              Support for a single or bulk upload. Allowed file types: PDF, DOCX, XLSX, PPTX
            </p>
          </Upload.Dragger>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>Document Category:</Text>
            <Select placeholder="Select a category" style={{ width: '100%' }}>
              {categories.map((category, index) => (
                <Option key={index} value={category}>{category}</Option>
              ))}
              <Option value="other">Other</Option>
            </Select>
          </Space>
          
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>Associated Company (Optional):</Text>
            <Select placeholder="Select a company" style={{ width: '100%' }} allowClear>
              <Option value="TechSolutions Inc.">TechSolutions Inc.</Option>
              <Option value="GreenEnergy Startup">GreenEnergy Startup</Option>
              <Option value="HealthTech Innovations">HealthTech Innovations</Option>
              <Option value="AgriTech Pioneers">AgriTech Pioneers</Option>
              <Option value="EdTech Solutions">EdTech Solutions</Option>
            </Select>
          </Space>
          
          <div style={{ textAlign: 'right', marginTop: 20 }}>
            <Button onClick={() => setUploadModalVisible(false)} style={{ marginRight: 10 }}>
              Cancel
            </Button>
            <Button type="primary" onClick={() => {
              message.success('Document uploaded successfully');
              setUploadModalVisible(false);
            }}>
              Upload
            </Button>
          </div>
        </Space>
      </Modal>

      {/* Document Preview Modal */}
      <Modal
        title={previewDocument?.name}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            Close
          </Button>,
          <Button 
            key="download" 
            type="primary" 
            icon={<DownloadOutlined />}
            onClick={() => {
              if (previewDocument) handleDownload(previewDocument);
            }}
          >
            Download
          </Button>,
        ]}
        width={800}
      >
        {previewDocument && (
          <div style={{ textAlign: 'center' }}>
            {/* In a real app, this would show a PDF viewer or document preview */}
            <div style={{ 
              height: 400, 
              background: '#f5f5f5', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
              border: '1px solid #d9d9d9',
              borderRadius: 2
            }}>
              {getFileIcon(previewDocument.type)}
              <Text style={{ marginTop: 16 }}>Document Preview</Text>
              <Text type="secondary" style={{ marginTop: 8 }}>
                In a production environment, this would show an actual document preview.
              </Text>
            </div>
            
            <div style={{ textAlign: 'left', marginTop: 20 }}>
              <Title level={5}>Document Information</Title>
              <Divider style={{ margin: '10px 0' }} />
              <Space direction="vertical" style={{ width: '100%' }}>
                <div><Text strong>Name:</Text> {previewDocument.name}</div>
                <div><Text strong>Type:</Text> {previewDocument.type}</div>
                <div><Text strong>Category:</Text> {previewDocument.category}</div>
                <div><Text strong>Size:</Text> {previewDocument.size}</div>
                <div><Text strong>Uploaded:</Text> {previewDocument.uploadDate}</div>
                {previewDocument.company && (
                  <div><Text strong>Company:</Text> {previewDocument.company}</div>
                )}
                <div>
                  <Text strong>Status:</Text>{' '}
                  <Tag color={getStatusColor(previewDocument.status)}>{previewDocument.status}</Tag>
                </div>
              </Space>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FunderDocuments; 