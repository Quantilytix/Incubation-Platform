import React from 'react'
import { List, Card, Typography } from 'antd'
import { Helmet } from 'react-helmet' // ✅ Import Helmet

const { Title, Paragraph } = Typography

interface Feedback {
  id: number
  sme: string
  interventionTitle: string
  comment: string
}

export const FeedbackWorkspace: React.FC = () => {
  const feedbacks: Feedback[] = [
    {
      id: 1,
      sme: 'BrightTech',
      interventionTitle: 'Website Development',
      comment: 'We would have liked clearer timelines for deliverables.'
    },
    {
      id: 2,
      sme: 'Green Farms',
      interventionTitle: 'Supply Chain Optimization',
      comment:
        'Consultant provided good strategies but needed more market data.'
    }
  ]

  return (
    <div style={{ padding: 24, height: '100vh', overflow: 'auto' }}>
      <Helmet>
        <title>Participant Insights | Smart Incubation</title>{' '}
        {/* ✅ Set page title */}
      </Helmet>

      <Title level={3}>Participant Insights</Title>

      <List
        dataSource={feedbacks}
        renderItem={item => (
          <Card key={item.id} style={{ marginBottom: 16 }}>
            <Title level={5}>{item.sme}</Title>
            <Paragraph type='secondary'>
              <b>Intervention:</b> {item.interventionTitle}
            </Paragraph>
            <Paragraph>{item.comment}</Paragraph>
          </Card>
        )}
      />
    </div>
  )
}
