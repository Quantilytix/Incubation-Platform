import React, { useEffect, useState } from 'react'
import {
  Table,
  Tag,
  Space,
  Typography,
  Divider,
  Select,
  Card,
  Row,
  Col,
  notification,
  Button,
  Modal
} from 'antd'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
import dayjs from 'dayjs'

const { Text } = Typography
const { Option } = Select

const InterventionDatabaseView = () => {
  const [records, setRecords] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [programOptions, setProgramOptions] = useState<string[]>([])
  const [filters, setFilters] = useState({
    programId: 'all',
    type: 'all',
    area: 'all'
  })
  const [programMap, setProgramMap] = useState<{ [key: string]: string }>({})
  const [participantMap, setParticipantMap] = useState<{
    [key: string]: string
  }>({})
  const [consultantMap, setConsultantMap] = useState<{ [key: string]: string }>(
    {}
  )
  const [consultantRates, setConsultantRates] = useState<{
    [key: string]: number
  }>({})
  const [selectedView, setSelectedView] = useState<any | null>(null)

  useEffect(() => {
    const fetchConsultants = async () => {
      const snapshot = await getDocs(collection(db, 'consultants'))
      const rateMap: any = {}
      snapshot.forEach(doc => {
        const data = doc.data()
        rateMap[doc.id] = data.rate || 0 // assumes `rate` field in consultant doc
      })
      setConsultantRates(rateMap)
    }

    fetchConsultants()
  }, [])

  useEffect(() => {
    const auth = getAuth()
    onAuthStateChanged(auth, async user => {
      if (!user) return

      // Fetch user profile to get companyCode
      const userSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', user.email))
      )
      if (userSnap.empty) {
        notification.error({
          message: 'User not found in participants collection.'
        })
        return
      }

      // Fetch program names from 'programs' collection
      const programsSnap = await getDocs(collection(db, 'programs'))
      const progMap: any = {}
      programsSnap.forEach(doc => {
        const data = doc.data()
        progMap[doc.id] = data.name
      })
      setProgramMap(progMap)

      const participantsSnap = await getDocs(collection(db, 'participants'))
      const pMap: any = {}
      participantsSnap.forEach(doc => {
        const data = doc.data()
        pMap[doc.id] = data.beneficiaryName || data.name
      })
      setParticipantMap(pMap)

      const consultantSnap = await getDocs(collection(db, 'consultants'))
      const cMap: any = {}
      consultantSnap.forEach(doc => {
        const data = doc.data()
        cMap[doc.id] = data.name
      })
      setConsultantMap(cMap)

      const userData = userSnap.docs[0].data()
      const code = userData.companyCode
      setCompanyCode(code)

      const snapshot = await getDocs(
        query(
          collection(db, 'interventionsDatabase'),
          where('companyCode', '==', code)
        )
      )

      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setRecords(data)
      setFiltered(data)

      // Collect program names dynamically
      const uniquePrograms = [...new Set(data.map(d => d.programId))]
      setProgramOptions(uniquePrograms)
    })
  }, [])

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)

    const result = records.filter(item => {
      return (
        (newFilters.programId === 'all' ||
          item.programId === newFilters.programId) &&
        (newFilters.type === 'all' ||
          item.interventionType === newFilters.type) &&
        (newFilters.area === 'all' || item.areaOfSupport === newFilters.area)
      )
    })

    setFiltered(result)
  }

  const columns = [
    {
      title: 'Beneficiary',
      dataIndex: 'participantId',
      key: 'participantId',
      render: (id: string) =>
        participantMap[id] ?? <Text type='secondary'>Unknown</Text>
    },
    {
      title: 'Location',
      dataIndex: 'province',
      key: 'province',
      render: (text: string, record: any) => (
        <Space direction='vertical' size={0}>
          <Text strong>{text}</Text>
          <Text type='secondary'>{record.hub}</Text>
        </Space>
      )
    },
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle',
      render: (text: string, record: any) => (
        <Space direction='vertical' size={0}>
          <Text strong>{text}</Text>
          <Text type='secondary'>{record.areaOfSupport}</Text>
        </Space>
      )
    },
    {
      title: 'Program',
      dataIndex: 'programId',
      key: 'programId',
      render: (id: string) => programMap[id] || id
    },
    {
      title: 'Consultants',
      dataIndex: 'consultantIds',
      key: 'consultantIds',
      render: (ids: string[]) =>
        ids.map(id => <Tag key={id}>{consultantMap[id] || id}</Tag>)
    },
    {
      title: 'Time Spent',
      dataIndex: 'timeSpent',
      key: 'timeSpent',
      render: (arr: number[]) => arr.reduce((a, b) => a + b, 0) + ' hrs'
    },
    {
      title: 'Confirmed At',
      dataIndex: 'confirmedAt',
      key: 'confirmedAt',
      sorter: (a, b) =>
        new Date(a.confirmedAt).getTime() - new Date(b.confirmedAt).getTime(),
      render: (date: any) =>
        date
          ? dayjs(date.toDate ? date.toDate() : date).format('YYYY-MM-DD')
          : '-'
    },
    {
      title: 'P.O.E',
      key: 'actions',
      render: (_: any, record: any) => (
        <Button type='link' onClick={() => setSelectedView(record)}>
          View
        </Button> 
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Select
            style={{ width: '100%' }}
            value={filters.programId}
            onChange={val => handleFilterChange('programId', val)}
          >
            <Option value='all'>All Programs</Option>
            {programOptions.map(p => (
              <Option key={p} value={p}>
                {programMap[p] || p}
              </Option>
            ))}
          </Select>
        </Col>
        <Col span={8}>
          <Select
            style={{ width: '100%' }}
            value={filters.type}
            onChange={val => handleFilterChange('type', val)}
          >
            <Option value='all'>All Types</Option>
            <Option value='singular'>Singular</Option>
            <Option value='grouped'>Grouped</Option>
          </Select>
        </Col>
        <Col span={8}>
          <Select
            style={{ width: '100%' }}
            value={filters.area}
            onChange={val => handleFilterChange('area', val)}
          >
            <Option value='all'>All Areas</Option>
            <Option value='Marketing Support'>Marketing Support</Option>
            <Option value='Compliance'>Compliance</Option>
            <Option value='Financial management'>Financial Management</Option>
          </Select>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey='id'
          expandable={{
            expandedRowRender: record => {
              const isGrouped = record.interventionType === 'grouped'
              const consultants = record.consultantIds || []
              const hours = record.timeSpent || []

              return (
                <div>
                  <p>
                    <strong>Target:</strong> {record.targetValue}{' '}
                    {record.targetMetric}
                  </p>
                  <p>
                    <strong>Feedback:</strong>{' '}
                    {record.feedback?.comments || 'No feedback'}
                  </p>

                  {isGrouped ? (
                    <div>
                      <Divider />
                      <strong>Consultant Contributions:</strong>
                      <ul style={{ paddingLeft: 20 }}>
                        {consultants.map((id: string, idx: number) => {
                          const name = consultantMap[id] || id
                          const hoursSpent = hours[idx] || 0
                          const rate = consultantRates[id] || 0
                          const amount = rate * hoursSpent
                          return (
                            <li key={id}>
                              {name} — {hoursSpent} hrs × R{rate}/hr ={' '}
                              <b>R{amount.toFixed(2)}</b>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : (
                    <div>
                      <Divider />
                      <strong>Consultant:</strong>{' '}
                      {consultantMap[record.consultantIds?.[0]] || 'Unknown'}{' '}
                      <br />
                      <strong>Hours:</strong> {record.timeSpent?.[0] || 0} hrs{' '}
                      <br />
                      <strong>Rate:</strong> R
                      {consultantRates[record.consultantIds?.[0]] || 0}/hr{' '}
                      <br />
                      <strong>Amount Due:</strong>{' '}
                      <b>
                        R
                        {(
                          (record.timeSpent?.[0] || 0) *
                          (consultantRates[record.consultantIds?.[0]] || 0)
                        ).toFixed(2)}
                      </b>
                    </div>
                  )}
                </div>
              )
            }
          }}
        />
      </Card>
      <Modal
        title='View Intervention Details'
        open={!!selectedView}
        onCancel={() => setSelectedView(null)}
        footer={[
          <Button key='close' onClick={() => setSelectedView(null)}>
            Close
          </Button>
        ]}
      >
        {selectedView && (
          <>
            <p>
              <strong>Title:</strong> {selectedView.interventionTitle}
            </p>
            <p>
              <strong>Area:</strong> {selectedView.areaOfSupport}
            </p>
            <Divider />
            <strong>Resources:</strong>
            {selectedView.resources && selectedView.resources.length > 0 ? (
              <ul>
                {selectedView.resources.map((res: any, idx: number) => (
                  <li key={idx}>
                    {res.type === 'link' ? '🔗' : '📄'}{' '}
                    <a
                      href={res.link}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      {res.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No files uploaded.</p>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}

export default InterventionDatabaseView
