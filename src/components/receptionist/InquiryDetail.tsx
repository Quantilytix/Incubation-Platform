import React, { useState, useEffect } from 'react'
import { 
  Card, 
  Descriptions, 
  Tag, 
  Space, 
  Button, 
  Timeline, 
  Divider, 
  Typography, 
  Row, 
  Col,
  Badge,
  Tabs,
  List,
  Input,
  Select,
  DatePicker,
  Form,
  message,
  Modal,
  Spin,
  Alert,
  Tooltip,
  Checkbox
} from 'antd'
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EditOutlined,
  MessageOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  SendOutlined
} from '@ant-design/icons'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { inquiryService } from '@/services/inquiryService'
import type { 
  Inquiry, 
  InquiryStatus, 
  InquiryPriority,
  CommunicationEntry 
} from '@/types/inquiry'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

// Quick response templates
const QUICK_RESPONSE_TEMPLATES = [
  {
    id: 'initial_response',
    title: 'Initial Response',
    subject: 'Thank you for your inquiry',
    content: `Dear {{firstName}},

Thank you for reaching out to us regarding {{inquiryType}}. We have received your inquiry and appreciate your interest in our services.

Our team will review your requirements and get back to you within 24-48 hours with more information.

In the meantime, if you have any urgent questions, please don't hesitate to contact us directly.

Best regards,
{{senderName}}
Incubation Platform Team`
  },
  {
    id: 'information_request',
    title: 'Information Request',
    subject: 'Additional Information Required',
    content: `Dear {{firstName}},

Thank you for your inquiry about {{inquiryType}}.

To better assist you, we would appreciate some additional information:

• [Please specify what information you need]
• [Add specific questions here]
• [Include any relevant details]

This will help us provide you with the most accurate and helpful response tailored to your needs.

Looking forward to hearing from you.

Best regards,
{{senderName}}
Incubation Platform Team`
  },
  {
    id: 'schedule_meeting',
    title: 'Schedule Meeting',
    subject: 'Let\'s schedule a meeting to discuss your requirements',
    content: `Dear {{firstName}},

Thank you for your interest in our {{inquiryType}} services.

I'd love to schedule a brief meeting to discuss your requirements in detail and explore how we can best support your business goals.

Please let me know your availability for a 30-minute call this week or next. I'm flexible with timing and can accommodate your schedule.

Alternatively, you can book a time directly using this link: [Calendar Link]

Looking forward to our conversation.

Best regards,
{{senderName}}
Incubation Platform Team`
  },
  {
    id: 'follow_up',
    title: 'Follow-up Required',
    subject: 'Following up on your inquiry',
    content: `Dear {{firstName}},

I hope this message finds you well.

I wanted to follow up on your inquiry about {{inquiryType}} that we received on {{submittedDate}}.

We're committed to providing you with the support you need and would love to continue our conversation about how we can help with your business goals.

Please let me know if you're still interested or if you have any questions. I'm here to help.

Best regards,
{{senderName}}
Incubation Platform Team`
  },
  {
    id: 'referral',
    title: 'Referral to Specialist',
    subject: 'Connecting you with our specialist',
    content: `Dear {{firstName}},

Thank you for your inquiry about {{inquiryType}}.

Based on your specific requirements, I'm connecting you with our specialist who has extensive experience in this area. They will be able to provide you with detailed insights and tailored solutions.

{{specialistName}} will reach out to you within the next 24 hours to schedule a consultation.

If you have any immediate questions, please don't hesitate to contact me.

Best regards,
{{senderName}}
Incubation Platform Team`
  }
]

interface InquiryDetailProps {
  inquiryId: string
  onEdit?: () => void
}

const InquiryDetail: React.FC<InquiryDetailProps> = ({ inquiryId, onEdit }) => {
  console.log('=== INQUIRY DETAIL COMPONENT MOUNTED ===')
  console.log('Inquiry ID:', inquiryId)
  
  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [showCommunicationModal, setShowCommunicationModal] = useState(false)
  const [showQuickResponseModal, setShowQuickResponseModal] = useState(false)
  const [communicationForm] = Form.useForm()
  const [quickResponseForm] = Form.useForm()
  const { user } = useAuth()

  console.log('Auth user:', user)

  useEffect(() => {
    console.log('useEffect called, loading inquiry...')
    loadInquiry()
  }, [inquiryId])

  const loadInquiry = async () => {
    try {
      console.log('=== LOADING INQUIRY START ===')
      setLoading(true)
      console.log('Loading inquiry with ID:', inquiryId)
      
      if (!inquiryId) {
        console.error('No inquiry ID provided')
        message.error('No inquiry ID provided')
        return
      }
      
      const data = await inquiryService.getInquiryById(inquiryId)
      console.log('Loaded inquiry data:', data)
      
      if (!data) {
        console.error('No inquiry data returned for ID:', inquiryId)
        message.error(`Inquiry not found with ID: ${inquiryId}`)
        return
      }

      // Validate critical fields
      if (!data.contactInfo) {
        console.error('Missing contactInfo in inquiry:', data)
        message.error('Invalid inquiry data structure - missing contact info')
        return
      }

      if (!data.inquiryDetails) {
        console.error('Missing inquiryDetails in inquiry:', data)
        message.error('Invalid inquiry data structure - missing inquiry details')
        return
      }

      console.log('Setting inquiry state with data:', data)
      setInquiry(data)
      console.log('=== LOADING INQUIRY SUCCESS ===')
    } catch (error) {
      console.error('=== LOADING INQUIRY ERROR ===')
      console.error('Error loading inquiry:', error)
      console.error('Error type:', typeof error)
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      message.error(`Failed to load inquiry details: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
      console.log('=== LOADING INQUIRY COMPLETE ===')
    }
  }

  const updateStatus = async (newStatus: InquiryStatus) => {
    if (!inquiry) {
      console.log('No inquiry found, cannot update status')
      return
    }

    console.log('=== STATUS UPDATE DEBUG ===')
    console.log('Attempting to update status from', inquiry.status, 'to', newStatus)
    console.log('User ID:', user?.uid)
    console.log('User object:', user)
    console.log('Inquiry ID:', inquiryId)
    console.log('Current inquiry object:', inquiry)

    try {
      setStatusUpdating(true)
      console.log('Calling inquiryService.updateInquiryStatus...')
      
      // Add a small delay to ensure UI update shows
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const result = await inquiryService.updateInquiryStatus(inquiryId, newStatus, user?.uid || 'system')
      console.log('Service call result:', result)
      console.log('Status update successful, reloading inquiry data')
      
      // Force a complete reload with fresh data
      const refreshedInquiry = await inquiryService.getInquiryById(inquiryId)
      console.log('Refreshed inquiry after status update:', refreshedInquiry)
      
      if (refreshedInquiry) {
        setInquiry(refreshedInquiry)
        console.log('Inquiry state updated with fresh data')
      }
      
      message.success(`Status updated to ${newStatus} successfully`)
    } catch (error) {
      console.error('=== STATUS UPDATE ERROR ===')
      console.error('Error type:', typeof error)
      console.error('Error instanceof Error:', error instanceof Error)
      console.error('Error message:', error instanceof Error ? error.message : 'No message')
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
      console.error('Full error object:', error)
      message.error(`Failed to update status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setStatusUpdating(false)
      console.log('=== STATUS UPDATE COMPLETE ===')
    }
  }

  const addCommunication = async (values: any) => {
    if (!inquiry) return

    try {
      const communicationEntry: Omit<CommunicationEntry, 'id'> = {
        type: 'response',
        message: `Subject: ${values.subject}\n\n${values.content}`,
        sentAt: new Date(),
        sentBy: user?.uid || 'system',
        sentByName: user?.displayName || 'System',
        sentByRole: 'receptionist',
        isInternal: values.isInternal || false
      }

      await inquiryService.addCommunication(inquiryId, communicationEntry)
      await loadInquiry() // Reload to show the new communication
      setShowCommunicationModal(false)
      communicationForm.resetFields()
      message.success('Communication added successfully')
    } catch (error) {
      console.error('Error adding communication:', error)
      message.error('Failed to add communication')
    }
  }

  const handleQuickResponse = async (values: any) => {
    if (!inquiry) return

    try {
      // Replace template variables
      let content = values.content
      content = content.replace(/\{\{firstName\}\}/g, inquiry.contactInfo.firstName)
      content = content.replace(/\{\{inquiryType\}\}/g, inquiry.inquiryDetails.inquiryType)
      content = content.replace(/\{\{submittedDate\}\}/g, format(inquiry.submittedAt, 'PPP'))
      content = content.replace(/\{\{senderName\}\}/g, user?.displayName || 'Team Member')

      const communicationEntry: Omit<CommunicationEntry, 'id'> = {
        type: 'response',
        message: `Subject: ${values.subject}\n\n${content}`,
        sentAt: new Date(),
        sentBy: user?.uid || 'system',
        sentByName: user?.displayName || 'System',
        sentByRole: 'receptionist',
        isInternal: false // Quick responses are always external
      }

      await inquiryService.addCommunication(inquiryId, communicationEntry)
      await loadInquiry()
      setShowQuickResponseModal(false)
      quickResponseForm.resetFields()
      message.success('Quick response sent successfully')
    } catch (error) {
      console.error('Error sending quick response:', error)
      message.error('Failed to send quick response')
    }
  }

  const getStatusColor = (status: InquiryStatus): string => {
    const colors = {
      'New': 'blue',
      'In Progress': 'orange',
      'Contacted': 'cyan',
      'Converted': 'green',
      'Pending': 'gold',
      'Resolved': 'green',
      'Closed': 'gray',
      'Lost': 'red'
    }
    return colors[status] || 'default'
  }

  const getPriorityColor = (priority: InquiryPriority): string => {
    const colors = {
      'Low': 'green',
      'Medium': 'orange',
      'High': 'red',
      'Urgent': 'purple'
    }
    return colors[priority] || 'default'
  }

  const getStatusIcon = (status: InquiryStatus) => {
    const icons = {
      'New': <ExclamationCircleOutlined />,
      'In Progress': <ClockCircleOutlined />,
      'Contacted': <MessageOutlined />,
      'Converted': <CheckCircleOutlined />,
      'Pending': <ClockCircleOutlined />,
      'Resolved': <CheckCircleOutlined />,
      'Closed': <CheckCircleOutlined />,
      'Lost': <ExclamationCircleOutlined />
    }
    return icons[status] || <ClockCircleOutlined />
  }

  console.log('=== RENDER CHECK ===')
  console.log('Loading state:', loading)
  console.log('Inquiry state:', inquiry)

  if (loading) {
    console.log('Rendering loading spinner')
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Loading inquiry details...</div>
      </div>
    )
  }

  if (!inquiry) {
    console.log('Rendering inquiry not found message')
    return (
      <Card>
        <Text type="secondary">Inquiry not found</Text>
      </Card>
    )
  }

  console.log('Inquiry loaded, checking critical fields...')
  console.log('ContactInfo:', inquiry.contactInfo)
  console.log('InquiryDetails:', inquiry.inquiryDetails)

  // Add safety checks for rendering
  if (!inquiry.contactInfo || !inquiry.inquiryDetails) {
    console.error('Critical fields missing in inquiry:', inquiry)
    return (
      <Card>
        <Text type="danger">Invalid inquiry data structure</Text>
        <div style={{ marginTop: '16px' }}>
          <Text type="secondary">Missing: {!inquiry.contactInfo ? 'contactInfo ' : ''}{!inquiry.inquiryDetails ? 'inquiryDetails' : ''}</Text>
        </div>
      </Card>
    )
  }

  console.log('All checks passed, rendering full component')

  // Check if this is a new inquiry that needs attention
  const isNewInquiry = inquiry.status === 'New'
  const isUrgent = inquiry.priority === 'Urgent' || inquiry.priority === 'High'
  
  // Safe date calculation
  let daysSinceSubmitted = 0
  if (inquiry.submittedAt && !isNaN(inquiry.submittedAt.getTime())) {
    daysSinceSubmitted = Math.floor((new Date().getTime() - inquiry.submittedAt.getTime()) / (1000 * 60 * 60 * 24))
  } else {
    console.warn('Invalid submittedAt date for inquiry:', inquiry.id)
  }

  const tabItems = [
    {
      key: 'details',
      label: 'Details',
      children: (
        <Row gutter={[24, 24]}>
          <Col span={24}>
            {/* Action alerts */}
            {isNewInquiry && (
              <Alert
                message="New Inquiry - Action Required"
                description="This inquiry is waiting for initial response. Consider sending a quick acknowledgment to the client."
                type="info"
                showIcon
                action={
                  <Button 
                    size="small" 
                    type="primary"
                    onClick={() => setShowQuickResponseModal(true)}
                  >
                    Send Quick Response
                  </Button>
                }
                style={{ marginBottom: 16 }}
              />
            )}
            {isUrgent && (
              <Alert
                message={`${inquiry.priority} Priority Inquiry`}
                description="This inquiry requires immediate attention due to its priority level."
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            {daysSinceSubmitted > 3 && inquiry.status !== 'Closed' && inquiry.status !== 'Lost' && (
              <Alert
                message="Follow-up Reminder"
                description={`This inquiry was submitted ${daysSinceSubmitted} days ago and may need follow-up.`}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="Contact Information" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Name">
                  <Space>
                    {inquiry.contactInfo?.firstName || 'N/A'} {inquiry.contactInfo?.lastName || 'N/A'}
                    {inquiry.source === 'SME' && (
                      <Badge 
                        count={<UserOutlined style={{ color: '#1890ff' }} />}
                        size="small"
                      />
                    )}
                  </Space>
                </Descriptions.Item>
                {inquiry.contactInfo.email && (
                  <Descriptions.Item label="Email">
                    <Space>
                      <MailOutlined />
                      <a href={`mailto:${inquiry.contactInfo.email}`}>
                        {inquiry.contactInfo.email}
                      </a>
                    </Space>
                  </Descriptions.Item>
                )}
                {inquiry.contactInfo.phone && (
                  <Descriptions.Item label="Phone">
                    <Space>
                      <PhoneOutlined />
                      <a href={`tel:${inquiry.contactInfo.phone}`}>
                        {inquiry.contactInfo.phone}
                      </a>
                    </Space>
                  </Descriptions.Item>
                )}
                {inquiry.contactInfo.company && (
                  <Descriptions.Item label="Company">
                    {inquiry.contactInfo.company}
                  </Descriptions.Item>
                )}
                {inquiry.contactInfo.position && (
                  <Descriptions.Item label="Position">
                    {inquiry.contactInfo.position}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card title="Inquiry Management" size="small" style={{ marginTop: '16px' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Status">
                  <Tag 
                    icon={getStatusIcon(inquiry.status)} 
                    color={getStatusColor(inquiry.status)}
                  >
                    {inquiry.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Priority">
                  <Tag color={getPriorityColor(inquiry.priority)}>
                    {inquiry.priority}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Source">
                  <Tag>{inquiry.source}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Submitted">
                  {inquiry.submittedAt && !isNaN(inquiry.submittedAt.getTime()) 
                    ? format(inquiry.submittedAt, 'PPPp') 
                    : 'Invalid date'}
                </Descriptions.Item>
                {inquiry.tags && inquiry.tags.length > 0 && (
                  <Descriptions.Item label="Tags">
                    <Space wrap>
                      {inquiry.tags.map((tag, index) => (
                        <Tag key={index}>{tag}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Inquiry Details" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Type">
                  {inquiry.inquiryDetails?.inquiryType || 'N/A'}
                </Descriptions.Item>
                {inquiry.inquiryDetails.businessStage && (
                  <Descriptions.Item label="Business Stage">
                    {inquiry.inquiryDetails.businessStage}
                  </Descriptions.Item>
                )}
                {inquiry.inquiryDetails.industry && (
                  <Descriptions.Item label="Industry">
                    {inquiry.inquiryDetails.industry}
                  </Descriptions.Item>
                )}
                {inquiry.inquiryDetails.servicesOfInterest && inquiry.inquiryDetails.servicesOfInterest.length > 0 && (
                  <Descriptions.Item label="Services of Interest">
                    <Space wrap>
                      {inquiry.inquiryDetails.servicesOfInterest.map((service, index) => (
                        <Tag key={index}>{service}</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                )}
                {inquiry.inquiryDetails.budget && (
                  <Descriptions.Item label="Budget">
                    {inquiry.inquiryDetails.budget}
                  </Descriptions.Item>
                )}
                {inquiry.inquiryDetails.timeline && (
                  <Descriptions.Item label="Timeline">
                    {inquiry.inquiryDetails.timeline}
                  </Descriptions.Item>
                )}
              </Descriptions>
              
              {inquiry.inquiryDetails.description && (
                <>
                  <Divider />
                  <div>
                    <Text strong>Description:</Text>
                    <Paragraph style={{ marginTop: '8px' }}>
                      {inquiry.inquiryDetails.description}
                    </Paragraph>
                  </div>
                </>
              )}
            </Card>

            {inquiry.followUp && (
              <Card title="Follow-up Information" size="small" style={{ marginTop: '16px' }}>
                <Descriptions column={1} size="small">
                  {inquiry.followUp.nextFollowUpDate && (
                    <Descriptions.Item label="Next Follow-up">
                      {inquiry.followUp.nextFollowUpDate && !isNaN(inquiry.followUp.nextFollowUpDate.getTime())
                        ? format(inquiry.followUp.nextFollowUpDate, 'PPPp')
                        : 'Invalid date'}
                    </Descriptions.Item>
                  )}
                  {inquiry.followUp.followUpMethod && (
                    <Descriptions.Item label="Method">
                      <Tag>{inquiry.followUp.followUpMethod}</Tag>
                    </Descriptions.Item>
                  )}
                  {inquiry.followUp.assignedTo && (
                    <Descriptions.Item label="Assigned To">
                      {inquiry.followUp.assignedTo}
                    </Descriptions.Item>
                  )}
                  {inquiry.followUp.notes && (
                    <Descriptions.Item label="Notes">
                      {inquiry.followUp.notes}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}
          </Col>
        </Row>
      )
    },
    {
      key: 'communications',
      label: `Communications ${inquiry.communications && Array.isArray(inquiry.communications) ? `(${inquiry.communications.length})` : '(0)'}`,
      children: (
        <div>
          <Space style={{ marginBottom: '16px' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setShowCommunicationModal(true)}
            >
              Add Communication
            </Button>
            <Button 
              type="default" 
              icon={<SendOutlined />}
              onClick={() => setShowQuickResponseModal(true)}
            >
              Quick Response
            </Button>
          </Space>

          {inquiry.communications && Array.isArray(inquiry.communications) && inquiry.communications.length > 0 ? (
            <Timeline>
              {inquiry.communications
                .filter(comm => comm && comm.sentAt) // Filter out invalid entries
                .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
                .map((comm, index) => {
                  // Parse message for subject and content (format: "Subject: ...\n\n...")
                  const messageParts = comm.message.split('\n\n')
                  const subject = messageParts[0]?.replace('Subject: ', '') || 'No Subject'
                  const content = messageParts.slice(1).join('\n\n') || comm.message
                  
                  return (
                    <Timeline.Item
                      key={index}
                      dot={<MessageOutlined />}
                      color={comm.isInternal ? 'orange' : 'green'}
                    >
                      <Card size="small" style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <Space>
                            <Tag color={comm.isInternal ? 'orange' : 'green'}>
                              {comm.type.toUpperCase()}
                            </Tag>
                            <Text strong>{subject}</Text>
                            {comm.isInternal && (
                              <Tag color="orange">Internal</Tag>
                            )}
                          </Space>
                          <Text type="secondary" style={{ marginLeft: '8px' }}>
                            {comm.sentAt && !isNaN(comm.sentAt.getTime()) 
                              ? format(comm.sentAt, 'PPPp') 
                              : 'Invalid date'}
                          </Text>
                        </div>
                        <Paragraph>{content}</Paragraph>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          By: {comm.sentByName} ({comm.sentByRole})
                        </Text>
                      </Card>
                    </Timeline.Item>
                  )
                })}
            </Timeline>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              <MessageOutlined style={{ fontSize: '48px', marginBottom: '16px' }} />
              <div>No communications yet</div>
              <div style={{ fontSize: '14px' }}>Start a conversation with the client</div>
            </div>
          )}
        </div>
      )
    }
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: '24px' }}>
        <Col>
          <Space direction="vertical" size="small">
            <Title level={3} style={{ margin: 0 }}>
              Inquiry Details
              {inquiry.priority === 'Urgent' && (
                <Tag color="red" style={{ marginLeft: '8px' }}>URGENT</Tag>
              )}
            </Title>
            <Text type="secondary">
              #{inquiry.id} • {inquiry.contactInfo?.firstName || 'N/A'} {inquiry.contactInfo?.lastName || 'N/A'}
            </Text>
          </Space>
        </Col>
        <Col>
          <Space>
            <Select 
              value={inquiry.status}
              onChange={updateStatus}
              loading={statusUpdating}
              style={{ width: 140 }}
            >
              <Option value="New">New</Option>
              <Option value="In Progress">In Progress</Option>
              <Option value="Contacted">Contacted</Option>
              <Option value="Converted">Converted</Option>
              <Option value="Pending">Pending</Option>
              <Option value="Resolved">Resolved</Option>
              <Option value="Closed">Closed</Option>
              <Option value="Lost">Lost</Option>
            </Select>
            {onEdit && (
              <Button type="default" icon={<EditOutlined />} onClick={onEdit}>
                Edit
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      <Tabs items={tabItems} />

      {/* Communication Modal */}
      <Modal
        title="Add Communication"
        open={showCommunicationModal}
        onCancel={() => setShowCommunicationModal(false)}
        footer={null}
        width={600}
      >
        <Form
          form={communicationForm}
          layout="vertical"
          onFinish={addCommunication}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Subject"
                name="subject"
                rules={[{ required: true, message: 'Please enter a subject' }]}
              >
                <Input placeholder="Email subject" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Internal Communication"
                name="isInternal"
                valuePropName="checked"
              >
                <Checkbox>
                  Mark as internal note (not visible to SMEs)
                </Checkbox>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            label="Content"
            name="content"
            rules={[{ required: true, message: 'Please enter the communication content' }]}
          >
            <TextArea 
              rows={6} 
              placeholder="Enter your message here..."
            />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setShowCommunicationModal(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                Send Communication
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Quick Response Modal */}
      <Modal
        title="Quick Response"
        open={showQuickResponseModal}
        onCancel={() => setShowQuickResponseModal(false)}
        footer={null}
        width={700}
      >
        <Form
          form={quickResponseForm}
          layout="vertical"
          onFinish={handleQuickResponse}
        >
          <Form.Item
            label="Template"
            name="template"
          >
            <Select 
              placeholder="Choose a template or write custom message"
              onChange={(value) => {
                const template = QUICK_RESPONSE_TEMPLATES.find(t => t.id === value)
                if (template) {
                  quickResponseForm.setFieldsValue({
                    subject: template.subject,
                    content: template.content
                  })
                }
              }}
            >
              {QUICK_RESPONSE_TEMPLATES.map(template => (
                <Option key={template.id} value={template.id}>
                  {template.title}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Subject"
            name="subject"
            rules={[{ required: true, message: 'Please enter a subject' }]}
          >
            <Input placeholder="Email subject" />
          </Form.Item>
          
          <Form.Item
            label="Content"
            name="content"
            rules={[{ required: true, message: 'Please enter the message content' }]}
          >
            <TextArea 
              rows={8} 
              placeholder="Your message will automatically replace template variables like {{firstName}}, {{inquiryType}}, etc."
            />
          </Form.Item>

          <Alert
            message="Template Variables"
            description="Available variables: {{firstName}}, {{inquiryType}}, {{submittedDate}}, {{senderName}}"
            type="info"
            style={{ marginBottom: '16px' }}
          />

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setShowQuickResponseModal(false)}>
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />}>
                Send Quick Response
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default InquiryDetail 