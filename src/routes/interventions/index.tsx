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
  Modal,
  Skeleton,
  Spin,
  Statistic
} from 'antd'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { Helmet } from 'react-helmet'
import {
  TeamOutlined,
  FileDoneOutlined,
  CalendarOutlined,
  BarChartOutlined
} from '@ant-design/icons'

const { Text } = Typography
const { Option } = Select

const InterventionDatabaseView = () => {
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [companyCode, setCompanyCode] = useState<string | null>(null)
  const [programOptions, setProgramOptions] = useState<
    { id: string; name: string }[]
  >([])
  const [filters, setFilters] = useState({
    programId: 'all',
    type: 'all',
    area: 'all',
    quarter: 'all'
  })

  const [programMap, setProgramMap] = useState<{ [key: string]: string }>({})
  const [consultantMap, setConsultantMap] = useState<{ [key: string]: string }>(
    {}
  )
  const [consultantRates, setConsultantRates] = useState<{
    [key: string]: number
  }>({})
  const [selectedView, setSelectedView] = useState<any | null>(null)
  const [password, setPassword] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [participantMap, setParticipantMap] = useState<{
    [key: string]: string
  }>({})

  useEffect(() => {
    const auth = getAuth()
    onAuthStateChanged(auth, async user => {
      if (!user) return
      setLoading(true)

      try {
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', user.email))
        )
        if (userSnap.empty) {
          console.warn(`User not found on first try: ${user.email}`)

          // Retry once after a short delay
          setTimeout(async () => {
            const retrySnap = await getDocs(
              query(collection(db, 'users'), where('email', '==', user.email))
            )
            if (retrySnap.empty) {
              console.log(user.email)
              return
            }
            // Proceed as usual after retry
            const userData = retrySnap.docs[0].data()
            setCompanyCode(userData.companyCode)
            // ... proceed with fetchParticipants etc.
          }, 1000)

          return
        }

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
          cMap[doc.id] = doc.data().name
        })
        setConsultantMap(cMap)

        const programsSnap = await getDocs(collection(db, 'programs'))
        const prMap: any = {}
        programsSnap.forEach(doc => {
          prMap[doc.id] = doc.data().name
        })
        setProgramMap(prMap)

        const userData = userSnap.docs[0].data()
        const code = userData.companyCode
        setCompanyCode(code)

        const snapshot = await getDocs(
          query(
            collection(db, 'interventionsDatabase'),
            where('companyCode', '==', code)
          )
        )
        const grouped = new Map()

        snapshot.docs.forEach(doc => {
          const data = doc.data()

          const key = `${data.programId}_${data.participantId}`

          if (!grouped.has(key)) {
            grouped.set(key, {
              programId: data.programId, // ✅ correct
              participantId: data.participantId,
              beneficiaryName: data.beneficiaryName,
              province: data.province,
              quarter: data.quarter,
              hub: data.hub,
              interventions: []
            })
          }

          grouped.get(key).interventions.push({ id: doc.id, ...data })

          const flattened = snapshot.docs.map(doc => {
            const data = doc.data()
            return {
              id: doc.id,
              ...data,
              programName: pMap[data.programId] || data.programId,
              participantName: pMap[data.participantId] || data.participantId,
              quarter: `Q${
                Math.floor(
                  (dayjs(data.confirmedAt?.toDate()).month() || 0) / 3
                ) + 1
              }`
            }
          })
          setRecords(flattened)
          setFiltered(flattened)
        })

        const groupedRecords = Array.from(grouped.values())
        setRecords(groupedRecords)
        setFiltered(groupedRecords)

        const uniqueProgramIds = [
          ...new Set(groupedRecords.map(d => d.programId))
        ]
        setProgramOptions(
          uniqueProgramIds.map(id => ({ id, name: programMap[id] || id }))
        )
      } catch (err) {
        console.error(err)
        notification.error({ message: 'Failed to load' })
      } finally {
        setLoading(false)
      }
    })
  }, [])

  useEffect(() => {
    const fetchConsultants = async () => {
      const snapshot = await getDocs(collection(db, 'consultants'))
      const rateMap: any = {}
      snapshot.forEach(doc => {
        const data = doc.data()
        rateMap[doc.id] = data.rate || 0
      })
      setConsultantRates(rateMap)
    }

    fetchConsultants()
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
        (newFilters.area === 'all' || item.areaOfSupport === newFilters.area) &&
        (newFilters.quarter === 'all' || item.quarter === newFilters.quarter)
      )
    })
    setFiltered(result)
  }

  const columns = [
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      render: text => text || <Text type='secondary'>Unknown</Text>
    },
    {
      title: 'Location',
      render: (_, record) => (
        <Space direction='vertical' size={0}>
          <Text strong>{record.province}</Text>
          <Text type='secondary'>{record.hub}</Text>
        </Space>
      )
    },
    {
      title: 'Program',
      dataIndex: 'programId',
      render: id => programMap[id] || id
    },
    {
      title: 'Quarter',
      dataIndex: 'quarter',
      render: text => text || <Text type='secondary'>Unknown</Text>
    },
    {
      title: 'Actions',
      render: (_, record) => (
        <Button type='link' onClick={() => setSelectedView(record)}>
          View
        </Button>
      )
    }
  ]

  const totalInterventions = records.reduce((acc, rec) => {
    return acc + (rec.interventions?.length || 0)
  }, 0)

  const totalBeneficiaries = records.length

  const interventionsPerQuarter = records.reduce((acc, rec) => {
    const q = rec.quarter || 'Unknown'
    acc[q] = (acc[q] || 0) + (rec.interventions?.length || 0)
    return acc
  }, {} as Record<string, number>)

  return (
    <div style={{ padding: 24, height: '100vh' }}>
      <Helmet>
        <title>Interventions Database</title>
      </Helmet>
      {/* {loading ? (
        <div
          style={{
            display: 'flex',
            height: '100vh',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Spin tip='Loading layout...' size='large' />
        </div>
      ) : ( */}
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card loading={loading}>
              <Statistic
                title='Total Beneficiaries'
                value={totalBeneficiaries}
                prefix={
                  <TeamOutlined style={{ fontSize: 20, color: '#722ed1' }} />
                }
              />
            </Card>
          </Col>

          <Col span={6}>
            <Card loading={loading}>
              <Statistic
                title='Total Interventions'
                value={totalInterventions}
                prefix={
                  <FileDoneOutlined
                    style={{ fontSize: 20, color: '#1890ff' }}
                  />
                }
              />
            </Card>
          </Col>

          <Col span={12}>
            <Card loading={loading}>
              <Statistic
                title='Interventions per Quarter'
                prefix={
                  <CalendarOutlined
                    style={{ fontSize: 20, color: '#fa8c16' }}
                  />
                }
                valueRender={() => (
                  <div style={{ display: 'inline-block' }}>
                    {Object.entries(interventionsPerQuarter).map(
                      ([quarter, count]) => (
                        <Tag
                          key={quarter}
                          color='blue'
                          style={{ marginRight: 8 }}
                        >
                          {quarter}: {count}
                        </Tag>
                      )
                    )}
                  </div>
                )}
              />
            </Card>
          </Col>
        </Row>

        <Skeleton active paragraph={false} loading={loading}>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                value={filters.programId}
                onChange={val => handleFilterChange('programId', val)}
              >
                <Option value='all'>All Programs</Option>
                {programOptions.map(p => (
                  <Option key={p.id} value={p.id}>
                    {p.name}
                  </Option>
                ))}
              </Select>
            </Col>

            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                value={filters.quarter}
                onChange={val => handleFilterChange('quarter', val)}
              >
                <Option value='all'>All Quarters</Option>
                <Option value='Q1'>Q1</Option>
                <Option value='Q2'>Q2</Option>
                <Option value='Q3'>Q3</Option>
                <Option value='Q4'>Q4</Option>
              </Select>
            </Col>

            <Col span={6}>
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

            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                value={filters.area}
                onChange={val => handleFilterChange('area', val)}
              >
                <Option value='all'>All Areas</Option>
                <Option value='Marketing Support'>Marketing Support</Option>
                <Option value='Compliance'>Compliance</Option>
                <Option value='Financial management'>
                  Financial Management
                </Option>
              </Select>
            </Col>
          </Row>
        </Skeleton>

        <Card>
          <Skeleton active loading={loading}>
            <Table columns={columns} dataSource={filtered} rowKey='id' />
          </Skeleton>
        </Card>

        <Modal
          title={`Completed Interventions for ${
            participantMap[selectedView?.participantId] || 'Beneficiary'
          }`}
          open={!!selectedView}
          onCancel={() => {
            setSelectedView(null)
            setShowDetails(false)
            setPassword('')
          }}
          footer={[
            <Button key='close' onClick={() => setSelectedView(null)}>
              Close
            </Button>
          ]}
        >
          {selectedView && (
            <>
              <p>
                <strong>Participant:</strong>{' '}
                {participantMap[selectedView.participantId]}
              </p>
              <Divider />

              <ul>
                {[...selectedView.interventions].map((item, index) => (
                  <li key={index} style={{ marginBottom: 12 }}>
                    <Space direction='vertical'>
                      <Text strong>{item.interventionTitle}</Text>
                      <Button
                        type='link'
                        onClick={() => {
                          setShowDetails(item.id)
                          setPassword('')
                        }}
                      >
                        🔑 {item.interventionKey}
                      </Button>
                    </Space>

                    {/* Password prompt */}
                    {showDetails === item.id && (
                      <div style={{ marginTop: 8 }}>
                        {!password ? (
                          <Space direction='vertical' style={{ width: '100%' }}>
                            <input
                              type='password'
                              placeholder='Enter password'
                              style={{ width: '100%', padding: 8 }}
                              onChange={e => setPassword(e.target.value)}
                            />
                            <Button
                              type='primary'
                              onClick={() => {
                                if (password === 'admin') {
                                  // do nothing, show details already
                                } else {
                                  notification.error({
                                    message: 'Incorrect password'
                                  })
                                  setPassword('')
                                }
                              }}
                            >
                              Reveal Details
                            </Button>
                          </Space>
                        ) : (
                          <>
                            <Divider />
                            <p>
                              <strong>Completed At:</strong>{' '}
                              {dayjs(item.confirmedAt.toDate()).format(
                                'YYYY-MM-DD'
                              )}
                            </p>
                            <p>
                              <strong>Consultants:</strong>{' '}
                              {(item.consultantIds || [])
                                .map(id => consultantMap[id] || id)
                                .join(', ')}
                            </p>
                            <p>
                              <strong>Time Spent:</strong>{' '}
                              {Array.isArray(item.timeSpent)
                                ? item.timeSpent.join(', ')
                                : item.timeSpent !== undefined &&
                                  item.timeSpent !== null
                                ? item.timeSpent
                                : ''}{' '}
                              hrs
                            </p>

                            <p>
                              <strong>POE:</strong>{' '}
                              {item.resources?.length ? (
                                <ul>
                                  {item.resources.map((res: any, i: number) => (
                                    <li key={i}>
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
                                'None'
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Modal>
      </>
      {/* )} */}
    </div>
  )
}

export default InterventionDatabaseView
