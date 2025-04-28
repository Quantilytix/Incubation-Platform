import React, { useEffect, useState } from 'react'
import {
  Form,
  Input,
  Button,
  Select,
  Steps,
  Card,
  Row,
  Col,
  message,
  Space,
  Tag
} from 'antd'
import { db } from '@/firebase'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'

const { Option } = Select
const { Step } = Steps

const stages = ['Startup', 'Growth', 'Mature', 'Decline']
const provinces = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
  'Western Cape'
]
const developmentTypes = ['Enterprise Development', 'Supplier Development']

const getAgeGroup = (age: number) => {
  if (age <= 18) return 'Youth'
  if (age <= 35) return 'Youth'
  if (age <= 59) return 'Adult'
  return 'Senior'
}

export const ParticipantOnboardingForm: React.FC = () => {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [interventionsOptions, setInterventionsOptions] = useState<any[]>([])
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>(
    []
  )
  const [selectedSector, setSelectedSector] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchInterventions = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'interventions'))
        const interventionsList = snapshot.docs.flatMap(doc =>
          (doc.data()?.interventions || []).map((intervention: any) => ({
            id: intervention.id,
            title: intervention.title,
            area: doc.data().area
          }))
        )
        setInterventionsOptions(interventionsList)
      } catch (error) {
        console.error('Error fetching interventions:', error)
      }
    }
    fetchInterventions()
  }, [])

  const handleNext = async () => {
    try {
      await form.validateFields()
      setCurrentStep(prev => prev + 1)
    } catch (error) {
      console.error(error)
    }
  }

  const handlePrev = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleAddIntervention = (value: string) => {
    if (!selectedInterventions.includes(value)) {
      setSelectedInterventions([...selectedInterventions, value])
    }
  }

  const handleRemoveIntervention = (value: string) => {
    setSelectedInterventions(selectedInterventions.filter(i => i !== value))
  }

  const handleFinish = async (values: any) => {
    setLoading(true)
    try {
      const participant = {
        enterpriseName: values.enterpriseName,
        email: values.email,
        sector: values.sector === 'Other' ? values.otherSector : values.sector,
        stage: values.stage,
        developmentType: values.developmentType,
        gender: values.gender,
        age: values.age,
        ageGroup: getAgeGroup(values.age),
        incubatorCode: values.incubatorCode || '',
        businessAddress: values.businessAddress,
        businessAddressProvince: values.businessAddressProvince,
        businessAddressCity: values.businessAddressCity,
        businessAddressLocation: values.businessAddressLocation,
        postalCode: values.postalCode,
        websiteUrl: values.websiteUrl || '',
        socialMedia: {
          facebook: values.facebook || '',
          instagram: values.instagram || '',
          x: values.x || '',
          linkedIn: values.linkedIn || '',
          other: values.other || ''
        },
        interventions: {
          required: (values.requiredInterventions || []).map(
            (title: string) => ({ title, id: '' })
          ),
          assigned: [],
          completed: [],
          participationRate: 0
        },
        revenueHistory: {
          yearly: {
            '2023': values.revenue2023 || 0,
            '2024': values.revenue2024 || 0
          },
          monthly: {
            month1: values.revenueMonth1 || 0,
            month2: values.revenueMonth2 || 0,
            month3: values.revenueMonth3 || 0
          }
        },
        headcountHistory: {
          yearly: {
            '2023': values.headcount2023 || 0,
            '2024': values.headcount2024 || 0
          },
          monthly: {
            month1: values.headcountMonth1 || 0,
            month2: values.headcountMonth2 || 0,
            month3: values.headcountMonth3 || 0
          }
        }
      }

      await addDoc(collection(db, 'participants'), participant)
      message.success('Participant successfully onboarded!')
      navigate('/consultant/participants')
    } catch (error) {
      console.error('Error adding participant:', error)
      message.error('Failed to onboard participant.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    {
      title: 'Basic Info',
      content: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name='enterpriseName'
              label='Enterprise Name'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name='email'
              label='Email'
              rules={[{ type: 'email', required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name='sector'
              label='Sector'
              rules={[{ required: true }]}
            >
              <Select
                placeholder='Select sector'
                onChange={v => setSelectedSector(v)}
              >
                <Option value='Agriculture'>Agriculture</Option>
                <Option value='Construction'>Construction</Option>
                <Option value='Education'>Education</Option>
                <Option value='Energy'>Energy</Option>
                <Option value='Finance'>Finance</Option>
                <Option value='Healthcare'>Healthcare</Option>
                <Option value='Hospitality'>Hospitality</Option>
                <Option value='Information Technology'>
                  Information Technology
                </Option>
                <Option value='Manufacturing'>Manufacturing</Option>
                <Option value='Mining'>Mining</Option>
                <Option value='Retail'>Retail</Option>
                <Option value='Transportation'>Transportation</Option>
                <Option value='Other'>Other</Option>
              </Select>
            </Form.Item>
            {selectedSector === 'Other' && (
              <Form.Item
                name='otherSector'
                label='Specify Other Sector'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            )}
            <Form.Item
              name='stage'
              label='Company Stage'
              rules={[{ required: true }]}
            >
              <Select placeholder='Select stage'>
                {stages.map(stage => (
                  <Option key={stage} value={stage}>
                    {stage}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name='developmentType'
              label='Development Type'
              rules={[{ required: true }]}
            >
              <Select placeholder='Select development type'>
                {developmentTypes.map(type => (
                  <Option key={type} value={type}>
                    {type}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name='gender'
              label='Gender'
              rules={[{ required: true }]}
            >
              <Select>
                <Option value='Male'>Male</Option>
                <Option value='Female'>Female</Option>
              </Select>
            </Form.Item>
            <Form.Item name='age' label='Age' rules={[{ required: true }]}>
              <Input type='number' min={10} />
            </Form.Item>
            <Form.Item name='incubatorCode' label='Incubator Code'>
              <Input placeholder='Optional' />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      title: 'Business Info',
      content: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name='businessAddress'
              label='Business Address'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name='businessAddressProvince'
              label='Province'
              rules={[{ required: true }]}
            >
              <Select placeholder='Select province'>
                {provinces.map(province => (
                  <Option key={province} value={province}>
                    {province}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name='businessAddressCity'
              label='City'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name='businessAddressLocation'
              label='Location'
              rules={[{ required: true }]}
            >
              <Select>
                <Option value='Urban'>Urban</Option>
                <Option value='Township'>Township</Option>
                <Option value='Rural'>Rural</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name='postalCode'
              label='Postal Code'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name='websiteUrl' label='Website URL'>
              <Input />
            </Form.Item>
            <Form.Item name='facebook' label='Facebook'>
              <Input />
            </Form.Item>
            <Form.Item name='instagram' label='Instagram'>
              <Input />
            </Form.Item>
            <Form.Item name='x' label='X (Twitter)'>
              <Input />
            </Form.Item>
            <Form.Item name='linkedIn' label='LinkedIn'>
              <Input />
            </Form.Item>
            <Form.Item name='other' label='Other Link'>
              <Input />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      title: 'Revenue & Employees',
      content: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name='revenue2023'
              label='Revenue 2023 (R)'
              rules={[{ required: true }]}
            >
              <Input type='number' />
            </Form.Item>
            <Form.Item
              name='revenue2024'
              label='Revenue 2024 (R)'
              rules={[{ required: true }]}
            >
              <Input type='number' />
            </Form.Item>
            <Form.Item name='revenueMonth1' label='Revenue 1 Month Ago (R)'>
              <Input type='number' />
            </Form.Item>
            <Form.Item name='revenueMonth2' label='Revenue 2 Months Ago (R)'>
              <Input type='number' />
            </Form.Item>
            <Form.Item name='revenueMonth3' label='Revenue 3 Months Ago (R)'>
              <Input type='number' />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name='headcount2023'
              label='Headcount 2023'
              rules={[{ required: true }]}
            >
              <Input type='number' />
            </Form.Item>
            <Form.Item
              name='headcount2024'
              label='Headcount 2024'
              rules={[{ required: true }]}
            >
              <Input type='number' />
            </Form.Item>
            <Form.Item name='headcountMonth1' label='Employees 1 Month Ago'>
              <Input type='number' />
            </Form.Item>
            <Form.Item name='headcountMonth2' label='Employees 2 Months Ago'>
              <Input type='number' />
            </Form.Item>
            <Form.Item name='headcountMonth3' label='Employees 3 Months Ago'>
              <Input type='number' />
            </Form.Item>
          </Col>
        </Row>
      )
    },
    {
      title: 'Interventions',
      content: (
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label='Add Intervention'>
              <Select
                placeholder='Select to Add'
                onSelect={handleAddIntervention}
                style={{ width: '100%' }}
              >
                {interventionsOptions.map(option => (
                  <Option key={option.id} value={option.title}>
                    {option.title} ({option.area})
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Space wrap style={{ marginTop: 12 }}>
              {selectedInterventions.map(title => (
                <Tag
                  key={title}
                  closable
                  onClose={() => handleRemoveIntervention(title)}
                >
                  {title}
                </Tag>
              ))}
            </Space>
          </Col>
        </Row>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <Helmet>
        <title>Add New Participant | Incubation Platform</title>
      </Helmet>

      <Card>
        <Steps current={currentStep} style={{ marginBottom: 24 }}>
          {steps.map(step => (
            <Step key={step.title} title={step.title} />
          ))}
        </Steps>

        <Form form={form} layout='vertical' onFinish={handleFinish}>
          {steps[currentStep].content}

          <div style={{ marginTop: 24 }}>
            {currentStep > 0 && (
              <Button onClick={handlePrev} style={{ marginRight: 8 }}>
                Previous
              </Button>
            )}
            {currentStep < steps.length - 1 && (
              <Button type='primary' onClick={handleNext}>
                Next
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button type='primary' htmlType='submit' loading={loading}>
                Submit
              </Button>
            )}
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default ParticipantOnboardingForm
