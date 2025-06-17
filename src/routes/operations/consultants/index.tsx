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
  Skeleton
} from 'antd'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  query,
  setDoc,
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
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase' // Make sure you export your `functions` from your Firebase config
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { compareObjs } from '@fullcalendar/core/internal'

const { Title } = Typography
const { Option } = Select

interface Consultant {
  id: string
  name: string
  email: string
  expertise: string[]
  assignmentsCount: number
  rating: number
  active: boolean
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
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()
  const [editingConsultant, setEditingConsultant] = useState<Consultant | null>(
    null
  )
  const [newConsultantId, setNewConsultantId] = useState<string | null>(null)
  const [searchText, setSearchText] = useState('')
  const { user, loading: identityLoading } = useFullIdentity()
  const [companyCode, setCompanyCode] = useState<string>('')

  useEffect(() => {
    if (!identityLoading) {
      if (user?.companyCode) {
        setCompanyCode(user.companyCode)
        fetchConsultants(user.companyCode)
      } else {
        setLoading(false) // stop the spinner
      }
    }
  }, [identityLoading, user?.companyCode])

  useEffect(() => {
    if (newConsultantId) {
      const timeout = setTimeout(() => {
        setNewConsultantId(null)
      }, 8000)
      return () => clearTimeout(timeout)
    }
  }, [newConsultantId])

  const fetchConsultants = async (companyCode: string, userDep?: any) => {
    setLoading(true)
    try {
      let q
      q = query(
        collection(db, 'consultants'),
        where('companyCode', '==', companyCode)
      )

      const snapshot = await getDocs(q)
      setConsultants(
        snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
      )
    } catch (error) {
      console.error('Error fetching consultants:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!identityLoading && user?.companyCode) {
      setCompanyCode(user.companyCode)
    }
  }, [identityLoading, user?.companyCode])

  const handleAddConsultant = async (values: any) => {
    try {
      const { email, name, expertise, rate } = values

      // Create Firebase Auth account
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        'Password@1'
      )
      const uid = userCred.user.uid

      const newConsultant = {
        name,
        email,
        expertise,
        rate,
        assignmentsCount: 0,
        rating: 0,
        active: true,
        authUid: uid,
        companyCode,
        createdAt: new Date().toISOString()
      }
      await addDoc(collection(db, 'consultants'), newConsultant)

      const newUser = {
        name,
        email,
        companyCode,
        role: 'consultant',
        createdAt: new Date().toISOString()
      }
      await setDoc(doc(db, 'users', uid), newUser)

      message.success('Consultant registered and notified!')
      form.resetFields()
      setAddModalVisible(false)
      fetchConsultants(companyCode)
    } catch (error: any) {
      console.error(error)
      message.error(error?.message || 'Failed to register consultant.')
    }
  }

  const handleEditConsultant = async (values: any) => {
    if (!editingConsultant) return
    try {
      const updated = {
        ...values
      }
      await updateDoc(doc(db, 'consultants', editingConsultant.id), updated)
      setEditModalVisible(false)
      setEditingConsultant(null)
      editForm.resetFields()
      fetchConsultants(companyCode)
    } catch (error) {
      console.error('Error updating consultant:', error)
      message.error('Failed to update consultant.')
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
          fetchConsultants(companyCode, userDepartment)
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

  const filteredConsultants = consultants.filter(
    c =>
      c.name.toLowerCase().includes(searchText.toLowerCase()) ||
      c.email.toLowerCase().includes(searchText.toLowerCase())
  )

  const activeCount = consultants.filter(c => c.active).length
  const totalConsultants = consultants.length
  const averageRating = totalConsultants
    ? (
        consultants.reduce((sum, c) => sum + (c.rating || 0), 0) /
        totalConsultants
      ).toFixed(1)
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
      sorter: (a: Consultant, b: Consultant) => a.rating - b.rating
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
        padding: 24,
        minHeight: '100vh',
        overflow: 'auto',
        background: '#fff'
      }}
    >
      <Helmet>
        <title>Consultants | Smart Incubation</title>
      </Helmet>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <UserOutlined />
                  Total Consultants
                </Space>
              }
              value={totalConsultants}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  Active Consultants
                </Space>
              }
              value={activeCount}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={8}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <StarOutlined style={{ color: '#fadb14' }} />
                  Average Rating
                </Space>
              }
              valueRender={() => (
                <Rate
                  disabled
                  allowHalf
                  value={parseFloat(averageRating.toString())}
                />
              )}
            />
          </Card>
        </Col>
      </Row>
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
      <Card>
        <Skeleton active loading={loading}>
          <Table
            columns={columns}
            dataSource={filteredConsultants}
            rowKey='id'
            pagination={{ pageSize: 8 }}
            rowClassName={record =>
              record.id === newConsultantId ? 'highlighted-row' : ''
            }
          />
        </Skeleton>
      </Card>

      {/* Add Consultant Modal */}
      <Modal
        title='Add New Consultant'
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => form.submit()}
        okText='Add Consultant'
        centered
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
            rules={[{ required: true, message: 'Please enter a rate' }]}
          >
            <Input type='number' min={0} />
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
