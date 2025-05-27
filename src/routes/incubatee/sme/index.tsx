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
import { FileTextOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { db } from '@/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import dayjs from 'dayjs'
import { auth } from 'firebase'
import { Helmet } from 'react-helmet'

const { Title, Paragraph } = Typography
const { Header, Content } = Layout
const { TabPane } = Tabs

function checkEligibility (participant, criteria = {}) {
  if (!criteria || Object.keys(criteria).length === 0) return null // Open to all

  // Min/Max Age
  if (criteria.minAge && participant.age < criteria.minAge)
    return `Minimum age is ${criteria.minAge}`
  if (criteria.maxAge && participant.age > criteria.maxAge)
    return `Maximum age is ${criteria.maxAge}`

  // Gender
  if (
    criteria.gender &&
    criteria.gender.length &&
    !criteria.gender.includes(participant.gender)
  )
    return `Eligible gender(s): ${criteria.gender.join(', ')}`

  // Sector
  if (
    criteria.sector &&
    criteria.sector.length &&
    !criteria.sector.includes(participant.sector)
  )
    return `Sector must be one of: ${criteria.sector.join(', ')}`

  // Province
  if (
    criteria.province &&
    criteria.province.length &&
    !criteria.province.includes(participant.province)
  )
    return `Province must be one of: ${criteria.province.join(', ')}`

  // BEE Level
  if (
    criteria.beeLevel &&
    criteria.beeLevel.length &&
    !criteria.beeLevel.includes(participant.beeLevel)
  )
    return `Allowed BEE Levels: ${criteria.beeLevel.join(', ')}`

  // Years of trading
  if (
    criteria.minYearsOfTrading &&
    participant.yearsOfTrading < criteria.minYearsOfTrading
  )
    return `At least ${criteria.minYearsOfTrading} year(s) of trading required`

  // Ownership
  if (
    criteria.youthOwnedPercent !== undefined &&
    +participant.youthOwnedPercent < +criteria.youthOwnedPercent
  )
    return `At least ${criteria.youthOwnedPercent}% youth ownership required`
  if (
    criteria.blackOwnedPercent !== undefined &&
    +participant.blackOwnedPercent < +criteria.blackOwnedPercent
  )
    return `At least ${criteria.blackOwnedPercent}% black ownership required`
  if (
    criteria.femaleOwnedPercent !== undefined &&
    +participant.femaleOwnedPercent < +criteria.femaleOwnedPercent
  )
    return `At least ${criteria.femaleOwnedPercent}% female ownership required`

  // Custom note (doesn't block, just show)
  return null
}

const SMEDashboard = () => {
  const [recommended, setRecommended] = useState<any[]>([])
  const [allPrograms, setAllPrograms] = useState<any[]>([])
  const [profileDrawerVisible, setProfileDrawerVisible] = useState(false)
  const [smeProfileForm] = useForm()
  const [programModalVisible, setProgramModalVisible] = useState(false)
  const [activeProgram, setActiveProgram] = useState<any>(null)
  const [applicationForm] = useForm()

  const [loading, setLoading] = useState(false)
  const [companyCode, setCompanyCode] = useState<string | null>(null)

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
    const getCompanyCode = async () => {
      const user = auth.currentUser
      if (user && user.uid) {
        // Assuming you store user info in Firestore "users" collection
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('email', '==', user.email))
        )
        if (!userSnap.empty) {
          setCompanyCode(userSnap.docs[0].data().companyCode || null)
        }
      }
    }
    getCompanyCode()
  }, [])

  const fetchPrograms = async () => {
    setLoading(true)
    try {
      const ref = collection(db, 'programs')

      let q
      if (companyCode) {
        // Filter by companyCode **and** status
        q = query(
          ref,
          where('status', 'in', [
            'Active',
            'Planned',
            'active',
            'planned',
            'Upcoming',
            'upcoming'
          ]),
          where('companyCode', '==', companyCode)
        )
      } else {
        // Show all active/planned if no companyCode
        q = query(
          ref,
          where('status', 'in', ['Active', 'Planned', 'active', 'planned'])
        )
      }

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
      message.error('Failed to load programs.')
      console.error(err)
    } finally {
      console.log(companyCode)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPrograms()
  }, [companyCode])

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

      const q = query(
        collection(db, 'participants'),
        where('email', '==', user.email)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        message.warning('Please complete your profile before applying.')
        navigate('/incubatee/profile')
        return
      }

      const participantDoc = snapshot.docs[0]
      const participant = participantDoc.data()
      const participantId = participantDoc.id

      if (!participant.setup) {
        message.warning('Please finish your profile setup before registering.')
        navigate('/incubatee/profile')
        return
      }

      // ✅ Check for existing application
      const existingAppSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('participantId', '==', participantId),
          where('programId', '==', program.id)
        )
      )

      if (!existingAppSnap.empty) {
        message.info('You’ve already applied to this program.')
        return
      }

      const eligibilityMessage = checkEligibility(
        participant,
        program.eligibilityCriteria
      )
      if (eligibilityMessage) {
        Modal.warning({
          title: 'Not Eligible',
          content: (
            <div>
              <b>You do not meet this program’s eligibility:</b>
              <div style={{ marginTop: 8 }}>{eligibilityMessage}</div>
            </div>
          )
        })
        return
      }

      applicationForm.setFieldsValue({
        ownerName: participant.ownerName || '',
        companyName: participant.companyName || '',
        email: participant.email || ''
      })

      setActiveProgram(program)
      setProgramModalVisible(true)
    } catch (error) {
      console.error('❌ Failed to verify profile/setup/application:', error)
      message.error('Could not verify your eligibility.')
    }
  }

  const submitApplication = async () => {
    try {
      const values = await applicationForm.validateFields()

      const query = new URLSearchParams({
        id: activeProgram.id,
        code: activeProgram.companyCode,
        program: activeProgram.name
      }).toString()

      navigate(`/registration/onboarding?${query}`)
    } catch (err) {
      message.error('Please complete all required fields')
    }
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
    <>
      <Helmet>
        <title>Programs Dashboard | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Explore recommended and active programs available to your SME.'
        />
      </Helmet>

      <div
        style={{
          padding: 24,
          background: '#fff',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}
      >
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
      </div>

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
          {activeProgram?.eligibilityCriteria &&
            Object.entries(activeProgram.eligibilityCriteria).map(
              ([key, value]) => (
                <li key={key}>
                  {key === 'minAge' && `Minimum age: ${value}`}
                  {key === 'maxAge' && `Maximum age: ${value}`}
                  {key === 'gender' && `Allowed gender(s): ${value.join(', ')}`}
                  {key === 'sector' && `Sector(s): ${value.join(', ')}`}
                  {key === 'province' && `Province(s): ${value.join(', ')}`}
                  {key === 'beeLevel' &&
                    `Allowed BEE Level(s): ${value.join(', ')}`}
                  {key === 'minYearsOfTrading' &&
                    `Min years of trading: ${value}`}
                  {key === 'youthOwnedPercent' &&
                    `Min youth ownership: ${value}%`}
                  {key === 'femaleOwnedPercent' &&
                    `Min female ownership: ${value}%`}
                  {key === 'blackOwnedPercent' &&
                    `Min black ownership: ${value}%`}
                  {key === 'custom' && (
                    <span style={{ fontStyle: 'italic' }}>{value}</span>
                  )}
                </li>
              )
            )}
          {!activeProgram?.eligibilityCriteria ||
          Object.keys(activeProgram.eligibilityCriteria).length === 0 ? (
            <li>Open to all (no restrictions)</li>
          ) : null}
        </ul>
      </Modal>
    </>
  )
}

export default SMEDashboard
