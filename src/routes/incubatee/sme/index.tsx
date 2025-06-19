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
  Layout,
  Statistic,
  Badge
} from 'antd'
import { useForm } from 'antd/lib/form/Form'
import {
  FileTextOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  StarOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { db } from '@/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import dayjs from 'dayjs'
import { auth } from 'firebase'
import { Helmet } from 'react-helmet'

const { Title, Paragraph, Text } = Typography
const { TabPane } = Tabs

const eligibilityLabels = {
  minAge: label => `Minimum age: ${label}`,
  maxAge: label => `Maximum age: ${label}`,
  gender: label =>
    `Allowed gender(s): ${Array.isArray(label) ? label.join(', ') : label}`,
  sector: label =>
    `Sector(s): ${Array.isArray(label) ? label.join(', ') : label}`,
  province: label =>
    `Province(s): ${Array.isArray(label) ? label.join(', ') : label}`,
  beeLevel: label =>
    `Allowed BEE Level(s): ${Array.isArray(label) ? label.join(', ') : label}`,
  minYearsOfTrading: label => `Min years of trading: ${label}`,
  youthOwnedPercent: label => `Min youth ownership: ${label}%`,
  femaleOwnedPercent: label => `Min female ownership: ${label}%`,
  blackOwnedPercent: label => `Min black ownership: ${label}%`,
  custom: label => <span style={{ fontStyle: 'italic' }}>{label}</span>
}
  
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

  function renderEligibilityCriteria (criteria) {
    if (!criteria || Object.keys(criteria).length === 0) {
      return <li>Open to all (no restrictions)</li>
    }
    return Object.entries(criteria).map(([key, value]) => (
      <li key={key}>
        {eligibilityLabels[key]
          ? eligibilityLabels[key](value)
          : `${key}: ${value}`}
      </li>
    ))
  }

const SMEDashboard = () => {
  const [recommended, setRecommended] = useState<any[]>([])
  const [allPrograms, setAllPrograms] = useState<any[]>([])
  const [appliedPrograms, setAppliedPrograms] = useState<Set<string>>(new Set())
  const [programModalVisible, setProgramModalVisible] = useState(false)
  const [activeProgram, setActiveProgram] = useState<any>(null)
  const [applicationForm] = useForm()
  const [eligibleCount, setEligibleCount] = useState(0)

  const [loading, setLoading] = useState(false)
  const [companyCode, setCompanyCode] = useState<string | null>(null)

  const [cohortYearOptions, setCohortYearOptions] = useState<string[]>([])
  const [typeOptions, setTypeOptions] = useState<string[]>([])
  const [filters, setFilters] = useState({ type: 'all', cohort: 'all' })

  const navigate = useNavigate()

  useEffect(() => {
    const getCompanyCode = async () => {
      const user = auth.currentUser
      if (user && user.uid) {
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
    if (!companyCode) return
    setLoading(true)
    try {
      const user = auth.currentUser
      const ref = collection(db, 'programs')

      const q = query(
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

      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => {
        const raw = doc.data()
        return {
          id: doc.id,
          ...raw,
          startDate: raw.startDate?.toDate?.() ?? new Date(raw.startDate)
        }
      })

      const recommendedPrograms = data.filter(
        p =>
          p.name?.toLowerCase().includes('market') ||
          p.description?.toLowerCase().includes('funding')
      )

      setRecommended(recommendedPrograms)
      setAllPrograms(data)
      setCohortYearOptions(
        [...new Set(data.map(p => p.cohortYear || 'Unknown'))].sort()
      )
      setTypeOptions([...new Set(data.map(p => p.type || 'Unknown'))].sort())

      if (user?.email) {
        const participantSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )
        if (!participantSnap.empty) {
          const participantDoc = participantSnap.docs[0]
          const participantId = participantDoc.id
          const participant = participantDoc.data()
          const appSnap = await getDocs(
            query(
              collection(db, 'applications'),
              where('participantId', '==', participantId)
            )
          )
          const appliedIds = new Set(
            appSnap.docs.map(doc => doc.data().programId)
          )
          setAppliedPrograms(appliedIds)

          // 🟢 Eligibility check count
          const eligiblePrograms = data.filter(
            p => !checkEligibility(participant, p.eligibilityCriteria)
          )
          setEligibleCount(eligiblePrograms.length)
        }
      }
    } catch (err) {
      message.error('Failed to load programs.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const isNewProgram = (createdAt: Date, programId: string) => {
    if (appliedPrograms.has(programId)) return false
    const now = dayjs()
    return dayjs(createdAt).isAfter(now.subtract(7, 'day'))
  }

  useEffect(() => {
    if (companyCode !== null) {
      fetchPrograms()
    }
  }, [companyCode])

  const filteredPrograms = allPrograms.filter(p => {
    return (
      (filters.type === 'all' || p.type === filters.type) &&
      (filters.cohort === 'all' || p.cohortYear === filters.cohort)
    )
  })

  const renderProgramCard = (program: any) => {
    const hasApplied = appliedPrograms.has(program.id)
    return (
      <Col xs={24} sm={12} md={8} lg={6} key={program.id}>
        <Badge.Ribbon
          text={isNewProgram(program.createdAt, program.id) ? 'New' : ''}
          color='cyan'
        >
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
              hasApplied ? (
                <Button size='small' disabled type='default'>
                  Applied
                </Button>
              ) : (
                <Button
                  size='small'
                  type='link'
                  icon={<FileTextOutlined />}
                  onClick={() => openProgramModal(program)}
                >
                  View
                </Button>
              )
            ]}
          >
            <div>
              <Title level={5} style={{ marginBottom: 4 }}>
                {program.name}
              </Title>
              <Tag color='magenta' style={{ marginBottom: 8 }}>
                {program.companyCode}
              </Tag>
              <Tag color='blue' style={{ marginBottom: 8 }}>
                {program.type}
              </Tag>
              <Tag color='gold' style={{ marginBottom: 12 }}>
                Cohort: {program.cohortYear || '—'}
              </Tag>
              <Paragraph type='secondary' ellipsis={{ rows: 3 }}>
                {program.description}
              </Paragraph>
            </div>

            <Divider style={{ margin: '12px 0' }} />
            <Tag color='green'>
              Starts {dayjs(program.startDate).format('MMM YYYY')}
            </Tag>
          </Card>
        </Badge.Ribbon>
      </Col>
    )
  }

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
  return (
    <>
      <Helmet>
        <title>Programs Dashboard | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Explore recommended and active programs available to your SME.'
        />
      </Helmet>

      <div style={{ padding: 24, background: '#fff', minHeight: '100vh' }}>
        <Title level={3}>📃 Program Opportunities</Title>
        <Divider>Metrics</Divider>
        <Card bordered style={{ background: '#fafafa' }}>
          <Row gutter={16} style={{ marginBottom: 24, marginTop: 10 }}>
            <Col span={6}>
              <Statistic
                title='Total Programs'
                value={allPrograms.length}
                prefix={<AppstoreOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title='Eligible'
                value={eligibleCount}
                prefix={<CheckCircleOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title='Recommended'
                value={recommended.length}
                prefix={<StarOutlined />}
              />
            </Col>
            <Col span={6}>
              <Select
                value={filters.type}
                onChange={val => setFilters(prev => ({ ...prev, type: val }))}
                style={{ width: '100%' }}
                placeholder='Filter by Type'
              >
                <Select.Option value='all'>All Types</Select.Option>
                {typeOptions.map(type => (
                  <Select.Option key={type} value={type}>
                    {type}
                  </Select.Option>
                ))}
              </Select>
              <Select
                value={filters.cohort}
                onChange={val => setFilters(prev => ({ ...prev, cohort: val }))}
                style={{ width: '100%', marginTop: 8 }}
                placeholder='Filter by Cohort Year'
              >
                <Select.Option value='all'>All Cohorts</Select.Option>
                {cohortYearOptions.map(cohort => (
                  <Select.Option key={cohort} value={cohort}>
                    {cohort}
                  </Select.Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Card>

        <Tabs defaultActiveKey='recommended'>
          <TabPane tab='All Programs' key='all'>
            {loading ? (
              <Spin />
            ) : filteredPrograms.length > 0 ? (
              <Row gutter={[16, 16]}>
                {filteredPrograms.map(renderProgramCard)}
              </Row>
            ) : (
              <Paragraph>No programs found.</Paragraph>
            )}
          </TabPane>
        </Tabs>

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
            {renderEligibilityCriteria(activeProgram?.eligibilityCriteria)}
          </ul>
        </Modal>
      </div>
    </>
  )
}

export default SMEDashboard
