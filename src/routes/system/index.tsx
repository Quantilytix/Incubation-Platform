import React, { useState, useEffect } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  UnorderedListOutlined,
  DollarOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { motion } from 'framer-motion'

const { Option } = Select

const SystemSetupForm: React.FC = () => {
  const [setupType, setSetupType] = useState<'intervention' | 'expense'>(
    'intervention'
  )
  const [interventions, setInterventions] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingRecord, setEditingRecord] = useState<any | null>(null)
  const [form] = Form.useForm()
  const { user, loading: identityLoading } = useFullIdentity()
  const [companyCode, setCompanyCode] = useState<string>('')

  useEffect(() => {
    if (!identityLoading && user?.companyCode) {
      setCompanyCode(user.companyCode)
      fetchAll(user.companyCode)
    }
  }, [identityLoading, user?.companyCode])

  const fetchAll = async (code?: string) => {
    const resolvedCode = code || companyCode

    if (!resolvedCode) {
      console.warn('Company code not available for fetching data.')
      return
    }

    setLoading(true)
    try {
      const [intSnap, expSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'interventions'),
            where('companyCode', '==', resolvedCode)
          )
        ),
        getDocs(
          query(
            collection(db, 'expenseTypes'),
            where('companyCode', '==', resolvedCode)
          )
        )
      ])
      setInterventions(intSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setExpenses(expSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (error) {
      console.error(error)
      message.error('Error fetching data')
    } finally {
      setLoading(false)
    }
  }

  const metrics = [
    {
      title: 'Interventions',
      value: interventions.length,
      icon: <UnorderedListOutlined style={{ fontSize: 24, color: '#3f8600' }} />
    },
    {
      title: 'Expense Types',
      value: expenses.length,
      icon: <DollarOutlined style={{ fontSize: 24, color: '#cf1322' }} />
    }
  ]

  const columns =
    setupType === 'intervention'
      ? [
          { title: 'Area', dataIndex: 'areaOfSupport', key: 'areaOfSupport' },
          {
            title: 'Title',
            dataIndex: 'interventionTitle',
            key: 'interventionTitle'
          },
          {
            title: 'Compulsory',
            dataIndex: 'isCompulsory',
            key: 'isCompulsory',
            render: value => (value === 'yes' ? '✅' : '❌')
          },
          {
            title: 'Recurring',
            dataIndex: 'isRecurring',
            key: 'isRecurring',
            render: value => (value === 'yes' ? '♻️' : '—')
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: ts => dayjs(ts).format('YYYY-MM-DD')
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Button
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            )
          }
        ]
      : [
          { title: 'Name', dataIndex: 'name', key: 'name' },
          { title: 'Budget (ZAR)', dataIndex: 'budget', key: 'budget' },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: ts => dayjs(ts).format('YYYY-MM-DD')
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Button
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            )
          }
        ]

  const dataSource = setupType === 'intervention' ? interventions : expenses

  const openEdit = (record: any) => {
    setEditingRecord(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const openAdd = () => {
    setEditingRecord(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleFinish = async (values: any) => {
    setLoading(true)
    try {
      // Add companyCode to all values
      const baseValues = {
        ...values,
        companyCode,
        createdAt: new Date().toISOString()
      }

      if (editingRecord) {
        const ref = doc(
          db,
          setupType === 'intervention' ? 'interventions' : 'expenseTypes',
          editingRecord.id
        )
        await updateDoc(ref, baseValues)
        message.success('Updated successfully')
      } else {
        await addDoc(
          collection(
            db,
            setupType === 'intervention' ? 'interventions' : 'expenseTypes'
          ),
          baseValues
        )
        message.success('Created successfully')
      }
      await fetchAll(companyCode)
      setModalVisible(false)
    } catch (error) {
      console.error(error)
      message.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {metrics.map(m => (
          <Col span={12} key={m.title}>
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
              {' '}
              <Card
                hoverable
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
              >
                <Statistic title={m.title} value={m.value} prefix={m.icon} />
              </Card>
            </motion.div>
          </Col>
        ))}
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
          title={
            <Row justify='space-between'>
              <Col>
                <Select
                  value={setupType}
                  onChange={setSetupType}
                  style={{ width: 200 }}
                >
                  <Option value='intervention'>Interventions</Option>
                  <Option value='expense'>Expense Types</Option>
                </Select>
              </Col>
              <Col>
                <Button
                  type='primary'
                  icon={<PlusOutlined />}
                  onClick={openAdd}
                >
                  Add New Setup
                </Button>
              </Col>
            </Row>
          }
          hoverable
          style={{
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            transition: 'all 0.3s ease',
            borderRadius: 8,
            border: '1px solid #d6e4ff'
          }}
        >
          <Table
            columns={columns}
            dataSource={dataSource}
            rowKey='id'
            loading={loading}
          />
        </Card>
      </motion.div>
      <Modal
        visible={modalVisible}
        title={
          editingRecord
            ? `Edit ${
                setupType === 'intervention' ? 'Intervention' : 'Expense Type'
              }`
            : `Add ${
                setupType === 'intervention' ? 'Intervention' : 'Expense Type'
              }`
        }
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form layout='vertical' form={form} onFinish={handleFinish}>
          {setupType === 'intervention' ? (
            <>
              <Form.Item
                name='areaOfSupport'
                label='Area of Support'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Marketing, Finance' />
              </Form.Item>
              <Form.Item
                name='interventionTitle'
                label='Intervention Title'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Website Development' />
              </Form.Item>
              <Form.Item
                name='isCompulsory'
                label='Is this intervention compulsory?'
                rules={[{ required: true }]}
              >
                <Select placeholder='Select an option'>
                  <Option value='yes'>Yes</Option>
                  <Option value='no'>No</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name='isRecurring'
                label='Is this intervention recurring?'
                rules={[{ required: true }]}
              >
                <Select placeholder='Select an option'>
                  <Option value='yes'>Yes</Option>
                  <Option value='no'>No</Option>
                </Select>
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name='name'
                label='Expense Name'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Travel, Supplies' />
              </Form.Item>
              <Form.Item
                name='budget'
                label='Default Budget (ZAR)'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
          <Form.Item>
            <Button type='primary' htmlType='submit' loading={loading}>
              {editingRecord ? 'Update' : 'Save'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SystemSetupForm
