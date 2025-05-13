// src/pages/incubatee/GrowthPlanPage.tsx

import React, { useEffect, useState } from 'react'
import { Card, Typography, Spin, Table, Divider, message } from 'antd'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { SHA256 } from 'crypto-js'

const { Title, Paragraph, Text } = Typography

const GrowthPlanPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchGrowthPlan = async () => {
      const user = auth.currentUser
      if (!user) {
        message.error('User not authenticated.')
        return
      }

      try {
        const q = query(
          collection(db, 'applications'),
          where('email', '==', user.email)
        )
        const snap = await getDocs(q)

        if (snap.empty) {
          message.warning('No growth plan found.')
          return
        }

        const docData = snap.docs[0].data()
        setData(docData)
      } catch (err) {
        console.error('Error loading growth plan:', err)
        message.error('Failed to load growth plan.')
      } finally {
        setLoading(false)
      }
    }

    fetchGrowthPlan()
  }, [])

  const getAnnualData = () =>
    [2023, 2024].map(year => ({
      year,
      perm: data?.[`empPerm${year}`],
      temp: data?.[`empTemp${year}`],
      revenue: `R${data?.[`revenue${year}`] ?? 0}`
    }))

  const getMonthlyData = () => {
    const months = ['January', 'February', 'March']
    return months.map(month => ({
      month,
      perm: data?.[`empPerm${month}`],
      temp: data?.[`empTemp${month}`],
      revenue: `R${data?.[`revenue${month}`] ?? 0}`
    }))
  }

  const getDigitalSignature = () => {
    return SHA256(
      `${data?.email}|${data?.participantName}|${data?.dateOfRegistration}`
    )
      .toString()
      .substring(0, 16)
  }

  if (loading) return <Spin tip='Loading...' style={{ marginTop: 64 }} />

  if (!data) return <Paragraph>No growth plan data available.</Paragraph>

  return (
    <Card style={{ padding: 24 }}>
      <Title level={3}>
        {data.beneficiaryName || 'Participant'} Diagnostic Assessment
      </Title>

      <Divider>1. Business Overview</Divider>
      <Paragraph>
        <Text strong>Business Owner:</Text> {data.participantName}
      </Paragraph>
      <Paragraph>
        <Text strong>Sector:</Text> {data.sector}
      </Paragraph>
      <Paragraph>
        <Text strong>Stage:</Text> {data.stage}
      </Paragraph>
      <Paragraph>
        <Text strong>Province:</Text> {data.province}
      </Paragraph>
      <Paragraph>
        <Text strong>City:</Text> {data.city}
      </Paragraph>
      <Paragraph>
        <Text strong>Date of Registration:</Text> {data.dateOfRegistration}
      </Paragraph>
      <Paragraph>
        <Text strong>Years Trading:</Text> {data.yearsOfTrading}
      </Paragraph>

      <Divider>2. Business Summary</Divider>
      <Paragraph>
        <Text strong>Motivation:</Text> {data.motivation}
      </Paragraph>
      <Paragraph>
        <Text strong>Challenges:</Text> {data.challenges}
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
        Monthly
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
        <Text strong>Compliance Score:</Text> {data.complianceRate}%
      </Paragraph>

      <Divider>5. Interventions</Divider>
      {(data.interventions?.required || []).map((i: any, idx: number) => (
        <Paragraph key={idx}>
          • {i.title} ({i.area})
        </Paragraph>
      ))}

      <Divider>6. AI Recommendation</Divider>
      <Paragraph>
        <Text strong>Recommendation:</Text>{' '}
        {data.aiEvaluation?.['AI Recommendation']}
      </Paragraph>
      <Paragraph>
        <Text strong>Score:</Text> {data.aiEvaluation?.['AI Score']}
      </Paragraph>
      <Paragraph>
        <Text strong>Justification:</Text>{' '}
        {data.aiEvaluation?.['Justification']}
      </Paragraph>

      <Divider>7. Online Presence</Divider>
      <Paragraph>
        <Text strong>Facebook:</Text> {data.facebook}
      </Paragraph>
      <Paragraph>
        <Text strong>Instagram:</Text> {data.instagram}
      </Paragraph>
      <Paragraph>
        <Text strong>LinkedIn:</Text> {data.linkedIn}
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
