import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Button,
  Badge,
  Table,
  Select,
  Input,
  Modal,
  Tabs,
  Statistic,
  Row,
  Col,
  Divider,
  Tag,
  message,
  Skeleton,
  Typography,
  Space,
  Alert
} from 'antd'
import {
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  UserOutlined,
  PieChartOutlined,
  RiseOutlined,
  FileOutlined
} from '@ant-design/icons'
import { db, auth } from '@/firebase'
import {
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  query,
  where
} from 'firebase/firestore'
import { motion } from 'framer-motion'

const { TabPane } = Tabs
const { Option } = Select
const { Text } = Typography

const ApplicationsDashboard = () => {
  const [loading, setLoading] = useState(false)
  const [applications, setApplications] = useState<any[]>([])
  const [selectedApplication, setSelectedApplication] = useState<any>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [selectedDocApp, setSelectedDocApp] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [genderFilter, setGenderFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>('all')
  const [companyCode, setCompanyCode] = useState<string | null>(null)

  // Get companyCode for current user
  useEffect(() => {
    async function getUserCompanyCode () {
      const user = auth.currentUser
      if (!user) return
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)
      setCompanyCode(userSnap.exists() ? userSnap.data()?.companyCode : null)
    }
    getUserCompanyCode()
  }, [])

  // Fetch applications
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
          applicationStatus: data.applicationStatus || 'Pending',
          growthPlanDocUrl: data.growthPlanDocUrl || null
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
    } catch (error) {
      console.error('Error fetching applications:', error)
      message.error('Failed to fetch applications')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (companyCode) fetchApplications()
  }, [companyCode])

  // Update application status
  const updateStatus = async (newStatus: string, docId: string) => {
    try {
      const ref = doc(db, 'applications', docId)

      // Step 1: Update status immediately
      await updateDoc(ref, { applicationStatus: newStatus })

      // Step 2: If accepted, assign compulsory interventions
      if (newStatus === 'accepted') {
        const applicationSnap = await getDoc(ref)
        const applicationData = applicationSnap.data()
        const companyCode = applicationData?.companyCode

        if (!companyCode) {
          console.warn('❗ companyCode missing on application, cannot proceed.')
          return
        }

        // Fetch compulsory interventions
        const interventionSnap = await getDocs(
          query(
            collection(db, 'interventions'),
            where('companyCode', '==', companyCode),
            where('isCompulsory', '==', 'yes') // or `true` if stored as boolean
          )
        )

        const compulsoryInterventions = interventionSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        console.log(
          '%c🔥 [Compulsory Interventions]',
          'color:orange',
          compulsoryInterventions
        )

        const newCompulsory = compulsoryInterventions
          .filter(i => i.id && i.interventionTitle && i.areaOfSupport)
          .map(i => ({
            id: i.id,
            title: i.interventionTitle,
            area: i.areaOfSupport
          }))

        const existingRequired = applicationData?.interventions?.required || []
        console.log(
          '%c🧾 [Existing Required Interventions]',
          'color:teal',
          existingRequired
        )

        const existingIds = new Set(
          existingRequired.map(item =>
            typeof item === 'string' ? item : item.id
          )
        )

        const filteredNew = newCompulsory.filter(i => {
          const isNew = !existingIds.has(i.id)
          if (!isNew) {
            console.log(`⚠️ Skipping duplicate: ${i.title} (${i.id})`)
          }
          return isNew
        })

        console.log('%c➕ [Interventions Added]', 'color:blue', filteredNew)

        const finalRequired = [...existingRequired, ...filteredNew]

        const allValid = finalRequired.every(i => i?.id && i?.title && i?.area)
        if (!allValid) {
          throw new Error(
            '❌ One or more interventions are missing required fields.'
          )
        }

        console.log(
          '%c✅ [Final Interventions to Save]',
          'color:green',
          finalRequired
        )

        await updateDoc(ref, {
          interventions: {
            ...(applicationData?.interventions || {}),
            required: finalRequired
          }
        })
      }

      message.success('Status updated successfully')
      await fetchApplications()

      const updatedApp = applications.find(app => app.id === docId)
      if (updatedApp) {
        setSelectedApplication(updatedApp)
      }
    } catch (error) {
      console.error('❌ Error updating status:', error)
      message.error('Failed to update status')
    }
  }

  // Filter applications based on search and filters
  const filteredApplications = useMemo(() => {
    return applications.filter(app => {
      const matchesSearch =
        app.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesGender =
        genderFilter === 'all' || app.gender === genderFilter
      const matchesStatus =
        statusFilter === 'all' || app.applicationStatus === statusFilter
      const matchesAgeGroup =
        ageGroupFilter === 'all' || app.ageGroup === ageGroupFilter

      return matchesSearch && matchesGender && matchesStatus && matchesAgeGroup
    })
  }, [applications, searchTerm, genderFilter, statusFilter, ageGroupFilter])

  // Calculate statistics
  const stats = useMemo(() => {
    const total = applications.length
    const accepted = applications.filter(
      app => app.applicationStatus === 'accepted'
    ).length
    const rejected = applications.filter(
      app => app.applicationStatus === 'rejected'
    ).length
    const pending = applications.filter(
      app => app.applicationStatus === 'pending'
    ).length

    return { total, accepted, rejected, pending }
  }, [applications])

  const genderDistribution = useMemo(() => {
    const distribution = applications.reduce((acc, app) => {
      acc[app.gender] = (acc[app.gender] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(distribution)
  }, [applications])

  const ageGroupDistribution = useMemo(() => {
    const distribution = applications.reduce((acc, app) => {
      acc[app.ageGroup] = (acc[app.ageGroup] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return Object.entries(distribution)
  }, [applications])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accept':
        return 'success'
      case 'reject':
        return 'error'
      case 'accepted':
        return 'success'
      case 'rejected':
        return 'error'
      case 'pending':
        return 'warning'
      default:
        return 'default'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return <CheckCircleOutlined />
      case 'rejected':
        return <CloseCircleOutlined />
      default:
        return <FileTextOutlined />
    }
  }

  const exportCSV = () => {
    const headers = [
      'Enterprise Name',
      'Email',
      'Gender',
      'Age Group',
      'Stage',
      'Hub',
      'Status',
      'AI Score'
    ]
    const rows = filteredApplications.map(app => [
      app.beneficiaryName,
      app.email,
      app.gender,
      app.ageGroup,
      app.stage,
      app.hub,
      app.applicationStatus,
      app.aiScore
    ])

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'applications.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns = [
    {
      title: 'Enterprise',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
    {
      title: 'Gender',
      dataIndex: 'gender',
      key: 'gender',
      responsive: ['md']
    },
    {
      title: 'Age Group',
      dataIndex: 'ageGroup',
      key: 'ageGroup',
      responsive: ['md']
    },
    {
      title: 'AI Score',
      dataIndex: 'aiScore',
      key: 'aiScore',
      render: (score: number) => (
        <Badge count={score} style={{ backgroundColor: '#faad14' }} />
      )
    },
    {
      title: 'Status',
      dataIndex: 'applicationStatus',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={getStatusColor(status)}
          text={
            <span>
              {getStatusIcon(status)}{' '}
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          }
        />
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text: string, record: any) => (
        <Space>
          <Button
            type='text'
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedDocApp(record)
              setIsModalVisible(true)
            }}
          />
          {record.growthPlanDocUrl && (
            <Button
              type='text'
              icon={<DownloadOutlined />}
              href={record.growthPlanDocUrl}
              target='_blank'
            />
          )}
        </Space>
      )
    }
  ]

  return (
    <div style={{ minHeight: '100vh', padding: 24 }}>
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            title: 'Total Applications',
            value: stats.total,
            icon: <FileTextOutlined />,
            color: '#1890ff',
            bgColor: '#e6f7ff'
          },
          {
            title: 'Accepted',
            value: stats.accepted,
            icon: <CheckCircleOutlined />,
            color: '#52c41a',
            bgColor: '#f6ffed'
          },
          {
            title: 'Rejected',
            value: stats.rejected,
            icon: <CloseCircleOutlined />,
            color: '#f5222d',
            bgColor: '#fff2f0'
          },
          {
            title: 'Pending',
            value: stats.pending,
            icon: <RiseOutlined />,
            color: '#faad14',
            bgColor: '#fffbe6'
          }
        ].map((metric, index) => (
          <Col span={24} md={12} lg={6} key={metric.title}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
                ease: 'easeOut'
              }}
              whileHover={{
                y: -3,
                boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
                transition: { duration: 0.2 }
              }}
            >
              <Card
                bordered={false}
                style={{
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  transition: 'all 0.3s ease',
                  borderRadius: 8,
                  border: '1px solid #d6e4ff'
                }}
                hoverable
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 8
                  }}
                >
                  <div
                    style={{
                      background: metric.bgColor,
                      padding: 8,
                      borderRadius: '50%',
                      marginRight: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {React.cloneElement(metric.icon, {
                      style: {
                        fontSize: 18,
                        color: metric.color
                      }
                    })}
                  </div>
                  <Text strong style={{ fontSize: 14 }}>
                    {metric.title}
                  </Text>
                </div>
                <Statistic
                  value={metric.value}
                  valueStyle={{
                    color: metric.color,
                    fontSize: 24,
                    fontWeight: 500
                  }}
                />
              </Card>
            </motion.div>
          </Col>
        ))}
      </Row>

      {/* Charts */}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: 'easeOut'
            }}
            whileHover={{
              y: -3,
              boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
              transition: { duration: 0.2 }
            }}
          >
            <Card
              title={
                <span>
                  <UserOutlined style={{ marginRight: 8 }} />
                  Gender Distribution
                </span>
              }
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                border: '1px solid #d6e4ff',
                background: '#fff'
              }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
              >
                {genderDistribution.map(([gender, count]) => (
                  <div
                    key={gender}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{gender}</span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <div
                        style={{
                          width: 160,
                          height: 8,
                          background: '#f0f0f0',
                          borderRadius: 4,
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            background: '#1890ff',
                            borderRadius: 4,
                            width: `${(count / stats.total) * 100}%`
                          }}
                        />
                      </div>
                      <span style={{ color: 'rgba(0, 0, 0, 0.45)', width: 32 }}>
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        </Col>
        <Col span={24} lg={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: 'easeOut'
            }}
            whileHover={{
              y: -3,
              boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
              transition: { duration: 0.2 }
            }}
          >
            <Card
              title={
                <span>
                  <PieChartOutlined style={{ marginRight: 8 }} />
                  Age Group Distribution
                </span>
              }
              bordered={false}
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Skeleton loading={loading} active paragraph={{ rows: 4 }}>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
                >
                  {ageGroupDistribution.map(([ageGroup, count]) => (
                    <div
                      key={ageGroup}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{ageGroup}</span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}
                      >
                        <div
                          style={{
                            width: 160,
                            height: 8,
                            background: '#f0f0f0',
                            borderRadius: 4,
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              background: '#13c2c2',
                              borderRadius: 4,
                              width: `${(count / stats.total) * 100}%`
                            }}
                          />
                        </div>
                        <span
                          style={{ color: 'rgba(0, 0, 0, 0.45)', width: 32 }}
                        >
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Skeleton>
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Filters and Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.4,
          delay: 0.1,
          ease: 'easeOut'
        }}
        whileHover={{
          y: -3,
          boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
          transition: { duration: 0.2 }
        }}
      >
        <Card
          title={
            <span>
              <FilterOutlined style={{ marginRight: 8 }} />
              Filters & Search
            </span>
          }
          bordered={false}
          style={{
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            transition: 'all 0.3s ease',
            borderRadius: 8,
            marginBottom: 16,
            border: '1px solid #d6e4ff'
          }}
        >
          <Row gutter={16}>
            <Col span={24} md={12} lg={6}>
              <Input
                placeholder='Search enterprises...'
                prefix={<SearchOutlined />}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </Col>
            <Col span={24} md={12} lg={6}>
              <Select
                style={{ width: '100%' }}
                value={genderFilter}
                onChange={setGenderFilter}
                placeholder='Filter by Gender'
              >
                <Option value='all'>All Genders</Option>
                <Option value='Male'>Male</Option>
                <Option value='Female'>Female</Option>
              </Select>
            </Col>
            <Col span={24} md={12} lg={6}>
              <Select
                style={{ width: '100%' }}
                value={ageGroupFilter}
                onChange={setAgeGroupFilter}
                placeholder='Filter by Age Group'
              >
                <Option value='all'>All Age Groups</Option>
                <Option value='Youth'>Youth</Option>
                <Option value='Adult'>Adult</Option>
                <Option value='Senior'>Senior</Option>
              </Select>
            </Col>
            <Col span={24} md={12} lg={6}>
              <Select
                style={{ width: '100%' }}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder='Filter by Status'
              >
                <Option value='all'>All Statuses</Option>
                <Option value='accepted'>Accepted</Option>
                <Option value='rejected'>Rejected</Option>
                <Option value='pending'>Pending</Option>
              </Select>
            </Col>
          </Row>
          <Divider />
          <Button
            type='default'
            onClick={() => {
              setSearchTerm('')
              setGenderFilter('all')
              setAgeGroupFilter('all')
              setStatusFilter('all')
            }}
          >
            Clear Filters
          </Button>
          <Button
            type='default'
            icon={<DownloadOutlined />}
            onClick={exportCSV}
            style={{ alignSelf: 'flex-end', marginLeft: 10 }}
          >
            Export CSV
          </Button>
        </Card>
      </motion.div>

      {/* Applications Table and Detail */}
      <Row gutter={16}>
        <Col span={24} lg={16}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: 'easeOut'
            }}
            whileHover={{
              y: -3,
              boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
              transition: { duration: 0.2 }
            }}
          >
            <Card
              title={`Applications (${filteredApplications.length})`}
              bordered={false}
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                marginBottom: 16,
                border: '1px solid #d6e4ff'
              }}
            >
              <Table
                columns={columns}
                dataSource={filteredApplications}
                rowKey='id'
                loading={loading}
                onRow={record => ({
                  onClick: () => setSelectedApplication(record),
                  style: { cursor: 'pointer' }
                })}
              />
            </Card>
          </motion.div>
        </Col>
        <Col span={24} lg={8}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.4,
              delay: 0.1,
              ease: 'easeOut'
            }}
            whileHover={{
              y: -3,
              boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
              transition: { duration: 0.2 }
            }}
          >
            <Card
              title='Application Details'
              bordered={false}
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              {selectedApplication ? (
                <Tabs defaultActiveKey='overview'>
                  <TabPane tab='Overview' key='overview'>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                      }}
                    >
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>
                          {selectedApplication.beneficiaryName}
                        </h3>
                        <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                          {selectedApplication.email}
                        </p>
                      </div>

                      <Row gutter={16}>
                        <Col span={12}>
                          <p style={{ fontWeight: 500 }}>Gender</p>
                          <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                            {selectedApplication.gender}
                          </p>
                        </Col>
                        <Col span={12}>
                          <p style={{ fontWeight: 500 }}>Age Group</p>
                          <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                            {selectedApplication.ageGroup}
                          </p>
                        </Col>
                        <Col span={12}>
                          <p style={{ fontWeight: 500 }}>Stage</p>
                          <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                            {selectedApplication.stage}
                          </p>
                        </Col>
                        <Col span={12}>
                          <p style={{ fontWeight: 500 }}>Hub</p>
                          <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                            {selectedApplication.hub}
                          </p>
                        </Col>
                      </Row>

                      <div>
                        <p style={{ fontWeight: 500, marginBottom: 8 }}>
                          Motivation
                        </p>
                        <Text
                          style={{
                            color: 'rgba(0, 0, 0, 0.45)',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {selectedApplication.motivation || 'N/A'}
                        </Text>
                      </div>

                      <div>
                        <p style={{ fontWeight: 500, marginBottom: 8 }}>
                          Challenges
                        </p>
                        <Text
                          style={{
                            color: 'rgba(0, 0, 0, 0.45)',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {selectedApplication.challenges || 'N/A'}
                        </Text>
                      </div>
                    </div>
                  </TabPane>
                  <TabPane tab='AI Analysis' key='ai'>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16
                      }}
                    >
                      <Card>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 8
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 16
                            }}
                          >
                            <p style={{ fontWeight: 500, margin: 0 }}>
                              Current Status (Alterable)
                            </p>
                            <Select
                              style={{ width: '100%' }}
                              value={selectedApplication.applicationStatus}
                              placeholder='Update Status'
                              onChange={value =>
                                updateStatus(value, selectedApplication.id)
                              }
                            >
                              <Option value='accepted'>Accept</Option>
                              <Option value='rejected'>Reject</Option>
                              <Option value='pending'>Pending</Option>
                            </Select>

                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8
                              }}
                            >
                              <p style={{ fontWeight: 500, margin: 0 }}>
                                AI Recommendation
                              </p>
                              <Tag
                                color={getStatusColor(
                                  selectedApplication.aiRecommendation.toLowerCase()
                                )}
                              >
                                {selectedApplication.aiRecommendation}
                              </Tag>
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 16
                          }}
                        >
                          <p style={{ fontWeight: 500 }}>AI Score</p>
                          <Badge
                            count={selectedApplication.aiScore}
                            style={{ backgroundColor: '#faad14' }}
                          />
                        </div>
                        <div>
                          <p style={{ fontWeight: 500, marginBottom: 8 }}>
                            Justification
                          </p>
                          <Text
                            style={{
                              color: 'rgba(0, 0, 0, 0.45)',
                              whiteSpace: 'pre-line'
                            }}
                          >
                            {selectedApplication.aiJustification || 'N/A'}
                          </Text>
                        </div>
                      </Card>
                    </div>
                  </TabPane>
                  <TabPane tab='Documents' key='documents'>
                    {selectedApplication.documents.length > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8
                        }}
                      >
                        {selectedApplication.documents.map(
                          (doc: any, idx: number) => (
                            <Card key={idx} size='small'>
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}
                              >
                                <div>
                                  <p style={{ fontWeight: 500 }}>{doc.type}</p>
                                  <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                                    {doc.fileName}
                                  </p>
                                </div>
                                <Button
                                  type='text'
                                  icon={<DownloadOutlined />}
                                  href={doc.url}
                                  target='_blank'
                                />
                              </div>
                            </Card>
                          )
                        )}
                        {selectedApplication.growthPlanDocUrl && (
                          <Card size='small'>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}
                            >
                              <div>
                                <p style={{ fontWeight: 500 }}>Growth Plan</p>
                                <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                                  growth_plan.pdf
                                </p>
                              </div>
                              <Button
                                type='text'
                                icon={<DownloadOutlined />}
                                href={selectedApplication.growthPlanDocUrl}
                                target='_blank'
                              />
                            </div>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                        No documents uploaded
                      </p>
                    )}
                  </TabPane>
                </Tabs>
              ) : (
                <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                  Select an application to view details
                </p>
              )}
            </Card>
          </motion.div>
        </Col>
      </Row>

      {/* Documents Modal */}
      <Modal
        title='Application Documents'
        visible={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedDocApp?.documents?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedDocApp.documents.map((doc: any, idx: number) => (
              <Card key={idx} size='small'>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 500 }}>{doc.type}</p>
                    <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
                      {doc.fileName}
                    </p>
                  </div>
                  <Button
                    type='text'
                    icon={<DownloadOutlined />}
                    href={doc.url}
                    target='_blank'
                  />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <p style={{ color: 'rgba(0, 0, 0, 0.45)' }}>No documents uploaded</p>
        )}
      </Modal>
    </div>
  )
}

export default ApplicationsDashboard
