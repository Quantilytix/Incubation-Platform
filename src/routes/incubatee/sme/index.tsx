// src/pages/SMEDashboard.tsx
import React, { useEffect, useState } from 'react'
import {
  Typography,
  Row,
  Col,
  Card,
  Tag,
  Spin,
  Button,
  Divider,
  Tabs,
  Avatar,
  Drawer,
  Form,
  Input,
  Select,
  InputNumber,
  DatePicker,
  message,
  Modal,
  Layout
} from 'antd'
import { useForm } from 'antd/lib/form/Form'
import {
  FileTextOutlined,
  StarOutlined,
  StarFilled,
  UserOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { db } from '@/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import dayjs from 'dayjs'

const { Title, Paragraph } = Typography
const { Header, Content } = Layout
const { TabPane } = Tabs

const SMEDashboard = () => {
  const [recommended, setRecommended] = useState<any[]>([])
  const [allPrograms, setAllPrograms] = useState<any[]>([])
  const [profileDrawerVisible, setProfileDrawerVisible] = useState(false)
  const [smeProfileForm] = useForm()
  const [programModalVisible, setProgramModalVisible] = useState(false)
  const [activeProgram, setActiveProgram] = useState<any>(null)
  const [applicationForm] = useForm()

  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  // Generate recent months and years
  const currentMonth = dayjs().month()
  const currentYear = dayjs().year()
  // Last 3 months
  const last3Months = Array.from({ length: 3 }, (_, i) =>
    dayjs().subtract(i, 'month').format('MMMM')
  ).reverse()

  // Last 2 years
  const last2Years = Array.from({ length: 2 }, (_, i) => `${currentYear - i}`)

  useEffect(() => {
    fetchPrograms()
  }, [])

  useEffect(() => {
    const handleOpen = () => setProfileDrawerVisible(true)
    window.addEventListener('openSmeProfileDrawer', handleOpen)
    return () => window.removeEventListener('openSmeProfileDrawer', handleOpen)
  }, [])

  const fetchPrograms = async () => {
    setLoading(true)
    try {
      const ref = collection(db, 'supportPrograms')
      const q = query(ref, where('status', 'in', ['active', 'planned']))
      const snapshot = await getDocs(q)

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Example logic: recommend programs based on tags/keywords
      const recommendedPrograms = data.filter(
        p =>
          p.programName.toLowerCase().includes('market') ||
          p.description.toLowerCase().includes('sme')
      )

      setRecommended(recommendedPrograms)
      setAllPrograms(data)
    } catch (err) {
      message.error('Failed to load support programs.')
    } finally {
      setLoading(false)
    }
  }
  const openProfileDrawer = () => {
    const profile = localStorage.getItem('smeProfile')
    if (profile) smeProfileForm.setFieldsValue(JSON.parse(profile))
    setProfileDrawerVisible(true)
  }
  const openProgramModal = (program: any) => {
    const profile = JSON.parse(localStorage.getItem('smeProfile') || '{}')
    applicationForm.setFieldsValue({
      ownerName: profile.ownerName || '',
      companyName: profile.companyName || '',
      email: profile.email || ''
    })
    setActiveProgram(program)
    setProgramModalVisible(true)
  }
  const submitApplication = async () => {
    try {
      const values = await applicationForm.validateFields()
      console.log('Application Submitted:', {
        ...values,
        programId: activeProgram.id,
        submittedAt: new Date()
      })
      message.success('Application submitted!')
      setProgramModalVisible(false)
    } catch (err) {
      message.error('Please complete all required fields')
    }
  }

  const saveProfile = async () => {
    const values = await smeProfileForm.validateFields()
    localStorage.setItem('smeProfile', JSON.stringify(values))
    message.success('Profile saved successfully')
    setProfileDrawerVisible(false)
  }

  const renderProgramCard = (program: any) => (
    <Col xs={24} sm={12} md={8} lg={6} key={program.id}>
      <Card
        hoverable
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
        actions={[
          <Button
            size='small'
            type='link'
            icon={<FileTextOutlined />}
            onClick={() => openProgramModal(program)}
          >
            View
          </Button>
        ]}
      >
        <div>
          <Title level={5} style={{ marginBottom: 4 }}>
            {program.programName}
          </Title>
          <Tag color='blue' style={{ marginBottom: 12 }}>
            {program.programType}
          </Tag>
          <Paragraph type='secondary' ellipsis={{ rows: 3 }}>
            {program.description}
          </Paragraph>
        </div>

        <Divider style={{ margin: '12px 0' }} />
        <Tag color='green'>
          Starts {dayjs(program.startDate?.toDate()).format('MMM YYYY')}
        </Tag>
      </Card>
    </Col>
  )

  return (
    <Layout>
      <Content style={{ padding: '16px 32px' }}>
        <Tabs defaultActiveKey='recommended'>
          <TabPane tab='Recommended for You' key='recommended'>
            {loading ? (
              <Spin />
            ) : recommended.length > 0 ? (
              <Row gutter={[16, 16]}>{recommended.map(renderProgramCard)}</Row>
            ) : (
              <Paragraph>No recommended programs at this time.</Paragraph>
            )}
          </TabPane>

          <TabPane tab='All Programs' key='all'>
            {loading ? (
              <Spin />
            ) : allPrograms.length > 0 ? (
              <Row gutter={[16, 16]}>{allPrograms.map(renderProgramCard)}</Row>
            ) : (
              <Paragraph>No programs found.</Paragraph>
            )}
          </TabPane>
        </Tabs>
      </Content>

      <Drawer
        title='SME Profile Setup'
        width={500}
        onClose={() => setProfileDrawerVisible(false)}
        open={profileDrawerVisible}
        footer={
          <Button type='primary' onClick={saveProfile} block>
            Save Profile
          </Button>
        }
      >
        <Form layout='vertical' form={smeProfileForm}>
          <Divider orientation='left'>Personal Details</Divider>
          <Form.Item
            name='ownerName'
            label='Owner Name'
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name='gender' label='Gender' rules={[{ required: true }]}>
            <Select>
              <Select.Option value='Male'>Male</Select.Option>
              <Select.Option value='Female'>Female</Select.Option>
              <Select.Option value='Other'>Other</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name='idNumber'
            label='ID Number'
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name='email' label='Email' rules={[{ type: 'email' }]}>
            <Input />
          </Form.Item>

          <Divider orientation='left'>Company Info</Divider>
          <Form.Item
            name='companyName'
            label='Company Name'
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name='blackOwnedPercent' label='Black-Owned Percentage'>
            <InputNumber
              min={0}
              max={100}
              style={{ width: '100%' }}
              addonAfter='%'
            />
          </Form.Item>
          <Form.Item name='beeLevel' label='BEEE Level'>
            <Select>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(level => (
                <Select.Option key={level} value={level}>
                  Level {level}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Divider orientation='left'>Monthly Revenue & Headcount</Divider>
          {last3Months.map(monthLabel => (
            <Row gutter={16} key={monthLabel}>
              <Col span={8}>
                <Form.Item
                  name={`revenue_${monthLabel}`}
                  label={`Revenue (${monthLabel})`}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    formatter={v =>
                      `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    }
                    parser={v => Number(v?.replace(/R\s?|(,*)/g, '') || 0)}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={`permHeadcount_${monthLabel}`}
                  label={`Perm. Staff`}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={`tempHeadcount_${monthLabel}`}
                  label={`Temp. Staff`}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          ))}

          <Divider orientation='left'>Annual Revenue & Headcount</Divider>
          {last2Years.map(year => (
            <Row gutter={16} key={year}>
              <Col span={8}>
                <Form.Item name={`revenue_${year}`} label={`Revenue (${year})`}>
                  <InputNumber
                    style={{ width: '100%' }}
                    formatter={v =>
                      `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                    }
                    parser={v => Number(v?.replace(/R\s?|(,*)/g, '') || 0)}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={`permHeadcount_${year}`} label={`Perm. Staff`}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name={`tempHeadcount_${year}`} label={`Temp. Staff`}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          ))}
        </Form>
      </Drawer>

      <Modal
        open={programModalVisible}
        title={activeProgram?.programName}
        onCancel={() => setProgramModalVisible(false)}
        onOk={submitApplication}
        okText='Submit Application'
        destroyOnClose
      >
        <Paragraph>{activeProgram?.description}</Paragraph>

        <Divider orientation='left'>Eligibility Criteria</Divider>
        <ul>
          <li>Minimum BEEE level: 4 or better</li>
          <li>Black-owned ≥ 51%</li>
          <li>Startup must be operational</li>
          {/* These could be dynamic from program definition later */}
        </ul>

        <Divider orientation='left'>Application Details</Divider>
        <Form layout='vertical' form={applicationForm} preserve={false}>
          <Form.Item
            name='motivation'
            label='Motivation for Applying'
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={3}
              placeholder='Why should we consider you for this program?'
            />
          </Form.Item>

          <Form.Item
            name='challenges'
            label='Key Business Challenges'
            rules={[{ required: true }]}
          >
            <Input.TextArea
              rows={3}
              placeholder='What challenges do you need help overcoming?'
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

export default SMEDashboard
