import React, { useEffect, useState } from 'react'
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
  Button,
  Tabs,
  Select
} from 'antd'
import {
  DollarOutlined,
  UserOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  GlobalOutlined
} from '@ant-design/icons'

const { Title } = Typography
const { TabPane } = Tabs
const { Option } = Select

const allSMEsByYear = {
  2024: [
    {
      id: 1,
      name: 'BrightTech',
      sector: 'ICT',
      developmentType: 'Enterprise Development',
      revenue: 150000,
      headcount: 10,
      interventions: 5,
      participation: 'Excellent'
    },
    {
      id: 2,
      name: 'Green Farms',
      sector: 'Agriculture',
      developmentType: 'Supplier Development',
      revenue: 80000,
      headcount: 6,
      interventions: 3,
      participation: 'Moderate'
    },
    {
      id: 3,
      name: 'SolarPlus',
      sector: 'Energy',
      developmentType: 'Enterprise Development',
      revenue: 220000,
      headcount: 14,
      interventions: 6,
      participation: 'Good'
    },
    {
      id: 4,
      name: 'EduNext',
      sector: 'Education',
      developmentType: 'Supplier Development',
      revenue: 40000,
      headcount: 3,
      interventions: 1,
      participation: 'Poor'
    }
  ]
}

export const FunderDashboard: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState('2024')
  const [devFilter, setDevFilter] = useState('All')
  const [filteredSMEs, setFilteredSMEs] = useState<any[]>([])

  useEffect(() => {
    const data = allSMEsByYear[selectedYear] || []
    if (devFilter === 'All') {
      setFilteredSMEs(data)
    } else {
      setFilteredSMEs(data.filter(sme => sme.developmentType === devFilter))
    }
  }, [selectedYear, devFilter])

  const renderSMETable = () => (
    <Table
      dataSource={filteredSMEs}
      rowKey='id'
      columns={[
        { title: 'Name', dataIndex: 'name' },
        { title: 'Sector', dataIndex: 'sector' },
        { title: 'Development Type', dataIndex: 'developmentType' },
        {
          title: 'Cumulative Revenue (R)',
          dataIndex: 'revenue',
          render: val => `R${val.toLocaleString()}`
        },
        {
          title: 'Head Count',
          dataIndex: 'headcount'
        },
        {
          title: 'Participation Rate',
          dataIndex: 'participation',
          render: text => {
            const colors = {
              Excellent: 'green',
              Good: 'blue',
              Moderate: 'orange',
              Poor: 'volcano',
              Bad: 'red'
            }
            return <Tag color={colors[text] || 'default'}>{text}</Tag>
          }
        },
        {
          title: 'Interventions Completed',
          dataIndex: 'interventions'
        },
        {
          title: 'Actions',
          render: (_, record) => (
            <>
              <Button
                type='link'
                icon={<EyeOutlined />}
                onClick={() => console.log('View SME', record.id)}
              >
                View
              </Button>
              <Button
                type='link'
                icon={<DownloadOutlined />}
                onClick={() => console.log('Download for', record.id)}
              >
                Download
              </Button>
            </>
          )
        }
      ]}
    />
  )

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Sponsor Dashboard</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col>
          <Select value={selectedYear} onChange={setSelectedYear}>
            <Option value='2024'>2024</Option>
          </Select>
        </Col>
        <Col>
          <Select value={devFilter} onChange={setDevFilter}>
            <Option value='All'>All Types</Option>
            <Option value='Enterprise Development'>
              Enterprise Development
            </Option>
            <Option value='Supplier Development'>Supplier Development</Option>
          </Select>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Total SMEs'
              value={filteredSMEs.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Interventions Completed'
              value={filteredSMEs.reduce(
                (acc, sme) => acc + (sme.interventions || 0),
                0
              )}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Cumulative Revenue'
              value={
                'R' +
                filteredSMEs
                  .reduce((acc, sme) => acc + (sme.revenue || 0), 0)
                  .toLocaleString()
              }
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title='Market Linkages'
              value={filteredSMEs.reduce(
                (acc, sme) => acc + (sme.headcount || 0),
                0
              )}
              prefix={<GlobalOutlined />}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey='1'>
              <TabPane tab='SMEs' key='1'>
                {renderSMETable()}
              </TabPane>
              <TabPane tab='Reports' key='2'>
                <p>Reports content coming soon...</p>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
