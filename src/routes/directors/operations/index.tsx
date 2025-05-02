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
  message
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
  const navigate = useNavigate()
  const { user, loading: identityLoading } = useFullIdentity()

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
      // Step 1: Create a new user in Firebase Authentication
      const { email, password, name } = values
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      )
      const firebaseUser = userCredential.user

      if (!firebaseUser) {
        throw new Error('Failed to create user in Firebase Authentication.')
      }

      // Step 2: Add the user details to the `users` collection
      const newUserDetails = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        name,
        role: 'operations', // Assign a role for operations staff
        companyCode,
        createdAt: new Date()
      }

      await setDoc(doc(db, 'users', firebaseUser.uid), newUserDetails)

      // Step 3: Add the user details to the `operationsStaff` collection
      const newOperationsStaff = {
        ...values,
        companyCode,
        createdAt: new Date()
      }

      await addDoc(collection(db, 'operationsStaff'), newOperationsStaff)

      // Success message
      message.success('Operations Staff added successfully!')
      form.resetFields()
      setAddModalVisible(false)
      fetchOperationsStaff(companyCode)
    } catch (error: any) {
      console.error('Error adding operations staff:', error)
      if (error.code === 'auth/email-already-in-use') {
        message.error(
          'This email is already in use. Please use a different email.'
        )
      } else {
        message.error('Failed to add operations staff.')
      }
    }
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
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone'
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender'
    },
    {
      title: 'Company Code',
      dataIndex: 'companyCode',
      key: 'companyCode'
    }
  ]

  const totalUsers = operationsStaff.length

  return (
    <div style={{ padding: 24 }}>
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
        title='Add New Operations Staff'
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onOk={() => form.submit()}
        okText='Add Staff'
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

          {/* Company Code */}
          <Form.Item label='Company Code'>
            <Input value={companyCode} disabled />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OperationsOnboardingDashboard
