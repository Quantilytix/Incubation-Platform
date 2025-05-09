import React, { useEffect, useState } from 'react'
import { List, Card, Typography, message, Spin } from 'antd'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { Helmet } from 'react-helmet'
import { onAuthStateChanged } from 'firebase/auth'

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (user) {
        const consultantSnap = await getDocs(
          query(collection(db, 'consultants'), where('email', '==', user.email))
        )

        if (!consultantSnap.empty) {
          const consultantDoc = consultantSnap.docs[0]
          setConsultantId(consultantDoc.id)
        } else {
          console.error('No consultant found for this user')
          setLoading(false)
        }
      } else {
        setLoading(false)
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

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <Helmet>
        <title>Participant Insights | Smart Incubation</title>
      </Helmet>

      <Title level={3}>Participant Insights</Title>

      <List
        loading={loading}
        dataSource={feedbacks}
        renderItem={item => (
          <Card key={item.id} style={{ marginBottom: 16 }}>
            <Title level={5}>{item.sme}</Title>
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
          </Card>
        )}
      />
    </div>
  )
}
