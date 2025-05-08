import React, { useEffect, useState } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Typography,
  Upload,
  message
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { collection, addDoc, getDocs } from 'firebase/firestore'
import { db, storage } from '@/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const { Title } = Typography
const { Option } = Select

const GenericProgramExpenseForm: React.FC = () => {
  const [form] = Form.useForm()
  const [programs, setPrograms] = useState<any[]>([])
  const [fileList, setFileList] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const fetchPrograms = async () => {
      const snap = await getDocs(collection(db, 'programs'))
      const data = snap.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }))
      setPrograms(data)
    }
    fetchPrograms()
  }, [])

  const handleUpload = async () => {
    if (fileList.length === 0) return null
    const file = fileList[0].originFileObj
    const storageRef = ref(storage, `expense_docs/${file.name}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    return url
  }

  const onFinish = async (values: any) => {
    try {
      setUploading(true)
      const fileUrl = await handleUpload()

      await addDoc(collection(db, 'programExpenses'), {
        programId: values.programId || null,
        expenseType: values.expenseType,
        amount: values.amount,
        supportingDocUrl: fileUrl || '',
        createdAt: new Date().toISOString()
      })

      message.success('Expense submitted successfully')
      form.resetFields()
      setFileList([])
    } catch (error) {
      console.error(error)
      message.error('Failed to submit expense')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ padding: 24, height: '100vh', background: '#f9f9f9' }}>
      <Title level={3}>Program Expense Submission</Title>
      <Form
        layout='vertical'
        form={form}
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item name='programId' label='Program (optional)'>
          <Select placeholder='Select a program' allowClear>
            {programs.map(program => (
              <Option key={program.id} value={program.id}>
                {program.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name='expenseType'
          label='Expense Type'
          rules={[{ required: true, message: 'Please enter the expense type' }]}
        >
          <Input placeholder='e.g. Travel, Marketing, Equipment' />
        </Form.Item>

        <Form.Item
          name='amount'
          label='Amount (ZAR)'
          rules={[{ required: true, message: 'Please enter the amount' }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label='Supporting Document (optional)'>
          <Upload
            beforeUpload={() => false}
            fileList={fileList}
            onChange={({ fileList }) => setFileList(fileList)}
          >
            <Button icon={<UploadOutlined />}>Upload File</Button>
          </Upload>
        </Form.Item>

        <Form.Item>
          <Button type='primary' htmlType='submit' loading={uploading}>
            Submit Expense
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default GenericProgramExpenseForm
