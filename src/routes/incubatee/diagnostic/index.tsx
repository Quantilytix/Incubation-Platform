import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Spin,
  Table,
  Divider,
  message,
  Button,
  Modal,
  Alert
} from 'antd'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from 'firebase/firestore'
import { db, auth } from '@/firebase'
import dayjs from 'dayjs'
import { SHA256 } from 'crypto-js'

const { Title, Text } = Typography

const IncubateeGrowthPlanPage = () => {
  const [loading, setLoading] = useState(true)
  const [participant, setParticipant] = useState<any>(null)
  const [application, setApplication] = useState<any>(null)
  const [interventions, setInterventions] = useState<any[]>([])
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser
      if (!user?.email) return message.error('User not authenticated')

      try {
        // Get participant
        const partSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )
        if (partSnap.empty) throw new Error('Participant not found')
        const partDoc = partSnap.docs[0]
        const partData = { ...partDoc.data(), docId: partDoc.id }
        setParticipant(partData)

        // Get application
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', user.email),
            where('applicationStatus', 'in', ['accepted', 'Accepted'])
          )
        )
        if (appSnap.empty) throw new Error('Application not found')
        const appDoc = appSnap.docs[0]
        const appData = { ...appDoc.data(), docId: appDoc.id }
        setApplication(appData)

        // Normalize interventions
        const required: any[] = appData?.interventions?.required || []
        const formatted: any[] = []

        for (const entry of required) {
          if (typeof entry === 'string') {
            const snap = await getDoc(doc(db, 'interventions', entry))
            if (snap.exists()) {
              const data = snap.data()
              formatted.push({
                id: entry,
                interventionTitle: data.interventionTitle,
                areaOfSupport: data.areaOfSupport
              })
            }
          } else {
            formatted.push({
              id: entry.id,
              interventionTitle: entry.title,
              areaOfSupport: entry.area
            })
          }
        }

        setInterventions(formatted)
      } catch (err) {
        console.error('Error:', err)
        message.error('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleConfirm = async () => {
    try {
      const sig = SHA256(
        `${application.email}|${participant.participantName}|${participant.dateOfRegistration}`
      )
        .toString()
        .substring(0, 16)

      const ref = doc(db, 'applications', application.docId)
      await updateDoc(ref, {
        'interventions.confirmedBy.incubatee': true,
        digitalSignature: sig,
        confirmedAt: new Date().toISOString()
      })

      message.success('Growth Plan Confirmed.')
      setConfirmModalOpen(false)
      setApplication(prev => ({
        ...prev,
        interventions: {
          ...prev.interventions,
          confirmedBy: {
            ...(prev.interventions?.confirmedBy || {}),
            incubatee: true
          }
        },
        digitalSignature: sig,
        confirmedAt: new Date()
      }))
    } catch (err) {
      console.error('Confirmation error:', err)
      message.error('Failed to confirm.')
    }
  }

  if (loading) return <Spin tip='Loading...' style={{ marginTop: 48 }} />
  if (!participant || !application) return <Text>No data found</Text>

  return (
    <Card>
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
      <Divider>Business Overview</Divider>
      <Text strong>Business Owner:</Text> {participant.participantName}
      <br />
      <Text strong>Sector:</Text> {participant.sector}
      <br />
      <Text strong>Province:</Text> {participant.province}
      <br />
      <Text strong>City:</Text> {participant.city}
      <br />
      <Text strong>Date of Registration:</Text>{' '}
      {participant.dateOfRegistration?.toDate
        ? dayjs(participant.dateOfRegistration.toDate()).format('YYYY-MM-DD')
        : participant.dateOfRegistration || 'N/A'}
      {!application.interventions?.confirmedBy?.operations ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginTop: 32,
              marginBottom: 24
            }}
          >
            <div
              style={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                border: '8px solid #1890ff',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontSize: 28,
                fontWeight: 'bold',
                color: '#1890ff'
              }}
            >
              37%
            </div>
          </div>
          <Alert
            type='info'
            message='Please be patient'
            description='Your growth plan is currently being finalized by the operations team. You will be able to confirm it once it is ready.'
            showIcon
          />
        </>
      ) : (
        <>
          <Divider>Planned Interventions</Divider>
          <Table
            dataSource={interventions}
            rowKey='id'
            size='small'
            bordered
            pagination={false}
            columns={[
              { title: 'Title', dataIndex: 'interventionTitle' },
              { title: 'Area', dataIndex: 'areaOfSupport' }
            ]}
          />
          <Divider />
          {application.interventions?.confirmedBy?.incubatee ? (
            <>
              <Text strong>Digital Signature:</Text>{' '}
              <Text copyable>{application.digitalSignature}</Text>
              <br />
              <Text>
                <strong>Confirmed At:</strong>{' '}
                {dayjs(application.confirmedAt).format('YYYY-MM-DD')}
              </Text>
            </>
          ) : (
            <Button
              type='primary'
              style={{ marginTop: 24 }}
              onClick={() => setConfirmModalOpen(true)}
            >
              Confirm Growth Plan
            </Button>
          )}
          <Modal
            title='Confirm Growth Plan'
            open={confirmModalOpen}
            onCancel={() => setConfirmModalOpen(false)}
            onOk={handleConfirm}
            okText='Confirm & Sign'
          >
            <Alert
              message='Final Confirmation'
              description='By confirming, you add your digital signature to this growth plan. This action is final and notifies the operations team that you accept the interventions.'
              type='info'
              showIcon
            />
          </Modal>
        </>
      )}
    </Card>
  )
}

export default IncubateeGrowthPlanPage
