import React, { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Tag,
  Space,
  Typography,
  Rate,
  Modal,
  Form,
  Input,
  Select,
  message,
  Skeleton,
  Grid,
  List,
  Avatar,
  Empty
} from 'antd'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where
} from 'firebase/firestore'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StarOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { CSVLink } from 'react-csv'
import { auth } from '@/firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase' // Make sure you export your `functions` from your Firebase config
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { compareObjs } from '@fullcalendar/core/internal'
import SHA256 from 'crypto-js/sha256'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography
const { Option } = Select

interface Consultant {
  id: string
  name: string
  email: string
  expertise: string[]
  assignmentsCount: number
  rate: number
  rating?: number
  active?: boolean
}

const defaultExpertise = [
  'Strategy',
  'Marketing',
  'Finance',
  'Technology',
  'Operations',
  'HR',
  'Compliance'
]

export const ConsultantPage: React.FC = () => {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editingConsultant, setEditingConsultant] = useState<Consultant | null>(
    null
  )
  const [newConsultantId, setNewConsultantId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const { user } = useFullIdentity()
  const [companyCode, setCompanyCode] = useState<string>('')
  const navigate = useNavigate()
  // 2) INSIDE ConsultantPage component (near other hooks)
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  useEffect(() => {
    if (user?.companyCode) {
      setCompanyCode(user.companyCode)
    } else if (user === null) {
      // explicitly no logged-in user
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (newConsultantId) {
      const timeout = setTimeout(() => {
        setNewConsultantId(null)
      }, 8000)
      return () => clearTimeout(timeout)
    }
  }, [newConsultantId])

  const fetchConsultants = async (companyCode: string) => {
    setLoading(true)
    try {
      const q = query(
        collection(db, 'consultants'),
        where('companyCode', '==', companyCode)
      )
      const snapshot = await getDocs(q)

      const consultantsData: Consultant[] = await Promise.all(
        snapshot.docs.map(async docSnap => {
          const data = docSnap.data() as any
          const c: Consultant = {
            id: docSnap.id,
            name: String(data?.name ?? ''),
            email: String(data?.email ?? ''),
            rate: Number(data?.rate ?? 0),
            expertise: Array.isArray(data?.expertise) ? data.expertise : [],
            assignmentsCount: 0,
            rating: data?.rating != null ? Number(data.rating) : undefined,
            active: data?.active != null ? Boolean(data.active) : true
          }

          const assignmentsSnap = await getDocs(
            query(
              collection(db, 'assignedInterventions'),
              where('consultantId', '==', c.id)
            )
          )
          c.assignmentsCount = assignmentsSnap.size
          return c
        })
      )

      setConsultants(consultantsData)
    } catch (e) {
      console.error('Error fetching consultants:', e)
      message.error('Failed to load consultants.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch consultants and set userDepartment
  useEffect(() => {
    if (companyCode) {
      fetchConsultants(companyCode)
    }
  }, [companyCode])

  const generateConsultantSignature = (uid: string, email: string): string => {
    const timestamp = new Date().toISOString()
    return SHA256(`${uid}:${email}:${timestamp}`).toString()
  }

  const handleAddConsultant = async (values: any) => {
    setAdding(true)
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        message.error('Not authenticated')
        return
      }

      const payload = {
        email: values.email,
        name: values.name,
        role: 'consultant',
        companyCode,
        // consultant extras
        expertise: values.expertise || [],
        rate: Number(values.rate),
        // options
        sendEmail: true,
        sendResetLink: true,
        allowExisting: false
      }

      const resp = await fetch(
        'https://createplatformuser-zv4wtb2ujq-uc.a.run.app',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        }
      );


      const data = await resp.json()
      if (!resp.ok || !data.ok) {
        throw new Error(data?.error || 'create_failed')
      }

      message.success('Consultant created. Password reset email sent.')
      form.resetFields()
      setAddModalVisible(false)
      fetchConsultants(companyCode) // refresh list
    } catch (error: any) {
      console.error(error)
      message.error(error?.message || 'Failed to register consultant.')
    } finally {
      setAdding(false)
    }
  }

  const handleEditConsultant = async (values: any) => {
    if (!editingConsultant) return
    setEditing(true)
    try {
      // Spread the values
      const updated = {
        ...values
      }
      await updateDoc(doc(db, 'consultants', editingConsultant.id), updated)
      setEditModalVisible(false)
      setEditingConsultant(null)
      message.success('Consultant details successfully updated ')
      editForm.resetFields()
      fetchConsultants(companyCode)
    } catch (error) {
      console.error('Error updating consultant:', error)
      message.error('Failed to update consultant.')
    } finally {
      setEditing(false)
    }
  }

  const handleDeleteConsultant = async (id: string) => {
    const consultant = consultants.find(c => c.id === id)
    if (!consultant || !consultant.email) {
      message.error('Consultant or email not found.')
      return
    }
    Modal.confirm({
      title: 'Delete Consultant',
      content: `Are you sure you want to permanently delete "${consultant.name}" (${consultant.email})? This will remove their authentication and profile. This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      async onOk () {
        try {
          // Call your Firebase Function to delete from Auth and Firestore
          const deleteUser = httpsCallable(functions, 'deleteUserAndFirestore')
          await deleteUser({ email: consultant.email, role: 'consultant' })
          message.success('Consultant deleted successfully.')
          fetchConsultants(companyCode)
        } catch (error: any) {
          console.error('Error deleting consultant:', error)
          message.error(
            error?.message ||
              error?.details ||
              'Failed to delete consultant from Auth/Firestore.'
          )
        }
      }
    })
  }

  const handleActivateToggle = async (record: Consultant) => {
    try {
      await updateDoc(doc(db, 'consultants', record.id), {
        active: !record.active
      })
      message.success('Consultant status updated!')
      fetchConsultants(companyCode)
    } catch (error) {
      console.error('Error toggling consultant:', error)
      message.error('Failed to update consultant.')
    }
  }

  const filteredConsultants = consultants.filter(c => {
    const name = (c.name ?? '').toLowerCase()
    const email = (c.email ?? '').toLowerCase()
    const matchesSearch =
      name.includes(searchText.toLowerCase()) ||
      email.includes(searchText.toLowerCase())
    return matchesSearch
  })

  const activeCount = consultants.filter(c => c.active).length
  const totalConsultants = consultants.length
  const averageRating = totalConsultants
    ? consultants.reduce((sum, c) => sum + (c.rating ?? 0), 0) /
      totalConsultants
    : 0

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: Consultant, b: Consultant) => a.name.localeCompare(b.name)
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: Consultant, b: Consultant) => a.email.localeCompare(b.email)
    },
    {
      title: 'Rate/hr',
      dataIndex: 'rate',
      key: 'rate',
      render: val => `R ${val}`
    },
    {
      title: 'Expertise',
      dataIndex: 'expertise',
      key: 'expertise',
      render: (expertise: string[]) => (
        <Space wrap>
          {expertise.map((item, index) => (
            <Tag color='blue' key={index}>
              {item}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'Assignments',
      dataIndex: 'assignmentsCount',
      key: 'assignmentsCount',
      sorter: (a: Consultant, b: Consultant) =>
        a.assignmentsCount - b.assignmentsCount
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      sorter: (a: Consultant, b: Consultant) =>
        (a.rating ?? 0) - (b.rating ?? 0)
    },
    {
      title: 'Status',
      dataIndex: 'active',
      key: 'active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
      sorter: (a: Consultant, b: Consultant) =>
        Number(a.active) - Number(b.active)
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Consultant) => (
        <Space>
          <Button
            size='small'
            onClick={() =>
              navigate(`/operations/consultants/${record.id}/performance`, {
                state: { consultantName: record.name }
              })
            }
          >
            View Performance
          </Button>

          <Button
            size='small'
            icon={<EditOutlined />}
            onClick={() => {
              setEditingConsultant(record)
              editForm.setFieldsValue(record)
              setEditModalVisible(true)
            }}
          />
          <Button
            size='small'
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDeleteConsultant(record.id)}
          />
          <Button size='small' onClick={() => handleActivateToggle(record)}>
            {record.active ? 'Deactivate' : 'Activate'}
          </Button>
        </Space>
      )
    }
  ]

  return (
    <div
      style={{
        padding: 8,
        minHeight: '100vh'
      }}
    >
      <Helmet>
        <title>Consultants | Smart Incubation</title>
      </Helmet>
      <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={8}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <MotionCard>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#e6f7ff',
                    padding: 10,
                    borderRadius: '50%',
                    marginRight: 16
                  }}
                >
                  <UserOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                </div>
                <Text strong>Total Consultants</Text>
              </div>
              <Title level={3} style={{ margin: 0 }}>
                {totalConsultants}
              </Title>
            </MotionCard>
          </motion.div>
        </Col>

        <Col xs={24} sm={8}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <MotionCard>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#f6ffed',
                    padding: 10,
                    borderRadius: '50%',
                    marginRight: 16
                  }}
                >
                  <CheckCircleOutlined
                    style={{ fontSize: 20, color: '#52c41a' }}
                  />
                </div>
                <Text strong>Active Consultants</Text>
              </div>
              <Title level={3} style={{ margin: 0, color: '#52c41a' }}>
                {activeCount}
              </Title>
            </MotionCard>
          </motion.div>
        </Col>

        <Col xs={24} sm={8}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <MotionCard>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12
                }}
              >
                <div
                  style={{
                    background: '#fffbe6',
                    padding: 10,
                    borderRadius: '50%',
                    marginRight: 16
                  }}
                >
                  <StarOutlined style={{ fontSize: 20, color: '#faad14' }} />
                </div>
                <Text strong>Average Rating</Text>
              </div>
              <Rate
                disabled
                allowHalf
                value={parseFloat(averageRating.toString())}
                style={{ fontSize: 24 }}
              />
            </MotionCard>
          </motion.div>
        </Col>
      </Row>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <MotionCard>
          <Col style={{ marginBottom: 10 }}>
            <Space>
              <Input.Search
                placeholder='Search by name or email'
                onSearch={value => setSearchText(value)}
                allowClear
                style={{ width: 250 }}
              />
              <Button
                type='primary'
                icon={<PlusOutlined />}
                onClick={() => setAddModalVisible(true)}
              >
                Add Consultant
              </Button>
              <Button icon={<DownloadOutlined />} type='default'>
                <CSVLink
                  filename='consultants.csv'
                  data={consultants}
                  style={{ color: 'inherit' }}
                >
                  Export
                </CSVLink>
              </Button>
            </Space>
          </Col>
        </MotionCard>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <MotionCard style={{ marginTop: 15 }}>
          {!loading && filteredConsultants.length === 0 ? (
            <Empty description='No consultants found' />
          ) : (
            <Skeleton active loading={loading}>
              {isMobile ? (
                <List
                  dataSource={filteredConsultants}
                  rowKey='id'
                  pagination={{ pageSize: 8 }}
                  renderItem={(c: Consultant) => (
                    <List.Item
                      key={c.id}
                      actions={[
                        <Button
                          key='perf'
                          size='small'
                          onClick={() =>
                            navigate(
                              `/operations/consultants/${c.id}/performance`,
                              {
                                state: { consultantName: c.name }
                              }
                            )
                          }
                        >
                          View Performance
                        </Button>,
                        <Button
                          key='edit'
                          size='small'
                          icon={<EditOutlined />}
                          onClick={() => {
                            setEditingConsultant(c)
                            editForm.setFieldsValue(c)
                            setEditModalVisible(true)
                          }}
                        />,
                        <Button
                          key='del'
                          size='small'
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteConsultant(c.id)}
                        />,
                        <Button
                          key='toggle'
                          size='small'
                          onClick={() => handleActivateToggle(c)}
                        >
                          {c.active ? 'Deactivate' : 'Activate'}
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar style={{ backgroundColor: '#1677ff' }}>
                            {(c.name || 'C').charAt(0).toUpperCase()}
                          </Avatar>
                        }
                        title={
                          <Space size={8} wrap>
                            <Text strong style={{ fontSize: 16 }}>
                              {c.name}
                            </Text>
                            <Tag color={c.active ? 'green' : 'red'}>
                              {c.active ? 'Active' : 'Inactive'}
                            </Tag>
                            <Tag
                              color={c.type === 'Internal' ? 'blue' : 'purple'}
                            >
                              {c.type}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div style={{ marginTop: 4 }}>
                            <div style={{ marginBottom: 6 }}>
                              <Text type='secondary'>{c.email}</Text>
                            </div>
                            <Space
                              wrap
                              size={[6, 6]}
                              style={{ marginBottom: 6 }}
                            >
                              {(c.expertise || []).map((e, i) => (
                                <Tag key={i} color='blue'>
                                  {e}
                                </Tag>
                              ))}
                            </Space>
                            <Space size='middle' wrap>
                              <Text>
                                Rate/hr:{' '}
                                <Text strong>R {Number(c.rate ?? 0)}</Text>
                              </Text>
                              <Text>
                                Assignments:{' '}
                                <Text strong>{c.assignmentsCount ?? 0}</Text>
                              </Text>
                              <Space>
                                <Text>Rating:</Text>
                                <Rate
                                  disabled
                                  allowHalf
                                  value={Number(c.rating ?? 0)}
                                />
                              </Space>
                            </Space>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Table
                  columns={columns}
                  dataSource={filteredConsultants}
                  rowKey='id'
                  pagination={{ pageSize: 8 }}
                  rowClassName={record =>
                    record.id === newConsultantId ? 'highlighted-row' : ''
                  }
                />
              )}
            </Skeleton>
          )}
        </MotionCard>
      </motion.div>
      {/* Add Consultant Modal */}
      <Modal
        title='Add New Consultant'
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => form.submit()}
        okText='Add Consultant'
        centered
        confirmLoading={adding}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }} // 👉 limit height nicely
      >
        <Form form={form} layout='vertical' onFinish={handleAddConsultant}>
          <Form.Item
            name='name'
            label='Name'
            rules={[
              { required: true, message: 'Please enter consultant name' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name='email'
            label='Email'
            rules={[
              { required: true, message: 'Please enter consultant email' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name='expertise'
            label='Expertise Areas'
            rules={[{ required: true, message: 'Please select expertise' }]}
          >
            <Select
              mode='tags'
              placeholder='Add expertise areas'
              options={defaultExpertise.map(area => ({
                value: area,
                label: area
              }))}
            />
          </Form.Item>
          <Form.Item
            name='rate'
            label='Rate per Hour (ZAR)'
            rules={[{ required: true, message: 'Please enter a rate' }]}
          >
            <Input type='number' min={0} />
          </Form.Item>
          <Form.Item
            name='type'
            label='Consultant Type'
            rules={[
              { required: true, message: 'Please select consultant type' }
            ]}
          >
            <Select placeholder='Select type'>
              <Option value='Internal'>Internal</Option>
              <Option value='External'>External</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      {/* Edit Consultant Modal */}
      <Modal
        title='Edit Consultant'
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        okText='Save Changes'
        confirmLoading={editing}
      >
        <Form form={editForm} layout='vertical' onFinish={handleEditConsultant}>
          <Form.Item
            name='name'
            label='Name'
            rules={[
              { required: true, message: 'Please enter consultant name' }
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name='email'
            label='Email'
            rules={[
              { required: true, message: 'Please enter consultant email' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name='expertise'
            label='Expertise Areas'
            rules={[{ required: true, message: 'Please select expertise' }]}
          >
            <Select
              mode='tags'
              style={{ width: '100%' }}
              placeholder='Add expertise areas'
            >
              {defaultExpertise.map(area => (
                <Option key={area} value={area}>
                  {area}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name='rate'
            label='Rate per Hour (ZAR)'
            rules={[
              {
                required: true,
                message: 'Please enter consultant rate per hour'
              }
            ]}
          >
            <Input type='number' min={0} />
          </Form.Item>
          <Form.Item
            name='type'
            label='Consultant Type'
            rules={[
              { required: true, message: 'Please select consultant type' }
            ]}
          >
            <Select placeholder='Select type'>
              <Option value='Internal'>Internal</Option>
              <Option value='External'>External</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <style>{`
        .highlighted-row {
          background-color: #fff7e6 !important;
          transition: background-color 0.8s ease;
          animation: fadeHighlight 8s forwards;
        }
        @keyframes fadeHighlight {
          0% { background-color: #fff7e6; }
          100% { background-color: white; }
        }
      `}</style>
    </div>
  )
}

export default ConsultantPage
