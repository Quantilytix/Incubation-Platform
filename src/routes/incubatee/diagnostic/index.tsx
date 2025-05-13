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
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { SHA256 } from 'crypto-js'
import dayjs from 'dayjs'

const { Title, Paragraph, Text } = Typography

const GrowthPlanPage: React.FC = () => {
  const [applicationData, setApplicationData] = useState<any>(null)
  const [participantData, setParticipantData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [manualInterventions, setManualInterventions] = useState<any[]>([])
  const [aiInterventions, setAiInterventions] = useState<any[]>([])
  const [allInterventions, setAllInterventions] = useState<any[]>([])
  const [selectedAi, setSelectedAi] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

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

  const getAvailableYears = () => {
    const keys1 = Object.keys(data?.revenueHistory?.yearly || {})
    const keys2 = Object.keys(data || {}).filter(k => k.startsWith('revenue_'))
    const allYears = new Set([
      ...keys1,
      ...keys2.map(k => k.replace('revenue_', ''))
    ])
    return Array.from(allYears)
      .map(y => parseInt(y))
      .filter(Boolean)
      .sort()
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
        const parsedAi = parseAiRawResponse(
          application?.aiEvaluation?.raw_response || ''
        )
        const parsedText = parsedAi?.['Recommended Interventions'] || ''
        const aiList = parsedText
          .split('\n')
          .filter(line => line.trim())
          .map((txt, i) => ({
            id: `ai-${i}`,
            title: txt.trim(),
            area: 'AI Suggested'
          }))
        setAiInterventions(aiList)

        // Fetch participant (where email matches)
        const partSnap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )
        if (!partSnap.empty) {
          setParticipantData(partSnap.docs[0].data())
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

  const totalSelected = manualInterventions.length + selectedAi.length
  const canAddMore = totalSelected < 8

  // Compute the last 3 months dynamically
  const getLastThreeMonths = () => {
    const now = dayjs()
    return [...Array(3)]
      .map((_, i) => now.subtract(i, 'month').format('MMM')) // Jan, Feb, etc.
      .reverse()
  }

  // Replace your getMonthlyData
  const getMonthlyData = () => {
    const recentMonths = getLastThreeMonths()

    return recentMonths.map(monthKey => {
      const rev =
        participantData?.revenueHistory?.monthly?.[monthKey] ??
        participantData?.[`revenue_${monthKey}`] ??
        0
      const perm =
        participantData?.headcountHistory?.monthly?.[monthKey]?.permanent ??
        participantData?.[`permHeadcount_${monthKey}`] ??
        0
      const temp =
        participantData?.headcountHistory?.monthly?.[monthKey]?.temporary ??
        participantData?.[`tempHeadcount_${monthKey}`] ??
        0

      return {
        month: monthKey,
        perm,
        temp,
        revenue: `R${rev}`
      }
    })
  }

  // Replace getAnnualData with this dynamic extractor
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

  if (loading) return <Spin tip='Loading...' style={{ marginTop: 64 }} />
  if (!applicationData || !participantData)
    return <Paragraph>No growth plan data available.</Paragraph>

  return (
    <Card style={{ padding: 24 }}>
      <Title level={3}>
        {participantData.beneficiaryName || 'Participant'} Diagnostic Assessment
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
        <Text strong>Compliance Score:</Text> {participantData.complianceRate}%
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
            render: (_, record) => (
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

      <Button type='primary' onClick={() => setIsModalOpen(true)}>
        + Add New Intervention
      </Button>
      <Modal
        title='Select Interventions'
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => setIsModalOpen(false)}
      >
        <Table
          size='small'
          rowSelection={{
            type: 'checkbox',
            onChange: (selectedRowKeys, selectedRows) => {
              setManualInterventions(prev => [
                ...prev,
                ...selectedRows.filter(
                  newInt => !prev.some(existing => existing.id === newInt.id)
                )
              ])
            }
          }}
          dataSource={allInterventions}
          columns={[
            { title: 'Title', dataIndex: 'title' },
            { title: 'Area', dataIndex: 'area' }
          ]}
          rowKey='id'
          pagination={false}
        />
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
            render: (_, record) => (
              <Button
                type='primary'
                onClick={() => {
                  if (!selectedAi.some(r => r.id === record.id)) {
                    setSelectedAi(prev => [...prev, record])
                  }
                }}
                disabled={selectedAi.some(r => r.id === record.id)}
              >
                Confirm
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

      <Divider>7. Online Presence</Divider>
      <Paragraph>
        <Text strong>Facebook:</Text> {participantData.facebook}
      </Paragraph>
      <Paragraph>
        <Text strong>Instagram:</Text> {participantData.instagram}
      </Paragraph>
      <Paragraph>
        <Text strong>LinkedIn:</Text> {participantData.linkedIn}
      </Paragraph>

      <Divider>8. Signature</Divider>
      <Paragraph>
        This document was generated based on your submitted data.
        <br />
        <Text strong>Signature:</Text> {getDigitalSignature()}
      </Paragraph>
    </Card>
  )
}

export default GrowthPlanPage
