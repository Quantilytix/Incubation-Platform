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
  PlusOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { getAuth } from 'firebase/auth'

const { Title } = Typography

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

  const user = auth.currentUser

  useEffect(() => {
    const fetchUserCompanyCode = async () => {
      if (user?.uid) {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)
        if (userSnap.exists()) {
          const userData = userSnap.data()
          setCompanyCode(userData.companyCode || '')
        }
      }
    }

    fetchUserCompanyCode()
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

      await addDoc(collection(db, 'programs'), {
        ...values,
        companyCode,
        status: values.status || 'Active'
      })
      message.success('Program added successfully')
      fetchPrograms()
      setModalVisible(false)
      form.resetFields()
    } catch (err) {
      message.error('Failed to add program')
      console.error(err)
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
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Add Program
          </Button>
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
          <Table.Column title='Type' dataIndex='type' />
          <Table.Column
            title='Status'
            dataIndex='status'
            render={status => (
              <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
            )}
          />
          <Table.Column title='Start Date' dataIndex='startDate' />
          <Table.Column title='End Date' dataIndex='endDate' />
          <Table.Column
            title='Actions'
            key='actions'
            render={(_, record) => (
              <Button
                onClick={() => toggleStatus(record)}
                loading={togglingProgramId === record.id}
              >
                {record.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>
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
            <Form.Item name='type' label='Type'>
              <Input />
            </Form.Item>
            <Form.Item name='status' label='Status'>
              <Input placeholder='e.g., Active, Completed, Upcoming' />
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

            <Form.Item>
              <Button type='primary' htmlType='submit' block>
                Add Program
              </Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Spin>
  )
}

export default ProgramManager
