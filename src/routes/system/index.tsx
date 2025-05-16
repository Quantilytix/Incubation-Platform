import React, { useState } from 'react'
import {
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Typography,
  message,
  Divider,
  Card
} from 'antd'
import { collection, addDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'

const { Title } = Typography
const { Option } = Select

const SystemSetupForm: React.FC = () => {
  const [form] = Form.useForm()
  const [setupType, setSetupType] = useState<string>('intervention')
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: any) => {
    try {
      setLoading(true)

      if (setupType === 'intervention') {
        await addDoc(collection(db, 'interventions'), {
          title: values.title,
          area: values.area,
          createdAt: new Date().toISOString()
        })
        message.success('Intervention saved')
      }

      if (setupType === 'expense') {
        await addDoc(collection(db, 'expenseTypes'), {
          name: values.name,
          budget: values.budget,
          createdAt: new Date().toISOString()
        })
        message.success('Expense Type saved')
      }

      form.resetFields()
    } catch (error) {
      console.error(error)
      message.error('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '40px 24px',
        background: '#fff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start'
      }}
    >
      <Card style={{ width: '100%', maxWidth: 800 }}>
        <Helmet>
          <title>Category Configuration</title>
        </Helmet>

        <Title level={3}>System Setup</Title>
        <Form layout='vertical' form={form} onFinish={onFinish}>
          <Form.Item label='Setup Category' required>
            <Select
              value={setupType}
              onChange={setSetupType}
              style={{ width: '100%' }}
            >
              <Option value='intervention'>Intervention</Option>
              <Option value='expense'>Expense Type</Option>
              {/* Future options go here */}
            </Select>
          </Form.Item>

          <Divider />

          {setupType === 'intervention' && (
            <>
              <Form.Item
                name='area'
                label='Area of Support'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Marketing, Finance, Compliance' />
              </Form.Item>
              <Form.Item
                name='title'
                label='Intervention Title'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Website Development' />
              </Form.Item>
            </>
          )}

          {setupType === 'expense' && (
            <>
              <Form.Item
                name='name'
                label='Expense Name'
                rules={[{ required: true }]}
              >
                <Input placeholder='e.g. Travel, Supplies' />
              </Form.Item>
              <Form.Item
                name='budget'
                label='Default Budget (ZAR)'
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Button type='primary' htmlType='submit' loading={loading}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default SystemSetupForm
