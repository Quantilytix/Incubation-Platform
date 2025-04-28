import React, { useState } from 'react'
import {
  Form,
  Input,
  Button,
  Select,
  Upload,
  Card,
  Typography,
  Space,
  message,
  Row,
  Col
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { db, storage } from '@/firebase'
import { addDoc, collection } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Helmet } from 'react-helmet'

const { Title } = Typography
const { Option } = Select

const sectors = [
  'Agriculture',
  'Construction',
  'Education',
  'Energy',
  'Finance',
  'Healthcare',
  'Hospitality',
  'IT',
  'Manufacturing',
  'Mining',
  'Retail',
  'Transportation',
  'Other'
]

const stages = ['Startup', 'Growth', 'Established', 'Expansion', 'Mature']

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

const ParticipantFormalRegistration: React.FC = () => {
  const [form] = Form.useForm()
  const [customSector, setCustomSector] = useState('')
  const [fileList, setFileList] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()

  const getAgeGroup = (age: number) => {
    if (age <= 18) return 'Youth'
    if (age <= 35) return 'Youth'
    if (age <= 59) return 'Adult'
    return 'Senior'
  }

  const handleUpload = async () => {
    const urls = []
    for (const file of fileList) {
      const storageRef = ref(storage, `participant_documents/${file.name}`)
      await uploadBytes(storageRef, file.originFileObj)
      const url = await getDownloadURL(storageRef)
      urls.push(url)
    }
    return urls
  }

  const onFinish = async (values: any) => {
    if (values.motivation && values.motivation.trim().split(' ').length < 100) {
      message.error('Motivation must be at least 100 words')
      return
    }

    setUploading(true)
    try {
      const fileUrls = await handleUpload()

      const participant = {
        enterpriseName: values.enterpriseName,
        email: values.email,
        sector: values.sector === 'Other' ? customSector : values.sector,
        stage: values.stage,
        developmentType: values.developmentType,
        gender: values.gender,
        age: values.age,
        ageGroup: getAgeGroup(values.age),
        incubatorCode: values.incubatorCode,
        businessAddress: values.businessAddress,
        province: values.province,
        city: values.city,
        location: values.location,
        postalCode: values.postalCode,
        natureOfBusiness: values.natureOfBusiness,
        registrationNumber: values.registrationNumber,
        dateOfRegistration: values.dateOfRegistration,
        yearsOfTrading: values.yearsOfTrading,
        websiteUrl: values.websiteUrl || '',
        socialMedia: {
          facebook: values.facebook || '',
          instagram: values.instagram || '',
          x: values.x || '',
          linkedIn: values.linkedIn || '',
          other: values.other || ''
        },
        motivation: values.motivation,
        challenges: values.challenges,
        documents: fileUrls,
        revenueHistory: {
          yearly: {
            '2023': values.revenue2023,
            '2024': values.revenue2024
          },
          monthly: {
            [values.month1]: values.revenueMonth1,
            [values.month2]: values.revenueMonth2,
            [values.month3]: values.revenueMonth3
          }
        },
        headcountHistory: {
          yearly: {
            '2023': {
              permanent: values.perm2023,
              temporary: values.temp2023
            },
            '2024': {
              permanent: values.perm2024,
              temporary: values.temp2024
            }
          },
          monthly: {
            [values.month1]: {
              permanent: values.permMonth1,
              temporary: values.tempMonth1
            },
            [values.month2]: {
              permanent: values.permMonth2,
              temporary: values.tempMonth2
            },
            [values.month3]: {
              permanent: values.permMonth3,
              temporary: values.tempMonth3
            }
          }
        },
        interventions: {
          required: [],
          assigned: [],
          completed: [],
          participationRate: 0
        }
      }

      await addDoc(collection(db, 'participants'), participant)
      message.success('Participant successfully registered!')
      navigate('/consultant/participants')
    } catch (error) {
      console.error(error)
      message.error('Registration failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Helmet>
        <title>Participant Registration</title>
      </Helmet>

      <Card>
        <Title level={3}>Participant Registration</Title>
        <Form layout='vertical' form={form} onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label='Enterprise Name'
                name='enterpriseName'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label='Email'
                name='email'
                rules={[{ required: true, type: 'email' }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label='Sector'
                name='sector'
                rules={[{ required: true }]}
              >
                <Select onChange={v => v === 'Other' && setCustomSector('')}>
                  {sectors.map(sec => (
                    <Option key={sec}>{sec}</Option>
                  ))}
                </Select>
              </Form.Item>
              {form.getFieldValue('sector') === 'Other' && (
                <Form.Item label='Specify Sector' required>
                  <Input
                    value={customSector}
                    onChange={e => setCustomSector(e.target.value)}
                  />
                </Form.Item>
              )}
              <Form.Item
                label='Nature of Business'
                name='natureOfBusiness'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label='Stage'
                name='stage'
                rules={[{ required: true }]}
              >
                <Select>
                  {stages.map(stage => (
                    <Option key={stage}>{stage}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                label='Development Type'
                name='developmentType'
                rules={[{ required: true }]}
              >
                <Select>
                  {developmentTypes.map(dev => (
                    <Option key={dev}>{dev}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                label='Gender'
                name='gender'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Male'>Male</Option>
                  <Option value='Female'>Female</Option>
                </Select>
              </Form.Item>
              <Form.Item label='Age' name='age' rules={[{ required: true }]}>
                <Input type='number' />
              </Form.Item>
              <Form.Item label='Incubator Code' name='incubatorCode'>
                <Input placeholder='Optional (e.g. CPT, JHB)' />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label='Business Address'
                name='businessAddress'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                label='Province'
                name='province'
                rules={[{ required: true }]}
              >
                <Select>
                  {provinces.map(prov => (
                    <Option key={prov}>{prov}</Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label='City' name='city' rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item
                label='Location'
                name='location'
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value='Urban'>Urban</Option>
                  <Option value='Township'>Township</Option>
                  <Option value='Rural'>Rural</Option>
                </Select>
              </Form.Item>
              <Form.Item
                label='Postal Code'
                name='postalCode'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>

              <Form.Item label='Registration Number' name='registrationNumber'>
                <Input />
              </Form.Item>
              <Form.Item label='Date of Registration' name='dateOfRegistration'>
                <Input type='date' />
              </Form.Item>
              <Form.Item label='Years of Trading' name='yearsOfTrading'>
                <Input type='number' />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label='Website URL' name='websiteUrl'>
                <Input />
              </Form.Item>
              <Form.Item label='Social Media: Facebook' name='facebook'>
                <Input />
              </Form.Item>
              <Form.Item label='Instagram' name='instagram'>
                <Input />
              </Form.Item>
              <Form.Item label='X (Twitter)' name='x'>
                <Input />
              </Form.Item>
              <Form.Item label='LinkedIn' name='linkedIn'>
                <Input />
              </Form.Item>
              <Form.Item label='Other' name='other'>
                <Input />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label='Motivation (Min 100 words)'
                name='motivation'
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={5} />
              </Form.Item>
              <Form.Item label='Challenges' name='challenges'>
                <Input.TextArea rows={4} />
              </Form.Item>
              <Form.Item label='Upload Business Documents'>
                <Upload
                  fileList={fileList}
                  beforeUpload={() => false}
                  onChange={({ fileList }) => setFileList(fileList)}
                  multiple
                >
                  <Button icon={<UploadOutlined />}>Upload</Button>
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Title level={4}>Financial Information</Title>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label='Revenue 2023' name='revenue2023'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label='Revenue 2024' name='revenue2024'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label='Month 1' name='month1'>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Revenue Month 1' name='revenueMonth1'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Permanent Month 1' name='permMonth1'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Temporary Month 1' name='tempMonth1'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
              </Row>

              {/* Repeat for Month 2 and 3 */}
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label='Month 2' name='month2'>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Revenue Month 2' name='revenueMonth2'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Permanent Month 2' name='permMonth2'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Temporary Month 2' name='tempMonth2'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label='Month 3' name='month3'>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Revenue Month 3' name='revenueMonth3'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Permanent Month 3' name='permMonth3'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label='Temporary Month 3' name='tempMonth3'>
                    <Input type='number' />
                  </Form.Item>
                </Col>
              </Row>
            </Col>
          </Row>

          <Form.Item style={{ marginTop: 24 }}>
            <Space>
              <Button type='primary' htmlType='submit' loading={uploading}>
                Submit Registration
              </Button>
              <Button onClick={() => navigate('/consultant/participants')}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default ParticipantFormalRegistration
