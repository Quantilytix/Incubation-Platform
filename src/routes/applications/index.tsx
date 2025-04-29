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
  Divider,
  Select,
  Badge
} from 'antd'
import { db } from '@/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { EyeOutlined, FileOutlined } from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'

const { Title, Text } = Typography
const { Option } = Select

const ApplicationsPage: React.FC = () => {
  const [participants, setParticipants] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [filteredApplications, setFilteredApplications] = useState<any[]>([])
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [aiModalVisible, setAiModalVisible] = useState(false)
  const [documentsModalVisible, setDocumentsModalVisible] = useState(false)
  const [genderFilter, setGenderFilter] = useState<string | undefined>(
    undefined
  )
  const [ageGroupFilter, setAgeGroupFilter] = useState<string | undefined>(
    undefined
  )
  const [filters, setFilters] = useState({ gender: '', ageGroup: '' })

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'participants'))
        const apps = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setApplications(apps)
        setFilteredApplications(apps)
      } catch (error) {
        console.error('Error fetching applications:', error)
      }
    }
    fetchApplications()
  }, [])

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
    app => app.aiRecommendation === 'Accepted'
  ).length
  const rejected = applications.filter(
    app => app.aiRecommendation === 'Rejected'
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

  const ageChartOptions = {
    chart: { type: 'pie', height: 200 },
    title: { text: 'Age Group Distribution', style: { fontSize: '14px' } },
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
      dataIndex: 'enterpriseName',
      key: 'enterpriseName'
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
      title: 'AI Recommendation',
      key: 'aiRecommendation',
      render: (record: any) => (
        <Tag color={record.aiRecommendation === 'Accepted' ? 'green' : 'red'}>
          {record.aiRecommendation || 'Pending'}
        </Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            size='small'
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedApplication(record)
              setAiModalVisible(true)
            }}
          >
            View AI
          </Button>
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

  return (
    <div style={{ padding: 24 }}>
      <Helmet>
        <title>Applications Overview</title>
      </Helmet>

      {/* Top Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={8}>
          <Card>
            <Statistic title='Total Applications' value={totalApplications} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title='Accepted'
              value={accepted}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title='Rejected'
              value={rejected}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pie Charts */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <HighchartsReact
            highcharts={Highcharts}
            options={genderChartOptions}
          />
        </Col>
        <Col span={12}>
          <HighchartsReact highcharts={Highcharts} options={ageChartOptions} />
        </Col>
      </Row>

      {/* Filters */}
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
      </Space>

      {/* Table + Details Card */}
      <Row gutter={16}>
        <Col xs={24} md={16}>
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

        <Col xs={24} md={8}>
          <Card title='Applicant Details'>
            {selectedApplication ? (
              <Space direction='vertical'>
                <Text strong>Enterprise:</Text>{' '}
                <Text>{selectedApplication.enterpriseName}</Text>
                <Divider />
                <Text strong>Gender:</Text>{' '}
                <Text>{selectedApplication.gender}</Text>
                <Divider />
                <Text strong>Age Group:</Text>{' '}
                <Text>{selectedApplication.ageGroup}</Text>
                <Divider />
                <Text strong>Sector:</Text>{' '}
                <Text>{selectedApplication.sector}</Text>
                <Divider />
                <Text strong>Province:</Text>{' '}
                <Text>{selectedApplication.province}</Text>
              </Space>
            ) : (
              <Text type='secondary'>Click a row to view details</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* AI Recommendation Modal */}
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
            <Text>
              {selectedApplication.aiJustification ??
                'No justification provided'}
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
            {selectedApplication.documents.map((url: string, idx: number) => (
              <li key={idx}>
                <a href={url} target='_blank' rel='noopener noreferrer'>
                  Document {idx + 1}
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
