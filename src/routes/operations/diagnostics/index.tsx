import React, { useEffect, useState } from 'react'
import {
  Row,
  Col,
  Card,
  Statistic,
  Space,
  Typography,
  Button,
  Spin,
  Modal,
  Table,
  Tag
} from 'antd'
import {
  TeamOutlined,
  CheckCircleOutlined,
  FileAddOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/firebase'
import GrowthPlanPage from './growth-plan'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { motion } from 'framer-motion'

const { Title } = Typography

const DiagnosticsDashboard = () => {
  const { user } = useFullIdentity()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({
    totalParticipants: 0,
    confirmedGrowthPlans: 0,
    totalRequiredInterventions: 0
  })
  const [participants, setParticipants] = useState<any[]>([])
  const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
  const [applicationMap, setApplicationMap] = useState<any>({})

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true)
      try {
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('companyCode', '==', user?.companyCode),
            where('applicationStatus', 'in', ['accepted', 'Accepted'])
          )
        )
        const apps = appSnap.docs.map(doc => doc.data())
        const appMap: Record<string, any> = {}
        let requiredCount = 0
        let confirmedCount = 0

        apps.forEach(app => {
          appMap[app.email] = app
          if (app.growthPlanConfirmed) confirmedCount++
          if (Array.isArray(app.interventions?.required)) {
            requiredCount += app.interventions.required.length
          }
        })

        const partSnap = await getDocs(collection(db, 'participants'))
        const allParticipants = partSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        const participantsWithApplications = allParticipants.filter(
          p => appMap[p.email]
        )

        setMetrics({
          totalParticipants: participantsWithApplications.length,
          confirmedGrowthPlans: confirmedCount,
          totalRequiredInterventions: requiredCount
        })

        setParticipants(participantsWithApplications)
        setApplicationMap(appMap)
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [user])

  const columns = [
    {
      title: 'Name',
      dataIndex: 'beneficiaryName',
      key: 'name'
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector'
    },
    {
      title: 'Province',
      dataIndex: 'province',
      key: 'province'
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record) => {
        const confirmed = applicationMap[record.email]?.growthPlanConfirmed
        return (
          <Tag color={confirmed ? 'green' : 'orange'}>
            {confirmed ? 'Confirmed' : 'Pending'}
          </Tag>
        )
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button onClick={() => setSelectedParticipant(record)}>View</Button>
      )
    }
  ]

  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8}>
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
              transition: { duration: 0.2 },
              borderRadius: 8,
              background: 'transparent'
            }}
          >
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <TeamOutlined /> Total Participants
                  </Space>
                }
                value={metrics.totalParticipants}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={12} md={8}>
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
              transition: { duration: 0.2 },
              borderRadius: 8,
              background: 'transparent'
            }}
          >
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />{' '}
                    Confirmed Plans
                  </Space>
                }
                value={metrics.confirmedGrowthPlans}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </motion.div>
        </Col>
        <Col xs={24} sm={12} md={8}>
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
              transition: { duration: 0.2 },
              borderRadius: 8,
              background: 'transparent'
            }}
          >
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <FileAddOutlined /> Required Interventions
                  </Space>
                }
                value={metrics.totalRequiredInterventions}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

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
          transition: { duration: 0.2 },
          borderRadius: 8,
          background: 'transparent'
        }}
      >
        <Card
          hoverable
          style={{
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
            transition: 'all 0.3s ease',
            borderRadius: 8,
            border: '1px solid #d6e4ff'
          }}
        >
          <Table
            dataSource={participants}
            columns={columns}
            loading={loading}
            rowKey='id'
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </motion.div>

      <Modal
        open={!!selectedParticipant}
        onCancel={() => setSelectedParticipant(null)}
        width={1000}
        footer={null}
      >
        {selectedParticipant && (
          <GrowthPlanPage participant={selectedParticipant} />
        )}
      </Modal>
    </div>
  )
}

export default DiagnosticsDashboard
