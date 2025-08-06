import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Spin,
  Table,
  Divider,
  message,
  Button,
  Modal
} from 'antd'
import {
  doc,
  getDocs,
  getDoc,
  query,
  collection,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const GrowthPlanPage = ({ participant }: { participant: any }) => {
  const [loading, setLoading] = useState(true)
  const [applicationData, setApplicationData] = useState<any>(null)
  const [interventions, setInterventions] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', participant.email),
            where('applicationStatus', 'in', ['accepted', 'Accepted'])
          )
        )
        const app = appSnap.empty ? null : appSnap.docs[0].data()
        const confirmedAt = app?.confirmedAt || null
        const digitalSignature = app?.digitalSignature || null

        // Store these as part of applicationData for reuse

        setApplicationData({
          ...app,
          confirmedAt,
          digitalSignature
        })

        const manual =
          app?.interventions?.required?.map((intv: any) => ({
            id: intv.id,
            interventionTitle: intv.title || '',
            areaOfSupport: intv.area || '',
            source: 'SME',
            confirmedAt: null
          })) || []

        let aiRecommended: any[] = []
        if (
          typeof app?.aiEvaluation?.['Recommended Interventions'] === 'object'
        ) {
          const recs = app.aiEvaluation['Recommended Interventions']
          aiRecommended = Object.entries(recs).flatMap(([area, items]) =>
            items.map((title: string, i: number) => ({
              id: `ai-${area}-${i}`,
              interventionTitle: title,
              areaOfSupport: area,
              source: 'AI',
              confirmedAt: null
            }))
          )
        }

        setInterventions([...manual, ...aiRecommended])
      } catch (err) {
        console.error('Error fetching growth plan data', err)
        message.error('Failed to fetch participant data.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [participant])

  if (loading)
    return (
      <Spin style={{ marginTop: 48 }} tip='Loading participant details...' />
    )
  if (!applicationData)
    return <Paragraph>No application found for this participant.</Paragraph>

  return (
    <Card style={{ padding: 24 }}>
      <Title level={3}>
        {participant.beneficiaryName || 'Participant'}'s Growth Plan
      </Title>
      <Divider>Business Overview</Divider>
      <Text strong>Business Owner:</Text> {participant.participantName || 'N/A'}
      <br />
      <Text strong>Sector:</Text> {participant.sector}
      <br />
      <Text strong>Province:</Text> {participant.province}
      <br />
      <Text strong>City:</Text> {participant.city}
      <br />
      <Text strong>Years Trading:</Text> {participant.yearsOfTrading || 'N/A'}
      <br />
      <Text strong>Date of Registration:</Text>{' '}
      {participant.dateOfRegistration?.toDate
        ? dayjs(participant.dateOfRegistration.toDate()).format('YYYY-MM-DD')
        : participant.dateOfRegistration || 'N/A'}
      <br />
      <Divider>Application Summary</Divider>
      <Text strong>Motivation:</Text> {applicationData.motivation}
      <br />
      <Text strong>Challenges:</Text> {applicationData.challenges}
      <br />
      <Text strong>Stage:</Text> {applicationData.stage}
      <br />
      <Text strong>Compliance Score:</Text> {applicationData.complianceScore}%
      <br />
      <Divider>Interventions</Divider>
      <div style={{ textAlign: 'right', marginBottom: 12 }}>
        <Button type='primary' onClick={() => setIsModalOpen(true)}>
          + Add New Intervention
        </Button>
      </div>
      <Table
        size='small'
        bordered
        dataSource={interventions}
        columns={[
          { title: 'Title', dataIndex: 'interventionTitle' },
          { title: 'Area', dataIndex: 'areaOfSupport' },
          { title: 'Source', dataIndex: 'source' }
        ]}
        rowKey={record => record.id || record.interventionTitle}
        pagination={false}
      />
      {applicationData.growthPlanConfirmed && (
        <>
          <Divider>Confirmation Details</Divider>
          <Text strong>Confirmed At:</Text>{' '}
          {applicationData.confirmedAt?.toDate
            ? dayjs(applicationData.confirmedAt.toDate()).format('YYYY-MM-DD')
            : 'N/A'}
          {applicationData.confirmedAt}
          <br />
        </>
      )}
      {applicationData.digitalSignature && (
        <>
          <Text strong>Participant Signature:</Text>
          <br />
          {applicationData.digitalSignature}
        </>
      )}
      <Modal
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
      >
        <Paragraph>Add New Intervention Form (coming soon)</Paragraph>
      </Modal>
    </Card>
  )
}

export default GrowthPlanPage
