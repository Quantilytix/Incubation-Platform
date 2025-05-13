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
import { useNavigate } from 'react-router-dom'

const { Title } = Typography

const ProfileForm: React.FC = () => {
  const [form] = Form.useForm()
  const [participantDocId, setParticipantDocId] = useState<string | null>(null)
  const navigate = useNavigate()

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
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) return

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)
      const fallbackEmail = user.email
      const fallbackName = userSnap.exists() ? userSnap.data()?.name || '' : ''

      const defaultValues = {
        email: fallbackEmail,
        ownerName: fallbackName
      }

      const q = query(
        collection(db, 'participants'),
        where('email', '==', fallbackEmail)
      )
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const docRef = snapshot.docs[0]
        const data = docRef.data()
        setParticipantDocId(docRef.id)

        form.setFieldsValue({
          ...defaultValues,
          ...data,
          dateOfRegistration: data.dateOfRegistration
            ? dayjs(
                data.dateOfRegistration.toDate?.() || data.dateOfRegistration
              )
            : null
        })
      } else {
        form.setFieldsValue(defaultValues)
      }
    })

    return () => unsubscribe()
  }, [form])

  const onSave = async () => {
    try {
      const values = await form.validateFields()
      const user = auth.currentUser
      if (!user) throw new Error('User not authenticated')

      // Extract and normalize headcount & revenue fields
      const monthly: Record<string, any> = {}
      const annual: Record<string, any> = {}

      Object.entries(values).forEach(([key, value]) => {
        if (key.startsWith('revenue_')) {
          const suffix = key.replace('revenue_', '')
          if (isNaN(Number(suffix))) {
            // Monthly
            if (!monthly[suffix]) monthly[suffix] = {}
            monthly[suffix].revenue = value
          } else {
            // Annual
            if (!annual[suffix]) annual[suffix] = {}
            annual[suffix].revenue = value
          }
        }
        if (key.startsWith('permHeadcount_')) {
          const suffix = key.replace('permHeadcount_', '')
          if (isNaN(Number(suffix))) {
            if (!monthly[suffix]) monthly[suffix] = {}
            monthly[suffix].permanent = value
          } else {
            if (!annual[suffix]) annual[suffix] = {}
            annual[suffix].permanent = value
          }
        }
        if (key.startsWith('tempHeadcount_')) {
          const suffix = key.replace('tempHeadcount_', '')
          if (isNaN(Number(suffix))) {
            if (!monthly[suffix]) monthly[suffix] = {}
            monthly[suffix].temporary = value
          } else {
            if (!annual[suffix]) annual[suffix] = {}
            annual[suffix].temporary = value
          }
        }
      })

      const data = {
        ...values,
        dateOfRegistration: values.dateOfRegistration
          ? values.dateOfRegistration.toDate()
          : null,
        email: user.email,
        updatedAt: new Date(),
        revenueHistory: {
          monthly: Object.fromEntries(
            Object.entries(monthly).map(([k, v]) => [k, v.revenue || 0])
          ),
          annual: Object.fromEntries(
            Object.entries(annual).map(([k, v]) => [k, v.revenue || 0])
          )
        },
        headcountHistory: {
          monthly: Object.fromEntries(
            Object.entries(monthly).map(([k, v]) => [
              k,
              { permanent: v.permanent || 0, temporary: v.temporary || 0 }
            ])
          ),
          annual: Object.fromEntries(
            Object.entries(annual).map(([k, v]) => [
              k,
              { permanent: v.permanent || 0, temporary: v.temporary || 0 }
            ])
          )
        }
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
        message.success('Profile saved successfully')
        navigate('/incubatee/sme') // ✅ redirect
      }
    } catch (error) {
      console.error(error)
      message.error('Failed to save profile')
    }
  }

  const sectors = [
    'Agriculture',
    'Mining',
    'Manufacturing',
    'Electricity, Gas and Water',
    'Construction',
    'Wholesale and Retail Trade',
    'Transport, Storage and Communication',
    'Finance, Real Estate and Business Services',
    'Community, Social and Personal Services',
    'Tourism and Hospitality',
    'Information Technology',
    'Education',
    'Health and Social Work',
    'Arts and Culture',
    'Automotive',
    'Chemical',
    'Textile',
    'Forestry and Logging',
    'Fishing',
    'Other'
  ]

  const provinces = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'Northern Cape',
    'North West',
    'Western Cape'
  ]

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
              name='beneficiaryName'
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
                {sectors.map(sector => (
                  <Select.Option key={sector} value={sector}>
                    {sector}
                  </Select.Option>
                ))}
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
                {provinces.map(province => (
                  <Select.Option key={province} value={province}>
                    {province}
                  </Select.Option>
                ))}
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
