import React, { useState } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  List,
  Button,
  Tag,
  Table,
  Modal,
  Input
} from 'antd'
import {
  FileSearchOutlined,
  MessageOutlined,
  BarChartOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

const initialInterventions = [
  {
    id: 1,
    sme: 'BrightTech',
    intervention: 'Website Development',
    resources: 'R12,000',
    sector: 'ICT',
    stage: 'Growth',
    location: 'Johannesburg',
    declined: false,
    declineReason: ''
  },
  {
    id: 2,
    sme: 'Green Farms',
    intervention: 'Financial Literacy Training',
    resources: 'R8,000',
    sector: 'Agriculture',
    stage: 'Startup',
    location: 'Limpopo',
    declined: false,
    declineReason: ''
  }
]

export const ConsultantDashboard: React.FC = () => {
  const navigate = useNavigate()

  const [data, setData] = useState(initialInterventions)
  const [modalVisible, setModalVisible] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [currentDeclineId, setCurrentDeclineId] = useState<number | null>(null)

  const handleAccept = (id: number) => {
    console.log('Accepted:', id)
  }

  const handleDecline = (id: number) => {
    setCurrentDeclineId(id)
    setModalVisible(true)
  }

  const confirmDecline = () => {
    setData(prev =>
      prev.map(item =>
        item.id === currentDeclineId
          ? { ...item, declined: true, declineReason }
          : item
      )
    )
    setModalVisible(false)
    setDeclineReason('')
    setCurrentDeclineId(null)
  }

  const columns = [
    { title: 'SME Name', dataIndex: 'sme', key: 'sme' },
    { title: 'Intervention', dataIndex: 'intervention', key: 'intervention' },
    // { title: 'Resources', dataIndex: 'resources', key: 'resources' },
    { title: 'Sector', dataIndex: 'sector', key: 'sector' },
    { title: 'Lifecycle Stage', dataIndex: 'stage', key: 'stage' },
    { title: 'Location', dataIndex: 'location', key: 'location' },
    {
      title: 'Action',
      render: (_, record) =>
        record.declined ? (
          <Tag color='red'>Declined</Tag>
        ) : (
          <>
            <Button
              type='link'
              onClick={() => handleAccept(record.id)}
              style={{ color: 'green' }}
            >
              ✅
            </Button>
            <Button
              type='link'
              onClick={() => handleDecline(record.id)}
              style={{ color: 'red' }}
            >
              ❌
            </Button>
          </>
        )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Consultant Workspace</Title>

      {/* Top Stats */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic
              title='Total Feedbacks'
              value={24}
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card>
            <Statistic
              title='Ongoing Audits'
              value={5}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card>
            <Statistic
              title='Analysed Projects'
              value={12}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>

        {/* Feedback List */}
        <Col span={24}>
          <Card title='Recent Feedback'>
            <List
              itemLayout='horizontal'
              dataSource={[
                {
                  id: 1,
                  sme: 'BrightTech',
                  summary: 'Good progress but needs branding support.'
                },
                {
                  id: 2,
                  sme: 'Green Farms',
                  summary:
                    'Supply chain issues noted, suggest strategic partner.'
                }
              ]}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button
                      key='view'
                      onClick={() => navigate('/consultant/feedback')}
                      type='link'
                    >
                      View
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    title={<b>{item.sme}</b>}
                    description={<Tag color='blue'>{item.summary}</Tag>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Interventions Table */}
        <Col span={24}>
          <Card title='Allocated Interventions'>
            <Table
              dataSource={data}
              columns={columns}
              rowKey='id'
              pagination={false}
              rowClassName={record => (record.declined ? 'declined-row' : '')}
            />
          </Card>
        </Col>
      </Row>

      {/* Decline Reason Modal */}
      <Modal
        title='Reason for Declining'
        visible={modalVisible}
        onOk={confirmDecline}
        onCancel={() => setModalVisible(false)}
        okText='Confirm'
      >
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={e => setDeclineReason(e.target.value)}
          placeholder='Please enter a reason...'
        />
      </Modal>

      {/* Declined Row Style */}
      <style>
        {`
          .declined-row {
            background-color: #f5f5f5 !important;
            color: #999;
            font-style: italic;
          }
        `}
      </style>
    </div>
  )
}
