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
  Tooltip
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
  where,
  onSnapshot,
  doc,
  setDoc,
  updateDoc
} from 'firebase/firestore'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { db, auth, functions } from '@/firebase'
import { httpsCallable } from 'firebase/functions'

const { Search } = Input

interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'Active' | 'Inactive'
  createdAt?: string
}

const AVAILABLE_ROLES = [
  'Director',
  'Admin',
  'Operations',
  'Incubatee',
  'Funder',
  'Consultant',
  'Mentor'
]

export const UserManagement: React.FC<{ companyCode: string }> = ({ companyCode }) => {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [searchText, setSearchText] = useState('')
  const [resetPasswordModalVisible, setResetPasswordModalVisible] = useState(false)
  const [resetPasswordEmail, setResetPasswordEmail] = useState('')
  const [form] = Form.useForm()

  useEffect(() => {
    if (!companyCode) return

    const q = query(collection(db, 'users'), where('companyCode', '==', companyCode))

    setLoading(true)
    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const userList = snapshot.docs.map(doc => {
          const data = doc.data()
          let createdAt = data.createdAt || new Date().toISOString()
          if (new Date(createdAt).toString() === 'Invalid Date') {
            createdAt = new Date().toISOString()
          }

          return {
            id: doc.id,
            ...data,
            createdAt,
            status: data.status || 'Active'
          } as User
        })

        setUsers(userList)
        setFilteredUsers(userList)
        setLoading(false)
      },
      error => {
        console.error(error)
        message.error('Failed to load users.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [companyCode])

  useEffect(() => {
    if (searchText) {
      setFilteredUsers(
        users.filter(u =>
          [u.name, u.email, u.role].some(field =>
            field.toLowerCase().includes(searchText.toLowerCase())
          )
        )
      )
    } else {
      setFilteredUsers(users)
    }
  }, [searchText, users])

  const showModal = (edit = false, user: User | null = null) => {
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
      form.setFieldsValue({ status: true })
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (isEditMode && currentUser) {
        await updateDoc(doc(db, 'users', currentUser.id), {
          name: values.name,
          role: values.role,
          status: values.status ? 'Active' : 'Inactive',
          updatedAt: new Date().toISOString()
        })

        message.success('User updated!')
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          values.email,
          values.password
        )

        const newUser = userCredential.user

        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          name: values.name,
          email: values.email,
          role: values.role,
          status: values.status ? 'Active' : 'Inactive',
          companyCode,
          createdAt: new Date().toISOString(),
          firstLoginComplete: values.role === 'Director' ? false : true
        })

        message.success('User created!')
      }

      setIsModalVisible(false)
      form.resetFields()
    } catch (error: any) {
      console.error(error)
      message.error(error.message || 'Operation failed')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const fn = httpsCallable(functions, 'deleteUserAccount')
      await fn({ uid: id })
      message.success('User deleted')
    } catch (error: any) {
      console.error(error)
      message.error(error.message || 'Failed to delete')
    }
  }

  const handleAdminPasswordReset = async (id: string) => {
    const newPassword = prompt('Enter new password:')
    if (!newPassword) return
    try {
      const resetFn = httpsCallable(functions, 'adminResetUserPassword')
      await resetFn({ uid: id, newPassword })
      message.success('Password reset!')
    } catch (err: any) {
      message.error(err.message || 'Failed to reset password')
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag>{role}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => showModal(true, record)}
            type="text"
          />
          <Button
            icon={<LockOutlined />}
            onClick={() => handleAdminPasswordReset(record.id)}
            type="text"
          />
          <Popconfirm
            title="Are you sure?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} type="text" danger />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => showModal()}>
          Add User
        </Button>
        <Search
          placeholder="Search users"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onSearch={value => setSearchText(value)}
          allowClear
          style={{ width: 300 }}
        />
      </div>

      <Table
        dataSource={filteredUsers}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        title={isEditMode ? 'Edit User' : 'Add User'}
      >
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email' }]}
          >
            <Input disabled={isEditMode} />
          </Form.Item>
          {!isEditMode && (
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, min: 6 }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select>
              {AVAILABLE_ROLES.map(role => (
                <Select.Option key={role} value={role}>
                  {role}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {isEditMode ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
