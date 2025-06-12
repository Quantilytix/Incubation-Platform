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
  getDoc,
  Timestamp
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'

const { Title } = Typography

const ProfileForm: React.FC = () => {
  const [form] = Form.useForm()
  const [participantDocId, setParticipantDocId] = useState<string | null>(null)
  const navigate = useNavigate()

  const last3Months = useMemo(
    () =>
      Array.from({ length: 3 }, (_, i) =>
        dayjs()
          .subtract(i + 1, 'month')
          .format('MMMM')
      ).reverse(),
    []
  )

  const currentYear = dayjs().year()
  const last2Years = useMemo(() => [currentYear - 1, currentYear - 2], [])

  useEffect(() => {
    console.log('ProfileForm useEffect running!')

    const unsubscribe = onAuthStateChanged(auth, async user => {
      console.log('onAuthStateChanged triggered!', user)
      if (!user) {
        console.log('No user, returning early.')
        return
      }

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)
      console.log(user)
      const fallbackEmail = user.email
      const fallbackName = userSnap.exists() ? userSnap.data()?.name || '' : ''

      // Fetch participant doc
      const q = query(
        collection(db, 'participants'),
        where('email', '==', fallbackEmail)
      )
      const snapshot = await getDocs(q)

      // Start with only minimal fields
      let initialValues = {
        email: fallbackEmail,
        participantName: fallbackName
      }

      if (!snapshot.empty) {
        const docRef = snapshot.docs[0]
        const data = docRef.data()
        setParticipantDocId(docRef.id)

        console.log('Firestore participant data:', data)
        // flatten headcountHistory & revenueHistory to flat field names
        const flatFields = {}
        // Headcount Monthly
        Object.entries(data.headcountHistory?.monthly || {}).forEach(
          ([month, v]) => {
            flatFields[`permHeadcount_${month}`] = v.permanent ?? 0
            flatFields[`tempHeadcount_${month}`] = v.temporary ?? 0
          }
        )
        // Headcount Annual
        Object.entries(data.headcountHistory?.annual || {}).forEach(
          ([year, v]) => {
            flatFields[`permHeadcount_${year}`] = v.permanent ?? 0
            flatFields[`tempHeadcount_${year}`] = v.temporary ?? 0
          }
        )
        // Revenue Monthly
        Object.entries(data.revenueHistory?.monthly || {}).forEach(
          ([month, v]) => {
            flatFields[`revenue_${month}`] = v ?? 0
          }
        )
        // Revenue Annual
        Object.entries(data.revenueHistory?.annual || {}).forEach(
          ([year, v]) => {
            flatFields[`revenue_${year}`] = v ?? 0
          }
        )

        console.log('flatFields:', flatFields)

        // Copy all non-history (top-level) fields from DB for other profile info
        const {
          participantName,
          email,
          beneficiaryName,
          gender,
          idNumber,
          phone,
          sector,
          natureOfBusiness,
          beeLevel,
          youthOwnedPercent,
          femaleOwnedPercent,
          blackOwnedPercent,
          dateOfRegistration,
          yearsOfTrading,
          registrationNumber,
          businessAddress,
          city,
          postalCode,
          province,
          hub,
          location
        } = data

        // Build what to inject into the form
        initialValues = {
          email: email ?? fallbackEmail,
          participantName: participantName ?? fallbackName,
          beneficiaryName,
          gender,
          idNumber,
          phone,
          sector,
          natureOfBusiness,
          beeLevel,
          youthOwnedPercent,
          femaleOwnedPercent,
          blackOwnedPercent,
          dateOfRegistration: dateOfRegistration
            ? dayjs(dateOfRegistration.toDate?.() || dateOfRegistration)
            : null,
          yearsOfTrading,
          registrationNumber,
          businessAddress,
          city,
          postalCode,
          province,
          hub,
          location,
          ...flatFields
        }

        console.log('initialValues to set in form:', initialValues)
        form.resetFields()
        form.setFieldsValue(initialValues)
        // After setting, log what the form thinks it has
        setTimeout(() => {
          console.log('Form values after set:', form.getFieldsValue(true))
        }, 100)
      } else {
        form.resetFields()
        form.setFieldsValue({
          email: fallbackEmail,
          participantName: fallbackName,
          permHeadcount_April: 1,
          permHeadcount_May: 1,
          permHeadcount_June: 1
        })
      }
    })

    return () => unsubscribe()
  }, [form, last3Months, last2Years])

  const onSave = async () => {
    try {
      const validated = await form.validateFields()
      const values = { ...form.getFieldsValue(true), ...validated }

      // Handle date conversion
      if (
        values.dateOfRegistration &&
        typeof values.dateOfRegistration === 'object' &&
        typeof values.dateOfRegistration.toDate === 'function'
      ) {
        values.dateOfRegistration = Timestamp.fromDate(
          values.dateOfRegistration.toDate()
        )
      }

      const user = auth.currentUser
      if (!user) throw new Error('User not authenticated')

      // 1. Gather all revenue and headcount entries
      const monthly = {}
      const annual = {}

      Object.entries(values).forEach(([key, value]) => {
        // Revenue fields
        if (key.startsWith('revenue_')) {
          const suffix = key.replace('revenue_', '')
          if (isNaN(Number(suffix))) {
            if (!monthly[suffix]) monthly[suffix] = {}
            monthly[suffix].revenue = value ?? 0 // Respect 0 and user input
          } else {
            if (!annual[suffix]) annual[suffix] = {}
            annual[suffix].revenue = value ?? 0
          }
        }
        // Permanent headcount fields
        if (key.startsWith('permHeadcount_')) {
          const suffix = key.replace('permHeadcount_', '')
          if (isNaN(Number(suffix))) {
            if (!monthly[suffix]) monthly[suffix] = {}
            monthly[suffix].permanent = value ?? 0
          } else {
            if (!annual[suffix]) annual[suffix] = {}
            annual[suffix].permanent = value ?? 0
          }
        }
        // Temporary headcount fields
        if (key.startsWith('tempHeadcount_')) {
          const suffix = key.replace('tempHeadcount_', '')
          if (isNaN(Number(suffix))) {
            if (!monthly[suffix]) monthly[suffix] = {}
            monthly[suffix].temporary = value ?? 0
          } else {
            if (!annual[suffix]) annual[suffix] = {}
            annual[suffix].temporary = value ?? 0
          }
        }
      })

      // 2. Prepare profile fields
      const {
        participantName,
        email,
        beneficiaryName,
        gender,
        idNumber,
        phone,
        sector,
        natureOfBusiness,
        beeLevel,
        youthOwnedPercent,
        femaleOwnedPercent,
        blackOwnedPercent,
        dateOfRegistration,
        yearsOfTrading,
        registrationNumber,
        businessAddress,
        city,
        postalCode,
        province,
        hub,
        location
      } = values

      // 3. Build the data object to save
      const dataToSave = {
        participantName,
        email,
        beneficiaryName,
        gender,
        idNumber,
        phone,
        sector,
        natureOfBusiness,
        beeLevel,
        youthOwnedPercent,
        femaleOwnedPercent,
        blackOwnedPercent,
        dateOfRegistration,
        yearsOfTrading,
        registrationNumber,
        businessAddress,
        city,
        postalCode,
        province,
        hub,
        location,
        headcountHistory: {
          monthly: Object.fromEntries(
            Object.entries(monthly).map(([k, v]) => [
              k,
              { permanent: v.permanent ?? 0, temporary: v.temporary ?? 0 }
            ])
          ),
          annual: Object.fromEntries(
            Object.entries(annual).map(([k, v]) => [
              k,
              { permanent: v.permanent ?? 0, temporary: v.temporary ?? 0 }
            ])
          )
        },
        revenueHistory: {
          monthly: Object.fromEntries(
            Object.entries(monthly).map(([k, v]) => [k, v.revenue ?? 0])
          ),
          annual: Object.fromEntries(
            Object.entries(annual).map(([k, v]) => [k, v.revenue ?? 0])
          )
        },
        updatedAt: new Date()
      }

      if (participantDocId) {
        await setDoc(doc(db, 'participants', participantDocId), dataToSave, {
          merge: true
        })
        message.success('Profile updated successfully')
      } else {
        const newDocRef = doc(collection(db, 'participants'))
        await setDoc(newDocRef, { ...dataToSave, setup: true })
        setParticipantDocId(newDocRef.id)
        message.success('Profile saved successfully')
        navigate('/incubatee/sme')
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
    <>
      <Helmet>
        <title>Profile | Smart Incubation Platform</title>
      </Helmet>
      <div
        style={{
          padding: '24px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff'
        }}
      >
        <Title level={3}>Your Profile</Title>
        <Form layout='vertical' form={form}>
          {/* Personal Info */}
          <Divider orientation='left'>Personal Details</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name='participantName'
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
            <Col span={12}>
              <Form.Item
                name='beneficiaryName'
                label='Company Name'
                rules={[{ required: true }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
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
          </Row>
          <Row>
            <Col span={24}>
              <Form.Item
                name='natureOfBusiness'
                label='Nature of Business (What your business offers)'
              >
                <Input.TextArea />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name='beeLevel' label='B-BBEE Level'>
                <Select>
                  {[1, 2, 3, 4].map(level => (
                    <Select.Option key={level} value={level}>
                      Level {level}
                    </Select.Option>
                  ))}
                  <Select.Option key='5plus' value='5+'>
                    Level 5 and above
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name='youthOwnedPercent' label='Youth-Owned %'>
                <InputNumber
                  addonAfter='%'
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name='femaleOwnedPercent' label='Female-Owned %'>
                <InputNumber
                  addonAfter='%'
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name='blackOwnedPercent' label='Black-Owned %'>
                <InputNumber
                  addonAfter='%'
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                />
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
            <Col span={8}>
              <Form.Item name='registrationNumber' label='Registration Number'>
                <Input />
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
              <Form.Item name='postalCode' label='Postal Code'>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
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
            <Col span={8}>
              <Form.Item name='hub' label='Host Community'>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
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
                <Form.Item
                  name={`revenue_${month}`}
                  label={`Revenue (${month})`}
                >
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
                <Form.Item
                  name={`permHeadcount_${month}`}
                  label='Permanent Staff'
                  //   initialValue={1}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={`tempHeadcount_${month}`}
                  label='Temporary Staff'
                >
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
                <Form.Item
                  name={`permHeadcount_${year}`}
                  label='Permanent Staff'
                  //   initialValue={1}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name={`tempHeadcount_${year}`}
                  label='Temporary Staff'
                >
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
    </>
  )
}

export default ProfileForm
