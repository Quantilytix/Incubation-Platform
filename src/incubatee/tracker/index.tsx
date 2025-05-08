import React, { useEffect, useState } from 'react'
import {
  Layout,
  Card,
  Typography,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Button,
  Space,
  message,
  Divider
} from 'antd'
import {
  getDocs,
  collection,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { useNavigate } from 'react-router-dom'

const { Title } = Typography
const { Content } = Layout

const ApplicationTracker = () => {
  const [applications, setApplications] = useState<any[]>([])
  const [programs, setPrograms] = useState<any[]>([])
  const [companyCode, setCompanyCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([])
  const [beneficiaryName, setBeneficiaryName] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser
      if (!currentUser) return

      const userRef = doc(db, 'users', currentUser.uid)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) return

      const userData = userSnap.data()
      const companyCode = userData.companyCode || ''
      form.setFieldsValue({ companyCode })

      // 🔄 Save Beneficiary name if available
      if (userData.beneficiaryName) {
        setBeneficiaryName(userData.beneficiaryName)
      }

      // 🔽 Fetch all programs
      const programsSnap = await getDocs(
        query(
          collection(db, 'programs'),
          where('companyCode', '==', companyCode)
        )
      )
      const allPrograms = programsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // 🔎 Fetch user's participants (applications)
      const participantSnap = await getDocs(
        query(
          collection(db, 'participants'),
          where('email', '==', currentUser.email)
        )
      )

      const appliedProgramIds = new Set<string>()
      participantSnap.docs.forEach(doc => {
        const interventions = doc.data().interventions?.required || []
        interventions.forEach((i: any) => {
          if (i.id) appliedProgramIds.add(i.id)
        })
      })

      // ❌ Filter out already-applied programs
      const filteredPrograms = allPrograms.filter(
        p => !appliedProgramIds.has(p.id)
      )
      setAvailablePrograms(filteredPrograms)

      // 🎯 Prepare interventions for selection step (if needed)
      const rawInterventions = filteredPrograms.map(p => ({
        id: p.id,
        title: p.interventionTitle,
        area: p.areaOfSupport
      }))

      // 🧠 Group interventions by area
      const areaMap: Record<string, { id: string; title: string }[]> = {}
      rawInterventions.forEach(intervention => {
        if (!areaMap[intervention.area]) {
          areaMap[intervention.area] = []
        }
        areaMap[intervention.area].push({
          id: intervention.id,
          title: intervention.title
        })
      })

      const fetchedGroups = Object.entries(areaMap).map(
        ([area, interventions]) => ({
          area,
          interventions
        })
      )

      setInterventionGroups(fetchedGroups)
    }

    fetchUserData()
  }, [])

  const statusCounts = {
    Accepted: applications.filter(
      app => app.applicationStatus?.toLowerCase() === 'accepted'
    ).length,
    Declined: applications.filter(
      app => app.applicationStatus?.toLowerCase() === 'declined'
    ).length,
    Pending: applications.filter(
      app => app.applicationStatus?.toLowerCase() === 'pending'
    ).length,
    Total: applications.length
  }

  const applicationColumns = [
    {
      title: 'Program',
      dataIndex: 'programName'
    },
    {
      title: 'Status',
      dataIndex: 'applicationStatus',
      render: (text: string) => {
        const status = text?.toLowerCase()
        const color =
          status === 'accepted'
            ? 'green'
            : status === 'declined'
            ? 'red'
            : 'gold'
        return <Tag color={color}>{status?.toUpperCase()}</Tag>
      }
    },
    {
      title: 'Compliance',
      dataIndex: 'complianceRate',
      render: (rate: number) => <strong>{rate}%</strong>
    }
  ]

  const programColumns = [
    {
      title: 'Title',
      dataIndex: 'name'
    },
    {
      title: 'Type',
      dataIndex: 'type'
    },
    {
      title: 'Action',
      render: (record: any) => {
        const alreadyApplied = applications.some(app =>
          app.interventions?.required?.some((i: any) => i.id === record.id)
        )

        const handleApply = () => {
          if (record.registrationLink) {
            navigate(record.registrationLink)
          } else {
            message.warning('This program does not have a registration link.')
          }
        }

        return (
          <Button
            type='primary'
            disabled={alreadyApplied}
            onClick={handleApply}
          >
            {alreadyApplied ? 'Applied' : 'Apply'}
          </Button>
        )
      }
    }
  ]

  return (
    <Layout style={{ padding: '24px', background: '#fff' }}>
      <Content>
        <Card bordered={false} style={{ padding: '24px' }}>
          <Space direction='vertical' size='large' style={{ width: '100%' }}>
            <Title level={3}>🎯 My Application Tracker</Title>

            <Card bordered style={{ background: '#fafafa' }}>
              <Row gutter={[24, 24]}>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Total Applications'
                    value={statusCounts.Total}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Accepted'
                    value={statusCounts.Accepted}
                    valueStyle={{ color: 'green' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Pending'
                    value={statusCounts.Pending}
                    valueStyle={{ color: 'orange' }}
                  />
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <Statistic
                    title='Declined'
                    value={statusCounts.Declined}
                    valueStyle={{ color: 'red' }}
                  />
                </Col>
              </Row>
            </Card>

            <Divider />

            <Card title='📋 My Applications' bodyStyle={{ padding: 0 }}>
              <Table
                rowKey='id'
                columns={applicationColumns}
                dataSource={applications}
                loading={loading}
                pagination={{ pageSize: 5 }}
                style={{ padding: '16px' }}
              />
            </Card>

            <Card title='🗂️ Available Programs' bodyStyle={{ padding: 0 }}>
              <Table
                rowKey='id'
                columns={programColumns}
                dataSource={programs}
                loading={loading}
                pagination={{ pageSize: 5 }}
                style={{ padding: '16px' }}
              />
            </Card>
          </Space>
        </Card>
      </Content>
    </Layout>
  )
}

export default ApplicationTracker
