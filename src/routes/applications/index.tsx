import React, { useEffect, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Modal,
  Button,
  Space,
  Typography,
  Select,
  message,
  Skeleton
} from 'antd'
import { db, auth } from '@/firebase'
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'

const { Title, Text } = Typography
const { Option } = Select

function toCSV(rows, columns) {
  const csvRows = [columns.map(col => `"${col.title}"`).join(',')]
  for (let row of rows) {
    const values = columns.map(col => {
      let val = row[col.dataIndex]
      if (typeof val === 'undefined' || val === null) return ''
      return `"${String(val).replace(/"/g, '""')}"`
    })
    csvRows.push(values.join(','))
  }
  return csvRows.join('\n')
}

const ApplicationsPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [applications, setApplications] = useState<any[]>([])
  const [filteredApplications, setFilteredApplications] = useState<any[]>([])
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [aiModalVisible, setAiModalVisible] = useState(false)
  const [documentsModalVisible, setDocumentsModalVisible] = useState(false)
  const [genderFilter, setGenderFilter] = useState<string | undefined>()
  const [ageGroupFilter, setAgeGroupFilter] = useState<string | undefined>()
  const [companyCode, setCompanyCode] = useState<string | null>(null)

  // 1. Get companyCode for current user
  useEffect(() => {
    async function getUserCompanyCode() {
      const user = auth.currentUser
      if (!user) return
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)
      setCompanyCode(userSnap.exists() ? userSnap.data()?.companyCode : null)
    }
    getUserCompanyCode()
  }, [])

  // 2. Fetch & filter applications by companyCode
  const fetchApplications = async () => {
    if (!companyCode) return
    setLoading(true)
    try {
      const snapshot = await getDocs(collection(db, 'applications'))
      let apps = snapshot.docs.map(doc => {
        const data = doc.data()
        let aiEvaluation = data.aiEvaluation
        let ai = {
          'AI Recommendation': 'Pending',
          'AI Score': 'N/A',
          Justification: 'No justification provided.'
        }
        try {
          if (typeof aiEvaluation?.raw_response === 'string') {
            const cleaned = aiEvaluation.raw_response
              .replace(/```json/i, '')
              .replace(/```/g, '')
              .trim()
            const parsed = JSON.parse(cleaned)
            ai['AI Recommendation'] = parsed['AI Recommendation'] || 'Pending'
            ai['AI Score'] = parsed['AI Score'] ?? 'N/A'
            ai['Justification'] =
              parsed['Justification'] || 'No justification provided.'
          } else if (
            typeof aiEvaluation === 'object' &&
            aiEvaluation !== null &&
            !aiEvaluation.raw_response
          ) {
            ai['AI Recommendation'] =
              aiEvaluation['AI Recommendation'] || 'Pending'
            ai['AI Score'] = aiEvaluation['AI Score'] ?? 'N/A'
            ai['Justification'] =
              aiEvaluation['Justification'] || 'No justification provided.'
          }
        } catch (err) {
          if (typeof aiEvaluation?.raw_response === 'string') {
            ai['Justification'] = aiEvaluation.raw_response
          }
        }
        return {
          id: doc.id,
          ...data,
          companyCode: data.companyCode || '',
          beneficiaryName: data.beneficiaryName || 'N/A',
          gender: data.gender || 'N/A',
          ageGroup: data.ageGroup || 'N/A',
          stage: data.stage || 'N/A',
          hub: data.hub || 'N/A',
          email: data.email || 'N/A',
          motivation: data.motivation || '',
          challenges: data.challenges || '',
          aiRecommendation: ai['AI Recommendation'] || 'Pending',
          aiScore: ai['AI Score'] || 'N/A',
          aiJustification: ai['Justification'] || 'N/A',
          documents: data.complianceDocuments || [],
          applicationStatus: data.applicationStatus || 'Pending'
        }
      })

      // Filter by companyCode
      apps = apps.filter(app => app.companyCode === companyCode)

      // Sort by aiScore descending (N/A at bottom)
      apps.sort((a, b) => {
        const aScore = isNaN(Number(a.aiScore)) ? -Infinity : Number(a.aiScore)
        const bScore = isNaN(Number(b.aiScore)) ? -Infinity : Number(b.aiScore)
        return bScore - aScore
      })

      setApplications(apps)
      setFilteredApplications(apps)
    } catch (error) {
      console.error('Error fetching applications:', error)
      message.error('Failed to fetch applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyCode) fetchApplications()
    // eslint-disable-next-line
  }, [companyCode])

  const updateStatus = async (newStatus: string, docId: string) => {
    const ref = doc(db, 'applications', docId)
    await updateDoc(ref, { applicationStatus: newStatus })
    fetchApplications()
  }

  const handleGenderFilter = (value: string | undefined) => {
    setGenderFilter(value)
    filterApplications(value, ageGroupFilter)
  }

  const handleAgeGroupFilter = (value: string | undefined) => {
    setAgeGroupFilter(value)
    filterApplications(genderFilter, value)
  }

  const filterApplications = (gender?: string, ageGroup?: string) => {
    let filtered = [...applications]
    if (gender) filtered = filtered.filter(app => app.gender === gender)
    if (ageGroup) filtered = filtered.filter(app => app.ageGroup === ageGroup)
    setFilteredApplications(filtered)
  }

  const totalApplications = applications.length
  const accepted = applications.filter(
    app => app.applicationStatus.toLowerCase() === 'accepted'
  ).length
  const rejected = applications.filter(
    app => app.applicationStatus.toLowerCase() === 'rejected'
  ).length

  const genderDistribution = applications.reduce((acc, p) => {
    acc[p.gender] = (acc[p.gender] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const ageGroupDistribution = applications.reduce((acc, p) => {
    acc[p.ageGroup] = (acc[p.ageGroup] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const genderChartOptions = {
    chart: { type: 'pie', height: 200 },
    title: { text: 'Gender Distribution', style: { fontSize: '14px' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    series: [
      {
        name: 'Participants',
        data: Object.entries(genderDistribution).map(([key, value]) => ({
          name: key,
          y: value
        }))
      }
    ]
  }

  const readableStatus = selectedApplication?.applicationStatus
    ? selectedApplication.applicationStatus.charAt(0).toUpperCase() +
      selectedApplication.applicationStatus.slice(1).toLowerCase()
    : 'Unassigned'

  const ageChartOptions = {
    chart: { type: 'pie', height: 200 },
    title: { text: 'Age Group Distribution', style: { fontSize: '14px' } },
    plotOptions: {
      series: {
        dataLabels: {
          enabled: true,
          format: '{point.y}'
        }
      }
    },
    series: [
      {
        name: 'Participants',
        data: Object.entries(ageGroupDistribution).map(([key, value]) => ({
          name: key,
          y: value
        }))
      }
    ]
  }

  const columns = [
    {
      title: 'Enterprise Name',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
    {
      title: 'Owner Gender',
      dataIndex: 'gender',
      key: 'gender'
    },
    {
      title: 'Owner Age Group',
      dataIndex: 'ageGroup',
      key: 'ageGroup'
    },
    {
      title: 'AI Score',
      dataIndex: 'aiScore',
      key: 'aiScore',
      sorter: (a, b) => {
        const aScore = isNaN(Number(a.aiScore)) ? -Infinity : Number(a.aiScore)
        const bScore = isNaN(Number(b.aiScore)) ? -Infinity : Number(b.aiScore)
        return bScore - aScore
      },
      defaultSortOrder: 'descend',
      render: score => score ?? 'N/A'
    },
    {
      title: 'Decision',
      key: 'applicationStatus',
      render: (record: any) => {
        const statusRaw = record.applicationStatus || 'Pending'
        const status =
          statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1).toLowerCase()
        const color =
          status === 'Accepted'
            ? 'green'
            : status === 'Rejected'
            ? 'red'
            : 'gold'
        return <Tag color={color}>{status}</Tag>
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size='small'
            icon={<FileOutlined />}
            onClick={() => {
              setSelectedApplication(record)
              setDocumentsModalVisible(true)
            }}
          >
            Documents
          </Button>
        </Space>
      )
    }
  ]

  // CSV export function
  const handleExportCSV = () => {
    const exportCols = columns.filter(col => col.dataIndex)
    const csv = toCSV(filteredApplications, exportCols)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.setAttribute('download', 'applications.csv')
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 24 }}>
      <Helmet>
        <title>Applications Overview</title>
      </Helmet>

      {/* Top Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#1890ff' }} />
                  Total Applications
                </Space>
              }
              value={totalApplications}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  Accepted
                </Space>
              }
              value={accepted}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card loading={loading}>
            <Statistic
              title={
                <Space>
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                  Rejected
                </Space>
              }
              value={rejected}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pie Charts */}
      <Skeleton loading={loading} paragraph={false}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <HighchartsReact
              highcharts={Highcharts}
              options={genderChartOptions}
            />
          </Col>
          <Col span={12}>
            <HighchartsReact
              highcharts={Highcharts}
              options={ageChartOptions}
            />
          </Col>
        </Row>
      </Skeleton>

      {/* Filters & Export */}
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder='Filter by Gender'
          allowClear
          onChange={handleGenderFilter}
          style={{ width: 200 }}
        >
          <Option value='Male'>Male</Option>
          <Option value='Female'>Female</Option>
        </Select>
        <Select
          placeholder='Filter by Age Group'
          allowClear
          onChange={handleAgeGroupFilter}
          style={{ width: 200 }}
        >
          <Option value='Youth'>Youth</Option>
          <Option value='Adult'>Adult</Option>
          <Option value='Senior'>Senior</Option>
        </Select>
        <Button
          type='primary'
          icon={<DownloadOutlined />}
          onClick={handleExportCSV}
        >
          Export CSV
        </Button>
      </Space>

      {/* Table & Detail Card */}
      <Row gutter={16}>
        <Col xs={24} md={14}>
          <Card>
            <Table
              columns={columns}
              dataSource={filteredApplications}
              rowKey='id'
              pagination={{ pageSize: 8 }}
              onRow={record => ({
                onClick: () => setSelectedApplication(record)
              })}
            />
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card
            title={
              selectedApplication ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ maxWidth: '70%' }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>Current Status: </Text>
                      <Tag
                        color={
                          readableStatus === 'Accepted'
                            ? 'green'
                            : readableStatus === 'Rejected'
                            ? 'red'
                            : 'gold'
                        }
                      >
                        {readableStatus}
                      </Tag>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text type='secondary'>
                        <strong>AI Recommendation:</strong>{' '}
                        {selectedApplication.aiRecommendation || 'N/A'}
                      </Text>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text>
                        <strong>Score:</strong>{' '}
                        {selectedApplication.aiScore ?? 'N/A'}
                      </Text>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <Text>
                        <strong>Justification:</strong>{' '}
                        <Button
                          type='link'
                          size='small'
                          onClick={() => setAiModalVisible(true)}
                          style={{ paddingLeft: 8 }}
                        >
                          View
                        </Button>
                      </Text>
                    </div>
                  </div>
                  <div>
                    <Text>
                      <strong>Alter Decision:</strong>{' '}
                    </Text>
                    <Select
                      style={{ width: 160, marginBottom: 5 }}
                      placeholder='Set Status'
                      value={selectedApplication.applicationStatus || undefined}
                      onChange={async value => {
                        try {
                          await updateStatus(value, selectedApplication.id)
                          message.success(`Status updated to ${value}`)
                          setApplications(prev =>
                            prev.map(app =>
                              app.id === selectedApplication.id
                                ? { ...app, applicationStatus: value }
                                : app
                            )
                          )
                          setFilteredApplications(prev =>
                            prev.map(app =>
                              app.id === selectedApplication.id
                                ? { ...app, applicationStatus: value }
                                : app
                            )
                          )
                          setSelectedApplication(prev =>
                            prev ? { ...prev, applicationStatus: value } : prev
                          )
                        } catch (err) {
                          message.error('Failed to update status')
                        }
                      }}
                    >
                      <Option value='Accepted'>Accept</Option>
                      <Option value='Rejected'>Reject</Option>
                      <Option value='Pending'>Pending</Option>
                    </Select>
                  </div>
                </div>
              ) : (
                'Applicant Details'
              )
            }
            style={{
              width: '100%',
              height: '100%',
              padding: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            {selectedApplication ? (
              <div style={{ padding: '8px 16px' }}>
                <>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Enterprise:</Text>
                    <div>{selectedApplication.beneficiaryName || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Email:</Text>
                    <div>{selectedApplication.email || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Gender:</Text>
                    <div>{selectedApplication.gender || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Stage:</Text>
                    <div>{selectedApplication.stage || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Hub:</Text>
                    <div>{selectedApplication.hub || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Motivation:</Text>
                    <div>{selectedApplication.motivation || 'N/A'}</div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>Challenges:</Text>
                    <div>{selectedApplication.challenges || 'N/A'}</div>
                  </div>
                </>
              </div>
            ) : (
              <Text type='secondary'>Click a row to view details</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* AI Modal */}
      <Modal
        title='AI Recommendation'
        open={aiModalVisible}
        footer={null}
        onCancel={() => setAiModalVisible(false)}
      >
        {selectedApplication && (
          <Space direction='vertical'>
            <Text>
              <strong>Recommendation:</strong>{' '}
              {selectedApplication.aiRecommendation || 'Pending'}
            </Text>
            <Text>
              <strong>Score:</strong> {selectedApplication.aiScore ?? 'N/A'}
            </Text>
            <Text>
              <strong>Justification:</strong>
            </Text>
            <Text style={{ whiteSpace: 'pre-line' }}>
              {selectedApplication.aiJustification ||
                'No justification provided by AI.'}
            </Text>
          </Space>
        )}
      </Modal>

      {/* Documents Modal */}
      <Modal
        title='Uploaded Documents'
        open={documentsModalVisible}
        footer={null}
        onCancel={() => setDocumentsModalVisible(false)}
      >
        {selectedApplication?.documents?.length ? (
          <ul>
            {selectedApplication.documents.map((doc: any, idx: number) => (
              <li key={idx}>
                <a href={doc.url} target='_blank' rel='noopener noreferrer'>
                  {doc.type} ({doc.fileName})
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <Text type='secondary'>No documents uploaded</Text>
        )}
      </Modal>
    </div>
  )
}

export default ApplicationsPage
