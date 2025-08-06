import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  DatePicker,
  Row,
  Col,
  Collapse
} from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  UploadOutlined,
  FileSearchOutlined,
  DownOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  query,
  where
} from 'firebase/firestore'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import dayjs from 'dayjs'
import { PREDEFINED_TASK_TYPES } from '@/types/TaskType'
import { motion } from 'framer-motion'

const { Text } = Typography
const { Panel } = Collapse

// Enhanced task types with specific fields
// Enhanced task types configuration
const ENHANCED_TASK_TYPES = [
  {
    id: 'document-review',
    name: 'Document Review',
    proofRequired: true,
    specificFields: [
      {
        name: 'document',
        label: 'Document to Review',
        required: true,
        type: 'select',
        options: ['Contract', 'Proposal', 'Report', 'Policy', 'Other']
      },
      {
        name: 'consultant',
        label: 'Consultant to Review',
        required: true,
        type: 'user-select',
        role: 'consultant'
      }
    ]
  },
  {
    id: 'compliance-check',
    name: 'Compliance Check',
    proofRequired: true,
    specificFields: [
      {
        name: 'regulation',
        label: 'Regulation/Standard',
        required: true,
        type: 'select',
        options: ['ISO 27001', 'GDPR', 'HIPAA', 'SOC 2', 'Other']
      },
      {
        name: 'consultant',
        label: 'Consultant to Perform Check',
        required: true,
        type: 'user-select',
        role: 'consultant'
      }
    ]
  },
  {
    id: 'client-outreach',
    name: 'Client Outreach',
    proofRequired: true,
    specificFields: [
      {
        name: 'purpose',
        label: 'Purpose of Outreach',
        required: true,
        type: 'select',
        options: ['Follow-up', 'Requirements Gathering', 'Feedback', 'Other']
      },
      {
        name: 'consultant',
        label: 'Consultant for Outreach',
        required: true,
        type: 'user-select',
        role: 'consultant'
      }
    ]
  },
  {
    id: 'training-delivery',
    name: 'Training Delivery',
    proofRequired: true,
    specificFields: [
      {
        name: 'trainingTitle',
        label: 'Training Title',
        required: true,
        type: 'input'
      },
      {
        name: 'participants',
        label: 'Participants',
        required: true,
        type: 'user-select-multiple'
      },
      {
        name: 'consultant',
        label: 'Lead Trainer',
        required: true,
        type: 'user-select',
        role: 'consultant'
      }
    ]
  },
  {
    id: 'other',
    name: 'Other Task',
    proofRequired: false,
    specificFields: []
  }
]

export const TasksManager: React.FC = () => {
  const { user } = useFullIdentity()
  const [tasks, setTasks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [proofModalOpen, setProofModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [taskForm] = Form.useForm()
  const [filters, setFilters] = useState({ status: null, role: null })
  const [selectedTaskType, setSelectedTaskType] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsersAndTasks = async () => {
      const userSnap = await getDocs(
        query(
          collection(db, 'users'),
          where('companyCode', '==', user?.companyCode)
        )
      )
      const allUsers = userSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(allUsers)

      const taskSnap = await getDocs(
        query(
          collection(db, 'tasks'),
          where('companyCode', '==', user?.companyCode)
        )
      )
      const allTasks = taskSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTasks(allTasks)
    }

    if (user?.companyCode) fetchUsersAndTasks()
  }, [user?.companyCode])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filters.status && t.status !== filters.status) return false
      if (filters.role && t.assignedRole !== filters.role) return false
      return true
    })
  }, [tasks, filters])

  const resolveUserName = (id: string) => {
    return users.find(u => u.id === id)?.name || 'Unknown'
  }

  const handleAddTask = async (values: any) => {
    const selectedType = ENHANCED_TASK_TYPES.find(t => t.id === values.taskType)

    // Ensure taskType is always an object
    const taskType = selectedType || {
      id: 'custom',
      name: values.taskType || 'Custom Task',
      proofRequired: false
    }

    const taskData = {
      title: values.title,
      description: values.description,
      taskType, // Now guaranteed to be an object
      dueDate: values.dueDate.toDate(),
      priority: values.priority,
      assignedRole: values.assignedRole,
      assignedTo: values.assignedTo,
      status: 'To Do',
      companyCode: user?.companyCode,
      createdAt: Timestamp.now(),
      ...(selectedType?.specificFields?.reduce((acc, field) => {
        if (values[field.name]) {
          acc[field.name] = values[field.name]
        }
        return acc
      }, {}) || {})
    }

    const newId = `task-${Date.now()}`
    await setDoc(doc(db, 'tasks', newId), taskData)
    setTasks(prev => [...prev, { id: newId, ...taskData }])
    setTaskModalOpen(false)
    taskForm.resetFields()
    setSelectedTaskType(null)
  }

  // Updated columns configuration to show all task-specific details
  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title' },
    {
      title: 'Details',
      key: 'details',
      render: (_, record) => {
        if (!record.taskType) return record.description || 'Custom Task'

        const taskType =
          typeof record.taskType === 'string'
            ? { id: 'custom', name: record.taskType }
            : record.taskType

        switch (taskType.id) {
          case 'document-review':
            return `Review ${record.document || 'document'} (${resolveUserName(
              record.consultant
            )})`
          case 'compliance-check':
            return `Check ${
              record.regulation || 'compliance'
            } (${resolveUserName(record.consultant)})`
          case 'client-outreach':
            return `${record.purpose || 'Client outreach'} (${resolveUserName(
              record.consultant
            )})`
          case 'training-delivery':
            return `${record.trainingTitle || 'Training'} for ${
              record.participants?.length || 0
            } participants`
          default:
            return taskType.name || 'Task'
        }
      }
    },
    {
      title: 'Assigned To',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      render: id => resolveUserName(id)
    },
    {
      title: 'Type',
      key: 'taskType',
      render: (_, record) => {
        if (!record.taskType) return 'Custom'
        if (typeof record.taskType === 'string') return record.taskType
        return record.taskType.name || 'Task'
      }
    },
    {
      title: 'Due',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: d => dayjs(d?.toDate ? d.toDate() : d).format('YYYY-MM-DD')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: s => (
        <Tag
          icon={
            s === 'Completed' ? (
              <CheckCircleOutlined />
            ) : s === 'Awaiting Proof' ? (
              <FileSearchOutlined />
            ) : (
              <ClockCircleOutlined />
            )
          }
          color={
            s === 'Completed' ? 'green' : s === 'To Do' ? 'blue' : 'orange'
          }
        >
          {s || 'Unknown'}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, task) => {
        const requiresProof =
          task.taskType?.proofRequired ||
          (typeof task.taskType === 'object' && task.taskType.proofRequired)

        return requiresProof && task.status === 'Awaiting Proof' ? (
          <Button
            type='link'
            onClick={() => {
              setSelectedTask(task)
              setProofModalOpen(true)
            }}
          >
            View Proof & Approve
          </Button>
        ) : null
      }
    }
  ]

  // Updated renderSpecificFields function
  const renderSpecificFields = () => {
    if (!selectedTaskType) return null

    const taskType = ENHANCED_TASK_TYPES.find(t => t.id === selectedTaskType)
    if (!taskType?.specificFields?.length) return null

    return (
      <Collapse
        bordered={false}
        defaultActiveKey={['specific-fields']}
        expandIcon={({ isActive }) => (
          <DownOutlined rotate={isActive ? 180 : 0} />
        )}
      >
        <Panel
          header='Task Specific Details'
          key='specific-fields'
          style={{ background: '#fafafa', borderRadius: 8 }}
        >
          {taskType.specificFields.map(field => {
            // Render different input types based on field configuration
            if (field.type === 'select') {
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={[
                    {
                      required: field.required,
                      message: `${field.label} is required`
                    }
                  ]}
                >
                  <Select placeholder={`Select ${field.label.toLowerCase()}`}>
                    {field.options.map(option => (
                      <Select.Option key={option} value={option}>
                        {option}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }

            if (field.type === 'user-select') {
              const filteredUsers = field.role
                ? users.filter(u => u.role === field.role)
                : users

              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={[
                    {
                      required: field.required,
                      message: `${field.label} is required`
                    }
                  ]}
                >
                  <Select
                    placeholder={`Select ${field.label.toLowerCase()}`}
                    showSearch
                    optionFilterProp='children'
                    filterOption={(input, option) =>
                      (option?.children ?? '')
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  >
                    {filteredUsers.map(u => (
                      <Select.Option key={u.id} value={u.id}>
                        {u.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }

            if (field.type === 'user-select-multiple') {
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={[
                    {
                      required: field.required,
                      message: `${field.label} is required`
                    }
                  ]}
                >
                  <Select
                    mode='multiple'
                    placeholder={`Select ${field.label.toLowerCase()}`}
                    showSearch
                    optionFilterProp='children'
                    filterOption={(input, option) =>
                      (option?.children ?? '')
                        .toLowerCase()
                        .includes(input.toLowerCase())
                    }
                  >
                    {users.map(u => (
                      <Select.Option key={u.id} value={u.id}>
                        {u.name}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }

            // Default to text input
            return (
              <Form.Item
                key={field.name}
                name={field.name}
                label={field.label}
                rules={[
                  {
                    required: field.required,
                    message: `${field.label} is required`
                  }
                ]}
              >
                <Input placeholder={`Enter ${field.label.toLowerCase()}`} />
              </Form.Item>
            )
          })}
        </Panel>
      </Collapse>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: '#fff' }}>
      <Space direction='vertical' style={{ width: '100%' }} size='large'>
        <Alert
          message='Each task listed below represents a specific deliverable or action assigned to a consultant or operations user. Use the filters and metrics to track progress and follow up where proof of execution is required.'
          type='info'
          showIcon
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.1,
                ease: 'easeOut'
              }}
              whileHover={{
                y: -3,
                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                transition: { duration: 0.2 },
                borderRadius: 8,
                background: 'transparent'
              }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <Space>
                  <CheckCircleOutlined
                    style={{ fontSize: 24, color: 'green' }}
                  />
                  <Text>Total Tasks: {tasks.length}</Text>
                </Space>
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={8}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.1,
                ease: 'easeOut'
              }}
              whileHover={{
                y: -3,
                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                transition: { duration: 0.2 },
                borderRadius: 8,
                background: 'transparent'
              }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <Space>
                  <ClockCircleOutlined
                    style={{ fontSize: 24, color: '#1890ff' }}
                  />
                  <Text>
                    Completed:{' '}
                    {tasks.filter(t => t.status === 'Completed').length}
                  </Text>
                </Space>
              </Card>
            </motion.div>
          </Col>
          <Col xs={24} sm={8}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.1,
                ease: 'easeOut'
              }}
              whileHover={{
                y: -3,
                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                transition: { duration: 0.2 },
                borderRadius: 8,
                background: 'transparent'
              }}
            >
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <Space>
                  <FileSearchOutlined
                    style={{ fontSize: 24, color: '#faad14' }}
                  />
                  <Text>
                    Awaiting Proof:{' '}
                    {tasks.filter(t => t.status === 'Awaiting Proof').length}
                  </Text>
                </Space>
              </Card>
            </motion.div>
          </Col>
        </Row>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: 0.1,
            ease: 'easeOut'
          }}
          whileHover={{
            y: -3,
            boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
            transition: { duration: 0.2 },
            borderRadius: 8,
            background: 'transparent'
          }}
        >
          <Card
            hoverable
            style={{
              boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
              transition: 'all 0.3s ease',
              borderRadius: 8,
              border: '1px solid #d6e4ff'
            }}
          >
            <Select
              placeholder='Filter by Status'
              onChange={v => setFilters(f => ({ ...f, status: v }))}
              allowClear
              style={{ width: 160, marginRight: 15 }}
            >
              <Select.Option value='To Do'>To Do</Select.Option>
              <Select.Option value='Completed'>Completed</Select.Option>
              <Select.Option value='Awaiting Proof'>
                Awaiting Proof
              </Select.Option>
            </Select>
            <Select
              placeholder='Filter by Role'
              onChange={v => setFilters(f => ({ ...f, role: v }))}
              allowClear
              style={{ width: 160 }}
            >
              <Select.Option value='consultant'>Consultant</Select.Option>
              <Select.Option value='operations'>Operations</Select.Option>
            </Select>
            <Button
              type='primary'
              style={{ marginLeft: 15 }}
              onClick={() => setTaskModalOpen(true)}
            >
              Add Task
            </Button>
          </Card>
        </motion.div>

        <Card
          hoverable
          style={{
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            transition: 'all 0.3s ease',
            borderRadius: 8,
            border: '1px solid #d6e4ff'
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: 'easeOut'
            }}
            whileHover={{
              y: -3,
              boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
              transition: { duration: 0.2 },
              borderRadius: 8,
              background: 'transparent'
            }}
          >
            <Table dataSource={filteredTasks} columns={columns} rowKey='id' />
          </motion.div>
        </Card>

        <Modal
          title='Submit Proof'
          open={proofModalOpen}
          onCancel={() => {
            setSelectedTask(null)
            setProofModalOpen(false)
          }}
          footer={null}
        >
          {selectedTask && (
            <Form layout='vertical' onFinish={() => {}}>
              {selectedTask.taskType?.proofTypes?.map(p => (
                <Card key={p.id} style={{ marginBottom: 12 }}>
                  <Text strong>{p.name}</Text>
                  <br />
                  <Text type='secondary'>{p.description}</Text>
                  <Form.Item
                    name={`description-${p.id}`}
                    label='Description'
                    rules={[{ required: p.required, message: 'Required' }]}
                  >
                    <Input.TextArea />
                  </Form.Item>
                  <Upload>
                    <Button icon={<UploadOutlined />}>Upload</Button>
                  </Upload>
                </Card>
              ))}
              <Button type='primary' htmlType='submit' block>
                Approve & Complete
              </Button>
            </Form>
          )}
        </Modal>

        <Modal
          title='Add Task'
          open={taskModalOpen}
          onCancel={() => {
            setTaskModalOpen(false)
            setSelectedTaskType(null)
          }}
          onOk={() => taskForm.submit()}
          width={800}
        >
          <Form layout='vertical' form={taskForm} onFinish={handleAddTask}>
            <Form.Item name='title' label='Title' rules={[{ required: true }]}>
              <Input placeholder='Enter task title' />
            </Form.Item>

            <Form.Item name='description' label='Description'>
              <Input.TextArea placeholder='Enter task description' rows={3} />
            </Form.Item>

            <Form.Item
              name='taskType'
              label='Task Type'
              rules={[{ required: true }]}
            >
              <Select
                placeholder='Select task type'
                onChange={value => {
                  setSelectedTaskType(value)
                  // Reset specific fields when type changes
                  const specificFields =
                    ENHANCED_TASK_TYPES.find(t => t.id === value)
                      ?.specificFields || []
                  specificFields.forEach(field => {
                    taskForm.setFieldsValue({ [field.name]: undefined })
                  })
                }}
              >
                {ENHANCED_TASK_TYPES.map(t => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {renderSpecificFields()}

            <Form.Item
              name='assignedRole'
              label='Assigned Role'
              rules={[{ required: true }]}
            >
              <Select placeholder='Select role'>
                <Select.Option value='consultant'>Consultant</Select.Option>
                <Select.Option value='operations'>Operations</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name='assignedTo'
              label='Assign To'
              rules={[{ required: true }]}
            >
              <Select
                placeholder='Select user'
                showSearch
                optionFilterProp='children'
                filterOption={(input, option) =>
                  (option?.children ?? '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {users.map(u => (
                  <Select.Option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name='dueDate'
              label='Due Date'
              rules={[{ required: true }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                disabledDate={current => {
                  return current && current < dayjs().startOf('day')
                }}
              />
            </Form.Item>

            <Form.Item name='priority' label='Priority' initialValue='medium'>
              <Select>
                <Select.Option value='low'>Low</Select.Option>
                <Select.Option value='medium'>Medium</Select.Option>
                <Select.Option value='high'>High</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </div>
  )
}
