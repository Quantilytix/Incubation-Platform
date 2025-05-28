import React, { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  message,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Statistic,
  Card,
  Select,
  Steps
} from 'antd'
import {
  ProjectOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PoweroffOutlined
} from '@ant-design/icons'
import type { StatisticProps } from 'antd'
import CountUp from 'react-countup'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { getAuth } from 'firebase/auth'
import dayjs from 'dayjs'
import { Helmet } from 'react-helmet'

const { Title } = Typography
const { Text } = Typography

const SECTORS = ['Agriculture', 'IT', 'Manufacturing', 'Tourism', 'Other']
const PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Free State'
]
const GENDERS = ['Male', 'Female', 'Other']
const BEE_LEVELS = [1, 2, 3, 4, '5+']
const OWNERSHIP_FIELDS = [
  'youthOwnedPercent',
  'femaleOwnedPercent',
  'blackOwnedPercent'
]

const CRITERIA_OPTIONS = [
  { value: 'minAge', label: 'Minimum Age' },
  { value: 'maxAge', label: 'Maximum Age' },
  { value: 'gender', label: 'Gender' },
  { value: 'sector', label: 'Sector' },
  { value: 'province', label: 'Province' },
  { value: 'minYearsOfTrading', label: 'Years of Trading' },
  { value: 'beeLevel', label: 'B-BBEE Level' },
  { value: 'youthOwnedPercent', label: 'Min Youth Ownership %' },
  { value: 'femaleOwnedPercent', label: 'Min Female Ownership %' },
  { value: 'blackOwnedPercent', label: 'Min Black Ownership %' },
  { value: 'custom', label: 'Custom Note' }
]

const formatter: StatisticProps['formatter'] = value => (
  <CountUp end={value as number} separator=',' />
)
const QuestionTable = ({ questions, onAdd, onEdit, onDelete }) => (
  <>
    <Button type='primary' style={{ marginBottom: 16 }} onClick={onAdd}>
      Add New Question
    </Button>
    <Table
      dataSource={questions}
      rowKey='id'
      pagination={false}
      bordered
      columns={[
        {
          title: 'Question',
          dataIndex: 'label',
          render: text => <b>{text}</b>
        },
        {
          title: 'Type',
          dataIndex: 'type',
          render: type => (
            <Tag color={type === 'dropdown' ? 'blue' : 'default'}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Tag>
          )
        },
        {
          title: 'Options',
          dataIndex: 'options',
          render: opts => {
            const arr = Array.isArray(opts)
              ? opts
              : typeof opts === 'string'
              ? opts
                  .split(',')
                  .map(opt => opt.trim())
                  .filter(Boolean)
              : []

            return arr && arr.length ? (
              arr.map(opt => (
                <Tag key={opt} color='processing'>
                  {opt}
                </Tag>
              ))
            ) : (
              <span style={{ color: '#aaa' }}>—</span>
            )
          }
        },
        {
          title: 'Actions',
          dataIndex: 'actions',
          render: (_, record) => (
            <Space>
              <Button
                size='small'
                onClick={() => {
                  onEdit(record) // Pass the full record, not record.id
                }}
              >
                Edit
              </Button>

              <Button size='small' danger onClick={() => onDelete(record.id)}>
                Delete
              </Button>
            </Space>
          )
        }
      ]}
    />
  </>
)

const QuestionModal = ({ visible, initialValues, onSave, onCancel }) => {
  const [form] = Form.useForm()
  const [type, setType] = useState(initialValues?.type || 'text')

  // Fix: Always set fields when initialValues changes!
  useEffect(() => {
    if (
      initialValues?.type === 'dropdown' &&
      Array.isArray(initialValues.options)
    ) {
      form.setFieldsValue({
        ...initialValues,
        options: initialValues.options.join(', ')
      })
    } else {
      form.setFieldsValue(initialValues || { type: 'text', options: [] })
    }
    setType(initialValues?.type || 'text')
  }, [initialValues, form])

  return (
    <Modal
      open={visible}
      title={initialValues ? 'Edit Question' : 'Add New Question'}
      onCancel={onCancel}
      onOk={() => {
        form.validateFields().then(values => {
          onSave(values)
          form.resetFields()
        })
      }}
      okText={initialValues ? 'Save' : 'Add'}
    >
      <Form
        form={form}
        layout='vertical'
        initialValues={initialValues || { type: 'text', options: [] }}
      >
        <Form.Item
          name='label'
          label='Question'
          rules={[{ required: true, message: 'Enter the question' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name='type' label='Type' initialValue='text'>
          <Select
            onChange={val => {
              setType(val)
              if (val === 'text') {
                form.setFieldsValue({ options: [] })
              }
            }}
          >
            <Select.Option value='text'>Text</Select.Option>
            <Select.Option value='dropdown'>Dropdown</Select.Option>
          </Select>
        </Form.Item>
        {type === 'dropdown' && (
          <Form.Item
            name='options'
            label='Dropdown Options (comma separated)'
            rules={[{ required: true, message: 'Provide options' }]}
          >
            <Input placeholder='e.g. Yes, No, Maybe' />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}

// Utility to get UID from email
async function getUserUidByEmail (email) {
  const q = query(collection(db, 'users'), where('email', '==', email))
  const snapshot = await getDocs(q)
  if (snapshot.empty) throw new Error('No user found with that email')
  return snapshot.docs[0].id // UID
}

const EligibilityCriteriaStep = ({ value = {}, onChange, onBack, onNext }) => {
  const [form] = Form.useForm()
  const [selectedCriteria, setSelectedCriteria] = useState([])

  useEffect(() => {
    if (value) {
      const selected = Object.keys(value)
      setSelectedCriteria(selected)
      form.setFieldsValue(value)
    }
  }, [value])

  const handleNext = async () => {
    const allValues = await form.validateFields()
    const result = {}
    selectedCriteria.forEach(key => {
      if (
        allValues[key] !== undefined &&
        allValues[key] !== null &&
        allValues[key] !== ''
      ) {
        result[key] = allValues[key]
      }
    })
    onChange(result)
    onNext()
  }

  return (
    <Form
      layout='vertical'
      form={form}
      initialValues={value}
      style={{ marginTop: 8, maxWidth: 560 }}
    >
      <Form.Item label='Select eligibility criteria for this program'>
        <Select
          mode='multiple'
          placeholder='Choose criteria'
          value={selectedCriteria}
          onChange={val => {
            setSelectedCriteria(val)
            // Remove unselected fields
            const newObj = { ...form.getFieldsValue() }
            Object.keys(newObj).forEach(k => {
              if (!val.includes(k)) form.resetFields([k])
            })
          }}
          options={CRITERIA_OPTIONS}
        />
      </Form.Item>

      {/* Ownership fields grouped in a row */}
      {selectedCriteria.some(c => OWNERSHIP_FIELDS.includes(c)) && (
        <Row gutter={16}>
          {OWNERSHIP_FIELDS.map(
            field =>
              selectedCriteria.includes(field) && (
                <Col key={field} span={8}>
                  <Form.Item
                    name={field}
                    label={
                      field === 'youthOwnedPercent'
                        ? 'Min Youth Ownership %'
                        : field === 'femaleOwnedPercent'
                        ? 'Min Female Ownership %'
                        : 'Min Black Ownership %'
                    }
                    rules={[
                      {
                        type: 'number',
                        min: 0,
                        max: 100,
                        message: '0–100 only'
                      }
                    ]}
                  >
                    <InputNumber
                      min={0}
                      max={100}
                      style={{ width: '100%' }}
                      addonAfter='%'
                    />
                  </Form.Item>
                </Col>
              )
          )}
        </Row>
      )}

      {/* Other fields, stacked vertically */}
      <Row gutter={16}>
        <Col span={8}>
          {selectedCriteria.includes('minAge') && (
            <Form.Item name='minAge' label='Minimum Age'>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Col>
        <Col span={8}>
          {selectedCriteria.includes('maxAge') && (
            <Form.Item name='maxAge' label='Maximum Age'>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
        </Col>
      </Row>
      {selectedCriteria.includes('gender') && (
        <Form.Item name='gender' label='Allowed Gender(s)'>
          <Select
            mode='multiple'
            allowClear
            options={GENDERS.map(g => ({ value: g }))}
          />
        </Form.Item>
      )}
      {selectedCriteria.includes('sector') && (
        <Form.Item name='sector' label='Allowed Sectors'>
          <Select
            mode='multiple'
            allowClear
            options={SECTORS.map(s => ({ value: s }))}
          />
        </Form.Item>
      )}
      {selectedCriteria.includes('province') && (
        <Form.Item name='province' label='Allowed Provinces'>
          <Select
            mode='multiple'
            allowClear
            options={PROVINCES.map(p => ({ value: p }))}
          />
        </Form.Item>
      )}
      {selectedCriteria.includes('minYearsOfTrading') && (
        <Form.Item name='minYearsOfTrading' label='Minimum Years of Trading'>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      )}
      {selectedCriteria.includes('beeLevel') && (
        <Form.Item name='beeLevel' label='Allowed B-BBEE Levels'>
          <Select
            mode='multiple'
            allowClear
            options={BEE_LEVELS.map(l => ({ value: l }))}
          />
        </Form.Item>
      )}
      {selectedCriteria.includes('custom') && (
        <Form.Item name='custom' label='Custom Eligibility Note'>
          <Input.TextArea placeholder='E.g. Must have 50% youth ownership' />
        </Form.Item>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <Button onClick={onBack}>Back</Button>
        <Button type='primary' onClick={handleNext}>
          Next
        </Button>
      </div>
    </Form>
  )
}

const ProgramManager: React.FC = () => {
  const [programs, setPrograms] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [selectedCriteria, setSelectedCriteria] = useState([])
  const [eligibility, setEligibility] = useState({})

  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [togglingProgramId, setTogglingProgramId] = useState<string | null>(
    null
  )
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filteredStatus, setFilteredStatus] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [consultantOptions, setConsultantOptions] = useState<any[]>([])
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState<any>(null)
  const [editForm] = Form.useForm()

  const [currentStep, setCurrentStep] = useState(0)
  const [basicDetails, setBasicDetails] = useState({})
  const [questions, setQuestions] = useState([])
  const [questionModalOpen, setQuestionModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)

  const user = auth.currentUser

  useEffect(() => {
    const fetchUserCompanyCodeAndRole = async () => {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          console.log(userData)
          setCompanyCode(userData.companyCode || '')
          setUserRole(userData.role || '')
          fetchConsultants(userData.companyCode)
        }
      }
    }
    const fetchConsultants = async (code: string) => {
      const snap = await getDocs(collection(db, 'users'))
      const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const consultants = allUsers.filter(
        user => user.role === 'consultant' && user.companyCode === code
      )
      setConsultantOptions(consultants)
    }

    fetchUserCompanyCodeAndRole()
  }, [user])

  const fetchPrograms = async () => {
    if (!companyCode) return
    console.log('Company Code : ', companyCode)
    setLoading(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'programs'),
          where('companyCode', '==', companyCode)
        )
      )
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPrograms(all)
      console.log(all)
    } catch (error) {
      message.error('Failed to load programs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyCode) {
      fetchPrograms()
    }
  }, [companyCode])

  const handleAddProgram = async values => {
    try {
      if (!companyCode) {
        message.error('Company code not set')
        return
      }

      // Extract email if assigning admin
      const assignedAdminEmail = values.assignedAdminEmail || null

      const payload = {
        ...values,
        companyCode,
        status: values.status || 'Active',
        startDate: values.startDate?.toDate?.() || null,
        endDate: values.endDate?.toDate?.() || null,
        registrationLink: `/registration?code=${companyCode}&role=sme`,
        assignedAdmin: assignedAdminEmail
      }

      const docRef = await addDoc(collection(db, 'programs'), {
        ...payload,
        cohortYear:
          values.cohortYear || dayjs(values.startDate).year() || dayjs().year(),
        description: values.description || '',
        eligibilityCriteria: eligibility
      })

      // Update to include the generated ID inside the document itself
      await updateDoc(docRef, { id: docRef.id })

      // If assigning admin, update user role in users collection
      if (assignedAdminEmail) {
        try {
          const uid = await getUserUidByEmail(assignedAdminEmail)
          await updateDoc(doc(db, 'users', uid), {
            role: 'projectadmin'
          })
        } catch (e) {
          console.error('Failed to update user role:', e)
          message.error('Could not update assigned project admin role')
        }
      }

      message.success('Program added successfully')
      fetchPrograms()
      setModalVisible(false)
      form.resetFields()
    } catch (err) {
      console.error(err)
      message.error('Failed to add program')
    }
  }

  const handleUpdateProgram = async values => {
    if (!selectedProgram) return

    const toTimestamp = val => {
      if (!val) return null
      if (val instanceof Timestamp) return val
      if (val.toDate) return Timestamp.fromDate(val.toDate())
      if (val instanceof Date) return Timestamp.fromDate(val)
      return null
    }

    const assignedAdminEmail =
      values.assignedAdminEmail || selectedProgram.assignedAdmin || null

    const payload = {
      ...selectedProgram,
      ...values,
      startDate: toTimestamp(values.startDate),
      endDate: toTimestamp(values.endDate),
      assignedAdmin: assignedAdminEmail,
      eligibilityCriteria: eligibility
    }

    try {
      const ref = doc(db, 'programs', selectedProgram.id)
      await updateDoc(ref, payload)

      // If assigned admin changed, update their role
      if (
        assignedAdminEmail &&
        assignedAdminEmail !== selectedProgram.assignedAdmin
      ) {
        try {
          const uid = await getUserUidByEmail(assignedAdminEmail)
          await updateDoc(doc(db, 'users', uid), {
            role: 'projectadmin'
          })
        } catch (e) {
          console.error('Failed to update user role:', e)
          message.error('Could not update assigned project admin role')
        }
      }

      message.success('Program updated successfully')
      setEditModalVisible(false)
      fetchPrograms()
    } catch (err) {
      console.error(err)
      message.error('Failed to update program')
    }
  }

  const handleDeleteProgram = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'programs', id))
      message.success('Program deleted successfully')
      fetchPrograms()
    } catch (err) {
      console.error(err)
      message.error('Failed to delete program')
    }
  }

  // Add Question Handler

  const handleAdd = () => {
    setEditingQuestion(null)
    setQuestionModalOpen(true)
  }
  const handleEdit = question => {
    setEditingQuestion(question)
    setQuestionModalOpen(true)
  }

  const handleDelete = id => {
    setQuestions(questions.filter(q => q.id !== id))
  }
  const handleSaveQuestion = values => {
    let options = values.options
    if (values.type === 'dropdown') {
      if (typeof options === 'string') {
        options = options
          .split(',')
          .map(opt => opt.trim())
          .filter(Boolean)
      }
    }
    const finalValues = { ...values, options }

    if (editingQuestion) {
      setQuestions(
        questions.map(q =>
          q.id === editingQuestion.id ? { ...editingQuestion, ...values } : q
        )
      )
      message.success('Question updated')
    } else {
      setQuestions([...questions, { ...values, id: Date.now().toString() }])
      message.success('Question added')
    }
    setQuestionModalOpen(false)
  }
  const toggleStatus = async (record: any) => {
    const newStatus = record.status === 'Active' ? 'Inactive' : 'Active'
    try {
      setTogglingProgramId(record.id)
      const ref = doc(db, 'programs', record.id)
      await updateDoc(ref, { status: newStatus })
      message.success(`Program ${newStatus.toLowerCase()}d`)
      fetchPrograms()
    } catch (err) {
      message.error('Failed to update status')
    } finally {
      setTogglingProgramId(null)
    }
  }

  const filteredPrograms = programs.filter(program => {
    const matchesSearch = program.name
      .toLowerCase()
      .includes(searchText.toLowerCase())
    const matchesStatus = filteredStatus
      ? program.status === filteredStatus
      : true
    return matchesSearch && matchesStatus
  })

  // Metrics
  const totalPrograms = programs.length
  const activePrograms = programs.filter(p => p.status === 'Active').length
  const totalBudget = programs.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalCapacity = programs.reduce(
    (sum, p) => sum + (p.maxCapacity || 0),
    0
  )

  return (
    <>
      <Helmet>
        <title>Incubation Programs | Smart Incubation Platform</title>
        <meta
          name='description'
          content="View, manage, and monitor all incubation programs created under your organization's code."
        />
      </Helmet>

      <div
        style={{
          padding: 24,
          height: '100vh'
        }}
      >
        <Title level={4}>Incubation Programs</Title>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title='Total Programs'
                value={totalPrograms}
                prefix={<ProjectOutlined />}
                formatter={formatter}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title='Active Programs'
                value={activePrograms}
                prefix={<CheckCircleOutlined />}
                formatter={formatter}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title='Total Budget'
                value={totalBudget}
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#1890ff' }}
                formatter={formatter}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title='Total Capacity'
                value={totalCapacity}
                prefix={<TeamOutlined />}
                formatter={formatter}
              />
            </Card>
          </Col>
        </Row>

        <Space
          style={{
            marginBottom: 16,
            justifyContent: 'space-between',
            display: 'flex'
          }}
        >
          {userRole !== 'director' && (
            <Button
              type='primary'
              icon={<PlusOutlined />}
              onClick={() => {
                if (userRole !== 'Director') setModalVisible(true)
              }}
            >
              Add Program
            </Button>
          )}
        </Space>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder='Search Program Name'
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder='Filter by Status'
              onChange={value => setFilteredStatus(value)}
              value={filteredStatus}
              allowClear
              style={{ width: '100%' }}
            >
              <Select.Option value='Active'>Active</Select.Option>
              <Select.Option value='Inactive'>Inactive</Select.Option>
              <Select.Option value='Completed'>Completed</Select.Option>
              <Select.Option value='Upcoming'>Upcoming</Select.Option>
            </Select>
          </Col>
        </Row>

        <Table
          loading={loading}
          dataSource={filteredPrograms}
          rowKey='id'
          pagination={{ pageSize: 6 }}
          expandable={{
            expandedRowRender: record => (
              <div>
                <p>
                  <strong>Description:</strong> {record.description || 'N/A'}
                </p>
                <p>
                  <strong>Budget:</strong> R{' '}
                  {record.budget?.toLocaleString() || 0}
                </p>
                <p>
                  <strong>Max Capacity:</strong> {record.maxCapacity || 'N/A'}
                </p>
              </div>
            )
          }}
        >
          <Table.Column title='Program Name' dataIndex='name' key='name' />
          <Table.Column
            title='Assigned Admin'
            key='assignedAdmin'
            render={record =>
              record.assignedAdmin ? (
                <Text>
                  {consultantOptions.find(c => c.id === record.assignedAdmin)
                    ?.name || 'Unknown'}
                </Text>
              ) : (
                <Tag color='orange'>Not Assigned</Tag>
              )
            }
          />

          <Table.Column title='Type' dataIndex='type' />
          <Table.Column
            title='Status'
            dataIndex='status'
            render={status => (
              <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
            )}
          />
          <Table.Column
            title='Start Date'
            dataIndex='startDate'
            render={val =>
              val?.toDate ? dayjs(val.toDate()).format('YYYY-MM-DD') : 'N/A'
            }
          />
          <Table.Column
            title='End Date'
            dataIndex='endDate'
            render={val =>
              val?.toDate ? dayjs(val.toDate()).format('YYYY-MM-DD') : 'N/A'
            }
          />
          <Table.Column
            title='Registration Link'
            dataIndex='registrationLink'
            render={(link: string) => (
              <Text
                copyable={{
                  text: window.location.origin + link,
                  tooltips: ['Copy link', 'Copied!']
                }}
              >
                {/* Empty to hide visible text */}{' '}
              </Text>
            )}
          />

          <Table.Column
            title='Actions'
            key='actions'
            render={(_, record) => (
              <Space size='middle'>
                <Button
                  icon={<EditOutlined />}
                  size='small'
                  style={{ border: 'none' }}
                  onClick={() => {
                    setSelectedProgram(record)
                    editForm.setFieldsValue({
                      ...record,
                      startDate: record.startDate?.toDate
                        ? dayjs(record.startDate.toDate())
                        : null,
                      endDate: record.endDate?.toDate
                        ? dayjs(record.endDate.toDate())
                        : null
                    })
                    setEligibility(record.eligibilityCriteria || {}) // <-- key!
                    setQuestions(record.onboardingQuestions || [])
                    setEditModalVisible(true)
                    setCurrentStep(0)
                  }}
                />

                <Button
                  icon={<DeleteOutlined />}
                  size='small'
                  danger
                  onClick={() => handleDeleteProgram(record.id)}
                />
                <Button
                  size='small'
                  icon={<PoweroffOutlined />}
                  onClick={() => toggleStatus(record)}
                  loading={togglingProgramId === record.id}
                >
                  {record.status === 'Active' ? 'Deactivate' : 'Activate'}
                </Button>
              </Space>
            )}
          />
        </Table>

        <Modal
          open={modalVisible}
          title='Add New Program'
          onCancel={() => {
            setModalVisible(false)
            setQuestions([])
            setEditingQuestion(null)
            setCurrentStep(0)
            setEligibility({})
          }}
          footer={null}
          width={900}
        >
          <Steps current={currentStep} style={{ marginBottom: 24 }}>
            <Steps.Step title='Program Details' />
            <Steps.Step title='Eligibility Criteria' />
            <Steps.Step title='Onboarding Questions' />
          </Steps>

          {currentStep === 0 && (
            <Form
              layout='vertical'
              form={form}
              onFinish={values => {
                setBasicDetails(values)
                setCurrentStep(1)
              }}
            >
              <Form.Item
                name='name'
                label='Program Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='description'
                label='Program Description'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name='type' label='Type'>
                <Input />
              </Form.Item>
              <Form.Item name='status' label='Status'>
                <Select>
                  <Select.Option value='Active'>Active</Select.Option>
                  <Select.Option value='Inactive'>Inactive</Select.Option>
                  <Select.Option value='Completed'>Completed</Select.Option>
                  <Select.Option value='Upcoming'>Upcoming</Select.Option>
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name='cohortYear'
                    label='Cohort Year'
                    rules={[
                      {
                        required: true,
                        message: 'Please input the cohort year'
                      }
                    ]}
                  >
                    <Input placeholder='e.g., 2025' />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name='startDate' label='Start Date'>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name='endDate' label='End Date'>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name='budget' label='Budget (ZAR)'>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name='maxCapacity' label='Max Capacity'>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
              <Form.Item name='assignedAdmin' label='Assign Project Admin'>
                <Select placeholder='Select a consultant'>
                  {consultantOptions.map(user => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type='primary' htmlType='submit' block>
                  Next
                </Button>
              </Form.Item>
            </Form>
          )}
          {currentStep === 1 && (
            <EligibilityCriteriaStep
              value={eligibility}
              onChange={setEligibility}
              onBack={() => setCurrentStep(0)}
              onNext={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 2 && (
            <>
              <QuestionTable
                questions={questions}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              <QuestionModal
                visible={questionModalOpen}
                initialValues={editingQuestion}
                onSave={handleSaveQuestion}
                onCancel={() => setQuestionModalOpen(false)}
              />
              <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <Button onClick={() => setCurrentStep(0)}>Back</Button>
                <Button
                  type='primary'
                  onClick={async () => {
                    // Validate and save program with both states
                    await handleAddProgram({
                      ...basicDetails,
                      onboardingQuestions: questions,
                      eligibilityCriteria: eligibility // pass eligibility into handler
                    })
                  }}
                >
                  Save Program
                </Button>
              </div>
            </>
          )}
        </Modal>

        <Modal
          open={editModalVisible}
          title='Edit Program'
          onCancel={() => {
            setEditModalVisible(false)
            setQuestions([])
            setEditingQuestion(null)
            setCurrentStep(0)
            setEligibility({})
          }}
          footer={null}
          width={900}
        >
          <Steps current={currentStep} style={{ marginBottom: 24 }}>
            <Steps.Step title='Program Details' />
            <Steps.Step title='Eligibility Criteria' />
            <Steps.Step title='Onboarding Questions' />
          </Steps>
          {currentStep === 0 && (
            <Form
              layout='vertical'
              form={editForm}
              onFinish={values => {
                setBasicDetails(values)
                setCurrentStep(1)
              }}
            >
              <Form.Item
                name='name'
                label='Program Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='description'
                label='Program Description'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item name='type' label='Type'>
                <Input />
              </Form.Item>
              <Form.Item name='status' label='Status'>
                <Select>
                  <Select.Option value='Active'>Active</Select.Option>
                  <Select.Option value='Inactive'>Inactive</Select.Option>
                  <Select.Option value='Completed'>Completed</Select.Option>
                  <Select.Option value='Upcoming'>Upcoming</Select.Option>
                </Select>
              </Form.Item>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name='cohortYear'
                    label='Cohort Year'
                    rules={[
                      {
                        required: true,
                        message: 'Please input the cohort year'
                      }
                    ]}
                  >
                    <Input placeholder='e.g., 2025' />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name='startDate' label='Start Date'>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name='endDate' label='End Date'>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name='budget' label='Budget (ZAR)'>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name='maxCapacity' label='Max Capacity'>
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
              <Form.Item name='assignedAdmin' label='Assign Project Admin'>
                <Select placeholder='Select a consultant'>
                  {consultantOptions.map(user => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item>
                <Button type='primary' htmlType='submit' block>
                  Next
                </Button>
              </Form.Item>
            </Form>
          )}
          {currentStep === 1 && (
            <EligibilityCriteriaStep
              value={eligibility}
              onChange={setEligibility}
              onBack={() => setCurrentStep(0)}
              onNext={() => setCurrentStep(2)}
            />
          )}
          {currentStep === 2 && (
            <>
              <QuestionTable
                questions={questions}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
              <QuestionModal
                visible={questionModalOpen}
                initialValues={editingQuestion}
                onSave={handleSaveQuestion}
                onCancel={() => setQuestionModalOpen(false)}
              />
              <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                <Button onClick={() => setCurrentStep(0)}>Back</Button>
                <Button
                  type='primary'
                  onClick={async () => {
                    // Validate and save program with both states
                    await handleUpdateProgram({
                      ...basicDetails,
                      ...editForm.getFieldsValue(),
                      onboardingQuestions: questions,
                      eligibilityCriteria: eligibility // pass eligibility into handler
                    })
                  }}
                >
                  Save Program
                </Button>
              </div>
            </>
          )}
        </Modal>
      </div>
    </>
  )
}

export default ProgramManager
