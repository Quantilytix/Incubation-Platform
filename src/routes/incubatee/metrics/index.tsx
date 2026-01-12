import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Typography,
  Table,
  Modal,
  Button,
  Form,
  DatePicker,
  Space,
  InputNumber,
  message,
  Row,
  Col,
  Upload,
  Statistic,
  Progress,
  Alert,
  Tabs,
  Input
} from 'antd'
import {
  PlusOutlined,
  TeamOutlined,
  DollarCircleOutlined,
  ShoppingCartOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import {
  setDoc,
  doc,
  collection,
  addDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
  getDoc
} from 'firebase/firestore'
import { auth, db, storage } from '@/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import axios from 'axios'
import { motion } from 'framer-motion'
import dayjs, { Dayjs } from 'dayjs'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

const { Title } = Typography
Highcharts.setOptions({ credits: { enabled: false } })

export const MonthlyPerformanceForm: React.FC = () => {
  const [form] = Form.useForm()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Month selection (for backfilling)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs())
  const thisMonth = dayjs().format('MMMM YYYY')

  // Progress modal
  const [progressVisible, setProgressVisible] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressMessage, setProgressMessage] = useState('Starting process...')

  // Transaction Preview States
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([])

  // Application Details (participant doc baselines)
  const [pRevenueMonthly, setPRevenueMonthly] = useState<Record<string, number>>(
    {}
  )
  const [pHeadcountMonthly, setPHeadcountMonthly] = useState<
    Record<string, { permanent?: number; temporary?: number }>
  >({})

  // default: current year
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf('year'),
    dayjs().endOf('year')
  ])

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ]

  // Map "April 2025" -> "April"
  const monthFromLabel = (label?: string) => (label || '').trim().split(' ')[0]

  // Build month-indexed arrays from uploaded history (Table `data`)
  const buildUploadedByMonth = (rows: any[]) => {
    const revenue = Array(12).fill(null) as (number | null)[]
    const perm = Array(12).fill(null) as (number | null)[]
    const temp = Array(12).fill(null) as (number | null)[]
    const orders = Array(12).fill(null) as (number | null)[]
    const customers = Array(12).fill(null) as (number | null)[]

    rows.forEach(r => {
      const label = r.monthLabel || r.month
      const mName = monthFromLabel(label)
      const i = monthNames.findIndex(m => m === mName)
      if (i >= 0) {
        revenue[i] = Number.isFinite(Number(r.revenue)) ? Number(r.revenue) : null
        perm[i] = Number.isFinite(Number(r.headPermanent))
          ? Number(r.headPermanent)
          : null
        temp[i] = Number.isFinite(Number(r.headTemporary))
          ? Number(r.headTemporary)
          : null
        orders[i] = Number.isFinite(Number(r.orders)) ? Number(r.orders) : null
        customers[i] = Number.isFinite(Number(r.customers))
          ? Number(r.customers)
          : null
      }
    })

    return { revenue, perm, temp, orders, customers }
  }

  const normalizeRevenueMap = (m?: Record<string, any>) => {
    const result: (number | null)[] = Array(12).fill(null)
    if (!m) return result
    monthNames.forEach((name, i) => {
      const v = Number(m[name])
      result[i] = Number.isFinite(v) ? v : null
    })
    return result
  }

  const normalizeHeadcountMap = (
    m?: Record<string, { permanent?: any; temporary?: any }>
  ) => {
    const perm: (number | null)[] = Array(12).fill(null)
    const temp: (number | null)[] = Array(12).fill(null)
    if (!m) return { perm, temp }
    monthNames.forEach((name, i) => {
      const row = m[name] || {}
      const p = Number(row.permanent)
      const t = Number(row.temporary)
      perm[i] = Number.isFinite(p) ? p : null
      temp[i] = Number.isFinite(t) ? t : null
    })
    return { perm, temp }
  }

  const encouragingMessages = [
    'Hang tight, crunching the numbers...',
    'Verifying bank statement transactions...',
    'Almost there, making sense of the data...',
    'Your patience will pay off... literally!',
    'Good things take time, optimizing your insights...'
  ]

  const simulateProgress = () => {
    setProgressVisible(true)
    setProgressPercent(5)
    const interval = setInterval(() => {
      setProgressPercent(prev => {
        if (prev >= 90) return prev
        const increment = Math.floor(Math.random() * 10) + 5
        return Math.min(prev + increment, 90)
      })
      setProgressMessage(
        encouragingMessages[
          Math.floor(Math.random() * encouragingMessages.length)
        ]
      )
    }, 1200)
    return interval
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async user => {
      if (user?.email) {
        setUserEmail(user.email)

        const q = query(
          collection(db, 'participants'),
          where('email', '==', user.email)
        )
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const pid = snapshot.docs[0].id
          setParticipantId(pid)

          // fetch participant doc to read histories
          const pDoc = await getDoc(doc(db, 'participants', pid))
          if (pDoc.exists()) {
            const pdata = pDoc.data() as any

            // revenueHistory.monthly (months by name)
            const revMonthly = pdata?.revenueHistory?.monthly || {}
            setPRevenueMonthly(revMonthly)

            // headcountHistory.monthly { April: {permanent, temporary}, ... }
            const hcMonthly = pdata?.headcountHistory?.monthly || {}
            setPHeadcountMonthly(hcMonthly)
          }
        } else {
          message.error('No participant record found for this user.')
        }
      }
    })

    return () => unsubscribe()
  }, [])

  const fetchData = async () => {
    if (!participantId) return
    try {
      // Prefer ordering by monthId if present, fallback to createdAt
      // (Firestore cannot order by a field that doesn't exist on all docs reliably,
      // so we keep createdAt and sort client-side below.)
      const q = query(
        collection(db, `monthlyPerformance/${participantId}/history`),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)

      const rows = snapshot.docs.map(d => ({ key: d.id, ...d.data() }))
      // sort client-side by monthId (YYYY-MM) if present
      rows.sort((a: any, b: any) => {
        if (a.monthId && b.monthId) return String(b.monthId).localeCompare(String(a.monthId))
        return 0
      })

      setData(rows)
    } catch (error) {
      console.error(error)
      message.error('Failed to load monthly performance data.')
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantId])

  // Participant doc monthly maps -> arrays
  const participantRev = normalizeRevenueMap(pRevenueMonthly)
  const { perm: participantPerm, temp: participantTemp } =
    normalizeHeadcountMap(pHeadcountMonthly)

  // Prefer uploaded value, else participant value, else null
  const mergePrefUploaded = (
    uploaded: (number | null)[],
    participant: (number | null)[]
  ) =>
    monthNames.map((_, i) =>
      uploaded[i] != null ? uploaded[i] : participant[i] ?? null
    )

  // Build base arrays
  const uploaded = buildUploadedByMonth(data)
  const pRev = normalizeRevenueMap(pRevenueMonthly)
  const pHC = normalizeHeadcountMap(pHeadcountMonthly)

  // Merge to single series per metric
  const revenueMerged = mergePrefUploaded(uploaded.revenue, pRev)
  const permMerged = mergePrefUploaded(uploaded.perm, pHC.perm)
  const tempMerged = mergePrefUploaded(uploaded.temp, pHC.temp)
  const ordersMerged = uploaded.orders
  const customersMerged = uploaded.customers

  // 3-month moving average on the merged revenue
  const revMA3 = revenueMerged.map((_, i) => {
    const windowVals = revenueMerged.slice(Math.max(0, i - 2), i + 1)
    const nums = windowVals.filter(v => typeof v === 'number') as number[]
    if (!nums.length) return null
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    return Math.round(avg * 100) / 100
  })

  // indices of months we will show based on the range (same-year filter)
  const monthIdxInRange = (() => {
    const startM = range?.[0]?.month() ?? 0
    const endM = range?.[1]?.month() ?? 11
    const idxs: number[] = []
    for (let i = startM; i <= endM; i++) idxs.push(i)
    return idxs
  })()

  const formatLabel = (mIndex: number, year: number) =>
    dayjs().year(year).month(mIndex).format('MMM YY')

  const categories = monthIdxInRange.map(i =>
    formatLabel(i, range?.[0]?.year() ?? dayjs().year())
  )

  const pickRange = (arr: (number | null)[]) => monthIdxInRange.map(i => arr[i])

  const revenueTrendOptions: Highcharts.Options = {
    chart: { type: 'line' },
    title: { text: 'Revenue Trend' },
    xAxis: { categories },
    yAxis: { title: { text: 'Revenue (R)' } },
    tooltip: { shared: true },
    series: [
      { name: 'Revenue', type: 'line', data: pickRange(revenueMerged) },
      {
        name: '3-month Avg',
        type: 'line',
        dashStyle: 'ShortDot',
        data: pickRange(revMA3)
      }
    ]
  }

  const employeesStackedOptions: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Headcount Composition' },
    xAxis: { categories },
    yAxis: {
      min: 0,
      title: { text: 'Employees' },
      stackLabels: { enabled: true }
    },
    plotOptions: { column: { stacking: 'normal' } },
    series: [
      { name: 'Permanent', type: 'column', data: pickRange(permMerged) },
      { name: 'Temporary', type: 'column', data: pickRange(tempMerged) }
    ]
  }

  const ordersCustomersDualAxis: Highcharts.Options = {
    title: { text: 'Orders vs Customers' },
    xAxis: [{ categories, crosshair: true }],
    yAxis: [{ title: { text: 'Orders' } }, { title: { text: 'Customers' }, opposite: true }],
    tooltip: { shared: true },
    series: [
      { name: 'Orders', type: 'column', yAxis: 0, data: pickRange(ordersMerged) },
      { name: 'Customers', type: 'spline', yAxis: 1, data: pickRange(customersMerged) }
    ]
  }

  const uploadProofs = async (files: any[], type: string, monthId: string) => {
    const urls: string[] = []
    for (const file of files) {
      const cleanName = file.name.replace(/\s+/g, '_')
      const storageRef = ref(
        storage,
        `monthlyPerformance/${participantId}/${monthId}/${type}-${monthId}-${cleanName}`
      )
      await uploadBytes(storageRef, file.originFileObj)
      const url = await getDownloadURL(storageRef)
      urls.push(url)
    }
    return urls
  }

  const processBankStatement = async (file: any) => {
    const formData = new FormData()
    formData.append('file', file.originFileObj)
    try {
      const response = await axios.post(
        'https://rairo-stmt-api.hf.space/process-pdf',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return response.data.transactions || []
    } catch (err: any) {
      console.error(err)
      message.error('Failed to process bank statement: ' + err.message)
      return []
    }
  }

  // ✅ Step 1: Process and show preview
  const handleSubmit = async (values: any) => {
    try {
      if (!values.month) {
        message.error('Please select the month you are uploading for.')
        return
      }

      setLoading(true)
      const rawTransactions =
        values.revenueProof?.fileList?.length > 0
          ? await processBankStatement(values.revenueProof.fileList[0])
          : []

      const formattedTransactions = rawTransactions.map((txn: any) => ({
        date: txn.Date || '',
        description: txn.Description || txn.Destination_of_funds || '',
        amount: txn.Amount ? Number(txn.Amount) : 0,
        type: txn.Type || '',
        destination_of_funds: txn.Destination_of_funds || '',
        customer_name: txn.Customer_name || ''
      }))

      setPreviewTransactions(formattedTransactions)
      setPreviewVisible(true)
      form.setFieldsValue(values)
    } catch (err) {
      console.error(err)
      message.error('Failed to process transactions.')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Step 2: Save everything to Firestore
  const finalizeSave = async () => {
    let interval: any
    try {
      setLoading(true)
      interval = simulateProgress()

      const values = form.getFieldsValue()
      const monthDayjs: Dayjs = values.month

      if (!monthDayjs || !monthDayjs.isValid?.()) {
        message.error('Please select a valid month.')
        clearInterval(interval)
        setProgressVisible(false)
        setLoading(false)
        return
      }

      const monthId = monthDayjs.format('YYYY-MM') // ✅ stable doc id
      const monthLabel = monthDayjs.format('MMMM YYYY') // ✅ display label

      const revenueProofUrls = values.revenueProof?.fileList?.length
        ? await uploadProofs(values.revenueProof.fileList, 'revenue', monthId)
        : []
      const employeeProofUrls = values.employeeProof?.fileList?.length
        ? await uploadProofs(values.employeeProof.fileList, 'employee', monthId)
        : []

      if (!participantId || !userEmail) {
        message.error('Unable to determine participant identity.')
        clearInterval(interval)
        setProgressVisible(false)
        setLoading(false)
        return
      }

      await setDoc(
        doc(db, 'monthlyPerformance', participantId),
        {
          participantId,
          email: userEmail,
          updatedAt: Timestamp.now()
        },
        { merge: true }
      )

      const monthDocRef = doc(
        db,
        `monthlyPerformance/${participantId}/history/${monthId}`
      )

      await setDoc(
        monthDocRef,
        {
          monthId,
          monthLabel,
          month: monthLabel, // keep legacy field for existing UI paths
          revenue: values.revenue,
          headPermanent: values.headPermanent,
          headTemporary: values.headTemporary,
          orders: values.orders,
          customers: values.customers,
          traffic: values.traffic,
          networking: values.networking,
          revenueProofUrls,
          employeeProofUrls,
          createdAt: Timestamp.now()
        },
        { merge: true }
      )

      // Save parsed transactions (optional)
      for (const txn of previewTransactions) {
        await addDoc(
          collection(
            db,
            `monthlyPerformance/${participantId}/history/${monthId}/bankTransactions`
          ),
          txn
        )
      }

      clearInterval(interval)
      setProgressPercent(100)
      setProgressMessage('All done! Your data has been saved successfully.')
      setTimeout(() => setProgressVisible(false), 1000)

      await fetchData()
      message.success(
        `Saved successfully for ${monthLabel} with ${previewTransactions.length} transactions!`
      )
      setModalVisible(false)
      setPreviewVisible(false)
      form.resetFields()
    } catch (err) {
      console.error(err)
      message.error('Failed to save monthly performance data.')
      clearInterval(interval)
      setProgressVisible(false)
    } finally {
      setLoading(false)
    }
  }

  // Missing months (current year, up to current month)
  const existingMonthIds = useMemo(
    () =>
      new Set(
        (data || [])
          .map(r => r.monthId)
          .filter(Boolean)
          .map((x: any) => String(x))
      ),
    [data]
  )

  const existingMonthLabels = useMemo(
    () =>
      new Set(
        (data || [])
          .map(r => r.monthLabel || r.month)
          .filter(Boolean)
          .map((x: any) => String(x))
      ),
    [data]
  )

  const missingMonths = useMemo(() => {
    const year = dayjs().year()
    return monthNames
      .map((m, idx) => {
        const label = dayjs().year(year).month(idx).format('MMMM YYYY')
        const id = dayjs().year(year).month(idx).format('YYYY-MM')
        return { idx, label, id }
      })
      .filter(x => x.idx <= dayjs().month())
      .filter(x => !existingMonthIds.has(x.id) && !existingMonthLabels.has(x.label))
  }, [existingMonthIds, existingMonthLabels])

  const columns = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      render: (_: any, record: any) => record.monthLabel || record.month || record.monthId
    },
    { title: 'Revenue (R)', dataIndex: 'revenue', key: 'revenue' },
    { title: 'Permanent Employees', dataIndex: 'headPermanent', key: 'headPermanent' },
    { title: 'Temporary Employees', dataIndex: 'headTemporary', key: 'headTemporary' },
    { title: 'Orders', dataIndex: 'orders', key: 'orders' },
    { title: 'Customers', dataIndex: 'customers', key: 'customers' },
    { title: 'Traffic', dataIndex: 'traffic', key: 'traffic' },
    { title: 'Networking Events', dataIndex: 'networking', key: 'networking' }
  ]

  const previewColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (_: any, record: any, index: number) => (
        <Input
          value={record.date}
          onChange={e => {
            const updated = [...previewTransactions]
            updated[index].date = e.target.value
            setPreviewTransactions(updated)
          }}
        />
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (_: any, record: any, index: number) => (
        <Input
          value={record.description}
          onChange={e => {
            const updated = [...previewTransactions]
            updated[index].description = e.target.value
            setPreviewTransactions(updated)
          }}
        />
      )
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (_: any, record: any, index: number) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={record.amount}
          onChange={val => {
            const updated = [...previewTransactions]
            updated[index].amount = val ?? 0
            setPreviewTransactions(updated)
          }}
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, __: any, index: number) => (
        <Button
          danger
          onClick={() => {
            const updated = [...previewTransactions]
            updated.splice(index, 1)
            setPreviewTransactions(updated)
          }}
        >
          Delete
        </Button>
      )
    }
  ]

  const totalRevenue = data.reduce((acc, cur) => acc + (cur.revenue || 0), 0)
  const totalEmployees = data.length
    ? (data[0].headPermanent || 0) + (data[0].headTemporary || 0)
    : 0
  const totalOrders = data.reduce((acc, cur) => acc + (cur.orders || 0), 0)

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Helmet>
        <title>Monthly Metrics</title>
      </Helmet>

      <Alert
        type='info'
        showIcon
        style={{ marginBottom: 16 }}
        message='📈 Monthly Performance Dashboard'
        description='Upload your month-on-month performance data here to keep your progress up to date.'
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Statistic
                title='Total Revenue'
                value={totalRevenue}
                prefix={<DollarCircleOutlined style={{ color: '#3f8600' }} />}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={8}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Statistic
                title='Current Employees'
                value={totalEmployees}
                prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
              />
            </Card>
          </motion.div>
        </Col>

        <Col xs={24} sm={8}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Card
              hoverable
              style={{
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                transition: 'all 0.3s ease',
                borderRadius: 8,
                border: '1px solid #d6e4ff'
              }}
            >
              <Statistic
                title='Total Orders'
                value={totalOrders}
                prefix={<ShoppingCartOutlined style={{ color: '#cf1322' }} />}
              />
            </Card>
          </motion.div>
        </Col>
      </Row>

      <Tabs
        centered
        defaultActiveKey='data'
        items={[
          {
            key: 'data',
            label: 'Data',
            children: (
              <>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                  <Card
                    title='📊 Historical Monthly Metrics'
                    extra={
                      <Space wrap>
                        <Button
                          type='primary'
                          icon={<PlusOutlined />}
                          onClick={() => {
                            const m = dayjs()
                            setSelectedMonth(m)
                            form.setFieldsValue({ month: m })
                            setModalVisible(true)
                          }}
                        >
                          Upload This Month
                        </Button>

                        {missingMonths.length > 0 && (
                          <Button
                            onClick={() => {
                              const earliest = missingMonths[0]
                              const m = dayjs(`${earliest.id}-01`)
                              setSelectedMonth(m)
                              form.setFieldsValue({ month: m })
                              setModalVisible(true)
                            }}
                          >
                            Backfill Missing Months
                          </Button>
                        )}
                      </Space>
                    }
                    style={{
                      boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                      transition: 'all 0.3s ease',
                      borderRadius: 8,
                      border: '1px solid #d6e4ff'
                    }}
                  >
                    {missingMonths.length > 0 && (
                      <Alert
                        style={{ marginBottom: 12 }}
                        type='warning'
                        showIcon
                        message='You have missing months.'
                        description={
                          <Space wrap>
                            {missingMonths.slice(0, 8).map(m => (
                              <Button
                                key={m.id}
                                size='small'
                                onClick={() => {
                                  const d = dayjs(`${m.id}-01`)
                                  setSelectedMonth(d)
                                  form.setFieldsValue({ month: d })
                                  setModalVisible(true)
                                }}
                              >
                                {m.label}
                              </Button>
                            ))}
                            {missingMonths.length > 8 && (
                              <span style={{ opacity: 0.7 }}>
                                +{missingMonths.length - 8} more
                              </span>
                            )}
                          </Space>
                        }
                      />
                    )}

                    <Table columns={columns} dataSource={data} pagination={{ pageSize: 5 }} />
                  </Card>
                </motion.div>
              </>
            )
          },
          {
            key: 'analytics',
            label: 'Analytics',
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <DatePicker.RangePicker
                    picker='month'
                    value={range}
                    onChange={vals => {
                      if (!vals || !vals[0] || !vals[1]) return
                      if (vals[0].year() !== vals[1].year()) {
                        message.warning('Please select months within the same year for now.')
                        return
                      }
                      setRange(vals as [Dayjs, Dayjs])
                    }}
                    allowEmpty={[false, false]}
                  />
                </Space>

                <Row gutter={[16, 16]}>
                  <Col xs={24} lg={12}>
                    <Card
                      hoverable
                      style={{
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        borderRadius: 8,
                        border: '1px solid #d6e4ff'
                      }}
                    >
                      <HighchartsReact highcharts={Highcharts} options={revenueTrendOptions} />
                    </Card>
                  </Col>

                  <Col xs={24} lg={12}>
                    <Card
                      hoverable
                      style={{
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        borderRadius: 8,
                        border: '1px solid #d6e4ff'
                      }}
                    >
                      <HighchartsReact highcharts={Highcharts} options={employeesStackedOptions} />
                    </Card>
                  </Col>

                  <Col xs={24}>
                    <Card
                      hoverable
                      style={{
                        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                        borderRadius: 8,
                        border: '1px solid #d6e4ff'
                      }}
                    >
                      <HighchartsReact highcharts={Highcharts} options={ordersCustomersDualAxis} />
                    </Card>
                  </Col>
                </Row>
              </>
            )
          }
        ]}
      />

      {/* Upload / Backfill Modal */}
      <Modal
        title={`Add Monthly Performance — ${
          selectedMonth?.format('MMMM YYYY') || thisMonth
        }`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText='Preview Transactions'
        okButtonProps={{ loading }}
      >
        <Form
          layout='vertical'
          form={form}
          onFinish={handleSubmit}
          initialValues={{ month: selectedMonth }}
        >
          <Form.Item
            name='month'
            label='Month you are uploading for'
            rules={[{ required: true, message: 'Please select the month' }]}
          >
            <DatePicker
              picker='month'
              style={{ width: '100%' }}
              disabledDate={d =>
                !!d && d.endOf('month').isAfter(dayjs().endOf('month'))
              }
              onChange={d => {
                if (!d) return
                setSelectedMonth(d)
              }}
            />
          </Form.Item>

          <Row gutter={[12, 12]}>
            <Col xs={24}>
              <Form.Item
                name='revenue'
                label='Revenue (R)'
                rules={[{ required: true, message: 'Please enter revenue' }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name='revenueProof'
                label='Bank Statement (Proof of Revenue)'
                rules={[{ required: true, message: 'Please upload bank statement' }]}
                valuePropName='fileList'
                getValueFromEvent={e => (Array.isArray(e) ? e : e?.fileList)}
              >
                <Upload multiple beforeUpload={() => false}>
                  <Button block>Upload Bank Statement</Button>
                </Upload>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name='headPermanent'
                label='Permanent Employees'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name='headTemporary'
                label='Temporary Employees'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item
                name='employeeProof'
                label='Contracts/Payslips (Employee Proof)'
                rules={[{ required: true, message: 'Please upload employee proof' }]}
                valuePropName='fileList'
                getValueFromEvent={e => (Array.isArray(e) ? e : e?.fileList)}
              >
                <Upload multiple beforeUpload={() => false}>
                  <Button block>Upload Contracts/Payslips</Button>
                </Upload>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name='orders' label='Orders Submitted'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name='customers' label='New Customers'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name='traffic' label='Website Traffic'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item name='networking' label='Networking Events'>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Preview Transactions Modal */}
      <Modal
        title='Preview Transactions Before Saving'
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        onOk={finalizeSave}
        okText='Save All'
        width={800}
      >
        <Table
          columns={previewColumns}
          dataSource={previewTransactions.map((t, i) => ({ ...t, key: i }))}
          pagination={{
            pageSize: 5,
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            showTotal: (total, r) => `Showing ${r[0]}-${r[1]} of ${total} transactions`
          }}
          scroll={{ y: 300 }}
        />
      </Modal>

      {/* Progress Modal */}
      <Modal
        open={progressVisible}
        footer={null}
        closable={false}
        centered
        bodyStyle={{ textAlign: 'center', padding: '40px' }}
      >
        <Progress
          type='circle'
          percent={progressPercent}
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
        />
        <p style={{ marginTop: 20, fontSize: 16, fontWeight: 500 }}>
          {progressMessage}
        </p>
      </Modal>
    </div>
  )
}
