import React, { useEffect, useState } from 'react'
import {
  Card,
  Table,
  Row,
  Col,
  Button,
  Typography,
  Input,
  Space,
  Statistic,
  Spin,
  Form,
  Select,
  Modal,
  message,
  Layout
} from 'antd'
import {
  collection,
  getDocs,
  setDoc,
  query,
  where,
  doc,
  addDoc
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import { useNavigate } from 'react-router-dom'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { PlusOutlined } from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { getFunctions, httpsCallable } from 'firebase/functions'

const { Title } = Typography
const { Option } = Select

interface OperationsUser {
  id: string
  name: string
  email: string
  gender: string
  phone: string
  companyCode: string
  createdAt: Date
}

interface UserIdentity {
  id: string
  email: string
  name?: string
  avatar?: string
  role?: string
  companyCode?: string
}

export const OperationsOnboardingDashboard: React.FC = () => {
  const [operationsStaff, setOperationsStaff] = useState<OperationsUser[]>([])
  const [filteredStaff, setFilteredStaff] = useState<OperationsUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [companyCode, setCompanyCode] = useState<string>('')
  const [form] = Form.useForm()
  const [editingStaff, setEditingStaff] = useState<OperationsUser | null>(null)
  const navigate = useNavigate()
  const { user, loading: identityLoading } = useFullIdentity()
  const getUserUidByEmail = async email => {
    const snapshot = await getDocs(
      query(collection(db, 'users'), where('email', '==', email))
    )
    if (snapshot.empty) throw new Error('No user found with that email')
    return snapshot.docs[0].id // uid is doc ID in `users`
  }
  const functions = getFunctions() // add region if needed

  useEffect(() => {
    if (!identityLoading) {
      if (user?.companyCode) {
        console.log('✅ Full user:', user)
        setCompanyCode(user.companyCode)
        fetchOperationsStaff(user.companyCode)
      } else {
        setLoading(false) // stop the spinner
      }
    }
  }, [identityLoading, user?.companyCode])

  const fetchOperationsStaff = async (companyCode: string) => {
    try {
      setLoading(true)
      const snapshot = await getDocs(
        query(
          collection(db, 'operationsStaff'),
          where('companyCode', '==', companyCode)
        )
      )
      const staffList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as OperationsUser[]
      setOperationsStaff(staffList)
      setFilteredStaff(staffList)
    } catch (error) {
      console.error('Error fetching operations staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (value: string) => {
    setSearchText(value)
    const filtered = operationsStaff.filter(
      staff =>
        staff.name.toLowerCase().includes(value.toLowerCase()) ||
        staff.email.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredStaff(filtered)
  }

  const handleFinish = async (values: any) => {
    try {
      const { email, password, name } = values
      let userUid = ''

      // If editing, get user UID by email (no password update for now)
      if (editingStaff) {
        userUid = await getUserUidByEmail(email)
        await setDoc(
          doc(db, 'users', userUid),
          {
            ...editingStaff,
            ...values,
            updatedAt: new Date()
          },
          { merge: true }
        )

        // Update operationsStaff record (find by ID)
        await setDoc(
          doc(db, 'operationsStaff', editingStaff.id),
          {
            ...editingStaff,
            ...values,
            updatedAt: new Date()
          },
          { merge: true }
        )

        message.success('Staff updated successfully!')
      } else {
        // Creating a new user
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        )
        const firebaseUser = userCredential.user
        if (!firebaseUser) throw new Error('Failed to create user.')

        // Set in users collection
        await setDoc(doc(db, 'users', firebaseUser.uid), {
          uid: firebaseUser.uid,
          email,
          name,
          role: 'operations',
          companyCode,
          createdAt: new Date()
        })

        // Set in operationsStaff collection
        await addDoc(collection(db, 'operationsStaff'), {
          email,
          name,
          gender: values.gender,
          phone: values.phone,
          companyCode
        })

        message.success('Operations Staff added successfully!')
      }
      form.resetFields()
      setAddModalVisible(false)
      setEditingStaff(null)
      fetchOperationsStaff(companyCode)
    } catch (error: any) {
      console.error('Error saving staff:', error)
      if (error.code === 'auth/email-already-in-use') {
        message.error(
          'This email is already in use. Please use a different email.'
        )
      } else {
        message.error(error.message || 'Failed to save operations staff.')
      }
    }
  }

  const handleEdit = (record: OperationsUser) => {
    setEditingStaff(record)
    form.setFieldsValue({
      ...record
    })
    setAddModalVisible(true)
  }

  const handleDelete = async (record: OperationsUser) => {
    Modal.confirm({
      title: 'Confirm Delete',
      content: `Are you sure you want to permanently delete "${record.name}" (${record.email})? This cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      async onOk () {
        try {
          const deleteUser = httpsCallable(functions, 'deleteUserAndFirestore')
          await deleteUser({ email: record.email, role: 'operations' })
          message.success('Staff deleted successfully.')
          fetchOperationsStaff(companyCode)
        } catch (error: any) {
          console.error('Error deleting staff:', error)
          message.error(
            error?.message ||
              error?.details ||
              'Failed to delete staff from Auth/Firestore.'
          )
        }
      }
    })
  }

  const columns = [
    {
      title: 'Full Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: any, b: any) => a.name.localeCompare(b.name)
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: any, b: any) => a.email.localeCompare(b.email)
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    { title: 'Gender', dataIndex: 'gender', key: 'gender' },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: OperationsUser) => (
        <Space>
          <Button size='small' onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Button size='small' danger onClick={() => handleDelete(record)}>
            Delete
          </Button>
        </Space>
      )
    }
  ]

  const totalUsers = operationsStaff.length

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <Helmet>
        <title>Operations Staff | Smart Incubation</title>
      </Helmet>

      <Row justify='space-between' align='middle' style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3}>Operations Staff</Title>
        </Col>
        <Col>
          <Space>
            <Input.Search
              placeholder='Search by name or email'
              onSearch={handleSearch}
              allowClear
              style={{ width: 250 }}
            />
            <Button
              type='primary'
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              Add New
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title='Total Operations Users' value={totalUsers} />
          </Card>
        </Col>
      </Row>

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh'
          }}
        >
          <Spin size='large' />
        </div>
      ) : (
        <Card>
          <Table
            columns={columns}
            dataSource={filteredStaff}
            rowKey='id'
            pagination={{ pageSize: 8 }}
          />
        </Card>
      )}

      {/* Add New Modal */}
      <Modal
        title={
          editingStaff ? 'Edit Operations Staff' : 'Add New Operations Staff'
        }
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false)
          setEditingStaff(null)
          form.resetFields()
        }}
        onOk={() => form.submit()}
        okText={editingStaff ? 'Update Staff' : 'Add Staff'}
      >
        <Form form={form} layout='vertical' onFinish={handleFinish}>
          {/* Full Name */}
          <Form.Item
            label='Full Name'
            name='name'
            rules={[{ required: true, message: 'Please enter full name' }]}
          >
            <Input placeholder='Enter full name' />
          </Form.Item>

          {/* Gender */}
          <Form.Item
            label='Gender'
            name='gender'
            rules={[{ required: true, message: 'Please select gender' }]}
          >
            <Select placeholder='Select gender'>
              <Option value='Male'>Male</Option>
              <Option value='Female'>Female</Option>
            </Select>
          </Form.Item>

          {/* Phone */}
          <Form.Item
            label='Phone Number'
            name='phone'
            rules={[{ required: true, message: 'Please enter phone number' }]}
          >
            <Input placeholder='Enter phone number' />
          </Form.Item>

          {/* Email */}
          <Form.Item
            label='Email Address'
            name='email'
            rules={[
              { required: true, message: 'Please enter email address' },
              { type: 'email', message: 'Enter a valid email address' }
            ]}
          >
            <Input placeholder='Enter email address' />
          </Form.Item>

          {/* Password */}
          <Form.Item
            label='Password'
            name='password'
            rules={[{ required: true, message: 'Please set a password' }]}
          >
            <Input.Password placeholder='Enter password' />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

export default OperationsOnboardingDashboard
