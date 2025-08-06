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
  DollarOutlined,
  DeleteOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  deleteDoc
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
  const [filters, setFilters] = useState({
    area: '',
    title: '',
    compulsory: ''
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

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
              <Button.Group>
                <Button
                  icon={<EditOutlined />}
                  onClick={() => openEdit(record)}
                />
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  onClick={() => deleteIntervention(record.id)}
                />
              </Button.Group>
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

        // ✅ If updating an intervention, update its title in all relevant applications
        if (setupType === 'intervention') {
          const appsSnap = await getDocs(collection(db, 'applications'))

          for (const appDoc of appsSnap.docs) {
            const appData = appDoc.data()
            const required = appData.interventions?.required || []

            const updatedRequired = required.map((item: any) => {
              if (typeof item === 'string' && item === editingRecord.id) {
                // Replace string with full object
                return {
                  id: item,
                  title: baseValues.interventionTitle,
                  area: baseValues.areaOfSupport
                }
              }

              if (typeof item === 'object' && item.id === editingRecord.id) {
                // Update object
                return {
                  ...item,
                  title: baseValues.interventionTitle,
                  area: baseValues.areaOfSupport
                }
              }

              return item
            })

            const hasChanged =
              JSON.stringify(required) !== JSON.stringify(updatedRequired)
            if (hasChanged) {
              await updateDoc(doc(db, 'applications', appDoc.id), {
                'interventions.required': updatedRequired
              })
              console.log(`✅ Synced updated title to application ${appDoc.id}`)
            }
          }
        }

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

  const deleteIntervention = async (interventionId: string) => {
    setLoading(true)
    try {
      // Delete intervention
      await deleteDoc(doc(db, 'interventions', interventionId))

      // Go through all applications and remove from required
      const appsSnap = await getDocs(collection(db, 'applications'))
      for (const appDoc of appsSnap.docs) {
        const appData = appDoc.data()
        const required = appData.interventions?.required || []

        const filtered = required.filter(
          (item: any) => item.id !== interventionId
        )

        // Only update if something was removed
        if (filtered.length !== required.length) {
          await updateDoc(doc(db, 'applications', appDoc.id), {
            'interventions.required': filtered
          })
          console.log(`🧹 Removed from application ${appDoc.id}`)
        }
      }

      message.success('Intervention deleted.')
      await fetchAll(companyCode)
    } catch (err) {
      console.error(err)
      message.error('Failed to delete intervention')
    } finally {
      setLoading(false)
    }
  }

  const filteredData = interventions.filter(item => {
    const areaMatch = item.areaOfSupport
      ?.toLowerCase()
      .includes(filters.area.toLowerCase())
    const titleMatch = item.interventionTitle
      ?.toLowerCase()
      .includes(filters.title.toLowerCase())
    const compulsoryMatch = filters.compulsory
      ? item.isCompulsory === filters.compulsory
      : true
    return areaMatch && titleMatch && compulsoryMatch
  })

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
              {setupType === 'intervention' && (
                <Row gutter={8}>
                  <Col>
                    <Input
                      allowClear
                      placeholder='Filter by Area'
                      value={filters.area}
                      onChange={e => handleFilterChange('area', e.target.value)}
                    />
                  </Col>
                  <Col>
                    <Input
                      allowClear
                      placeholder='Filter by Title'
                      value={filters.title}
                      onChange={e =>
                        handleFilterChange('title', e.target.value)
                      }
                    />
                  </Col>
                  <Col>
                    <Select
                      allowClear
                      placeholder='Compulsory?'
                      value={filters.compulsory}
                      onChange={value =>
                        handleFilterChange('compulsory', value)
                      }
                      style={{ width: 150 }}
                    >
                      <Option value='yes'>Yes</Option>
                      <Option value='no'>No</Option>
                    </Select>
                  </Col>
                </Row>
              )}

              <Col>
                <Button
                  type='primary'
                  icon={<PlusOutlined />}
                  onClick={openAdd}
                  style={{ marginLeft: 10 }}
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
            dataSource={setupType === 'intervention' ? filteredData : expenses}
            rowKey='id'
            loading={loading}
          />
        </Card>
      </motion.div>
      <Modal
        open={modalVisible}
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
