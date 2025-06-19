import React, { useState } from 'react'
import { 
  Form, 
  Input, 
  Select, 
  DatePicker, 
  Button, 
  Card, 
  Row, 
  Col, 
  Space, 
  message,
  Switch,
  InputNumber
} from 'antd'
import { SaveOutlined, ClearOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { 
  InquiryFormData, 
  InquiryType, 
  InquiryPriority, 
  InquirySource,
  BusinessStage,
  ServiceOfInterest,
  BudgetRange,
  Timeline,
  FollowUpMethod,
  INQUIRY_VALIDATION
} from '@/types/inquiry'
import { inquiryService } from '@/services/inquiryService'
import { useAuth } from '@/hooks/useAuth'

const { TextArea } = Input
const { Option } = Select

interface InquiryFormProps {
  initialData?: Partial<InquiryFormData>
  inquiryId?: string // For editing existing inquiries
  onSuccess?: () => void
}

const InquiryForm: React.FC<InquiryFormProps> = ({ 
  initialData, 
  inquiryId, 
  onSuccess 
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [requiresFollowUp, setRequiresFollowUp] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()

  const handleSubmit = async (values: any) => {
    if (!user?.assignedBranch) {
      message.error('No branch assigned. Please contact your administrator.')
      return
    }

    try {
      setLoading(true)

      // Prepare form data
      const inquiryData: InquiryFormData = {
        contactInfo: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email || undefined,
          phone: values.phone || undefined,
          company: values.company || undefined,
          position: values.position || undefined
        },
        inquiryDetails: {
          inquiryType: values.inquiryType,
          businessStage: values.businessStage || undefined,
          industry: values.industry || undefined,
          servicesOfInterest: values.servicesOfInterest || undefined,
          description: values.description,
          budget: values.budget || undefined,
          timeline: values.timeline || undefined
        },
        priority: values.priority,
        source: values.source,
        followUp: requiresFollowUp ? {
          nextFollowUpDate: values.nextFollowUpDate?.toDate(),
          followUpMethod: values.followUpMethod,
          assignedTo: values.assignedTo || user.uid,
          notes: values.followUpNotes || undefined
        } : undefined,
        tags: values.tags || []
      }

      if (inquiryId) {
        // Update existing inquiry
        await inquiryService.updateInquiry(inquiryId, inquiryData)
        message.success('Inquiry updated successfully!')
      } else {
        // Create new inquiry
        const newInquiryId = await inquiryService.createInquiry(
          inquiryData,
          user.assignedBranch,
          user.uid,
          user.companyCode || 'LEPHARO'
        )
        message.success('Inquiry created successfully!')
        console.log('Created inquiry:', newInquiryId)
      }

      onSuccess?.()
      navigate('/receptionist/inquiries')
    } catch (error) {
      console.error('Error saving inquiry:', error)
      message.error('Failed to save inquiry. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    form.resetFields()
    setRequiresFollowUp(false)
  }

  const inquiryTypes: InquiryType[] = [
    'General Information',
    'Incubation Program', 
    'Funding',
    'Mentorship',
    'Office Space',
    'Training',
    'Networking',
    'Partnership',
    'Other'
  ]

  const priorities: InquiryPriority[] = ['Low', 'Medium', 'High', 'Urgent']

  const sources: InquirySource[] = [
    'Walk-in', 
    'Phone', 
    'Email', 
    'Website', 
    'Referral', 
    'Social Media', 
    'Event', 
    'SME',
    'Other'
  ]

  const businessStages: BusinessStage[] = [
    'Idea Stage',
    'Startup', 
    'Early Stage',
    'Growth Stage',
    'Established',
    'Not Applicable'
  ]

  const servicesOfInterest: ServiceOfInterest[] = [
    'Business Incubation',
    'Funding Support',
    'Mentorship', 
    'Office Space',
    'Legal Support',
    'Marketing Support',
    'Technical Support',
    'Networking',
    'Training Programs'
  ]

  const budgetRanges: BudgetRange[] = [
    'Under R10k',
    'R10k - R50k',
    'R50k - R100k', 
    'R100k - R500k',
    'R500k - R1M',
    'Over R1M',
    'To be discussed'
  ]

  const timelines: Timeline[] = [
    'Immediate',
    'Within 1 month',
    '1-3 months',
    '3-6 months', 
    '6-12 months',
    'Over 1 year',
    'Flexible'
  ]

  const followUpMethods: FollowUpMethod[] = ['Phone', 'Email', 'In-person', 'Video Call']

  // Show proper message if user has no assigned branch
  if (user && !user.assignedBranch) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Card style={{ maxWidth: 500, margin: '0 auto' }}>
          <div style={{ padding: '40px 20px' }}>
            <h2>🏢 Branch Assignment Required</h2>
            <p style={{ fontSize: '16px', color: '#666', marginBottom: '24px' }}>
              You need to be assigned to a branch to create inquiries.
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
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card 
        title={inquiryId ? 'Edit Inquiry' : 'New Inquiry'}
        extra={
          <Space>
            <Button 
              icon={<ClearOutlined />} 
              onClick={handleClear}
              disabled={loading}
            >
              Clear
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />}
              loading={loading}
              onClick={() => form.submit()}
            >
              {inquiryId ? 'Update' : 'Save'} Inquiry
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={initialData}
          size="large"
        >
          {/* Contact Information Section */}
          <Card 
            type="inner" 
            title="Contact Information" 
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="First Name"
                  name="firstName"
                  rules={[
                    { required: true, message: 'First name is required' },
                    { max: 50, message: 'First name must be less than 50 characters' }
                  ]}
                >
                  <Input placeholder="Enter first name" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Last Name"
                  name="lastName"
                  rules={[
                    { required: true, message: 'Last name is required' },
                    { max: 50, message: 'Last name must be less than 50 characters' }
                  ]}
                >
                  <Input placeholder="Enter last name" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[
                    { type: 'email', message: 'Please enter a valid email address' }
                  ]}
                >
                  <Input placeholder="Enter email address" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Phone"
                  name="phone"
                  rules={[
                    { pattern: /^[\d\s\+\-\(\)]+$/, message: 'Please enter a valid phone number' }
                  ]}
                >
                  <Input placeholder="Enter phone number" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Company"
                  name="company"
                >
                  <Input placeholder="Enter company name (optional)" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Position"
                  name="position"
                >
                  <Input placeholder="Enter job position (optional)" />
                </Form.Item>
              </Col>
            </Row>

            {/* Email or Phone validation */}
            <Form.Item
              dependencies={['email', 'phone']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    const email = getFieldValue('email')
                    const phone = getFieldValue('phone')
                    if (!email && !phone) {
                      return Promise.reject(new Error('Either email or phone number is required'))
                    }
                    return Promise.resolve()
                  },
                }),
              ]}
            >
              <div />
            </Form.Item>
          </Card>

          {/* Inquiry Details Section */}
          <Card 
            type="inner" 
            title="Inquiry Details" 
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Inquiry Type"
                  name="inquiryType"
                  rules={[{ required: true, message: 'Please select an inquiry type' }]}
                >
                  <Select placeholder="Select inquiry type">
                    {inquiryTypes.map(type => (
                      <Option key={type} value={type}>{type}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Business Stage"
                  name="businessStage"
                >
                  <Select placeholder="Select business stage (optional)">
                    {businessStages.map(stage => (
                      <Option key={stage} value={stage}>{stage}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Industry"
                  name="industry"
                >
                  <Input placeholder="Enter industry (optional)" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Services of Interest"
                  name="servicesOfInterest"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (value && value.length > INQUIRY_VALIDATION.MAX_SERVICES_OF_INTEREST) {
                          return Promise.reject(new Error(`Maximum ${INQUIRY_VALIDATION.MAX_SERVICES_OF_INTEREST} services can be selected`))
                        }
                        return Promise.resolve()
                      }
                    }
                  ]}
                >
                  <Select 
                    mode="multiple" 
                    placeholder="Select services of interest (optional)"
                    maxTagCount={3}
                  >
                    {servicesOfInterest.map(service => (
                      <Option key={service} value={service}>{service}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Description"
              name="description"
              rules={[
                { required: true, message: 'Description is required' },
                { max: INQUIRY_VALIDATION.MAX_DESCRIPTION_LENGTH, message: `Description must be less than ${INQUIRY_VALIDATION.MAX_DESCRIPTION_LENGTH} characters` }
              ]}
            >
              <TextArea 
                rows={4} 
                placeholder="Enter detailed description of the inquiry"
                showCount
                maxLength={INQUIRY_VALIDATION.MAX_DESCRIPTION_LENGTH}
              />
            </Form.Item>

            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Budget Range"
                  name="budget"
                >
                  <Select placeholder="Select budget range (optional)">
                    {budgetRanges.map(budget => (
                      <Option key={budget} value={budget}>{budget}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Timeline"
                  name="timeline"
                >
                  <Select placeholder="Select timeline (optional)">
                    {timelines.map(timeline => (
                      <Option key={timeline} value={timeline}>{timeline}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Inquiry Management Section */}
          <Card 
            type="inner" 
            title="Inquiry Management" 
            style={{ marginBottom: '24px' }}
          >
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Priority"
                  name="priority"
                  rules={[{ required: true, message: 'Please select a priority' }]}
                >
                  <Select placeholder="Select priority">
                    {priorities.map(priority => (
                      <Option key={priority} value={priority}>{priority}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Source"
                  name="source"
                  rules={[{ required: true, message: 'Please select a source' }]}
                >
                  <Select placeholder="Select source">
                    {sources.map(source => (
                      <Option key={source} value={source}>{source}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Tags"
                  name="tags"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (value && value.length > INQUIRY_VALIDATION.MAX_TAGS) {
                          return Promise.reject(new Error(`Maximum ${INQUIRY_VALIDATION.MAX_TAGS} tags allowed`))
                        }
                        return Promise.resolve()
                      }
                    }
                  ]}
                >
                  <Select 
                    mode="tags" 
                    placeholder="Add tags (optional)"
                    maxTagCount={5}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Follow-up Section */}
          <Card 
            type="inner" 
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Follow-up</span>
                <Switch 
                  size="small"
                  checked={requiresFollowUp}
                  onChange={setRequiresFollowUp}
                />
              </div>
            }
          >
            {requiresFollowUp && (
              <Row gutter={[16, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Next Follow-up Date"
                    name="nextFollowUpDate"
                    rules={requiresFollowUp ? [{ required: true, message: 'Please select a follow-up date' }] : []}
                  >
                    <DatePicker 
                      style={{ width: '100%' }}
                      placeholder="Select follow-up date"
                      disabledDate={(current) => current && current.isBefore(new Date(), 'day')}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Follow-up Method"
                    name="followUpMethod"
                    rules={requiresFollowUp ? [{ required: true, message: 'Please select a follow-up method' }] : []}
                  >
                    <Select placeholder="Select follow-up method">
                      {followUpMethods.map(method => (
                        <Option key={method} value={method}>{method}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item
                    label="Follow-up Notes"
                    name="followUpNotes"
                    rules={[
                      { max: INQUIRY_VALIDATION.MAX_FOLLOW_UP_NOTES_LENGTH, message: `Notes must be less than ${INQUIRY_VALIDATION.MAX_FOLLOW_UP_NOTES_LENGTH} characters` }
                    ]}
                  >
                    <TextArea 
                      rows={3} 
                      placeholder="Enter follow-up notes (optional)"
                      showCount
                      maxLength={INQUIRY_VALIDATION.MAX_FOLLOW_UP_NOTES_LENGTH}
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Card>
        </Form>
      </Card>
    </div>
  )
}

export default InquiryForm 