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
import { auth } from '@/firebase'
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
  const last2Years = Array.from({ length: 2 }, (_, i) => `${currentYear - i}`)useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged(user => {
    if (!user) {
      message.warning('You are not signed in')
    }
  })

  return () => unsubscribe()
}, [])
const fetchPrograms = async () => {
    setLoading(true)
    try {
      const ref = collection(db, 'programs')
      const q = query(
        ref,
        where('status', 'in', ['Active', 'Planned', 'active', 'planned'])
      )
      const snapshot = await getDocs(q)

      const data = snapshot.docs.map(doc => {
        const raw = doc.data()
        return {
          id: doc.id,
          ...raw,
          startDate: raw.startDate?.toDate?.() ?? new Date(raw.startDate)
        }
      })

      // Example logic: recommend programs based on tags/keywords
      const recommendedPrograms = data.filter(
        p =>
          p.name?.toLowerCase().includes('market') ||
          p.description?.toLowerCase().includes('funding')
      )

      setRecommended(recommendedPrograms)
      setAllPrograms(data)
    } catch (err) {
      message.error('Failed to load  programs.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrograms()
  }, [])

  useEffect(() => {
    const handleOpen = () => setProfileDrawerVisible(true)
    window.addEventListener('openSmeProfileDrawer', handleOpen)
    return () => window.removeEventListener('openSmeProfileDrawer', handleOpen)
  }, [])

  const openProgramModal = async (program: any) => {
    try {
      const user = auth.currentUser
      if (!user?.email) {
        message.error('You must be logged in to apply.')
        return
      }

      // 🔍 Check Firestore profile for setup flag
      const q = query(
        collection(db, 'participants'),
        where('email', '==', user.email)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        message.warning('Please complete your profile before applying.')
        setProfileDrawerVisible(true)
        return
      }

      const data = snapshot.docs[0].data()
      if (!data.setup) {
        message.warning('Please finish your profile setup before registering.')
        setProfileDrawerVisible(true)
        return
      }

      // ✅ Proceed if setup is true
      applicationForm.setFieldsValue({
        ownerName: data.ownerName || '',
        companyName: data.companyName || '',
        email: data.email || ''
      })

      setActiveProgram(program)
      setProgramModalVisible(true)
    } catch (err) {
      console.error('Failed to verify profile setup:', err)
      message.error('Could not verify your profile status.')
    }
  }

  const submitApplication = async () => {
    try {
      const values = await applicationForm.validateFields()

      const query = new URLSearchParams({
        code: activeProgram.companyCode,
        program: activeProgram.programName
      }).toString()

      navigate(`/registration/onboarding?${query}`)
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
            {program.name}
          </Title>
          <Tag color='magenta' style={{ marginBottom: 8 }}>
            {program.companyCode}
          </Tag>
          <Tag color='blue' style={{ marginBottom: 12 }}>
            {program.type}
          </Tag>
          <Paragraph type='secondary' ellipsis={{ rows: 3 }}>
            {program.description}
          </Paragraph>
        </div>

        <Divider style={{ margin: '12px 0' }} />
        <Tag color='green'>
          Starts{' '}
          {dayjs(
            typeof program.startDate === 'string'
              ? program.startDate
              : program.startDate?.toDate?.() || new Date()
          ).format('MMM YYYY')}
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
        title={activeProgram?.name}
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
      </Modal>
    </Layout>
  )
}

export default SMEDashboard
