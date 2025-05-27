import React, { useEffect, useState } from 'react'
import {
  Alert,
  Card,
  Collapse,
  Checkbox,
  Typography,
  Spin,
  Table,
  Divider,
  message,
  Button,
  Modal,
  notification
} from 'antd'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { SHA256 } from 'crypto-js'
import dayjs from 'dayjs'
import { Helmet } from 'react-helmet'

const { Title, Paragraph, Text } = Typography
const { Panel } = Collapse

const GrowthPlanPage: React.FC = () => {
  const [applicationData, setApplicationData] = useState<any>(null)
  const [participantData, setParticipantData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [manualInterventions, setManualInterventions] = useState<any[]>([])
  const [aiInterventions, setAiInterventions] = useState<any[]>([])
  const [allInterventions, setAllInterventions] = useState<any[]>([])
  const [selectedAi, setSelectedAi] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedInModal, setSelectedInModal] = useState<any[]>([])
  const [interventionsConfirmed, setInterventionsConfirmed] = useState(false)
  const [digitalSignature, setDigitalSignature] = useState<string | null>(null)
  const [signatureModalVisible, setSignatureModalVisible] = useState(false)

  function parseAiRawResponse (raw: string): any {
    try {
      const cleaned = raw
        .replace(/^```json/, '')
        .replace(/```$/, '')
        .trim()
      return JSON.parse(cleaned)
    } catch (e) {
      console.warn('Failed to parse AI response:', e)
      return null
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      const user = auth.currentUser
      if (!user) {
        message.error('User not authenticated.')
        return
      }

      try {
        // Fetch application
        const appSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', user.email)
          )
        )
        const application = appSnap.empty ? null : appSnap.docs[0].data()
        setApplicationData(application)
        setManualInterventions(application?.interventions?.required || [])

        // AI Interventions from raw_response
        let aiRecommended = []

        // Case 1: structured directly
        if (
          typeof application?.aiEvaluation?.['Recommended Interventions'] ===
          'object'
        ) {
          const recs = application.aiEvaluation['Recommended Interventions']
          aiRecommended = Object.entries(recs).flatMap(([area, items]) =>
            items.map((title: string, i: number) => ({
              id: `ai-${area}-${i}`,
              title,
              area
            }))
          )
        } else if (
          typeof application?.aiEvaluation?.raw_response === 'string'
        ) {
          // Case 2: from raw_response markdown
          const parsedAi = parseAiRawResponse(
            application.aiEvaluation.raw_response
          )
          const recs = parsedAi?.['Recommended Interventions'] || {}

          aiRecommended = Object.entries(recs).flatMap(([area, items]) =>
            items.map((title: string, i: number) => ({
              id: `ai-${area}-${i}`,
              title,
              area
            }))
          )
        }

        setAiInterventions(aiRecommended)

        // Fetch participant (where email matches)
        const partSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )
        if (!partSnap.empty) {
          const docRef = partSnap.docs[0]
          const data = docRef.data()
          data.participantDocId = docRef.id // ✅ Attach document ID
          setParticipantData(data)
        } else {
          message.warning('Participant record not found.')
        }
      } catch (err) {
        console.error('Error loading growth plan:', err)
        message.error('Failed to load growth plan.')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    const fetchInterventions = async () => {
      const snapshot = await getDocs(collection(db, 'interventions'))
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setAllInterventions(list)
    }

    fetchInterventions()
  }, [])

  useEffect(() => {
    if (applicationData?.growthPlanConfirmed) {
      setInterventionsConfirmed(true)
    }
  }, [applicationData])

  const totalSelected = manualInterventions.length + selectedAi.length
  const canAddMore = totalSelected < 8

  const getMonthlyData = () => {
    const now = dayjs()
    const recentMonths = [...Array(3)]
      .map(
        (_, i) => now.subtract(i, 'month').format('MMMM') // 'Jan', 'Feb', etc.
      )
      .reverse()

    return recentMonths.map(monthKey => {
      const lower = monthKey.toLowerCase() // e.g. 'may'

      const rev =
        participantData?.revenueHistory?.monthly?.[monthKey] ??
        participantData?.[`revenue_${monthKey}`] ??
        participantData?.[`revenue_${lower}`] ??
        0

      const perm =
        participantData?.headcountHistory?.monthly?.[monthKey]?.permanent ??
        participantData?.[`permHeadcount_${monthKey}`] ??
        participantData?.[`permHeadcount_${lower}`] ??
        0

      const temp =
        participantData?.headcountHistory?.monthly?.[monthKey]?.temporary ??
        participantData?.[`tempHeadcount_${monthKey}`] ??
        participantData?.[`tempHeadcount_${lower}`] ??
        0

      return {
        month: monthKey,
        perm,
        temp,
        revenue: `R${rev}`
      }
    })
  }

  const getAnnualData = () => {
    const keys1 = Object.keys(participantData?.revenueHistory?.yearly || {})
    const keys2 = Object.keys(participantData || {}).filter(k =>
      k.startsWith('revenue_')
    )
    const allYears = new Set([
      ...keys1,
      ...keys2.map(k => k.replace('revenue_', ''))
    ])
    const parsed = Array.from(allYears)
      .map(y => parseInt(y))
      .filter(Boolean)
      .sort()

    return parsed.map(year => {
      const rev =
        participantData?.revenueHistory?.yearly?.[year] ??
        participantData?.[`revenue_${year}`] ??
        0
      const perm =
        participantData?.headcountHistory?.yearly?.[year]?.permanent ??
        participantData?.[`permHeadcount_${year}`] ??
        0
      const temp =
        participantData?.headcountHistory?.yearly?.[year]?.temporary ??
        participantData?.[`tempHeadcount_${year}`] ??
        0

      return {
        year,
        perm,
        temp,
        revenue: `R${rev}`
      }
    })
  }

  const getDigitalSignature = () => {
    return SHA256(
      `${applicationData?.email}|${participantData?.participantName}|${participantData?.dateOfRegistration}`
    )
      .toString()
      .substring(0, 16)
  }

  const handleConfirmGrowthPlan = async () => {
    try {
      const required = [...manualInterventions, ...selectedAi]

      const growthPlanUrl = applicationData?.growthPlanDocUrl
      if (!growthPlanUrl) {
        notification.error({
          message: 'Missing File URL',
          description:
            'The Diagnostic Needs Plan file URL is not available in the application data.'
        })
        return
      }

      const completed = [
        ...(applicationData?.interventions?.completed || []),
        {
          id: 'diagnostic-plan',
          title: 'Diagnostic Needs Assessment Plan Development',
          area: 'Planning',
          confirmedAt: new Date(),
          resources: [
            {
              type: 'document',
              label: 'Diagnostic Needs Plan PDF',
              link: growthPlanUrl
            }
          ]
        }
      ]

      // Find application doc ID
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', auth.currentUser?.email)
        )
      )

      const appDocId = appSnap.docs[0].id

      // Update application document
      await updateDoc(doc(db, 'applications', appDocId), {
        'interventions.required': required,
        'interventions.completed': completed,
        growthPlanConfirmed: true,
        digitalSignature: getDigitalSignature()
      })

      // Add to interventionsDatabase
      await addDoc(collection(db, 'interventionsDatabase'), {
        programId: applicationData.programId,
        companyCode: applicationData.companyCode,
        interventionId: 'diagnostic-plan',
        interventionTitle: 'Diagnostic Needs Assessment Plan Development',
        areaOfSupport: 'Planning',
        participantId: participantData.participantDocId,
        beneficiaryName: participantData.beneficiaryName,
        hub: participantData.hub,
        province: participantData.province,
        quarter: 'Q' + (Math.floor(new Date().getMonth() / 3) + 1),
        consultantIds: [],
        timeSpent: [],
        interventionType: 'singular',
        targetMetric: '',
        targetType: 'custom',
        targetValue: 0,
        feedback: null,
        confirmedAt: new Date(),
        createdAt: participantData.createdAt || new Date(),
        updatedAt: new Date(),
        interventionKey: SHA256(participantData.email + 'diagnostic-plan')
          .toString()
          .substring(0, 12),
        resources: [
          {
            type: 'document',
            label: 'Diagnostic Needs Plan PDF',
            link: applicationData.growthPlanDocUrl
          }
        ]
      })

      notification.success({
        message: 'Diagnostic Needs Plan Confirmed',
        description:
          'Your selections and completed diagnostic needs plan have been saved.'
      })

      // After successful updates and notifications
      const signature = getDigitalSignature()
      setDigitalSignature(signature)
      setSignatureModalVisible(true)
      setInterventionsConfirmed(true)
    } catch (err) {
      console.error('Confirmation failed', err)
      notification.error({
        message: 'Error',
        description:
          'Something went wrong while confirming your diagnostic needs plan.'
      })
    }
  }

  if (loading) return <Spin tip='Loading...' style={{ marginTop: 64 }} />
  if (!applicationData || !participantData)
    return (
      <Paragraph>No diagnostic needs assessment plan data available.</Paragraph>
    )

  return (
    <Card style={{ padding: 24 }}>
      <Helmet>
        <title>Smart Incubation | Diagnostic Plan</title>
      </Helmet>

      <Title level={3}>
        {participantData.beneficiaryName || 'Participant'} Diagnostic Needs
        Assessment
      </Title>

      <Divider>1. Business Overview</Divider>
      <Paragraph>
        <Text strong>Business Owner:</Text>{' '}
        {participantData.participantName || participantData.ownerName}
      </Paragraph>
      <Paragraph>
        <Text strong>Sector:</Text> {participantData.sector}
      </Paragraph>
      <Paragraph>
        <Text strong>Stage:</Text> {applicationData.stage}
      </Paragraph>
      <Paragraph>
        <Text strong>Province:</Text> {participantData.province}
      </Paragraph>
      <Paragraph>
        <Text strong>City:</Text> {participantData.city}
      </Paragraph>
      <Paragraph>
        <Text strong>Date of Registration:</Text>{' '}
        {participantData.dateOfRegistration?.toDate
          ? dayjs(participantData.dateOfRegistration.toDate()).format(
              'YYYY-MM-DD'
            )
          : participantData.dateOfRegistration || 'N/A'}
      </Paragraph>

      <Paragraph>
        <Text strong>Years Trading:</Text> {participantData.yearsOfTrading}
      </Paragraph>

      <Divider>2. Business Summary</Divider>
      <Paragraph>
        <Text strong>Motivation:</Text> {applicationData.motivation}
      </Paragraph>
      <Paragraph>
        <Text strong>Challenges:</Text> {applicationData.challenges}
      </Paragraph>

      <Divider>3. Revenue & Staffing</Divider>
      <Title level={5}>Annual</Title>
      <Table
        size='small'
        bordered
        dataSource={getAnnualData()}
        columns={[
          { title: 'Year', dataIndex: 'year' },
          { title: 'Perm', dataIndex: 'perm' },
          { title: 'Temp', dataIndex: 'temp' },
          { title: 'Revenue', dataIndex: 'revenue' }
        ]}
        pagination={false}
        rowKey='year'
      />

      <Title level={5} style={{ marginTop: 24 }}>
        Last 3 Months
      </Title>
      <Table
        size='small'
        bordered
        dataSource={getMonthlyData()}
        columns={[
          { title: 'Month', dataIndex: 'month' },
          { title: 'Perm', dataIndex: 'perm' },
          { title: 'Temp', dataIndex: 'temp' },
          { title: 'Revenue', dataIndex: 'revenue' }
        ]}
        pagination={false}
        rowKey='month'
      />

      <Divider>4. Compliance</Divider>
      <Paragraph>
        <Text strong>Compliance Score:</Text> {applicationData.complianceRate}%
      </Paragraph>

      <Divider>5. Interventions</Divider>
      <Table
        size='small'
        bordered
        dataSource={manualInterventions}
        columns={[
          { title: 'Title', dataIndex: 'title' },
          { title: 'Area', dataIndex: 'area' },
          {
            title: 'Action',
            render: (_, record) =>
              !interventionsConfirmed && (
                <Button
                  danger
                  onClick={() =>
                    setManualInterventions(prev =>
                      prev.filter(i => i.id !== record.id)
                    )
                  }
                >
                  Remove
                </Button>
              )
          }
        ]}
        rowKey='id'
        pagination={false}
      />

      <Paragraph style={{ marginTop: 12 }}>
        <Text strong>Total Interventions Selected: </Text>
        {totalSelected} / 8
      </Paragraph>

      {totalSelected > 8 && (
        <Paragraph type='danger'>
          ⚠️ You can only select up to 8 interventions total.
        </Paragraph>
      )}

      {!interventionsConfirmed && (
        <Button type='primary' onClick={() => setIsModalOpen(true)}>
          + Add New Intervention
        </Button>
      )}

      <Modal
        title='Select Interventions'
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => {
          setManualInterventions(prev => [
            ...prev,
            ...selectedInModal
              .filter(
                newInt => !prev.some(existing => existing.id === newInt.id)
              )
              .map(item => ({
                id: item.id,
                title: item.interventionTitle || item.title || 'Untitled',
                area: item.areaOfSupport || item.area || 'Unknown'
              }))
          ])
          setSelectedInModal([])
          setIsModalOpen(false)
        }}
        okText='Add Selected'
        okButtonProps={{ disabled: selectedInModal.length === 0 }}
      >
        <Paragraph>
          <Text strong>Remaining:</Text>{' '}
          {8 - totalSelected - selectedInModal.length} interventions
        </Paragraph>

        {totalSelected + selectedInModal.length >= 8 && (
          <Alert
            type='warning'
            showIcon
            message='You have reached the maximum allowed interventions (8). Remove one before adding more.'
            style={{ marginBottom: 12 }}
          />
        )}

        <Collapse accordion>
          {Object.entries(
            allInterventions.reduce((acc, intv) => {
              const key = intv.areaOfSupport || 'Other'
              if (!acc[key]) acc[key] = []
              acc[key].push(intv)
              return acc
            }, {} as Record<string, any[]>)
          ).map(([area, interventions]) => (
            <Panel header={area} key={area}>
              <Checkbox.Group
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                value={selectedInModal.map(i => i.id)}
                onChange={(checked: any[]) => {
                  const newSelection = interventions.filter(i =>
                    checked.includes(i.id)
                  )

                  if (totalSelected + newSelection.length > 8) {
                    message.warning(
                      'You can only select up to 8 interventions.'
                    )
                    return
                  }

                  setSelectedInModal(newSelection)
                }}
              >
                {interventions.map(intv => (
                  <Checkbox
                    key={intv.id}
                    value={intv.id}
                    disabled={
                      !selectedInModal.some(sel => sel.id === intv.id) &&
                      totalSelected + selectedInModal.length >= 8
                    }
                  >
                    {intv.interventionTitle}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Panel>
          ))}
        </Collapse>
      </Modal>

      <Divider>6. AI Recommended Interventions</Divider>
      <Table
        size='small'
        bordered
        dataSource={aiInterventions}
        columns={[
          { title: 'Title', dataIndex: 'title' },
          { title: 'Area', dataIndex: 'area' },
          {
            title: 'Action',
            render: (_, record) =>
              !interventionsConfirmed &&
              (selectedAi.some(r => r.id === record.id) ? (
                <Button
                  danger
                  onClick={() =>
                    setSelectedAi(prev => prev.filter(i => i.id !== record.id))
                  }
                >
                  Remove
                </Button>
              ) : (
                <Button
                  type='primary'
                  onClick={() => setSelectedAi(prev => [...prev, record])}
                >
                  Confirm
                </Button>
              ))
          }
        ]}
        rowKey='id'
        pagination={false}
      />

      <Paragraph style={{ marginTop: 12 }}>
        <Text strong>Total Interventions Selected: </Text>
        {totalSelected} / 8
      </Paragraph>

      {totalSelected > 8 && (
        <Paragraph type='danger'>
          ⚠️ You can only select up to 8 interventions total.
        </Paragraph>
      )}

      <Divider>7. Online Presence</Divider>
      <Paragraph>
        <Text strong>Facebook:</Text> {applicationData.facebook}
      </Paragraph>
      <Paragraph>
        <Text strong>Instagram:</Text> {applicationData.instagram}
      </Paragraph>
      <Paragraph>
        <Text strong>LinkedIn:</Text> {applicationData.linkedIn}
      </Paragraph>

      <Divider>8. Signature</Divider>
      <Paragraph>
        This document was generated based on your information.
      </Paragraph>
      {interventionsConfirmed && (
        <Paragraph>
          <Text strong>Cryptographic Signature: </Text>
          <Text copyable>{applicationData.digitalSignature}</Text>
        </Paragraph>
      )}

      {!interventionsConfirmed && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Button
            type='primary'
            size='large'
            onClick={() => {
              handleConfirmGrowthPlan()
            }}
            disabled={totalSelected > 8}
          >
            Confirm Diagnostic Plan
          </Button>

          {interventionsConfirmed && (
            <Paragraph type='success' style={{ marginTop: 24 }}>
              ✅ Diagnostic Needs Assessment Plan has been confirmed and saved.
              Interventions are now locked.
            </Paragraph>
          )}
        </div>
      )}
      <Modal
        open={signatureModalVisible}
        title='Digital Signature Generated'
        onOk={() => setSignatureModalVisible(false)}
        onCancel={() => setSignatureModalVisible(false)}
      >
        <Paragraph>
          This is your digital signature. Please copy and keep it safe:
        </Paragraph>
        <Paragraph copyable>{digitalSignature}</Paragraph>
      </Modal>
    </Card>
  )
}

export default GrowthPlanPage
