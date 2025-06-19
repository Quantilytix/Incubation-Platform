import React, { useState, useEffect } from 'react'
import { 
  Table, 
  Card, 
  Space, 
  Button, 
  Tag, 
  Input, 
  Select, 
  DatePicker, 
  Row, 
  Col, 
  Typography,
  Badge,
  Tooltip,
  message
} from 'antd'
import { 
  PlusOutlined, 
  SearchOutlined, 
  EyeOutlined,
  EditOutlined,
  UserOutlined
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { format } from 'date-fns'
import { Inquiry, InquiryPriority, InquiryStatus, InquirySource } from '@/types/inquiry'
import { inquiryService } from '@/services/inquiryService'
import { useAuth } from '@/hooks/useAuth'

const { Search } = Input
const { Option } = Select
const { RangePicker } = DatePicker
const { Title } = Typography

const InquiriesList: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<InquiryPriority | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<InquirySource | 'all'>('all')
  const [dateRange, setDateRange] = useState<any>([])
  
  const navigate = useNavigate()
  const { user, loading: userLoading } = useAuth()

  const loadInquiries = React.useCallback(async () => {
    console.log('InquiriesList: loadInquiries called')
    console.log('InquiriesList: User role:', user?.role)
    console.log('InquiriesList: User assignedBranch:', user?.assignedBranch)
    
    if (!user?.assignedBranch) {
      console.error('InquiriesList: No branch assigned to user')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('InquiriesList: Fetching inquiries for branch:', user.assignedBranch)
      const data = await inquiryService.getInquiriesByBranch(user.assignedBranch)
      console.log('InquiriesList: Retrieved', data.length, 'inquiries')
      setInquiries(data)
    } catch (error) {
      console.error('Error loading inquiries:', error)
      message.error('Failed to load inquiries')
    } finally {
      setLoading(false)
    }
  }, [user?.assignedBranch])

  useEffect(() => {
    console.log('InquiriesList: useEffect triggered. User:', user, 'UserLoading:', userLoading)
    if (user && user.assignedBranch) {
      console.log('InquiriesList: User has branch assignment, loading inquiries...')
      loadInquiries()
    } else if (user && !user.assignedBranch) {
      console.log('InquiriesList: User has no branch assignment')
    } else if (!user && !userLoading) {
      console.log('InquiriesList: No user and not loading')
    }
  }, [user?.assignedBranch, userLoading, loadInquiries])

  const getStatusColor = (status: InquiryStatus): string => {
    const colors: Record<string, string> = {
      'New': 'blue',
      'In Progress': 'orange',
      'Follow-up Required': 'gold',
      'Resolved': 'green',
      'Closed': 'gray',
      'Contacted': 'purple',
      'Converted': 'green'
    }
    return colors[status] || 'default'
  }

  const getPriorityColor = (priority: InquiryPriority): string => {
    const colors = {
      'Low': 'default',
      'Medium': 'blue',
      'High': 'orange',
      'Urgent': 'red'
    }
    return colors[priority] || 'default'
  }

  const filteredInquiries = inquiries.filter(inquiry => {
    // Text search
    const matchesSearch = !searchText || 
      inquiry.contactInfo.firstName.toLowerCase().includes(searchText.toLowerCase()) ||
      inquiry.contactInfo.lastName.toLowerCase().includes(searchText.toLowerCase()) ||
      inquiry.contactInfo.email?.toLowerCase().includes(searchText.toLowerCase()) ||
      inquiry.contactInfo.phone?.includes(searchText) ||
      inquiry.inquiryDetails.description.toLowerCase().includes(searchText.toLowerCase())

    // Status filter
    const matchesStatus = statusFilter === 'all' || inquiry.status === statusFilter

    // Priority filter
    const matchesPriority = priorityFilter === 'all' || inquiry.priority === priorityFilter

    // Source filter
    const matchesSource = sourceFilter === 'all' || inquiry.source === sourceFilter

    // Date range filter
    const matchesDateRange = !dateRange.length || 
      (new Date(inquiry.submittedAt) >= new Date(dateRange[0]) && 
       new Date(inquiry.submittedAt) <= new Date(dateRange[1]))

    return matchesSearch && matchesStatus && matchesPriority && matchesSource && matchesDateRange
  })

  const columns: ColumnsType<Inquiry> = [
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.contactInfo.firstName} {record.contactInfo.lastName}
            {record.source === 'SME' && (
              <Badge 
                count={<UserOutlined style={{ color: '#1890ff' }} />}
                size="small"
                style={{ marginLeft: 8 }}
              />
            )}
          </div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.contactInfo.email || record.contactInfo.phone}
          </div>
          {record.contactInfo.company && (
            <div style={{ color: '#666', fontSize: '12px' }}>
              {record.contactInfo.company}
            </div>
          )}
        </div>
      ),
      width: 200,
    },
    {
      title: 'Inquiry',
      key: 'inquiry',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.inquiryDetails.inquiryType}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>
            {record.inquiryDetails.description.length > 50 
              ? `${record.inquiryDetails.description.substring(0, 50)}...`
              : record.inquiryDetails.description
            }
          </div>
        </div>
      ),
      width: 250,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: InquiryPriority) => (
        <Tag color={getPriorityColor(priority)}>{priority}</Tag>
      ),
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: InquiryStatus) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
      width: 120,
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source: InquirySource) => (
        <Tag>{source}</Tag>
      ),
      width: 100,
    },
    {
      title: 'Submitted',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (date: any) => format(new Date(date), 'MMM dd, yyyy'),
      sorter: (a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button 
              type="text" 
              icon={<EyeOutlined />}
              onClick={() => navigate(`/receptionist/inquiries/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button 
              type="text" 
              icon={<EditOutlined />}
              onClick={() => navigate(`/receptionist/inquiries/${record.id}/edit`)}
            />
          </Tooltip>
        </Space>
      ),
      width: 100,
      fixed: 'right',
    },
  ]

  // Show loading while user data is being fetched
  if (userLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Card>
          <div style={{ padding: '40px 20px' }}>
            <h3>Loading user data...</h3>
          </div>
        </Card>
      </div>
    )
  }

  // Show proper message if user has no assigned branch
  if (user && !user.assignedBranch) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Card style={{ maxWidth: 500, margin: '0 auto' }}>
          <div style={{ padding: '40px 20px' }}>
            <h2>🏢 Branch Assignment Required</h2>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>
              You need to be assigned to a branch to access the inquiries system.
            </p>
            <p style={{ fontSize: '14px', color: '#888' }}>
              Please contact your <strong>Director</strong> to assign you to a branch through the User Management system.
            </p>
            <p style={{ fontSize: '12px', color: '#aaa', marginTop: '20px' }}>
              Directors can assign branches via: <em>User Management → Edit User → Select Branch</em>
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <Title level={3} style={{ margin: 0 }}>Inquiries</Title>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => navigate('/receptionist/inquiries/new')}
            >
              New Inquiry
            </Button>
          </div>

          {/* Filters */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Search
                placeholder="Search inquiries..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">All Status</Option>
                <Option value="New">New</Option>
                <Option value="In Progress">In Progress</Option>
                <Option value="Follow-up Required">Follow-up Required</Option>
                <Option value="Resolved">Resolved</Option>
                <Option value="Closed">Closed</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Priority"
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">All Priority</Option>
                <Option value="Low">Low</Option>
                <Option value="Medium">Medium</Option>
                <Option value="High">High</Option>
                <Option value="Urgent">Urgent</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <Select
                placeholder="Source"
                value={sourceFilter}
                onChange={setSourceFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">All Sources</Option>
                <Option value="Walk-in">Walk-in</Option>
                <Option value="Phone">Phone</Option>
                <Option value="Email">Email</Option>
                <Option value="Website">Website</Option>
                <Option value="Referral">Referral</Option>
                <Option value="Social Media">Social Media</Option>
                <Option value="Event">Event</Option>
                <Option value="SME">SME</Option>
                <Option value="Other">Other</Option>
              </Select>
            </Col>
            <Col xs={24} sm={12} md={4}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                placeholder={['From', 'To']}
              />
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={filteredInquiries}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            total: filteredInquiries.length,
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} inquiries`,
          }}
        />
      </Card>
    </div>
  )
}

export default InquiriesList 