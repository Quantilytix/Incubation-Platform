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
  Spin
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
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDoc
} from 'firebase/firestore'

import { auth, db } from '@/firebase'
import { getAuth } from 'firebase/auth'
import dayjs from 'dayjs'
import { Helmet } from 'react-helmet'

const { Title } = Typography

const { Text } = Typography

const ProgramManager: React.FC = () => {
  const [programs, setPrograms] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
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

  const user = auth.currentUser

  useEffect(() => {
    const fetchUserCompanyCodeAndRole = async () => {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
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
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'programs'))
      const all = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      const filtered = all.filter(p => p.companyCode === companyCode)
      setPrograms(filtered)
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

  const handleAddProgram = async (values: any) => {
    try {
      if (!companyCode) {
        message.error('Company code not set')
        return
      }

      const payload = {
        ...values,
        companyCode,
        status: values.status || 'Active',
        startDate: values.startDate?.toDate?.() || null,
        endDate: values.endDate?.toDate?.() || null,
        registrationLink: `/registration?code=${companyCode}`,
        assignedAdmin: values.assignedAdmin || null
      }

      const docRef = await addDoc(collection(db, 'programs'), {
        ...payload,
        cohortYear:
          values.cohortYear || dayjs(values.startDate).year() || dayjs().year(), // fallback
        description: values.description || ''
      })

      // Update to include the generated ID inside the document itself
      await updateDoc(docRef, {
        id: docRef.id
      })

      if (values.assignedAdmin) {
        const selectedAdmin = consultantOptions.find(
          user => user.id === values.assignedAdmin
        )

        await addDoc(collection(db, 'notifications'), {
          type: 'program-assignment',
          createdAt: new Date(),
          readBy: {},
          recipientIds: [values.assignedAdmin],
          recipientRoles: ['consultant'],
          message: {
            consultant: `You have been assigned as the project admin for "${
              values.name
            }". Start: ${dayjs(payload.startDate).format(
              'YYYY-MM-DD'
            )}, End: ${dayjs(payload.endDate).format('YYYY-MM-DD')}`
          }
        })
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
  const handleUpdateProgram = async (values: any) => {
    if (!selectedProgram) return

    const payload = {
      ...selectedProgram,
      ...values,
      startDate: values.startDate?.toDate?.() || null,
      endDate: values.endDate?.toDate?.() || null
    }

    try {
      const ref = doc(db, 'programs', selectedProgram.id)
      await updateDoc(ref, payload)

      // Send notification if assigned admin was added/changed
      if (
        values.assignedAdmin &&
        values.assignedAdmin !== selectedProgram.assignedAdmin
      ) {
        const assignedUser = consultantOptions.find(
          u => u.id === values.assignedAdmin
        )
        if (assignedUser) {
          await addDoc(collection(db, 'notifications'), {
            type: 'program-assignment',
            createdAt: new Date(),
            readBy: {},
            recipientIds: [assignedUser.id],
            recipientRoles: ['consultant'],
            message: {
              consultant: `You have been assigned as the project admin for "${
                values.name
              }". Start: ${dayjs(values.startDate).format(
                'YYYY-MM-DD'
              )}, End: ${dayjs(values.endDate).format('YYYY-MM-DD')}`
            }
          })
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

      <Spin spinning={loading} tip='Loading programs...'>
        <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
          <Title level={4}>Incubation Programs</Title>

          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Total Programs'
                  value={totalPrograms}
                  prefix={<ProjectOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Active Programs'
                  value={activePrograms}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#3f8600' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Total Budget'
                  value={totalBudget}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card>
                <Statistic
                  title='Total Capacity'
                  value={totalCapacity}
                  prefix={<TeamOutlined />}
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
                <Tag color={status === 'Active' ? 'green' : 'red'}>
                  {status}
                </Tag>
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
                <Text strong>
                  <a href={link} target='_blank' rel='noopener noreferrer'>
                    Link
                  </a>
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
                      setEditModalVisible(true)
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
            onCancel={() => setModalVisible(false)}
            footer={null}
          >
            <Form layout='vertical' form={form} onFinish={handleAddProgram}>
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
                <Input placeholder='e.g., Active, Completed, Upcoming' />
              </Form.Item>
              <Form.Item
                name='cohortYear'
                label='Cohort Year'
                rules={[
                  { required: true, message: 'Please input the cohort year' }
                ]}
              >
                <Input placeholder='e.g., 2025' />
              </Form.Item>

              <Form.Item name='startDate' label='Start Date'>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name='endDate' label='End Date'>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
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
                  Add Program
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </div>
      </Spin>
      <Modal
        open={editModalVisible}
        title='Edit Program'
        onCancel={() => setEditModalVisible(false)}
        footer={null}
      >
        <Form
          layout='vertical'
          form={editForm}
          onFinish={handleUpdateProgram}
          initialValues={selectedProgram}
        >
          <Form.Item
            name='name'
            label='Program Name'
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name='description' label='Program Description'>
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
          <Form.Item name='cohortYear' label='Cohort Year'>
            <Input />
          </Form.Item>
          <Form.Item name='startDate' label='Start Date'>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name='endDate' label='End Date'>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
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
              Save Changes
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default ProgramManager
