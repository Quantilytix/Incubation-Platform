import { useLocation, useNavigate } from 'react-router-dom'
import { Typography, Divider, Card, Button } from 'antd'

const { Title, Paragraph } = Typography

const GrowthPlanDocument = () => {
  const { state } = useLocation()
  const navigate = useNavigate()

  if (!state || !state.participant) {
    return (
      <Card>
        <p>No participant data found.</p>
        <Button onClick={() => navigate('/')}>Go Home</Button>
      </Card>
    )
  }

  const data = state.participant

  return (
    <Card style={{ padding: 24 }}>
      <Title level={2}>{data.beneficiaryName} Growth Plan</Title>
      <Divider />
      <Title level={4}>Business Introduction</Title>
      <Paragraph>
        <strong>Business Name:</strong> {data.beneficiaryName}
        <br />
        <strong>Owner:</strong> {data.participantName}
        <br />
        <strong>Sector:</strong> {data.sector}
        <br />
        <strong>Nature of Business:</strong> {data.natureOfBusiness}
        <br />
        <strong>Stage:</strong> {data.stage}
        <br />
        <strong>Province:</strong> {data.province}
        <br />
      </Paragraph>

      <Title level={4}>Business Summary</Title>
      <Paragraph>{data.motivation}</Paragraph>

      <Title level={4}>Challenges</Title>
      <Paragraph>{data.challenges}</Paragraph>

      <Title level={4}>Compliance Overview</Title>
      <Paragraph>
        Compliance Score: {data.complianceRate}%<br />
        Years of Trading: {data.yearsOfTrading}
        <br />
        Registered on: {new Date(data.dateOfRegistration).toLocaleDateString()}
      </Paragraph>

      <Title level={4}>Selected Interventions</Title>
      <ul>
        {data.interventions?.required?.map((i, idx) => (
          <li key={idx}>
            {i.title} ({i.area})
          </li>
        ))}
      </ul>

      <Divider />
      <Button type='primary' onClick={() => window.print()}>
        Print or Save as PDF
      </Button>
    </Card>
  )
}

export default GrowthPlanDocument
