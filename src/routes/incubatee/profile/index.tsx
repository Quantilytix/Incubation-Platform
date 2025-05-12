import React, { useEffect, useMemo, useState } from 'react'
import {
  Form,
  Input,
  Select,
  InputNumber,
  Divider,
  Row,
  Col,
  Button,
  DatePicker,
  Typography,
  message
} from 'antd'
import { db, auth } from '@/firebase'
import {
  collection,
  getDocs,
  query,
  where,
  setDoc,
  doc,
  getDoc
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import dayjs from 'dayjs'

const { Title } = Typography

const ProfileForm: React.FC = () => {
  const [form] = Form.useForm()
  const [participantDocId, setParticipantDocId] = useState<string | null>(null)

  const last3Months = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) =>
        dayjs().subtract(i, 'month').format('MMMM')
      ).reverse(),
    []
  )

  const currentYear = dayjs().year()
  const last2Years = useMemo(() => [currentYear - 1, currentYear - 2], [])

  useEffect(() => {
    onAuthStateChanged(auth, async user => {
      if (!user) return

      // Fetch user profile from 'users' collection
      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      const fallbackEmail = user.email
      const fallbackName = userSnap.exists() ? userSnap.data()?.name || '' : ''

      const defaultValues = {
        email: fallbackEmail,
        ownerName: fallbackName
      }

      // Fetch from participants collection (profile data)
      const q = query(
        collection(db, 'participants'),
        where('email', '==', fallbackEmail)
      )
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const doc = snapshot.docs[0]
        setParticipantDocId(doc.id)
        form.setFieldsValue({
          ...defaultValues,
          ...doc.data()
        })
      } else {
        form.setFieldsValue(defaultValues)
      }
    })
  }, [form])

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      const user = auth.currentUser
      if (!user) throw new Error('User not authenticated')

      const data = {
        ...values,
        email: user.email,
        updatedAt: new Date()
      }

      if (participantDocId) {
        await setDoc(doc(db, 'participants', participantDocId), data, {
          merge: true
        })
        message.success('Profile updated successfully')
      } else {
        const newDocRef = doc(collection(db, 'participants'))
        await setDoc(newDocRef, {
          ...data,
          setup: true // ✅ Mark as setup on first creation
        })
        setParticipantDocId(newDocRef.id)
        message.success('Profile created successfully')
      }
    } catch (error) {
      console.error(error)
      message.error('Failed to save profile')
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Your Profile</Title>
      <Form layout='vertical' form={form}>
        {/* Personal Info */}
        <Divider orientation='left'>Personal Details</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name='ownerName'
              label='Owner Name'
              rules={[{ required: true }]}
            >
              <Input disabled />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name='gender'
              label='Gender'
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value='Male'>Male</Select.Option>
                <Select.Option value='Female'>Female</Select.Option>
                <Select.Option value='Other'>Other</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name='idNumber'
              label='ID Number'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        {/* Contact */}
        <Row gutter={16}>
          <Col span={10}>
            <Form.Item name='email' label='Email' rules={[{ type: 'email' }]}>
              <Input disabled />
            </Form.Item>
          </Col>
          <Col span={10}>
            <Form.Item name='phone' label='Phone'>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        {/* Company Info */}
        <Divider orientation='left'>Company Info</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name='companyName'
              label='Company Name'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name='sector'
              label='Sector'
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value='Agriculture'>Agriculture</Select.Option>
                <Select.Option value='Manufacturing'>
                  Manufacturing
                </Select.Option>
                <Select.Option value='IT'>Information Technology</Select.Option>
                <Select.Option value='Other'>Other</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name='natureOfBusiness' label='Nature of Business'>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name='blackOwnedPercent' label='Black-Owned %'>
              <InputNumber
                addonAfter='%'
                min={0}
                max={100}
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name='beeLevel' label='BEEE Level'>
              <Select>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(level => (
                  <Select.Option key={level} value={level}>
                    Level {level}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name='registrationNumber' label='Registration Number'>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name='dateOfRegistration' label='Date of Registration'>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name='yearsOfTrading' label='Years of Trading'>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {/* Location Info */}
        <Divider orientation='left'>Location</Divider>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name='businessAddress' label='Business Address'>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name='city' label='City'>
              <Input />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name='province' label='Province'>
              <Select>
                <Select.Option value='Gauteng'>Gauteng</Select.Option>
                <Select.Option value='Western Cape'>Western Cape</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name='hub' label='Host Community'>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name='location' label='Location Type'>
              <Select>
                <Select.Option value='Urban'>Urban</Select.Option>
                <Select.Option value='Rural'>Rural</Select.Option>
                <Select.Option value='Township'>Township</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Metrics Section */}
        <Divider orientation='left'>📈 Headcount & Revenue</Divider>
        <Title level={5}>Monthly Data</Title>
        {last3Months.map(month => (
          <Row gutter={16} key={month}>
            <Col span={8}>
              <Form.Item name={`revenue_${month}`} label={`Revenue (${month})`}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v =>
                    `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  }
                  parser={v => Number(v?.replace(/R\s?|(,*)/g, '') || 0)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={`permHeadcount_${month}`} label='Perm. Staff'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={`tempHeadcount_${month}`} label='Temp. Staff'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        ))}

        <Title level={5}>Annual Data</Title>
        {last2Years.map(year => (
          <Row gutter={16} key={year}>
            <Col span={8}>
              <Form.Item name={`revenue_${year}`} label={`Revenue (${year})`}>
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={v =>
                    `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  }
                  parser={v => Number(v?.replace(/R\s?|(,*)/g, '') || 0)}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={`permHeadcount_${year}`} label='Perm. Staff'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name={`tempHeadcount_${year}`} label='Temp. Staff'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        ))}

        <Divider />
        <Button type='primary' onClick={onSave} block>
          Save Profile
        </Button>
      </Form>
    </div>
  )
}

export default ProfileForm
