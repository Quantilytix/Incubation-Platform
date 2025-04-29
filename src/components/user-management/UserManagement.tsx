import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Tooltip,
  Input as AntdInput
} from 'antd'
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import {
  collection,
  query,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { db, auth } from '@/firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase' // your Firebase functions config

const { Search } = Input

interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'Active' | 'Inactive'
  createdAt?: string
}

// Predefined roles to choose from
const AVAILABLE_ROLES = [
  'Director',
  'Admin',
  'Operations',
  'Incubatee',
  'Funder',
  'Consultant',
  'Mentor'
]

export const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [searchText, setSearchText] = useState('')
  const [resetPasswordModalVisible, setResetPasswordModalVisible] =
    useState(false)
  const [resetPasswordEmail, setResetPasswordEmail] = useState('')
  const [form] = Form.useForm()

  // Fetch users from Firestore with real-time updates
  useEffect(() => {
    const q = query(collection(db, 'users'))

    setLoading(true)
    const unsubscribe = onSnapshot(
      q,
      querySnapshot => {
        try {
          const usersData = querySnapshot.docs.map(doc => {
            const data = doc.data()
            // Ensure createdAt has a default value if missing or invalid
            let createdAt = data.createdAt || new Date().toISOString()
            try {
              // Validate the date
              if (new Date(createdAt).toString() === 'Invalid Date') {
                createdAt = new Date().toISOString()
              }
            } catch (error) {
              createdAt = new Date().toISOString()
            }

            return {
              id: doc.id,
              ...data,
              createdAt,
              status: data.status || 'Active' // Default to Active if not set
            } as User
          })

          setUsers(usersData)
          setFilteredUsers(usersData)
          setLoading(false)
        } catch (error) {
          console.error('Error processing user data:', error)
          message.error('Failed to process user data. Please try again.')
          setLoading(false)
        }
      },
      error => {
        console.error('Error fetching users:', error)
        message.error('Failed to load users. Please try again.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Update filtered users when search text changes
  useEffect(() => {
    if (searchText) {
      const filtered = users.filter(
        user =>
          user.name.toLowerCase().includes(searchText.toLowerCase()) ||
          user.email.toLowerCase().includes(searchText.toLowerCase()) ||
          user.role.toLowerCase().includes(searchText.toLowerCase())
      )
      setFilteredUsers(filtered)
    } else {
      setFilteredUsers(users)
    }
  }, [searchText, users])

  // Handle modal visibility
  const showModal = (edit: boolean = false, user: User | null = null) => {
    setIsEditMode(edit)
    setCurrentUser(user)
    setIsModalVisible(true)

    if (edit && user) {
      form.setFieldsValue({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status === 'Active'
      })
    } else {
      form.resetFields()
      // Set default values for new user
      form.setFieldsValue({
        status: true // Active by default
      })
    }
  }

  // Handle form submission
  const handleSubmit = async (values: any) => {
    try {
      if (isEditMode && currentUser) {
        // Update existing user
        await updateDoc(doc(db, 'users', currentUser.id), {
          name: values.name,
          role: values.role,
          status: values.status ? 'Active' : 'Inactive',
          updatedAt: new Date().toISOString()
        })

        if (values.email !== currentUser.email) {
          message.info(
            'Email changes require the user to log in again for security reasons.'
          )
        }

        message.success('User updated successfully!')
      } else {
        // Create new user in Firebase Auth
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            values.email,
            values.password
          )

          const user = userCredential.user

          // Create corresponding Firestore document
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: values.name,
            email: values.email,
            role: values.role,
            status: values.status ? 'Active' : 'Inactive',
            company: '',
            companyCode: '',
            firstLoginComplete:
              values.role.toLowerCase() === 'director' ? false : true,
            createdAt: new Date().toISOString()
          })

          message.success('User created successfully!')
        } catch (authError: any) {
          console.error('Auth error:', authError)
          message.error(
            `Failed to create user: ${authError.message || 'Unknown error'}`
          )
          return // Prevent closing modal if failed
        }
      }

      setIsModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      console.error('Error saving user:', error)
      message.error(error.message || 'Failed to save user. Please try again.')
    }
  }

  // Handle user deletion
  const handleDelete = async (userId: string) => {
    try {
      const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount')
      await deleteUserAccount({ uid: userId })

      message.success('✅ User deleted from Auth and Firestore!')
    } catch (error: any) {
      console.error('Cloud function delete error:', error)
      message.error(error.message || 'Failed to delete user.')
    }
  }
  const handleAdminPasswordReset = async (userId: string) => {
    const newPassword = prompt('Enter new password for user:')
    if (!newPassword) return

    try {
      const adminResetUserPassword = httpsCallable(
        functions,
        'adminResetUserPassword'
      )
      await adminResetUserPassword({ uid: userId, newPassword })

      message.success('✅ Password reset successfully.')
    } catch (error: any) {
      console.error('Password reset error:', error)
      message.error(error.message || 'Failed to reset password.')
    }
  }

  // Show password reset confirmation
  const showResetPasswordModal = (email: string) => {
    setResetPasswordEmail(email)
    setResetPasswordModalVisible(true)
  }

  // Handle password reset
  const handlePasswordReset = async () => {
    try {
      await sendPasswordResetEmail(auth, resetPasswordEmail)
      message.success(`Password reset email sent to ${resetPasswordEmail}`)
      setResetPasswordModalVisible(false)
    } catch (error: any) {
      console.error('Error sending password reset:', error)
      message.error(
        `Failed to send password reset: ${error.message || 'Unknown error'}`
      )
    }
  }

  // Handle status change
  const toggleUserStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'Active' ? 'Inactive' : 'Active'
      await updateDoc(doc(db, 'users', user.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      })
      message.success(`User status changed to ${newStatus}`)
    } catch (error: any) {
      console.error('Error updating status:', error)
      message.error(
        `Failed to update status: ${error.message || 'Unknown error'}`
      )
    }
  }

  // Format date safely
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'

    try {
      const date = new Date(dateString)
      if (date.toString() === 'Invalid Date') return 'N/A'
      return date.toLocaleDateString()
    } catch (error) {
      return 'N/A'
    }
  }

  // Handle refresh
  const handleRefresh = () => {
    setLoading(true)
    // The snapshot listener will automatically refresh the data
    // This just triggers the loading state to give feedback to the user
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  // Table columns configuration
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: User, b: User) => a.name.localeCompare(b.name),
      width: '20%'
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      width: '25%'
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      filters: AVAILABLE_ROLES.map(role => ({ text: role, value: role })),
      onFilter: (value: any, record: User) => record.role === value,
      render: (role: string) => (
        <Tag
          color={
            role === 'Director'
              ? 'purple'
              : role === 'Admin'
              ? 'blue'
              : role === 'Operations'
              ? 'green'
              : role === 'Incubatee'
              ? 'orange'
              : role === 'Funder'
              ? 'gold'
              : role === 'Consultant'
              ? 'cyan'
              : 'default'
          }
        >
          {role}
        </Tag>
      ),
      width: '15%'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      filters: [
        { text: 'Active', value: 'Active' },
        { text: 'Inactive', value: 'Inactive' }
      ],
      onFilter: (value: any, record: User) => record.status === value,
      render: (status: string, record: User) => (
        <Popconfirm
          title={`Change user status to ${
            status === 'Active' ? 'Inactive' : 'Active'
          }?`}
          onConfirm={() => toggleUserStatus(record)}
          okText='Yes'
          cancelText='No'
        >
          <Tag
            color={status === 'Active' ? 'success' : 'error'}
            style={{ cursor: 'pointer' }}
          >
            {status}
          </Tag>
        </Popconfirm>
      ),
      width: '10%'
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => formatDate(date),
      sorter: (a: User, b: User) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return dateA - dateB
      },
      width: '15%'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space size='small'>
          <Tooltip title='Edit User'>
            <Button
              type='text'
              icon={<EditOutlined />}
              onClick={() => showModal(true, record)}
              size='small'
            />
          </Tooltip>

          <Tooltip title='Reset Password'>
            <Button
              type='text'
              icon={<LockOutlined />}
              onClick={() => showResetPasswordModal(record.email)}
              size='small'
            />
          </Tooltip>

          <Tooltip title='Reset Password (Admin)'>
            <Button
              type='text'
              icon={<LockOutlined />}
              onClick={() => handleAdminPasswordReset(record.id)}
              size='small'
            />
          </Tooltip>

          <Popconfirm
            title='Are you sure you want to delete this user?'
            description='This action cannot be undone.'
            onConfirm={() => handleDelete(record.id)}
            okText='Yes'
            cancelText='No'
            okButtonProps={{ danger: true }}
          >
            <Tooltip title='Delete User'>
              <Button
                type='text'
                icon={<DeleteOutlined />}
                danger
                size='small'
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
      width: '15%'
    }
  ]

  return (
    <div>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Button
          type='primary'
          icon={<UserAddOutlined />}
          onClick={() => showModal()}
        >
          Add User
        </Button>

        <Space>
          <Search
            placeholder='Search users by name, email or role'
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={value => setSearchText(value)}
            style={{ width: 300 }}
            allowClear
          />

          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            Refresh
          </Button>
        </Space>
      </div>

      <Table
        dataSource={filteredUsers}
        columns={columns}
        rowKey='id'
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
          showTotal: total => `Total ${total} users`
        }}
      />

      {/* User Create/Edit Modal */}
      <Modal
        title={isEditMode ? 'Edit User' : 'Create New User'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        maskClosable={false}
      >
        <Form form={form} layout='vertical' onFinish={handleSubmit}>
          <Form.Item
            name='name'
            label='Name'
            rules={[{ required: true, message: "Please enter user's name" }]}
          >
            <Input placeholder='Enter full name' />
          </Form.Item>

          <Form.Item
            name='email'
            label='Email'
            rules={[
              { required: true, message: "Please enter user's email" },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              placeholder='Enter email address'
              disabled={isEditMode} // Cannot change email for existing users through this interface
            />
          </Form.Item>

          {!isEditMode && (
            <Form.Item
              name='password'
              label='Password'
              rules={[
                { required: true, message: 'Please enter a password' },
                { min: 6, message: 'Password must be at least 6 characters' }
              ]}
            >
              <Input.Password placeholder='Enter password' />
            </Form.Item>
          )}

          <Form.Item
            name='role'
            label='Role'
            rules={[{ required: true, message: 'Please select a role' }]}
          >
            <Select placeholder='Select role'>
              {AVAILABLE_ROLES.map(role => (
                <Select.Option key={role} value={role}>
                  {role}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name='status' label='Status' valuePropName='checked'>
            <Switch checkedChildren='Active' unCheckedChildren='Inactive' />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit'>
                {isEditMode ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Password Reset Confirmation Modal */}
      <Modal
        title='Reset Password'
        open={resetPasswordModalVisible}
        onCancel={() => setResetPasswordModalVisible(false)}
        onOk={handlePasswordReset}
        okText='Send Reset Email'
        cancelText='Cancel'
      >
        <p>Are you sure you want to send a password reset email to:</p>
        <p style={{ fontWeight: 'bold' }}>{resetPasswordEmail}</p>
        <p>
          The user will receive an email with instructions to reset their
          password.
        </p>
      </Modal>
    </div>
  )
}
