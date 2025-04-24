import React, { useState } from 'react'
import { Table, Button, Modal, Typography, Tag, List } from 'antd'
import {
  CheckOutlined,
  FileTextOutlined,
  LinkOutlined,
  PictureOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const { Title, Paragraph } = Typography

const mockData = [
  {
    id: 1,
    sme: 'BrightTech',
    title: 'Website Development',
    timeSpent: '5',
    description: 'Create a full SME landing page with domain & hosting',
    status: 'In Progress',
    resources: [
      {
        type: 'document',
        label: 'Brand Brief PDF',
        link: '/docs/brighttech-brief.pdf'
      },
      {
        type: 'link',
        label: 'Sample Website',
        link: 'https://example.com/sample-site'
      }
    ]
  },
  {
    id: 2,
    sme: 'Green Farms',
    title: 'Financial Literacy Training',
    timeSpent: '10',
    description: 'Basic budgeting and record keeping for Agri-SMEs',
    status: 'Assigned',
    resources: [
      {
        type: 'document',
        label: 'Budget Template',
        link: '/docs/budget-template.xlsx'
      },
      {
        type: 'image',
        label: 'Training Snapshot',
        link: '/images/greenfarms-training.jpg'
      }
    ]
  }
]

export const AssignedInterventions: React.FC = () => {
  const [selected, setSelected] = useState<any | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const navigate = useNavigate()

  const openDetails = (record: any) => {
    setSelected(record)
    setModalOpen(true)
  }

  const columns = [
    { title: 'SME', dataIndex: 'sme' },
    { title: 'Intervention', dataIndex: 'title' },
    {
      title: 'Time Spent (hrs)',
      dataIndex: 'timeSpent'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'Completed' ? 'green' : 'blue'}>{status}</Tag>
      )
    },
    {
      title: 'Action', // ✅ Renamed here
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 12 }}>
          <Button type='link' onClick={() => openDetails(record)}>
            View Resources
          </Button>
          <Button
            type='link'
            icon={<CheckOutlined />}
            onClick={() =>
              navigate(`/consultant/allocated/intervention/${record.id}`)
            }
          >
            Update
          </Button>
        </div>
      )
    }
  ]

  const getIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileTextOutlined />
      case 'link':
        return <LinkOutlined />
      case 'image':
        return <PictureOutlined />
      default:
        return null
    }
  }

  return (
    <>
      <Title level={4}>Assigned Interventions</Title>
      <Table dataSource={mockData} columns={columns} rowKey='id' />

      <Modal
        open={modalOpen}
        title='Intervention Details & Resources'
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        {selected && (
          <>
            <Title level={5}>{selected.title}</Title>
            <Paragraph>
              <b>SME:</b> {selected.sme}
              <br />
              <b>Time Spent:</b> {selected.timeSpent} hours
              <br />
              <b>Status:</b> {selected.status}
            </Paragraph>
            <Paragraph>
              <b>Description:</b> <br />
              {selected.description}
            </Paragraph>

            <Paragraph>
              <b>Reference Material:</b>
            </Paragraph>
            <List
              dataSource={selected.resources}
              renderItem={(item: any) => (
                <List.Item>
                  {getIcon(item.type)}{' '}
                  <a href={item.link} target='_blank' rel='noopener noreferrer'>
                    {item.label}
                  </a>
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </>
  )
}
