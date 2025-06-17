import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  message,
  Spin,
  Row,
  Col,
  Statistic,
  Modal,
  Button,
  List
} from 'antd'
import {
  BarChartOutlined,
  PieChartOutlined,
  StarOutlined
} from '@ant-design/icons'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { Helmet } from 'react-helmet'
import { onAuthStateChanged } from 'firebase/auth'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const { Title, Paragraph } = Typography

interface Feedback {
  id: string
  sme: string
  interventionTitle: string
  comment: string
  rating?: number
}

export const FeedbackWorkspace: React.FC = () => {
  const [consultantId, setConsultantId] = useState<string | null>(null)
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [currentRole, setCurrentRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [expandedChart, setExpandedChart] = useState<'pie' | 'bar' | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user?.email) {
        const consultantSnap = await getDocs(
          query(collection(db, 'consultants'), where('email', '==', user.email))
        )

        if (!consultantSnap.empty) {
          const consultantDoc = consultantSnap.docs[0]
          const consultantData = consultantDoc.data()

          if (consultantData.id) {
            setConsultantId(consultantData.id)
          } else {
            console.warn('Missing consultantData.id — fallback to doc.id')
            setConsultantId(consultantDoc.id)
          }

          if (consultantData.role) {
            setCurrentRole(consultantData.role.toLowerCase())
          }

          setRoleLoading(false)
        } else {
          message.error('Consultant not found')
          setLoading(false)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!consultantId) return

    const fetchFeedback = async () => {
      setLoading(true)

      try {
        const q = query(
          collection(db, 'assignedInterventions'),
          where('consultantId', '==', consultantId),
          where('status', '==', 'completed')
        )

        const snapshot = await getDocs(q)

        const data: Feedback[] = snapshot.docs
          .map(docSnap => {
            const docData = docSnap.data()
            if (!docData.feedback?.comments) return null
            return {
              id: docSnap.id,
              sme: docData.beneficiaryName || 'Unknown SME',
              interventionTitle: docData.interventionTitle || 'Untitled',
              comment: docData.feedback.comments,
              rating: docData.feedback.rating
            }
          })
          .filter(Boolean) as Feedback[]

        setFeedbacks(data)
      } catch (error) {
        console.error('Error fetching feedback:', error)
        message.error('Failed to load feedback.')
      } finally {
        setLoading(false)
      }
    }

    fetchFeedback()
  }, [consultantId])

  const totalFeedbacks = feedbacks.length
  const ratedFeedbacks = feedbacks.filter(f => typeof f.rating === 'number')
  const averageRating = ratedFeedbacks.length
    ? ratedFeedbacks.reduce((acc, f) => acc + (f.rating ?? 0), 0) /
      ratedFeedbacks.length
    : 0

  const feedbacksBySME = feedbacks.reduce((acc, curr) => {
    acc[curr.sme] = (acc[curr.sme] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const ratingsBySME = ratedFeedbacks.reduce((acc, f) => {
    if (!acc[f.sme]) acc[f.sme] = { total: 0, count: 0 }
    acc[f.sme].total += f.rating!
    acc[f.sme].count += 1
    return acc
  }, {} as Record<string, { total: number; count: number }>)

  const avgRatingsBySME = Object.entries(ratingsBySME).map(([sme, val]) => ({
    name: sme,
    y: parseFloat((val.total / val.count).toFixed(2))
  }))

  const pieChartOptions: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'Feedbacks per SME' },
    series: [
      {
        type: 'pie',
        name: 'Feedback Count',
        data: Object.entries(feedbacksBySME).map(([sme, count]) => ({
          name: sme,
          y: count
        }))
      }
    ]
  }

  const barChartOptions: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Average Rating per SME' },
    xAxis: { type: 'category', title: { text: 'SME' } },
    yAxis: { min: 0, max: 5, title: { text: 'Average Rating' } },
    series: [
      {
        name: 'Rating',
        type: 'column',
        data: avgRatingsBySME
      }
    ]
  }

  return (
    <div style={{ padding: 24, height: '100%', overflow: 'auto' }}>
      <Helmet>
        <title>Participant Insights | Smart Incubation</title>
      </Helmet>

      <Title level={3}>Participant Insights</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title='Total Feedbacks'
              value={totalFeedbacks}
              prefix={<PieChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title='Average Rating'
              value={averageRating.toFixed(2)}
              prefix={<StarOutlined />}
              suffix='/5'
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            title='Feedback Distribution'
            extra={
              <Button onClick={() => setExpandedChart('pie')}>Expand</Button>
            }
          >
            <HighchartsReact
              highcharts={Highcharts}
              options={pieChartOptions}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title='Average Rating by SME'
            extra={
              <Button onClick={() => setExpandedChart('bar')}>Expand</Button>
            }
          >
            <HighchartsReact
              highcharts={Highcharts}
              options={barChartOptions}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={
          expandedChart === 'pie'
            ? 'Feedbacks per SME'
            : 'Average Rating per SME'
        }
        open={!!expandedChart}
        onCancel={() => setExpandedChart(null)}
        footer={null}
        width={800}
      >
        {expandedChart === 'pie' && (
          <HighchartsReact highcharts={Highcharts} options={pieChartOptions} />
        )}
        {expandedChart === 'bar' && (
          <HighchartsReact highcharts={Highcharts} options={barChartOptions} />
        )}
      </Modal>

      <Card title='Feedback Comments'>
        <List
          loading={loading}
          dataSource={feedbacks}
          renderItem={item => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={<b>{item.sme}</b>}
                description={
                  <>
                    <Paragraph type='secondary'>
                      <b>Intervention:</b> {item.interventionTitle}
                      {item.rating !== undefined && (
                        <>
                          {' '}
                          | <b>Rating:</b> {item.rating} / 5
                        </>
                      )}
                    </Paragraph>
                    <Paragraph>{item.comment}</Paragraph>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}
