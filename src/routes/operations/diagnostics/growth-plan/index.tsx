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
  where,
  updateDoc
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const GrowthPlanPage = ({ participant }: { participant: any }) => {
  const [loading, setLoading] = useState(true)
  const [applicationData, setApplicationData] = useState<any>(null)
  const [interventions, setInterventions] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const confirmByOperations = async () => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (!appSnap.empty) {
        const appRef = appSnap.docs[0].ref
        await updateDoc(appRef, {
          'interventions.confirmedBy.operations': true,
          growthPlanConfirmed: true,
          confirmedAt: new Date().toISOString()
        })
        message.success('Growth plan confirmed!')
        setApplicationData(prev => ({
          ...prev,
          interventions: {
            ...prev.interventions,
            confirmedBy: {
              ...(prev.interventions?.confirmedBy || {}),
              operations: true
            }
          },
          growthPlanConfirmed: true,
          confirmedAt: new Date()
        }))
      }
    } catch (error) {
      console.error('Failed to confirm growth plan:', error)
      message.error('Error during confirmation')
    }
  }

  const handleConfirmIntervention = async (record: any) => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (appSnap.empty) return

      const appRef = appSnap.docs[0].ref
      const appData = appSnap.docs[0].data()
      const existingRequired = appData?.interventions?.required || []

      // Prevent duplicate adds
      const alreadyExists = existingRequired.some(
        (i: any) => i.id === record.id
      )
      if (alreadyExists) {
        message.info('Already confirmed.')
        return
      }

      const updated = [
        ...existingRequired,
        {
          id: record.id,
          title: record.interventionTitle,
          area: record.areaOfSupport
        }
      ]

      await updateDoc(appRef, {
        'interventions.required': updated
      })

      // Update UI to hide Confirm button
      setInterventions(prev =>
        prev.map(item =>
          item.id === record.id ? { ...item, confirmed: true } : item
        )
      )

      message.success('AI Intervention confirmed.')
    } catch (err) {
      console.error('Error confirming AI intervention:', err)
      message.error('Could not confirm intervention.')
    }
  }

  const handleDeleteIntervention = async (record: any) => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (appSnap.empty) return

      const appRef = appSnap.docs[0].ref
      const appData = appSnap.docs[0].data()
      const existingRequired = appData?.interventions?.required || []

      if (record.source === 'SME') {
        const updatedRequired = existingRequired.filter(
          (i: any) => i.id !== record.id
        )
        await updateDoc(appRef, {
          'interventions.required': updatedRequired
        })
        setInterventions(prev => prev.filter(i => i.id !== record.id))
        message.success('SME Intervention removed from required.')
      } else if (record.source === 'AI') {
        // Just remove from local AI list
        setInterventions(prev => prev.filter(i => i.id !== record.id))
        message.success('AI Intervention removed.')
      }
    } catch (err) {
      console.error('Error deleting intervention:', err)
      message.error('Could not delete intervention.')
    }
  }

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
    <Card bordered={false} style={{ padding: 24, marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: 24,
          justifyContent: 'space-between'
        }}
      >
        {/* Box with logo, name, and Growth Plan label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center', // vertically align image and text
            justifyContent: 'center', // center the whole box
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Logo box */}
          <div
            style={{
              width: 200,
              height: 100,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 24
            }}
          >
            <img
              src='/assets/images/RCM.jpg'
              alt='Logo'
              style={{ maxWidth: '90%', maxHeight: '90%' }}
            />
          </div>

          {/* Text section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text style={{ fontSize: 18, fontWeight: 500 }}>
              {participant.beneficiaryName || 'Participant'}
            </Text>
            <Text style={{ fontSize: 36, fontWeight: 700, color: '#222' }}>
              Growth Plan
            </Text>
          </div>
        </div>
      </div>
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
          { title: 'Source', dataIndex: 'source' },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <div style={{ display: 'flex', gap: 12 }}>
                {record.source === 'AI' && !record.confirmed && (
                  <div
                    style={{
                      transition: 'transform 0.2s',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={e =>
                      (e.currentTarget.style.transform = 'scale(1.2)')
                    }
                    onMouseLeave={e =>
                      (e.currentTarget.style.transform = 'scale(1)')
                    }
                    title='Confirm'
                    onClick={() => handleConfirmIntervention(record)}
                  >
                    <CheckCircleOutlined
                      style={{ color: 'green', fontSize: 18 }}
                    />
                  </div>
                )}
                <div
                  style={{
                    transition: 'transform 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e =>
                    (e.currentTarget.style.transform = 'scale(1.2)')
                  }
                  onMouseLeave={e =>
                    (e.currentTarget.style.transform = 'scale(1)')
                  }
                  title='Delete'
                  onClick={() => handleDeleteIntervention(record)}
                >
                  <DeleteOutlined style={{ color: 'red', fontSize: 18 }} />
                </div>
              </div>
            )
          }
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
      <Divider />
      {applicationData.interventions?.confirmedBy?.operations &&
      applicationData.interventions?.confirmedBy?.incubatee ? (
        <Button type='primary'>Download Growth Plan</Button>
      ) : applicationData.interventions?.confirmedBy?.operations ? (
        <Text type='secondary'>Waiting for Incubatee to confirm</Text>
      ) : (
        <Button type='primary' onClick={confirmByOperations}>
          Confirm Growth Plan
        </Button>
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
