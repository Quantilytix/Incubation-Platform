import React, { useState, useEffect, useMemo } from 'react'
import {
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Card,
  Tabs,
  Typography,
  Badge,
  Avatar,
  Divider,
  Statistic,
  Row,
  Col,
  Empty
} from 'antd'
import {
  SearchOutlined,
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  FilterOutlined,
  SyncOutlined,
  PlusOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import TextArea from 'antd/es/input/TextArea'
import { motion } from 'framer-motion'

const { Text } = Typography
const { Option } = Select
const { RangePicker } = DatePicker
const { TabPane } = Tabs

type LeaveRequest = {
  id: string
  userId: string
  userEmail?: string
  userName?: string
  userPhoto?: string
  type: 'annual' | 'sick' | 'personal'
  reason: string
  from: string
  to: string
  days: number
  status: 'pending' | 'approved' | 'rejected'
  appliedDate: string
  approvedBy?: string
  approvedDate?: string
  rejectionReason?: string
}

// ---------- Dummy data (used if Firestore returns nothing) ----------
const DUMMY_LEAVE: LeaveRequest[] = [
  {
    id: 'd1',
    userId: 'u1',
    userEmail: 'thandi@company.com',
    userName: 'Thandi Ndlovu',
    userPhoto: '',
    type: 'annual',
    reason: 'Family vacation',
    from: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    to: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    days: 5,
    status: 'pending',
    appliedDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
  },
  {
    id: 'd2',
    userId: 'u2',
    userEmail: 'kabelo@company.com',
    userName: 'Kabelo Mokoena',
    userPhoto: '',
    type: 'sick',
    reason: 'Flu and doctor appointment',
    from: dayjs().subtract(5, 'day').format('YYYY-MM-DD'),
    to: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    days: 2,
    status: 'approved',
    appliedDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'),
    approvedBy: 'hr@company.com',
    approvedDate: dayjs().subtract(5, 'day').format('YYYY-MM-DD')
  },
  {
    id: 'd3',
    userId: 'u3',
    userEmail: 'lerato@company.com',
    userName: 'Lerato Dube',
    userPhoto: '',
    type: 'personal',
    reason: 'Home affairs appointment',
    from: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    to: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    days: 1,
    status: 'rejected',
    appliedDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    approvedBy: 'hr@company.com',
    approvedDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    rejectionReason: 'Peak project sprint'
  },
  {
    id: 'd4',
    userId: 'u4',
    userEmail: 'siphiwe@company.com',
    userName: 'Siphiwe Mthembu',
    userPhoto: '',
    type: 'annual',
    reason: 'Wedding leave',
    from: dayjs().add(14, 'day').format('YYYY-MM-DD'),
    to: dayjs().add(19, 'day').format('YYYY-MM-DD'),
    days: 5,
    status: 'approved',
    appliedDate: dayjs().subtract(3, 'day').format('YYYY-MM-DD'),
    approvedBy: 'hr@company.com',
    approvedDate: dayjs().subtract(2, 'day').format('YYYY-MM-DD')
  }
]

// ---------- Shared styles ----------
const metricCardStyle: React.CSSProperties = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
  transition: 'all 0.3s ease',
  borderRadius: 8,
  border: '1px solid #d6e4ff'
}

const AdminLeaveManagement: React.FC = () => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<LeaveRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(
    null
  )
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isReviewModalVisible, setIsReviewModalVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [useDummy, setUseDummy] = useState(false)
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  })
  const [form] = Form.useForm()
  const [rejectForm] = Form.useForm()

  // Fetch all leave requests (and fallback to personell)
  useEffect(() => {
    setLoading(true)
    const q = query(collection(db, 'leaveRequests'))
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const requests = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<LeaveRequest, 'id'>)
        })) as LeaveRequest[]
        if (requests.length === 0) {
          setLeaveRequests(DUMMY_LEAVE)
          setUseDummy(true)
        } else {
          setLeaveRequests(requests)
          setUseDummy(false)
        }
        setLoading(false)
      },
      () => {
        // On error, still show dummy so UI is populated
        setLeaveRequests(DUMMY_LEAVE)
        setUseDummy(true)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [])

  // Apply filters
  useEffect(() => {
    let result = [...leaveRequests]

    if (filters.status !== 'all') {
      result = result.filter(req => req.status === (filters.status as any))
    }

    if (filters.type !== 'all') {
      result = result.filter(req => req.type === (filters.type as any))
    }

    if (filters.search) {
      const s = filters.search.toLowerCase()
      result = result.filter(req =>
        [
          req.userName || '',
          req.userEmail || '',
          req.reason || '',
          req.type || '',
          req.status || ''
        ]
          .join(' ')
          .toLowerCase()
          .includes(s)
      )
    }

    setFilteredRequests(result)
  }, [leaveRequests, filters])

  const handleApprove = async (requestId: string) => {
    try {
      if (useDummy) {
        setLeaveRequests(prev =>
          prev.map(r =>
            r.id === requestId
              ? {
                  ...r,
                  status: 'approved',
                  approvedBy: auth.currentUser?.email || 'hr@company.com',
                  approvedDate: dayjs().format('YYYY-MM-DD')
                }
              : r
          )
        )
        message.success('Leave request approved ')
        return
      }
      await updateDoc(doc(db, 'leaveRequests', requestId), {
        status: 'approved',
        approvedBy: auth.currentUser?.email,
        approvedDate: dayjs().format('YYYY-MM-DD')
      })
      message.success('Leave request approved successfully')
    } catch {
      message.error('Failed to approve leave request')
    }
  }

  const handleReject = async (values: { rejectionReason: string }) => {
    if (!selectedRequest) return
    try {
      if (useDummy) {
        setLeaveRequests(prev =>
          prev.map(r =>
            r.id === selectedRequest.id
              ? {
                  ...r,
                  status: 'rejected',
                  rejectionReason: values.rejectionReason,
                  approvedBy: auth.currentUser?.email || 'hr@company.com',
                  approvedDate: dayjs().format('YYYY-MM-DD')
                }
              : r
          )
        )
        message.success('Leave request rejected (dummy)')
        setIsReviewModalVisible(false)
        setSelectedRequest(null)
        rejectForm.resetFields()
        return
      }
      await updateDoc(doc(db, 'leaveRequests', selectedRequest.id), {
        status: 'rejected',
        rejectionReason: values.rejectionReason,
        approvedBy: auth.currentUser?.email,
        approvedDate: dayjs().format('YYYY-MM-DD')
      })
      message.success('Leave request rejected')
      setIsReviewModalVisible(false)
      setSelectedRequest(null)
      rejectForm.resetFields()
    } catch {
      message.error('Failed to reject leave request')
    }
  }

  const getStatusTag = (status: LeaveRequest['status']) => {
    switch (status) {
      case 'approved':
        return <Tag color='green'>APPROVED</Tag>
      case 'pending':
        return <Tag color='orange'>PENDING</Tag>
      case 'rejected':
        return <Tag color='red'>REJECTED</Tag>
      default:
        return <Tag>{status}</Tag>
    }
  }

  const getLeaveTypeLabel = (type: LeaveRequest['type']) => {
    switch (type) {
      case 'annual':
        return 'Annual Leave'
      case 'sick':
        return 'Sick Leave'
      case 'personal':
        return 'Personal Leave'
    }
  }

  const columns = [
    {
      title: 'Employee',
      dataIndex: 'userName',
      key: 'userName',
      render: (_: string, record: LeaveRequest) => (
        <Space>
          <Avatar src={record.userPhoto} size='small'>
            {record.userName?.charAt(0)}
          </Avatar>
          <div>
            <div>{record.userName}</div>
            <Text type='secondary' style={{ fontSize: 12 }}>
              {record.userEmail}
            </Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: LeaveRequest['type']) => getLeaveTypeLabel(type)
    },
    {
      title: 'Dates',
      key: 'dates',
      render: (_: any, record: LeaveRequest) => (
        <div>
          {dayjs(record.from).format('MMM D')} -{' '}
          {dayjs(record.to).format('MMM D, YYYY')}
          <div style={{ fontSize: 12, color: '#888' }}>
            {record.days} day{record.days > 1 ? 's' : ''}
          </div>
        </div>
      )
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: LeaveRequest['status']) => getStatusTag(status)
    },
    {
      title: 'Applied On',
      dataIndex: 'appliedDate',
      key: 'appliedDate',
      render: (date: string) => dayjs(date).format('MMM D, YYYY')
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: LeaveRequest) => (
        <Space size='small'>
          <Button
            icon={<EditOutlined />}
            size='small'
            onClick={() => {
              setSelectedRequest(record)
              setIsModalVisible(true)
            }}
          />
          {record.status === 'pending' && (
            <>
              <Button
                type='text'
                size='small'
                icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleApprove(record.id)}
              />
              <Button
                type='text'
                size='small'
                icon={<CloseOutlined style={{ color: '#f5222d' }} />}
                onClick={() => {
                  setSelectedRequest(record)
                  setIsReviewModalVisible(true)
                }}
              />
            </>
          )}
        </Space>
      )
    }
  ]

  // -------- Metrics --------
  const stats = useMemo(() => {
    const pending = leaveRequests.filter(r => r.status === 'pending').length
    const approved = leaveRequests.filter(r => r.status === 'approved').length
    const rejected = leaveRequests.filter(r => r.status === 'rejected').length
    const total = leaveRequests.length
    const annual = leaveRequests.filter(r => r.type === 'annual').length
    const sick = leaveRequests.filter(r => r.type === 'sick').length
    const personal = leaveRequests.filter(r => r.type === 'personal').length
    return { pending, approved, rejected, total, annual, sick, personal }
  }, [leaveRequests])

  const metric = (title: string, value: number, badgeColor?: string) => (
    <Card style={metricCardStyle}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Statistic
          title={title}
          value={value}
          prefix={badgeColor ? <Badge color={badgeColor} /> : undefined}
        />
      </motion.div>
    </Card>
  )

  const renderTable = (data: LeaveRequest[]) => (
    <Table
      columns={columns}
      dataSource={data}
      rowKey='id'
      loading={loading}
      pagination={{ pageSize: 10 }}
      scroll={{ x: true }}
      locale={{ emptyText: <Empty description='No requests' /> }}
    />
  )

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Card
        title={`Leave Request Management`}
        extra={
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setIsModalVisible(true)}
            >
              New Request
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={() => setLoading(!loading)}
            >
              Refresh
            </Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey='dashboard'>
          {/* DASHBOARD */}
          <TabPane tab='Dashboard' key='dashboard'>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} md={6}>
                {metric('Pending Requests', stats.pending, 'orange')}
              </Col>
              <Col xs={12} md={6}>
                {metric('Approved Requests', stats.approved, 'green')}
              </Col>
              <Col xs={12} md={6}>
                {metric('Rejected Requests', stats.rejected, 'red')}
              </Col>
              <Col xs={12} md={6}>
                {metric('Total Requests', stats.total)}
              </Col>
            </Row>

            <Divider />

            <Space style={{ marginBottom: 16 }} wrap>
              <Select
                value={filters.status}
                style={{ width: 140 }}
                onChange={value => setFilters({ ...filters, status: value })}
              >
                <Option value='all'>All Status</Option>
                <Option value='pending'>Pending</Option>
                <Option value='approved'>Approved</Option>
                <Option value='rejected'>Rejected</Option>
              </Select>

              <Select
                value={filters.type}
                style={{ width: 160 }}
                onChange={value => setFilters({ ...filters, type: value })}
              >
                <Option value='all'>All Types</Option>
                <Option value='annual'>Annual Leave</Option>
                <Option value='sick'>Sick Leave</Option>
                <Option value='personal'>Personal Leave</Option>
              </Select>

              <Input
                placeholder='Search...'
                prefix={<SearchOutlined />}
                onChange={e =>
                  setFilters({ ...filters, search: e.target.value })
                }
                style={{ width: 220 }}
              />

              <Button icon={<FilterOutlined />}>More Filters</Button>
            </Space>

            {renderTable(filteredRequests)}
          </TabPane>

          {/* ALL REQUESTS */}
          <TabPane tab='All Requests' key='all'>
            {renderTable(leaveRequests)}
          </TabPane>

          {/* STATUS-SPECIFIC TABS */}
          <TabPane tab='Pending' key='pending'>
            {renderTable(leaveRequests.filter(r => r.status === 'pending'))}
          </TabPane>
          <TabPane tab='Approved' key='approved'>
            {renderTable(leaveRequests.filter(r => r.status === 'approved'))}
          </TabPane>
          <TabPane tab='Rejected' key='rejected'>
            {renderTable(leaveRequests.filter(r => r.status === 'rejected'))}
          </TabPane>

          {/* TYPE-SPECIFIC TABS */}
          <TabPane tab='Annual Leave' key='annual'>
            {renderTable(leaveRequests.filter(r => r.type === 'annual'))}
          </TabPane>
          <TabPane tab='Sick Leave' key='sick'>
            {renderTable(leaveRequests.filter(r => r.type === 'sick'))}
          </TabPane>
          <TabPane tab='Personal Leave' key='personal'>
            {renderTable(leaveRequests.filter(r => r.type === 'personal'))}
          </TabPane>

          {/* CALENDAR / REPORTS / SETTINGS */}
          <TabPane tab='Calendar View' key='calendar'>
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Text type='secondary'>Calendar view coming soon</Text>
            </div>
          </TabPane>

          <TabPane tab='Reports' key='reports'>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title='Monthly Leave Summary' style={metricCardStyle}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Empty description='Charts coming soon' />
                  </motion.div>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title='Top Leave Types' style={metricCardStyle}>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <Empty description='Charts coming soon' />
                  </motion.div>
                </Card>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab='Settings' key='settings'>
            <Card title='Leave Policies' style={metricCardStyle}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ul style={{ marginLeft: 16 }}>
                  <li>Annual leave cap: 20 days</li>
                  <li>Sick leave requires medical proof after 2 days</li>
                  <li>Personal leave capped at 5 days per year</li>
                </ul>
              </motion.div>
            </Card>
          </TabPane>
        </Tabs>
      </Card>

      {/* Request Details Modal */}
      <Modal
        title='Leave Request Details'
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedRequest ? (
          <div>
            <div style={{ display: 'flex', marginBottom: 16 }}>
              <Avatar src={selectedRequest.userPhoto} size={64}>
                {selectedRequest.userName?.charAt(0)}
              </Avatar>
              <div style={{ marginLeft: 16 }}>
                <h3>{selectedRequest.userName}</h3>
                <Text type='secondary'>{selectedRequest.userEmail}</Text>
              </div>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Text strong>Leave Type</Text>
                <div>{getLeaveTypeLabel(selectedRequest.type)}</div>
              </div>
              <div>
                <Text strong>Status</Text>
                <div>{getStatusTag(selectedRequest.status)}</div>
              </div>
              <div>
                <Text strong>Duration</Text>
                <div>
                  {selectedRequest.days} day
                  {selectedRequest.days > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <Text strong>Dates</Text>
              <div>
                {dayjs(selectedRequest.from).format('MMMM D, YYYY')} -{' '}
                {dayjs(selectedRequest.to).format('MMMM D, YYYY')}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>Reason</Text>
              <div>{selectedRequest.reason}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong>Applied On</Text>
              <div>
                {dayjs(selectedRequest.appliedDate).format('MMMM D, YYYY')}
              </div>
            </div>

            {selectedRequest.status !== 'pending' && (
              <>
                <Divider />
                <div style={{ marginBottom: 16 }}>
                  <Text strong>
                    {selectedRequest.status === 'approved'
                      ? 'Approved'
                      : 'Rejected'}{' '}
                    By
                  </Text>
                  <div>{selectedRequest.approvedBy}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Date</Text>
                  <div>
                    {selectedRequest.approvedDate &&
                      dayjs(selectedRequest.approvedDate).format(
                        'MMMM D, YYYY'
                      )}
                  </div>
                </div>
                {selectedRequest.status === 'rejected' && (
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>Rejection Reason</Text>
                    <div>{selectedRequest.rejectionReason}</div>
                  </div>
                )}
              </>
            )}

            <Divider />

            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setIsModalVisible(false)}>Close</Button>
            </div>
          </div>
        ) : (
          // Quick Create (dummy/new)
          <Form
            layout='vertical'
            onFinish={vals => {
              const newReq: LeaveRequest = {
                id: `tmp-${Date.now()}`,
                userId: 'me',
                userEmail: auth.currentUser?.email || 'me@company.com',
                userName: auth.currentUser?.displayName || 'Current User',
                userPhoto: auth.currentUser?.photoURL || '',
                type: vals.type,
                reason: vals.reason,
                from: vals.dates?.[0]?.format('YYYY-MM-DD'),
                to: vals.dates?.[1]?.format('YYYY-MM-DD'),
                days: vals.dates
                  ? vals.dates[1].diff(vals.dates[0], 'day') + 1
                  : 1,
                status: 'pending',
                appliedDate: dayjs().format('YYYY-MM-DD')
              }
              setLeaveRequests(prev => [newReq, ...prev])
              message.success('Request created (local)')
              setIsModalVisible(false)
            }}
          >
            <Form.Item
              name='type'
              label='Leave Type'
              rules={[{ required: true }]}
            >
              <Select placeholder='Select type'>
                <Option value='annual'>Annual Leave</Option>
                <Option value='sick'>Sick Leave</Option>
                <Option value='personal'>Personal Leave</Option>
              </Select>
            </Form.Item>
            <Form.Item name='dates' label='Dates' rules={[{ required: true }]}>
              <RangePicker />
            </Form.Item>
            <Form.Item
              name='reason'
              label='Reason'
              rules={[{ required: true }]}
            >
              <TextArea rows={4} placeholder='Reason for leave' />
            </Form.Item>
            <Form.Item style={{ textAlign: 'right' }}>
              <Button
                onClick={() => setIsModalVisible(false)}
                style={{ marginRight: 8 }}
              >
                Cancel
              </Button>
              <Button type='primary' htmlType='submit'>
                Create
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Reject Request Modal */}
      <Modal
        title='Reject Leave Request'
        open={isReviewModalVisible}
        onCancel={() => setIsReviewModalVisible(false)}
        footer={null}
      >
        <Form form={rejectForm} onFinish={handleReject} layout='vertical'>
          <Form.Item
            name='rejectionReason'
            label='Reason for Rejection'
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <TextArea
              rows={4}
              placeholder='Enter the reason for rejecting this leave request'
            />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right' }}>
            <Button
              onClick={() => setIsReviewModalVisible(false)}
              style={{ marginRight: 8 }}
            >
              Cancel
            </Button>
            <Button type='primary' htmlType='submit'>
              Confirm Rejection
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AdminLeaveManagement
