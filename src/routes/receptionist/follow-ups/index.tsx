import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  message, 
  Breadcrumb, 
  Row, 
  Col, 
  Statistic,
  DatePicker,
  Select,
  Modal,
  Input,
  Form
} from 'antd'
import { 
  ClockCircleOutlined, 
  ExclamationCircleOutlined, 
  CheckCircleOutlined, 
  PhoneOutlined, 
  MailOutlined, 
  HomeOutlined,
  EditOutlined
} from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { inquiryService } from '@/services/inquiryService'
import { format, isAfter, isBefore, addDays } from 'date-fns'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
const { TextArea } = Input

interface FollowUp {
  id: string
  inquiryId: string
  customerName: string
  customerEmail: string
  customerPhone: string
  inquirySubject: string
  followUpType: 'Phone' | 'Email' | 'In-person' | 'Video Call'
  scheduledDate: Date
  status: 'Pending' | 'Completed' | 'Overdue' | 'Cancelled'
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  notes: string
  assignedTo: string
  createdAt: Date
  completedAt?: Date
}

const FollowUpsList: React.FC = () => {
  console.log('=== FOLLOW UPS COMPONENT MOUNTED ===')
  
  const navigate = useNavigate()
  const { user, loading: userLoading } = useAuth()
  
  console.log('Follow-ups auth state:', { user, userLoading })
  
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [filteredFollowUps, setFilteredFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null)
  const [form] = Form.useForm()

  const loadFollowUps = React.useCallback(async () => {
    if (!user?.assignedBranch) {
      console.error('FollowUpsList: No branch assigned to user')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('FollowUpsList: Fetching inquiries for branch:', user.assignedBranch)
      
      // Get all inquiries for the branch
      const inquiries = await inquiryService.getInquiriesByBranch(user.assignedBranch)
      
      // Extract follow-ups from inquiries
      const followUpsList: FollowUp[] = []
      
      inquiries.forEach(inquiry => {
        // Create follow-ups based on inquiry status and follow-up requirements
        if (inquiry.followUp?.followUpMethod && inquiry.status !== 'Closed') {
          const scheduledDate = inquiry.followUp.nextFollowUpDate 
            ? new Date(inquiry.followUp.nextFollowUpDate)
            : addDays(new Date(inquiry.submittedAt), 3) // Default to 3 days after submission

          const isOverdue = isAfter(new Date(), scheduledDate) && inquiry.status !== 'Converted'
          
          followUpsList.push({
            id: `${inquiry.id}-followup`,
            inquiryId: inquiry.id,
            customerName: `${inquiry.contactInfo.firstName} ${inquiry.contactInfo.lastName}`,
            customerEmail: inquiry.contactInfo.email || '',
            customerPhone: inquiry.contactInfo.phone || '',
            inquirySubject: inquiry.inquiryDetails.inquiryType,
            followUpType: inquiry.followUp.followUpMethod,
            scheduledDate,
            status: isOverdue ? 'Overdue' : 
                   inquiry.status === 'Converted' ? 'Completed' : 'Pending',
            priority: inquiry.priority || 'Medium',
            notes: inquiry.followUp.notes || '',
            assignedTo: user.name || user.email,
            createdAt: new Date(inquiry.submittedAt),
            completedAt: inquiry.status === 'Converted' ? new Date() : undefined
          })
        }
      })
      
      // Sort by scheduled date
      followUpsList.sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
      
      console.log('FollowUpsList: Processed', followUpsList.length, 'follow-ups')
      setFollowUps(followUpsList)
      setFilteredFollowUps(followUpsList)
    } catch (error) {
      console.error('Error loading follow-ups:', error)
      message.error('Failed to load follow-ups')
    } finally {
      setLoading(false)
    }
  }, [user?.assignedBranch, user?.name, user?.email])

  useEffect(() => {
    if (user && user.assignedBranch) {
      loadFollowUps()
    }
  }, [user?.assignedBranch, loadFollowUps])

  // Apply filters
  useEffect(() => {
    let filtered = [...followUps]

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(followUp => followUp.status === statusFilter)
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(followUp => followUp.priority === priorityFilter)
    }

    // Date range filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      const startDate = dateRange[0].toDate()
      const endDate = dateRange[1].toDate()
      filtered = filtered.filter(followUp => 
        isAfter(followUp.scheduledDate, startDate) && 
        isBefore(followUp.scheduledDate, endDate)
      )
    }

    setFilteredFollowUps(filtered)
  }, [followUps, statusFilter, priorityFilter, dateRange])

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      console.log('Completing follow-up:', followUpId)
      
      // Find the follow-up and extract the inquiry ID
      const followUp = followUps.find(fu => fu.id === followUpId)
      if (!followUp) {
        message.error('Follow-up not found')
        return
      }

      console.log('Found follow-up for inquiry:', followUp.inquiryId)
      
      // Update the inquiry status in the database
      await inquiryService.updateInquiryStatus(
        followUp.inquiryId, 
        'Contacted', // Mark as contacted when follow-up is completed
        user?.uid || 'system',
        'Follow-up completed by receptionist'
      )
      
      console.log('Inquiry status updated successfully')
      
      // Update local state
      const updatedFollowUps = followUps.map(fu => 
        fu.id === followUpId 
          ? { ...fu, status: 'Completed' as const, completedAt: new Date() }
          : fu
      )
      setFollowUps(updatedFollowUps)
      message.success('Follow-up completed and inquiry status updated')
    } catch (error) {
      console.error('Error completing follow-up:', error)
      message.error(`Failed to complete follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleEditFollowUp = (followUp: FollowUp) => {
    setEditingFollowUp(followUp)
    form.setFieldsValue({
      notes: followUp.notes,
      priority: followUp.priority,
      scheduledDate: followUp.scheduledDate,
    })
    setIsModalVisible(true)
  }

  const handleUpdateFollowUp = async (values: any) => {
    if (!editingFollowUp) return

    try {
      console.log('Updating follow-up:', editingFollowUp.id, 'with values:', values)
      
      // Update the inquiry's follow-up information in the database
      const inquiryUpdate = {
        followUp: {
          nextFollowUpDate: new Date(values.scheduledDate),
          followUpMethod: editingFollowUp.followUpType,
          notes: values.notes,
          assignedTo: user?.uid
        },
        priority: values.priority
      }
      
      await inquiryService.updateInquiry(editingFollowUp.inquiryId, inquiryUpdate)
      console.log('Inquiry follow-up updated successfully')
      
      // Update local state
      const updatedFollowUps = followUps.map(fu =>
        fu.id === editingFollowUp.id
          ? { ...fu, ...values, scheduledDate: new Date(values.scheduledDate) }
          : fu
      )
      setFollowUps(updatedFollowUps)
      setIsModalVisible(false)
      setEditingFollowUp(null)
      form.resetFields()
      message.success('Follow-up updated and saved to database')
    } catch (error) {
      console.error('Error updating follow-up:', error)
      message.error(`Failed to update follow-up: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleViewInquiry = (inquiryId: string) => {
    navigate(`/receptionist/inquiries/${inquiryId}`)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'green'
      case 'Overdue': return 'red'
      case 'Pending': return 'orange'
      case 'Cancelled': return 'default'
      default: return 'default'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'red'
      case 'High': return 'orange'
      case 'Medium': return 'blue'
      case 'Low': return 'default'
      default: return 'default'
    }
  }

  const columns: ColumnsType<FollowUp> = [
    {
      title: 'Customer',
      key: 'customer',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: '14px' }}>{record.customerName}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{record.customerEmail}</div>
        </div>
      ),
      width: 200,
    },
    {
      title: 'Inquiry',
      dataIndex: 'inquirySubject',
      key: 'inquirySubject',
      render: (subject: string, record) => (
        <Button
          type="link"
          onClick={() => handleViewInquiry(record.inquiryId)}
          style={{ padding: 0, textAlign: 'left' }}
        >
          {subject}
        </Button>
      ),
      width: 250,
    },
    {
      title: 'Type',
      dataIndex: 'followUpType',
      key: 'followUpType',
      render: (type: string) => {
        const icon = type === 'Phone' ? <PhoneOutlined /> :
                    type === 'Email' ? <MailOutlined /> :
                    <ClockCircleOutlined />
        return (
          <Space>
            {icon}
            {type}
          </Space>
        )
      },
      width: 120,
    },
    {
      title: 'Scheduled',
      dataIndex: 'scheduledDate',
      key: 'scheduledDate',
      render: (date: Date) => format(date, 'MMM dd, yyyy'),
      sorter: (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime(),
      width: 120,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority: string) => (
        <Tag color={getPriorityColor(priority)}>{priority}</Tag>
      ),
      filters: [
        { text: 'Urgent', value: 'Urgent' },
        { text: 'High', value: 'High' },
        { text: 'Medium', value: 'Medium' },
        { text: 'Low', value: 'Low' },
      ],
      width: 100,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
      filters: [
        { text: 'Pending', value: 'Pending' },
        { text: 'Completed', value: 'Completed' },
        { text: 'Overdue', value: 'Overdue' },
        { text: 'Cancelled', value: 'Cancelled' },
      ],
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {record.status === 'Pending' || record.status === 'Overdue' ? (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleCompleteFollowUp(record.id)}
            >
              Complete
            </Button>
          ) : null}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditFollowUp(record)}
          >
            Edit
          </Button>
        </Space>
      ),
      width: 150,
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
              You need to be assigned to a branch to access follow-ups.
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

  const overdueCount = followUps.filter(fu => fu.status === 'Overdue').length
  const pendingCount = followUps.filter(fu => fu.status === 'Pending').length
  const completedCount = followUps.filter(fu => fu.status === 'Completed').length

  return (
    <div style={{ padding: '24px' }}>
      {/* Breadcrumb Navigation */}
      <Breadcrumb style={{ marginBottom: '16px' }}>
        <Breadcrumb.Item>
          <Link to="/receptionist">
            <HomeOutlined /> Dashboard
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <ClockCircleOutlined /> Follow-ups
        </Breadcrumb.Item>
      </Breadcrumb>

      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px' 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
            Follow-up Management
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            Track and manage follow-up actions for your branch
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Total Follow-ups" 
              value={followUps.length} 
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Pending" 
              value={pendingCount} 
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Overdue" 
              value={overdueCount} 
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic 
              title="Completed" 
              value={completedCount} 
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Status"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value="all">All Statuses</Option>
              <Option value="Pending">Pending</Option>
              <Option value="Overdue">Overdue</Option>
              <Option value="Completed">Completed</Option>
              <Option value="Cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Select
              placeholder="Filter by Priority"
              style={{ width: '100%' }}
              value={priorityFilter}
              onChange={setPriorityFilter}
            >
              <Option value="all">All Priorities</Option>
              <Option value="Urgent">Urgent</Option>
              <Option value="High">High</Option>
              <Option value="Medium">Medium</Option>
              <Option value="Low">Low</Option>
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Start Date', 'End Date']}
              value={dateRange}
              onChange={setDateRange}
            />
          </Col>
          <Col xs={24} sm={4}>
            <Button
              type="default"
              onClick={() => {
                setStatusFilter('all')
                setPriorityFilter('all')
                setDateRange(null)
              }}
            >
              Clear Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Follow-ups Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredFollowUps}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} follow-ups`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Edit Follow-up Modal */}
      <Modal
        title="Update Follow-up"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false)
          setEditingFollowUp(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleUpdateFollowUp}
        >
          <Form.Item
            name="priority"
            label="Priority"
            rules={[{ required: true, message: 'Please select priority' }]}
          >
            <Select>
              <Option value="Low">Low</Option>
              <Option value="Medium">Medium</Option>
              <Option value="High">High</Option>
              <Option value="Urgent">Urgent</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="scheduledDate"
            label="Scheduled Date"
            rules={[{ required: true, message: 'Please select scheduled date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Notes"
          >
            <TextArea
              rows={4}
              placeholder="Add notes about this follow-up..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default FollowUpsList 