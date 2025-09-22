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
  message,
  Grid,
  Space
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
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
dayjs.extend(customParseFormat)

const { Title } = Typography
const { useBreakpoint } = Grid

// SA ID checksum + date validation
export const isValidSouthAfricanID = (raw: string): boolean => {
  const id = (raw || '').replace(/\D/g, '')
  if (!/^\d{13}$/.test(id)) return false

  // --- DOB (YYMMDD) with century disambiguation ---
  const yyMMdd = id.slice(0, 6)
  const today = dayjs().startOf('day')

  // Try 2000s first (most recent births), else fall back to 1900s.
  const dob2000 = dayjs(`20${yyMMdd}`, 'YYYYMMDD', true)
  const dob1900 = dayjs(`19${yyMMdd}`, 'YYYYMMDD', true)

  let dob: dayjs.Dayjs | null = null
  if (dob2000.isValid() && !dob2000.isAfter(today)) {
    dob = dob2000
  } else if (dob1900.isValid() && !dob1900.isAfter(today)) {
    dob = dob1900
  } else {
    return false
  }

  // Age sanity: 0–120
  const age = today.diff(dob, 'year')
  if (age < 0 || age > 120) return false

  // --- SA checksum (Luhn variant over first 12 digits) ---
  const digits = id.split('').map(n => parseInt(n, 10))

  const oddSum =
    digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10]

  const evenConcat = `${digits[1]}${digits[3]}${digits[5]}${digits[7]}${digits[9]}${digits[11]}`
  const evenTimesTwo = String(Number(evenConcat) * 2)
  const evenSum = evenTimesTwo
    .split('')
    .reduce((s, d) => s + parseInt(d, 10), 0)

  const total = oddSum + evenSum
  const checkDigit = (10 - (total % 10)) % 10

  return checkDigit === digits[12]
}

// SA CIPC/CK/IT registration number formats (most common)
const isValidZARegistration = (raw: string): boolean => {
  if (!raw) return false
  const v = raw.toUpperCase().replace(/\s+/g, '')
  const patterns = [
    /^K\d{4}\/\d{6}\/\d{2}$/, // K2023/123456/07
    /^\d{4}\/\d{6}\/\d{2}$/, // 2015/123456/07
    /^CK\d{4}\/\d{6}\/\d{2}$/, // CK2009/123456/23
    /^IT\d{4}\/\d{6}$/ // IT2015/123456
  ]
  return patterns.some(re => re.test(v))
}

const ProfileForm: React.FC = () => {
  const [form] = Form.useForm()
  const [participantDocId, setParticipantDocId] = useState<string | null>(null)
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

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
  const last2Years = useMemo(
    () => [currentYear - 1, currentYear - 2],
    [currentYear]
  )

  // Trim all strings; turn "" -> undefined
  const isDateLike = (v: any) =>
    dayjs.isDayjs(v) || v instanceof Date || v instanceof Timestamp

  const trimStringsDeep = (obj: any): any => {
    if (obj === null || obj === undefined) return obj
    if (isDateLike(obj)) return obj // ⬅️ do not dive
    if (Array.isArray(obj)) return obj.map(trimStringsDeep)
    if (typeof obj === 'object')
      return Object.fromEntries(
        Object.entries(obj).map(([k, v]) => [k, trimStringsDeep(v)])
      )
    if (typeof obj === 'string') {
      const t = obj.trim()
      return t === '' ? undefined : t
    }
    return obj
  }

  const pruneUndefinedDeep = (obj: any): any => {
    if (obj === null || obj === undefined) return obj
    if (isDateLike(obj)) return obj // ⬅️ do not dive
    if (Array.isArray(obj))
      return obj.map(pruneUndefinedDeep).filter(v => v !== undefined)
    if (typeof obj === 'object')
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, pruneUndefinedDeep(v)])
      )
    return obj
  }

  const toFirestoreTimestamp = (v: any): Timestamp | undefined => {
    if (!v) return undefined
    if (v instanceof Timestamp) return v
    if (dayjs.isDayjs(v)) return Timestamp.fromDate(v.toDate())
    if (v instanceof Date) return Timestamp.fromDate(v)
    if (typeof v?.toDate === 'function') return Timestamp.fromDate(v.toDate()) // moment/Timestamp-like
    const d = dayjs(v)
    return d.isValid() ? Timestamp.fromDate(d.toDate()) : undefined
  }

  const coerceDateForForm = (v: any) => {
    if (!v) return null
    if (typeof v?.toDate === 'function') return dayjs(v.toDate()) // proper Timestamp
    if (typeof v?.seconds === 'number' && typeof v?.nanoseconds === 'number')
      return dayjs(new Timestamp(v.seconds, v.nanoseconds).toDate()) // raw TS object
    if (
      typeof v?.$y === 'number' &&
      typeof v?.$M === 'number' &&
      typeof v?.$D === 'number'
    )
      return dayjs(new Date(v.$y, v.$M, v.$D)) // previously-saved Dayjs map
    return dayjs(v).isValid() ? dayjs(v) : null
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) return

      const userRef = doc(db, 'users', user.uid)
      const userSnap = await getDoc(userRef)

      const fallbackEmail = user.email || ''
      const fallbackName = userSnap.exists() ? userSnap.data()?.name || '' : ''

      // Fetch participant doc
      const q = query(
        collection(db, 'participants'),
        where('email', '==', fallbackEmail)
      )
      const snapshot = await getDocs(q)

      let initialValues: any = {
        email: fallbackEmail,
        participantName: fallbackName
      }

      if (!snapshot.empty) {
        const docRef = snapshot.docs[0]
        const data: any = docRef.data()
        setParticipantDocId(docRef.id)

        const flatFields: Record<string, any> = {}

        Object.entries(data.headcountHistory?.monthly || {}).forEach(
          ([month, v]: any) => {
            flatFields[`permHeadcount_${month}`] = v?.permanent ?? 0
            flatFields[`tempHeadcount_${month}`] = v?.temporary ?? 0
          }
        )
        Object.entries(data.headcountHistory?.annual || {}).forEach(
          ([year, v]: any) => {
            flatFields[`permHeadcount_${year}`] = v?.permanent ?? 0
            flatFields[`tempHeadcount_${year}`] = v?.temporary ?? 0
          }
        )
        Object.entries(data.revenueHistory?.monthly || {}).forEach(
          ([month, v]: any) => {
            flatFields[`revenue_${month}`] = v ?? 0
          }
        )
        Object.entries(data.revenueHistory?.annual || {}).forEach(
          ([year, v]: any) => {
            flatFields[`revenue_${year}`] = v ?? 0
          }
        )

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
          dateOfRegistration: coerceDateForForm(data.dateOfRegistration),
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

        form.resetFields()
        form.setFieldsValue(initialValues)
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
  }, [form])

  const onSave = async () => {
    try {
      // Validates only fields with rules; "optional" fields without rules won't block save
      await form.validateFields()

      // Get raw values, trim strings, and normalize blanks -> undefined
      const raw = form.getFieldsValue(true)
      const values = trimStringsDeep(raw)

      // Convert date if present
      const regTs = toFirestoreTimestamp(values.dateOfRegistration)
      if (regTs) values.dateOfRegistration = regTs
      else delete values.dateOfRegistration

      const user = auth.currentUser
      if (!user) throw new Error('User not authenticated')

      // Build headcount/revenue maps – default to 0 only for these metrics
      const monthly: Record<string, any> = {}
      const annual: Record<string, any> = {}

      Object.entries(values).forEach(([key, value]) => {
        if (key.startsWith('revenue_')) {
          const suffix = key.replace('revenue_', '')
          if (isNaN(Number(suffix))) {
            monthly[suffix] = {
              ...(monthly[suffix] || {}),
              revenue: value ?? 0
            }
          } else {
            annual[suffix] = { ...(annual[suffix] || {}), revenue: value ?? 0 }
          }
        }
        if (key.startsWith('permHeadcount_')) {
          const suffix = key.replace('permHeadcount_', '')
          if (isNaN(Number(suffix))) {
            monthly[suffix] = {
              ...(monthly[suffix] || {}),
              permanent: value ?? 0
            }
          } else {
            annual[suffix] = {
              ...(annual[suffix] || {}),
              permanent: value ?? 0
            }
          }
        }
        if (key.startsWith('tempHeadcount_')) {
          const suffix = key.replace('tempHeadcount_', '')
          if (isNaN(Number(suffix))) {
            monthly[suffix] = {
              ...(monthly[suffix] || {}),
              temporary: value ?? 0
            }
          } else {
            annual[suffix] = {
              ...(annual[suffix] || {}),
              temporary: value ?? 0
            }
          }
        }
      })

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

      const base = {
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
            Object.entries(monthly).map(([k, v]: any) => [
              k,
              { permanent: v.permanent ?? 0, temporary: v.temporary ?? 0 }
            ])
          ),
          annual: Object.fromEntries(
            Object.entries(annual).map(([k, v]: any) => [
              k,
              { permanent: v.permanent ?? 0, temporary: v.temporary ?? 0 }
            ])
          )
        },
        revenueHistory: {
          monthly: Object.fromEntries(
            Object.entries(monthly).map(([k, v]: any) => [k, v.revenue ?? 0])
          ),
          annual: Object.fromEntries(
            Object.entries(annual).map(([k, v]: any) => [k, v.revenue ?? 0])
          )
        },
        updatedAt: new Date()
      }

      // Strip every undefined key deeply so Firestore never sees undefined
      const dataToSave = pruneUndefinedDeep(base)

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
    } catch (err) {
      console.error(err)
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
          padding: isMobile ? 12 : 24,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff'
        }}
      >
        <Space
          direction='vertical'
          size={isMobile ? 8 : 12}
          style={{ width: '100%' }}
        >
          <Form
            layout='vertical'
            form={form}
            style={{ width: '100%' }}
            requiredMark='optional'
          >
            {/* Personal Info */}
            <Divider
              orientation={isMobile ? 'center' : 'left'}
              style={{ margin: isMobile ? '8px 0 16px' : '16px 0 24px' }}
            >
              Personal Details
            </Divider>

            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
              <Col xs={24} md={8}>
                <Form.Item
                  name='participantName'
                  label='Owner Name'
                  rules={[{ required: true }]}
                >
                  <Input disabled />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name='gender'
                  label='Gender'
                  rules={[{ required: true }]}
                >
                  <Select placeholder='Select gender' allowClear>
                    <Select.Option value='Male'>Male</Select.Option>
                    <Select.Option value='Female'>Female</Select.Option>
                    <Select.Option value='Other'>Other</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name='idNumber'
                  label='ID Number'
                  rules={[
                    { required: false, message: 'ID number is required' },
                    {
                      validator: (_, value) =>
                        !value || isValidSouthAfricanID(value)
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error('Enter a valid South African ID')
                            )
                    }
                  ]}
                  getValueFromEvent={e =>
                    e.target.value.replace(/\D/g, '').slice(0, 13)
                  }
                >
                  <Input
                    inputMode='numeric'
                    maxLength={13}
                    placeholder='e.g. 9001015009087'
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Contact */}
            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name='email'
                  label='Email'
                  rules={[
                    { type: 'email', message: 'Enter a valid email' },
                    { required: true, message: 'Email is required' }
                  ]}
                >
                  <Input disabled />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name='phone' label='Phone'>
                  <Input inputMode='tel' placeholder='e.g. 082 123 4567' />
                </Form.Item>
              </Col>
            </Row>

            {/* Company Info */}
            <Divider
              orientation={isMobile ? 'center' : 'left'}
              style={{ margin: isMobile ? '8px 0 16px' : '16px 0 24px' }}
            >
              Company Info
            </Divider>

            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  name='beneficiaryName'
                  label='Company Name'
                  rules={[{ required: true }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name='sector'
                  label='Sector'
                  rules={[{ required: true }]}
                >
                  <Select
                    showSearch
                    placeholder='Select sector'
                    optionFilterProp='children'
                    filterOption={(input, option) =>
                      (option?.children as string)
                        ?.toLowerCase()
                        .includes(input.toLowerCase())
                    }
                    allowClear
                  >
                    {sectors.map(sector => (
                      <Select.Option key={sector} value={sector}>
                        {sector}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item
                  name='natureOfBusiness'
                  label='Nature of Business (What your business offers)'
                >
                  <Input.TextArea autoSize={{ minRows: 3 }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
              <Col xs={24} sm={12}>
                <Form.Item name='beeLevel' label='B-BBEE Level'>
                  <Select placeholder='Select level' allowClear>
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

              <Col xs={24} sm={4}>
                <Form.Item name='youthOwnedPercent' label='Youth-Owned %'>
                  <InputNumber
                    addonAfter='%'
                    min={0}
                    max={100}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={4}>
                <Form.Item name='femaleOwnedPercent' label='Female-Owned %'>
                  <InputNumber
                    addonAfter='%'
                    min={0}
                    max={100}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>

              <Col xs={24} sm={4}>
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

            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
              <Col xs={24} md={8}>
                <Form.Item
                  name='dateOfRegistration'
                  label='Date of Registration'
                  rules={[
                    {
                      required: true,
                      message: 'Registration date is required'
                    },
                    {
                      validator: (_, value) =>
                        !value || value.isAfter(dayjs(), 'day')
                          ? Promise.reject(
                              new Error(
                                'Registration date cannot be in the future'
                              )
                            )
                          : Promise.resolve()
                    }
                  ]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    inputReadOnly={isMobile}
                    disabledDate={current =>
                      current && current > dayjs().endOf('day')
                    }
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name='yearsOfTrading'
                  label='Years of Trading'
                  rules={[
                    { required: true, message: 'Years of trading is required' },
                    {
                      validator: (_, v) =>
                        v === null || v === undefined || v === ''
                          ? Promise.reject(
                              new Error('Years of trading is required')
                            )
                          : v < 0
                          ? Promise.reject(new Error('Must be 0 or greater'))
                          : Promise.resolve()
                    }
                  ]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name='registrationNumber'
                  label='Registration Number'
                  rules={[
                    {
                      required: true,
                      message: 'Registration number is required'
                    },
                    {
                      validator: (_, value) =>
                        !value || isValidZARegistration(value)
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error('Use a valid SA registration')
                            )
                    }
                  ]}
                  getValueFromEvent={e => e.target.value.toUpperCase()}
                >
                  <Input placeholder='e.g. 2015/123456/07' />
                </Form.Item>
              </Col>
            </Row>

            {/* Location Info */}
            <Divider
              orientation={isMobile ? 'center' : 'left'}
              style={{ margin: isMobile ? '8px 0 16px' : '16px 0 24px' }}
            >
              Location
            </Divider>

            <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
              <Col xs={24}>
                <Form.Item
                  name='businessAddress'
                  label='Business Address'
                  rules={[
                    { required: true, message: 'Business address is required' }
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name='city'
                  label='City'
                  rules={[{ required: true, message: 'City is required' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name='postalCode' label='Postal Code'>
                  <Input inputMode='numeric' />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name='province'
                  label='Province'
                  rules={[{ required: true, message: 'Province is required' }]}
                >
                  <Select showSearch placeholder='Select province' allowClear>
                    {provinces.map(p => (
                      <Select.Option key={p} value={p}>
                        {p}
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name='hub' label='Host Community'>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name='location' label='Location Type'>
                  <Select placeholder='Select type' allowClear>
                    <Select.Option value='Urban'>Urban</Select.Option>
                    <Select.Option value='Rural'>Rural</Select.Option>
                    <Select.Option value='Township'>Township</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Metrics Section */}
            <Divider
              orientation={isMobile ? 'center' : 'left'}
              style={{ margin: isMobile ? '8px 0 12px' : '16px 0 16px' }}
            >
              📈 Headcount & Revenue
            </Divider>

            <Title level={isMobile ? 5 : 5} style={{ marginTop: 0 }}>
              Monthly Data
            </Title>
            {last3Months.map(month => (
              <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} key={month}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name={`revenue_${month}`}
                    label={`Revenue (${month})`}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      inputMode='decimal'
                      formatter={v =>
                        `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      }
                      parser={v => Number((v || '').replace(/R\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item
                    name={`permHeadcount_${month}`}
                    label='Permanent Staff'
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item
                    name={`tempHeadcount_${month}`}
                    label='Temporary Staff'
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            ))}

            <Title level={isMobile ? 5 : 5} style={{ marginTop: 8 }}>
              Annual Data
            </Title>
            {last2Years.map(year => (
              <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]} key={year}>
                <Col xs={24} md={8}>
                  <Form.Item
                    name={`revenue_${year}`}
                    label={`Revenue (${year})`}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      inputMode='decimal'
                      formatter={v =>
                        `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      }
                      parser={v => Number((v || '').replace(/R\s?|(,*)/g, ''))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item
                    name={`permHeadcount_${year}`}
                    label='Permanent Staff'
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={8}>
                  <Form.Item
                    name={`tempHeadcount_${year}`}
                    label='Temporary Staff'
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            ))}

            {/* Sticky Save (especially nice on mobile) */}
            <div
              style={{
                position: isMobile ? 'sticky' : 'static',
                bottom: 0,
                left: 0,
                right: 0,
                background: isMobile ? 'rgba(255,255,255,0.95)' : 'transparent',
                backdropFilter: isMobile
                  ? 'saturate(180%) blur(6px)'
                  : undefined,
                padding: isMobile ? '12px 0 4px' : '16px 0',
                borderTop: isMobile ? '1px solid #f0f0f0' : 'none',
                marginTop: 8,
                zIndex: 1
              }}
            >
              <Button
                type='primary'
                onClick={onSave}
                block={isMobile}
                style={{ maxWidth: isMobile ? '100%' : 260 }}
              >
                Save Profile
              </Button>
            </div>
          </Form>
        </Space>
      </div>
    </>
  )
}

export default ProfileForm
