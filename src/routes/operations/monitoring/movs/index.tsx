// ✅ Imports
import React, { useEffect, useState } from 'react'
import {
  Table,
  Modal,
  Button,
  Typography,
  message,
  Space,
  Card,
  Row,
  Col,
  Select,
  Statistic,
  Alert,
  Dropdown,
  Timeline
} from 'antd'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc
} from 'firebase/firestore'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import {
  FileDoneOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MoreOutlined
} from '@ant-design/icons'
import { motion } from 'framer-motion'

const { Title, Text } = Typography
const { Option } = Select

// 🔹 Step labels for timeline
const stepLabels: Record<string, string> = {
  hod_approval: 'HOD Approval',
  validation: 'M&E / PM Validation',
  final_confirmation: 'Center Coordinator Confirmation'
}

const MonitoringMOVApprovals: React.FC = () => {
  const { user } = useFullIdentity()
  const [movs, setMovs] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedDept, setSelectedDept] = useState<string>('all')
  const [poesModalVisible, setPoesModalVisible] = useState(false)
  const [timelineModalVisible, setTimelineModalVisible] = useState(false)
  const [poeResources, setPoeResources] = useState<any[]>([])

  // 🔹 Determine step for this role
  const stepMap: Record<string, string> = {
    operations: 'validation', // M&E validations
    projectmanager: 'validation',
    projectadmin: 'final_confirmation'
  }
  const roleStep = stepMap[user?.role?.toLowerCase() || ''] || ''

  // 🔹 Fetch MOVs
  const fetchMOVs = async () => {
    if (!user?.companyCode) return
    setLoading(true)
    try {
      const q = query(
        collection(db, 'consolidatedMOVs'),
        where('companyCode', '==', user.companyCode)
      )
      const snap = await getDocs(q)
      const allData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Client-side filter: only show MOVs missing this step
      const filteredData = roleStep
        ? allData.filter(
            mov => !(mov.approvals || []).some((a: any) => a.step === roleStep)
          )
        : allData

      setMovs(filteredData)
      setFiltered(filteredData)
    } catch (err) {
      message.error('Failed to fetch MOVs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMOVs()
  }, [user?.companyCode])

  // 🔹 Approve MOV
  const handleValidate = async () => {
    if (!selected || !roleStep) return
    try {
      await updateDoc(doc(db, 'consolidatedMOVs', selected.id), {
        approvals: [
          ...(selected.approvals || []),
          { step: roleStep, name: user.name, role: user.role, date: new Date() }
        ]
      })
      message.success('✅ MOV approved successfully.')
      setModalVisible(false)
      fetchMOVs()
    } catch (err) {
      message.error('❌ Failed to approve MOV')
    }
  }

  // 🔹 View POEs
  const handleViewPOEs = async (mov: any) => {
    try {
      const interventionIds: string[] = mov?.interventions
        ?.map((i: any) => i?.id)
        ?.filter((id: any) => typeof id === 'string')

      if (!interventionIds?.length) {
        message.warning('No POEs found for this MOV.')
        return
      }

      const q = query(
        collection(db, 'interventionsDatabase'),
        where('interventionId', 'in', interventionIds.slice(0, 10))
      )

      const snap = await getDocs(q)
      const allResources: any[] = []
      snap.forEach(doc => {
        const data = doc.data()
        if (Array.isArray(data.resources)) {
          allResources.push(...data.resources)
        }
      })

      setPoeResources(allResources)
      setPoesModalVisible(true)
    } catch (err) {
      message.error('Failed to fetch POEs')
    }
  }

  // 🔹 Department filter
  const handleFilter = (dept: string) => {
    setSelectedDept(dept)
    if (dept === 'all') return setFiltered(movs)
    const result = movs.filter(mov =>
      mov.interventions?.some((i: any) => i.departmentName === dept)
    )
    setFiltered(result)
  }

  const columns = [
    { title: 'Month', dataIndex: 'month' },
    { title: 'Department', dataIndex: 'departmentName' },
    {
      title: 'Status',
      render: (record: any) => {
        if (record.approvals?.some((a: any) => a.step === 'final_confirmation'))
          return 'CC Approved'
        if (record.approvals?.some((a: any) => a.step === 'validation'))
          return 'M&E/PM Approved'
        if (record.approvals?.some((a: any) => a.step === 'hod_approval'))
          return 'HOD Approved'
        return 'Pending'
      }
    },
    {
      title: 'Actions',
      render: (_: any, record: any) => {
        const menuItems = [
          {
            key: 'review',
            label: 'Review',
            onClick: () => {
              setSelected(record)
              setModalVisible(true)
            }
          },
          {
            key: 'poes',
            label: 'View POEs',
            onClick: () => handleViewPOEs(record)
          },
          {
            key: 'timeline',
            label: 'View Timeline',
            onClick: () => {
              setSelected(record)
              setTimelineModalVisible(true)
            }
          }
        ]
        return (
          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        )
      }
    }
  ]

  const approvedCount = filtered.length
  const uniqueDepartments = Array.from(
    new Set(
      movs
        .flatMap(m => m.interventions?.map((i: any) => i.departmentName))
        .filter(Boolean)
    )
  )

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      {/* 🔹 Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            icon: (
              <FileDoneOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            ),
            title: 'Pending MOVs',
            value: approvedCount
          },
          {
            icon: (
              <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
            ),
            title: 'Departments',
            value: uniqueDepartments.length
          },
          {
            icon: (
              <ExclamationCircleOutlined
                style={{ fontSize: 24, color: '#fa8c16' }}
              />
            ),
            title: 'Total MOVs (All Depts)',
            value: movs.length
          }
        ].map((stat, i) => (
          <Col xs={24} sm={8} key={i}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Card>
                <Space>
                  {stat.icon}
                  <Statistic title={stat.title} value={stat.value} />
                </Space>
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      <Alert
        type='info'
        showIcon
        message={
          user?.role?.toLowerCase() === 'operations'
            ? 'Please verify MOV contents before validating. Only documents approved by HODs appear here.'
            : user?.role?.toLowerCase() === 'projectadmin'
            ? 'Please verify MOV contents before confirming. Only documents validated by M&E appear here for your confirmation.'
            : 'Please verify MOV contents before taking action.'
        }
        style={{ marginBottom: 16 }}
      />

      {/* 🔹 Filters */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Select
            value={selectedDept}
            onChange={handleFilter}
            style={{ width: '100%' }}
          >
            <Option value='all'>All Departments</Option>
            {uniqueDepartments.map(dep => (
              <Option key={dep} value={dep}>
                {dep}
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={6}>
          <Select
            placeholder='Filter by Month'
            onChange={month => {
              const filteredByMonth = movs.filter(m => m.month === month)
              setFiltered(
                selectedDept === 'all'
                  ? filteredByMonth
                  : filteredByMonth.filter(m =>
                      m.interventions?.some(
                        (i: any) => i.departmentName === selectedDept
                      )
                    )
              )
            }}
            style={{ width: '100%' }}
          >
            {[...new Set(movs.map(m => m.month))].map(m => {
              const formatted = dayjs(m, ['YYYY-MM', 'YYYY-MM-DD']).isValid()
                ? dayjs(m, ['YYYY-MM', 'YYYY-MM-DD']).format('MMM YYYY')
                : m
              return (
                <Option key={m} value={m}>
                  {formatted}
                </Option>
              )
            })}
          </Select>
        </Col>
      </Row>

      {/* 🔹 Main Table */}
      <Table
        rowKey='id'
        dataSource={filtered}
        columns={columns}
        loading={loading}
        pagination={{ pageSize: 5 }}
      />

      {/* 🔹 Review Modal */}
      <Modal
        open={modalVisible}
        title='📝 Review MOV'
        onCancel={() => setModalVisible(false)}
        width={900}
        onOk={handleValidate}
        okText={
          user?.role?.toLowerCase() === 'projectadmin' ? 'Confirm' : 'Validate'
        }
      >
        <Alert
          type='warning'
          message={
            user?.role?.toLowerCase() === 'projectadmin'
              ? 'By confirming, you acknowledge the submitted information is truthful.'
              : 'By validating, you confirm the submitted information is truthful.'
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
        {selected?.invoiceAttachment && (
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Button
              type='primary'
              icon={<FileDoneOutlined />}
              onClick={() => window.open(selected.invoiceAttachment, '_blank')}
            >
              View Invoice
            </Button>
          </div>
        )}
        {selected?.interventions?.map((mov: any, i: number) => (
          <div key={i} style={{ marginBottom: 32, textAlign: 'center' }}>
            <Title level={4}>{mov.beneficiaryName}</Title>
            <Text strong>{mov.departmentName}</Text>
            <br />
            <Text strong>{mov.programName}</Text>
            <Table
              bordered
              size='small'
              pagination={false}
              style={{ marginTop: 16 }}
              dataSource={[mov]}
              columns={[
                { title: 'Intervention', dataIndex: 'interventionTitle' },
                {
                  title: 'Date Completed',
                  dataIndex: 'interventionDate',
                  render: (val: any) =>
                    dayjs(val?.toDate?.()).format('YYYY-MM-DD')
                },
                { title: 'Consultant', dataIndex: 'facilitatorName' },
                {
                  title: 'Consultant Signature',
                  dataIndex: 'digitalSignature',
                  render: (val: string) =>
                    val ? <img src={val} height={40} /> : 'N/A'
                }
              ]}
            />
            <Space
              style={{ marginTop: 24, justifyContent: 'center', width: '100%' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 32,
                  gap: '200px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <Text strong>Incubatee: {mov.beneficiaryName}</Text>
                  <br />
                  Signature: ___________________
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <Text strong>HOD: {selected.opsName || 'N/A'}</Text>
                  <br />
                  Signature: {selected.opsSignature || 'N/A'}
                </div>
              </div>
            </Space>
          </div>
        ))}
      </Modal>

      {/* 🔹 Timeline Modal */}
      <Modal
        open={timelineModalVisible}
        onCancel={() => setTimelineModalVisible(false)}
        footer={null}
        title='📅 Approval Timeline'
      >
        <Timeline>
          {['hod_approval', 'validation', 'final_confirmation'].map(step => {
            const entry = selected?.approvals?.find((a: any) => a.step === step)
            return (
              <Timeline.Item key={step} color={entry ? 'green' : 'gray'}>
                {stepLabels[step]} — {entry?.name || 'Pending'} (
                {entry?.role || ''})
              </Timeline.Item>
            )
          })}
        </Timeline>
      </Modal>

      {/* 🔹 POEs Modal */}
      <Modal
        open={poesModalVisible}
        onCancel={() => setPoesModalVisible(false)}
        footer={null}
        title='📎 Intervention POEs'
      >
        {poeResources.length ? (
          <ul>
            {poeResources.map((res, index) => (
              <li key={index}>
                <a href={res.link} target='_blank' rel='noopener noreferrer'>
                  {res.label || res.type || 'Resource'}
                </a>{' '}
                ({res.type})
              </li>
            ))}
          </ul>
        ) : (
          <Text type='secondary'>No POEs uploaded for this intervention.</Text>
        )}
      </Modal>
    </div>
  )
}

export default MonitoringMOVApprovals
