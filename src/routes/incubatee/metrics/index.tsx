import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Table,
  Modal,
  Button,
  Form,
  InputNumber,
  message,
  Row,
  Col,
  Upload,
  Statistic,
  Progress
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
  where
} from 'firebase/firestore'
import { auth, db, storage } from '@/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import axios from 'axios'

const { Title } = Typography

export const MonthlyPerformanceForm: React.FC = () => {
  const [form] = Form.useForm()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Progress modal
  const [progressVisible, setProgressVisible] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [progressMessage, setProgressMessage] = useState('Starting process...')

  // Transaction Preview States
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewTransactions, setPreviewTransactions] = useState<any[]>([])

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
          setParticipantId(snapshot.docs[0].id)
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
      const q = query(
        collection(db, `monthlyPerformance/${participantId}/history`),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      setData(snapshot.docs.map(doc => ({ key: doc.id, ...doc.data() })))
    } catch (error) {
      console.error(error)
      message.error('Failed to load monthly performance data.')
    }
  }

  useEffect(() => {
    fetchData()
  }, [participantId])

  const uploadProofs = async (files: any[], type: string, monthKey: string) => {
    const urls: string[] = []
    for (const file of files) {
      const cleanName = file.name.replace(/\s+/g, '_')
      const storageRef = ref(
        storage,
        `monthlyPerformance/${monthKey}/${type}-${monthKey}-${cleanName}`
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
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )
      return response.data.transactions || []
    } catch (err: any) {
      console.error(err)
      message.error('Failed to process bank statement: ' + err.message)
      return []
    }
  }

  // ✅ First step: Process and show preview
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true)
      const rawTransactions =
        values.revenueProof?.fileList?.length > 0
          ? await processBankStatement(values.revenueProof.fileList[0])
          : []

      // ✅ Map API fields to our table structure
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

  // ✅ Final step: Save everything to Firestore
  const finalizeSave = async () => {
    let interval: any
    try {
      setLoading(true)
      interval = simulateProgress()

      const values = form.getFieldsValue()
      const monthKey = new Date().toLocaleString('default', {
        month: 'long',
        year: 'numeric'
      })

      const revenueProofUrls = values.revenueProof?.fileList?.length
        ? await uploadProofs(values.revenueProof.fileList, 'revenue', monthKey)
        : []
      const employeeProofUrls = values.employeeProof?.fileList?.length
        ? await uploadProofs(
            values.employeeProof.fileList,
            'employee',
            monthKey
          )
        : []

      if (!participantId || !userEmail) {
        message.error('Unable to determine participant identity.')
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
        `monthlyPerformance/${participantId}/history/${monthKey}`
      )

      await setDoc(monthDocRef, {
        month: monthKey,
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
      })

      for (const txn of previewTransactions) {
        await addDoc(
          collection(
            db,
            `monthlyPerformance/${participantId}/history/${monthKey}/bankTransactions`
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
        `Saved successfully with ${previewTransactions.length} transactions!`
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

  const columns = [
    { title: 'Month', dataIndex: 'month', key: 'month' },
    { title: 'Revenue (R)', dataIndex: 'revenue', key: 'revenue' },
    {
      title: 'Permanent Employees',
      dataIndex: 'headPermanent',
      key: 'headPermanent'
    },
    {
      title: 'Temporary Employees',
      dataIndex: 'headTemporary',
      key: 'headTemporary'
    },
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
      render: (text: any, record: any, index: number) => (
        <InputNumber
          value={record.date}
          onChange={val => {
            const updated = [...previewTransactions]
            updated[index].date = val
            setPreviewTransactions(updated)
          }}
        />
      )
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: any, record: any, index: number) => (
        <input
          style={{ width: '100%' }}
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
      render: (text: any, record: any, index: number) => (
        <InputNumber
          min={0}
          value={record.amount}
          onChange={val => {
            const updated = [...previewTransactions]
            updated[index].amount = val
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

      <Title level={3} style={{ marginBottom: 16 }}>
        📈 Monthly Performance Dashboard
      </Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Total Revenue'
              value={totalRevenue}
              prefix={<DollarCircleOutlined style={{ color: '#3f8600' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Current Employees'
              value={totalEmployees}
              prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Total Orders'
              value={totalOrders}
              prefix={<ShoppingCartOutlined style={{ color: '#cf1322' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title='📊 Historical Monthly Metrics'
        extra={
          <Button
            type='primary'
            icon={<PlusOutlined />}
            onClick={() => setModalVisible(true)}
          >
            Add New
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          pagination={{ pageSize: 5 }}
        />
      </Card>

      <Modal
        title='Add Monthly Performance Data'
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText='Preview Transactions'
        okButtonProps={{ loading }}
      >
        <Form layout='vertical' form={form} onFinish={handleSubmit}>
          <Form.Item
            name='revenue'
            label='Revenue (R)'
            rules={[{ required: true, message: 'Please enter revenue' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='revenueProof'
            label='Bank Statement (Proof of Revenue)'
            rules={[
              { required: true, message: 'Please upload bank statement' }
            ]}
          >
            <Upload multiple beforeUpload={() => false}>
              <Button>Upload Bank Statement</Button>
            </Upload>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name='headPermanent'
                label='Permanent Employees'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name='headTemporary'
                label='Temporary Employees'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name='employeeProof'
            label='Contracts/Payslips (Employee Proof)'
            rules={[
              { required: true, message: 'Please upload employee proof' }
            ]}
          >
            <Upload multiple beforeUpload={() => false}>
              <Button>Upload Contracts/Payslips</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name='orders'
            label='Orders Submitted'
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='customers'
            label='New Customers'
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='traffic'
            label='Website Traffic'
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name='networking'
            label='Networking Events'
            rules={[{ required: true }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title='Preview Transactions Before Saving'
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        onOk={finalizeSave}
        okText='Save All'
        width={800} // optional: make it wider for better readability
      >
        <Table
          columns={previewColumns}
          dataSource={previewTransactions.map((t, i) => ({ ...t, key: i }))}
          pagination={{
            pageSize: 5, // ✅ Show 5 transactions per page (change to 10 if preferred)
            showSizeChanger: true,
            pageSizeOptions: ['5', '10', '20', '50'],
            showTotal: (total, range) =>
              `Showing ${range[0]}-${range[1]} of ${total} transactions`
          }}
          scroll={{ y: 300 }}
        />
      </Modal>

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
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068'
          }}
        />
        <p style={{ marginTop: 20, fontSize: 16, fontWeight: 500 }}>
          {progressMessage}
        </p>
      </Modal>
    </div>
  )
}
