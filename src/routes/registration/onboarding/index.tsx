import React, { useState } from 'react'
import {
  Form,
  Input,
  Select,
  Upload,
  Button,
  DatePicker,
  Space,
  Typography,
  message,
  Card,
  Steps,
  Row,
  Col,
  Checkbox,
  Collapse
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { auth, db, storage } from '@/firebase'
import { collection, addDoc, getDoc, doc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useEffect } from 'react'

const { Title } = Typography
const { Step } = Steps
const { Option } = Select
const documentTypes = ['ID Copy', 'B-BBEE Certificate', 'Tax PIN', 'CSD Report']
const interventionGroups = [
  {
    id: 'i1',
    area: 'Marketing Support',
    interventions: [
      { id: 'i1-1', title: 'Marketing Action Plan' },
      { id: 'i1-2', title: 'Company logo' },
      { id: 'i1-3', title: 'Social / Digital Marketing' },
      { id: 'i1-4', title: 'Banners/ Pamphlets/Brochures' }
    ]
  },
  {
    id: 'i2',
    area: 'Financial management',
    interventions: [
      { id: 'i2-1', title: 'Management Acc' },
      { id: 'i2-2', title: 'Record keeping (financial)' }
    ]
  },
  {
    id: 'i3',
    area: 'Compliance',
    interventions: [
      { id: 'i3-1', title: 'Food safety & compliance' },
      { id: 'i3-2', title: 'CSD Registration' }
    ]
  }
]

const ParticipantRegistrationStepForm = () => {
  const [form] = Form.useForm()
  const [current, setCurrent] = useState(0)
  const [documents, setDocuments] = useState([])
  const [documentDetails, setDocumentDetails] = useState([])
  const [uploading, setUploading] = useState(false)
  const [documentFields, setDocumentFields] = useState(
    documentTypes.map(type => ({
      type,
      file: null,
      issueDate: null,
      expiryDate: null
    }))
  )
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>(
    []
  )

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const data = userSnap.data()
          form.setFieldsValue({
            incubatorCode: data.incubatorCode || ''
          })
        }
      }
    }

    fetchUserData()
  }, [])

  const navigate = useNavigate()

  const getAgeGroup = (age: number): 'Youth' | 'Adult' | 'Senior' => {
    if (age <= 35) return 'Youth'
    if (age <= 59) return 'Adult'
    return 'Senior'
  }

  const handleDateChange = (
    date: moment.Moment | null,
    field: 'issueDate' | 'expiryDate',
    index: number
  ): void => {
    const updated = [...documentFields]
    updated[index][field] = date
    setDocumentFields(updated)
  }

  const next = () => form.validateFields().then(() => setCurrent(current + 1))

  const prev = () => setCurrent(current - 1)

  const handleFileUpload = (file: any, index: number) => {
    const updated = [...documentFields]
    updated[index].file = file
    setDocumentFields(updated)
    return false // prevent auto-upload
  }
  const uploadAllDocuments = async () => {
    const uploadedDocs = []
    for (const doc of documentFields) {
      if (!doc.file || !doc.issueDate || !doc.expiryDate) continue

      const storageRef = ref(storage, `participant_documents/${doc.file.name}`)
      await uploadBytes(storageRef, doc.file)
      const url = await getDownloadURL(storageRef)

      uploadedDocs.push({
        type: doc.type,
        url,
        issueDate: doc.issueDate.format('YYYY-MM-DD'),
        expiryDate: doc.expiryDate.format('YYYY-MM-DD'),
        status: 'valid'
      })
    }
    return uploadedDocs
  }
  const calculateCompliance = () => {
    const filled = documentFields.filter(
      d => d.file && d.issueDate && d.expiryDate
    ).length
    return Math.round((filled / documentTypes.length) * 100)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const complianceRate = calculateCompliance()

    if (complianceRate < 90) {
      message.error(
        'Compliance must be 90% or higher to approve this application.'
      )
      return
    }

    try {
      setUploading(true)
      const uploadedDocs = await uploadAllDocuments()

      const participant = {
        ...values,
        ageGroup: getAgeGroup(values.age),
        complianceRate,
        complianceDocuments: uploadedDocs,
        interventions: {
          required: selectedInterventions.map(id => {
            const match = interventionGroups
              .flatMap(group => group.interventions)
              .find(i => i.id === id)
            return {
              id: match?.id,
              title: match?.title,
              area: interventionGroups.find(g =>
                g.interventions.some(i => i.id === id)
              )?.area
            }
          }),
          assigned: [],
          completed: [],
          participationRate: 0
        }
      }

      await addDoc(collection(db, 'participants'), participant)
      message.success('Participant successfully registered and approved!')
      setCurrent(0)
      form.resetFields()
      setDocumentFields(
        documentTypes.map(type => ({
          type,
          file: null,
          issueDate: null,
          expiryDate: null
        }))
      )
      setSelectedInterventions([])
    } catch (err) {
      console.error(err)
      message.error('Failed to register participant.')
    } finally {
      setUploading(false)
    }
  }

  const steps = [
    {
      title: 'Business Info',
      content: (
        <Card style={{ backgroundColor: '#f0f5ff' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name='beneficiaryName'
                label='Beneficiary Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='participantName'
                label='Owner Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='email'
                label='Email'
                rules={[{ required: true, type: 'email' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='idNumber'
                label='ID Number'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='sector'
                label='Sector'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='IT'>IT</Option>
                  <Option value='Manufacturing'>Manufacturing</Option>
                  <Option value='Other'>Other</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name='natureOfBusiness'
                label='Nature of Business'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='stage'
                label='Stage'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Startup'>Startup</Option>
                  <Option value='Growth'>Growth</Option>
                </Select>
              </Form.Item>
              <Form.Item
                name='developmentType'
                label='Development Type'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Enterprise Development'>
                    Enterprise Development
                  </Option>
                  <Option value='Supplier Development'>
                    Supplier Development
                  </Option>
                </Select>
              </Form.Item>
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
                <Input type='number' />
              </Form.Item>
              <Form.Item name='registrationNumber' label='Registration Number'>
                <Input />
              </Form.Item>
              <Form.Item name='yearsOfTrading' label='Years of Trading'>
                <Input type='number' />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Business Location',
      content: (
        <Card style={{ backgroundColor: '#f6ffed' }}>
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
                name='province'
                label='Province'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Gauteng'>Gauteng</Option>
                  <Option value='Western Cape'>Western Cape</Option>
                </Select>
              </Form.Item>
              <Form.Item name='city' label='City' rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='postalCode'
                label='Postal Code'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name='location'
                label='Location'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Urban'>Urban</Option>
                  <Option value='Rural'>Rural</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Motivation',
      content: (
        <Card style={{ backgroundColor: '#fff7e6' }}>
          <Form.Item
            name='motivation'
            label='Motivation (min 100 words)'
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name='challenges' label='Challenges'>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name='facebook' label='Facebook'>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name='instagram' label='Instagram'>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name='linkedIn' label='LinkedIn'>
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Documents',
      content: (
        <Space direction='vertical' style={{ width: '100%' }}>
          {documentFields.map((doc, index) => (
            <Row gutter={16} key={index} align='middle'>
              <Col span={4}>
                <strong>{doc.type}</strong>
              </Col>
              <Col span={5}>
                <Upload
                  beforeUpload={file => handleFileUpload(file, index)}
                  fileList={doc.file ? [doc.file] : []}
                  onRemove={() => {
                    const updated = [...documentFields]
                    updated[index].file = null
                    setDocumentFields(updated)
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload</Button>
                </Upload>
              </Col>
              <Col span={7}>
                <DatePicker
                  placeholder='Issue Date'
                  style={{ width: '100%' }}
                  onChange={date => handleDateChange(date, 'issueDate', index)}
                />
              </Col>
              <Col span={7}>
                <DatePicker
                  placeholder='Expiry Date'
                  style={{ width: '100%' }}
                  onChange={date => handleDateChange(date, 'expiryDate', index)}
                />
              </Col>
            </Row>
          ))}
        </Space>
      )
    },
    {
      title: 'Interventions',
      content: (
        <Collapse accordion>
          {interventionGroups.map(group => (
            <Collapse.Panel header={group.area} key={group.id}>
              <Checkbox.Group
                value={selectedInterventions}
                onChange={val => setSelectedInterventions(val as string[])}
              >
                <Space direction='vertical'>
                  {group.interventions.map(i => (
                    <Checkbox key={i.id} value={i.id}>
                      {i.title}
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            </Collapse.Panel>
          ))}
        </Collapse>
      )
    },
    {
      title: 'Review',
      content: (
        <>
          <Title level={4}>Ready to Submit</Title>
          <p>
            Once submitted, your application will be saved and you’ll receive
            confirmation of onboarding.
          </p>
          <p>
            Compliance Score: <strong>{calculateCompliance()}%</strong>
          </p>
        </>
      )
    }
  ]

  return (
    <Card style={{ padding: 24 }}>
      <Title level={3}>Participant Stepwise Registration</Title>
      <Steps current={current} style={{ marginBottom: 24 }}>
        {steps.map(s => (
          <Step key={s.title} title={s.title} />
        ))}
      </Steps>
      <Form layout='vertical' form={form}>
        {steps[current].content}
        <Form.Item>
          <Space style={{ marginTop: 24 }}>
            {current > 0 && <Button onClick={prev}>Back</Button>}
            {current < steps.length - 1 && (
              <Button type='primary' onClick={next}>
                Next
              </Button>
            )}
            {current === steps.length - 1 && (
              <Button type='primary' onClick={handleSubmit}>
                Submit
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default ParticipantRegistrationStepForm
