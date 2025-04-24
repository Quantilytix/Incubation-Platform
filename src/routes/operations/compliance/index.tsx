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
  DatePicker, 
  Upload, 
  message, 
  Tooltip, 
  Typography,
  Badge,
  Tabs,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  PlusOutlined,
  DownloadOutlined,
  FileAddOutlined,
  FileProtectOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import moment from 'dayjs';
import type { UploadProps } from 'antd';
import type { ColumnType } from 'antd/es/table';

import { ComplianceDocument, documentTypes, documentStatuses } from './types';
import EDAgreementModal from './EDAgreementModal';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// Mock data for participants
const mockParticipants = [
  { id: 'p1', name: 'TechSolutions Inc.' },
  { id: 'p2', name: 'GreenEnergy Startup' },
  { id: 'p3', name: 'HealthTech Innovations' },
  { id: 'p4', name: 'EdTech Solutions' },
  { id: 'p5', name: 'FinTech Revolution' },
];

const OperationsCompliance: React.FC = () => {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEDAgreementModalVisible, setIsEDAgreementModalVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('1');
  const navigate = useNavigate();

  // Mock upload props
  const uploadProps: UploadProps = {
    name: 'file',
    action: 'https://run.mocky.io/v3/435e224c-44fb-4773-9faf-380c5e6a2188',
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

  // Load mock data
  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        // In a real implementation, this would fetch from Firestore
        const mockDocuments: ComplianceDocument[] = [
          {
            id: 'd1',
            participantId: 'p1',
            participantName: 'TechSolutions Inc.',
            documentType: 'beeCertificate',
            documentName: 'BEE Certificate 2023',
            status: 'valid',
            issueDate: '2023-01-15',
            expiryDate: '2024-01-15',
            notes: 'Level 1 B-BBEE contributor',
            fileUrl: 'https://example.com/bee-cert.pdf',
            uploadedBy: 'Admin User',
            uploadedAt: '2023-01-20',
            lastVerifiedBy: 'Operations User',
            lastVerifiedAt: '2023-02-01',
          },
          {
            id: 'd2',
            participantId: 'p1',
            participantName: 'TechSolutions Inc.',
            documentType: 'taxClearance',
            documentName: 'Tax Clearance Certificate',
            status: 'expiring',
            issueDate: '2023-03-10',
            expiryDate: '2023-12-10',
            fileUrl: 'https://example.com/tax-cert.pdf',
            uploadedBy: 'Admin User',
            uploadedAt: '2023-03-15',
          },
          {
            id: 'd3',
            participantId: 'p2',
            participantName: 'GreenEnergy Startup',
            documentType: 'letterOfGoodStanding',
            documentName: 'CIPC Letter of Good Standing',
            status: 'expired',
            issueDate: '2022-06-01',
            expiryDate: '2023-06-01',
            fileUrl: 'https://example.com/goodstanding.pdf',
            uploadedBy: 'Admin User',
            uploadedAt: '2022-06-05',
          },
          {
            id: 'd4',
            participantId: 'p3',
            participantName: 'HealthTech Innovations',
            documentType: 'uifCompliance',
            documentName: 'UIF Compliance Certificate',
            status: 'missing',
            issueDate: '',
            expiryDate: '',
            notes: 'Requested from participant on 2023-09-01',
            uploadedBy: 'System',
            uploadedAt: '2023-09-01',
          },
          {
            id: 'd5',
            participantId: 'p4',
            participantName: 'EdTech Solutions',
            documentType: 'directorIdCopies',
            documentName: 'Director ID Copies',
            status: 'pending',
            issueDate: '2023-08-20',
            expiryDate: '2028-08-20',
            fileUrl: 'https://example.com/id-copies.zip',
            uploadedBy: 'Participant User',
            uploadedAt: '2023-08-25',
          },
          {
            id: 'd6',
            participantId: 'p5',
            participantName: 'FinTech Revolution',
            documentType: 'industryLicense',
            documentName: 'Financial Services License',
            status: 'valid',
            issueDate: '2023-04-12',
            expiryDate: '2025-04-12',
            fileUrl: 'https://example.com/fsp-license.pdf',
            uploadedBy: 'Admin User',
            uploadedAt: '2023-04-15',
            lastVerifiedBy: 'Operations User',
            lastVerifiedAt: '2023-05-01',
          },
        ];
        
        setDocuments(mockDocuments);
      } catch (error) {
        console.error('Error fetching documents:', error);
        message.error('Failed to load compliance documents.');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  // Show add/edit document modal
  const showModal = (document?: ComplianceDocument) => {
    if (document) {
      setSelectedDocument(document);
      form.setFieldsValue({
        participantId: document.participantId,
        documentType: document.documentType,
        documentName: document.documentName,
        status: document.status,
        issueDate: document.issueDate ? moment(document.issueDate) : null,
        expiryDate: document.expiryDate ? moment(document.expiryDate) : null,
        notes: document.notes,
      });
    } else {
      setSelectedDocument(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  // Handle form submission
  const handleSubmit = async (values: any) => {
    try {
      const newDocument: ComplianceDocument = {
        id: selectedDocument?.id || `d${Date.now()}`,
        participantId: values.participantId,
        participantName: mockParticipants.find(p => p.id === values.participantId)?.name || '',
        documentType: values.documentType,
        documentName: values.documentName,
        status: values.status,
        issueDate: values.issueDate ? values.issueDate.format('YYYY-MM-DD') : '',
        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : '',
        notes: values.notes,
        fileUrl: selectedDocument?.fileUrl || undefined,
        uploadedBy: 'Current User', // In a real app, this would be the current user
        uploadedAt: new Date().toISOString().split('T')[0],
        lastVerifiedBy: selectedDocument?.lastVerifiedBy,
        lastVerifiedAt: selectedDocument?.lastVerifiedAt,
      };

      if (selectedDocument) {
        // Update existing document
        setDocuments(documents.map(doc => 
          doc.id === selectedDocument.id ? newDocument : doc
        ));
        message.success('Document updated successfully');
      } else {
        // Add new document
        setDocuments([...documents, newDocument]);
        message.success('Document added successfully');
      }

      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Error saving document:', error);
      message.error('Failed to save document.');
    }
  };

  // Handle document verification
  const handleVerifyDocument = (documentId: string) => {
    const updatedDocuments = documents.map(doc => {
      if (doc.id === documentId) {
        return {
          ...doc,
          status: 'valid' as 'valid',
          lastVerifiedBy: 'Current User',
          lastVerifiedAt: new Date().toISOString().split('T')[0],
        };
      }
      return doc;
    });
    
    setDocuments(updatedDocuments);
    message.success('Document verified successfully');
  };

  // Show ED Agreement modal for specific participant
  const showEDAgreementModal = (participantId: string) => {
    const participant = mockParticipants.find(p => p.id === participantId);
    setSelectedParticipant(participant);
    setIsEDAgreementModalVisible(true);
  };

  // Handle saving the new ED Agreement
  const handleSaveEDAgreement = (document: ComplianceDocument) => {
    setDocuments([...documents, document]);
  };

  // Search functionality
  const filteredDocuments = searchText 
    ? documents.filter(doc =>
        doc.participantName.toLowerCase().includes(searchText.toLowerCase()) ||
        doc.documentName.toLowerCase().includes(searchText.toLowerCase()) ||
        documentTypes.find(type => type.value === doc.documentType)?.label.toLowerCase().includes(searchText.toLowerCase())
      )
    : documents;

  // Get compliance statistics
  const complianceStats = {
    total: documents.length,
    valid: documents.filter(doc => doc.status === 'valid').length,
    expiring: documents.filter(doc => doc.status === 'expiring').length,
    expired: documents.filter(doc => doc.status === 'expired').length,
    missing: documents.filter(doc => doc.status === 'missing').length,
    pending: documents.filter(doc => doc.status === 'pending').length,
  };

  // Table columns
  const columns: ColumnType<ComplianceDocument>[] = [
    {
      title: 'Participant',
      dataIndex: 'participantName',
      key: 'participantName',
      sorter: (a: ComplianceDocument, b: ComplianceDocument) => a.participantName.localeCompare(b.participantName),
    },
    {
      title: 'Document Type',
      dataIndex: 'documentType',
      key: 'documentType',
      render: (type: string) => documentTypes.find(t => t.value === type)?.label || type,
      filters: documentTypes.map(type => ({ text: type.label, value: type.value })),
      onFilter: (value: any, record: ComplianceDocument) => record.documentType === value,
    },
    {
      title: 'Document Name',
      dataIndex: 'documentName',
      key: 'documentName',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = documentStatuses.find(s => s.value === status);
        return (
          <Tag color={statusConfig?.color || 'default'}>
            {statusConfig?.label || status}
          </Tag>
        );
      },
      filters: documentStatuses.map(status => ({ text: status.label, value: status.value })),
      onFilter: (value: any, record: ComplianceDocument) => record.status === value,
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date: string) => moment(date).format('DD MMM YYYY'),
      sorter: (a: ComplianceDocument, b: ComplianceDocument) => moment(a.expiryDate).unix() - moment(b.expiryDate).unix(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: ComplianceDocument) => (
        <Space size="middle">
          <Tooltip title="View Document">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => window.open(record.fileUrl, '_blank')} 
              type="text"
              disabled={!record.fileUrl}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="Verify Document">
              <Button
                type="text"
                icon={<CheckCircleOutlined style={{ color: 'green' }} />}
                onClick={() => handleVerifyDocument(record.id)}
              />
            </Tooltip>
          )}
          {record.documentType !== 'edAgreement' && (
            <Tooltip title="Generate ED Agreement">
              <Button
                type="text"
                icon={<FileProtectOutlined style={{ color: 'blue' }} />}
                onClick={() => showEDAgreementModal(record.participantId)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ] as const;

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>Compliance Management</Title>
      <Text>Track and manage compliance documents for participants.</Text>
      
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginTop: '20px', marginBottom: '20px' }}>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Total Documents" 
              value={complianceStats.total} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<SafetyCertificateOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Valid" 
              value={complianceStats.valid} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Expiring Soon" 
              value={complianceStats.expiring} 
              valueStyle={{ color: '#faad14' }}
              prefix={<WarningOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Expired" 
              value={complianceStats.expired} 
              valueStyle={{ color: '#f5222d' }}
              prefix={<CloseCircleOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Missing" 
              value={complianceStats.missing} 
              valueStyle={{ color: '#fa541c' }}
              prefix={<WarningOutlined />} 
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Pending Review" 
              value={complianceStats.pending} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<FileTextOutlined />} 
            />
          </Card>
        </Col>
      </Row>
      
      <Card>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
          <Input
            placeholder="Search documents or participants"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: '300px' }}
            prefix={<SearchOutlined />}
          />
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              Add New Document
            </Button>
            <Button
              icon={<FileAddOutlined />}
              onClick={() => setIsEDAgreementModalVisible(true)}
            >
              Generate ED Agreement
            </Button>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          rowKey="id"
          loading={loading}
          expandable={{
            expandedRowRender: record => (
              <div style={{ padding: '0 20px' }}>
                <p><strong>Issue Date:</strong> {record.issueDate || 'N/A'}</p>
                {record.notes && <p><strong>Notes:</strong> {record.notes}</p>}
                <p><strong>Uploaded By:</strong> {record.uploadedBy} on {record.uploadedAt}</p>
                {record.lastVerifiedBy && (
                  <p><strong>Last Verified By:</strong> {record.lastVerifiedBy} on {record.lastVerifiedAt}</p>
                )}
              </div>
            ),
          }}
        />
      </Card>
      
      {/* Add/Edit Document Modal */}
      <Modal
        title={selectedDocument ? 'Edit Document' : 'Add New Document'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="participantId"
            label="Participant"
            rules={[{ required: true, message: 'Please select a participant' }]}
          >
            <Select placeholder="Select a participant">
              {mockParticipants.map(participant => (
                <Option key={participant.id} value={participant.id}>
                  {participant.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="documentType"
            label="Document Type"
            rules={[{ required: true, message: 'Please select a document type' }]}
          >
            <Select placeholder="Select document type">
              {documentTypes.map(type => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="documentName"
            label="Document Name"
            rules={[{ required: true, message: 'Please enter a document name' }]}
          >
            <Input placeholder="Enter document name" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="issueDate"
                label="Issue Date"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="expiryDate"
                label="Expiry Date"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
          >
            <Select placeholder="Select status">
              {documentStatuses.map(status => (
                <Option key={status.value} value={status.value}>
                  {status.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="notes"
            label="Notes"
          >
            <TextArea rows={4} placeholder="Enter notes about this document" />
          </Form.Item>
          
          <Form.Item
            label="Document File"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>Upload Document</Button>
            </Upload>
            {selectedDocument?.fileUrl && (
              <div style={{ marginTop: '10px' }}>
                <Text>Current file: </Text>
                <Button 
                  type="link" 
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(selectedDocument.fileUrl, '_blank')}
                >
                  View Document
                </Button>
              </div>
            )}
          </Form.Item>
          
          <div style={{ textAlign: 'right' }}>
            <Button onClick={() => setIsModalVisible(false)} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit">
              Save
            </Button>
          </div>
        </Form>
      </Modal>
      
      {/* ED Agreement Modal */}
      <EDAgreementModal
        visible={isEDAgreementModalVisible}
        onCancel={() => setIsEDAgreementModalVisible(false)}
        participant={selectedParticipant}
        onSave={handleSaveEDAgreement}
      />
    </div>
  );
};

export default OperationsCompliance; 