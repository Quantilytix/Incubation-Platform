import React from 'react'
import { Form, Input, Button, Select, Typography, message } from 'antd'
import { setDoc, doc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Helmet } from 'react-helmet'

const { Title } = Typography
const { TextArea } = Input

const specializationOptions = [
  'Finance',
  'Compliance',
  'Operations',
  'Marketing',
  'Strategy',
  'HR',
  'Technology'
]

export const ConsultantOnboardingForm: React.FC = () => {
  const [form] = Form.useForm()

  const handleSubmit = async (values: any) => {
    try {
      const consultantId = `c${Date.now()}`
      const consultantData = {
        id: consultantId,
        name: values.name,
        email: values.email,
        expertise: values.expertise,
        active: true,
        assignmentsCount: 0,
        rating: 0
      }

      await setDoc(doc(db, 'consultants', consultantId), consultantData)

      message.success('Consultant onboarded successfully!')
      form.resetFields()
    } catch (error) {
      console.error('Error adding consultant:', error)
      message.error('Failed to onboard consultant.')
    }
  }

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 700,
        margin: '0 auto',
        height: '100vh',
        overflow: 'auto'
      }}
    >
      <Helmet>
        <title>Consultant Onboarding | Smart Incubation</title>
      </Helmet>

      <Title level={3}>Consultant Onboarding</Title>

      <Form
        layout='vertical'
        form={form}
        onFinish={handleSubmit}
        style={{ marginTop: 24 }}
      >
        {/* Name */}
        <Form.Item
          name='name'
          label='Full Name'
          rules={[{ required: true, message: 'Please enter full name' }]}
        >
          <Input placeholder='e.g. Lerato Sithole' />
        </Form.Item>

        {/* Email */}
        <Form.Item
          name='email'
          label='Email Address'
          rules={[
            { required: true, message: 'Please enter email address' },
            { type: 'email', message: 'Please enter a valid email' }
          ]}
        >
          <Input placeholder='e.g. consultant@company.com' />
        </Form.Item>

        {/* Expertise */}
        <Form.Item
          name='expertise'
          label='Expertise Areas'
          rules={[
            { required: true, message: 'Please select areas of expertise' }
          ]}
        >
          <Select
            mode='multiple'
            placeholder='Select specialization areas'
            allowClear
          >
            {specializationOptions.map(option => (
              <Select.Option key={option} value={option}>
                {option}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {/* Submit */}
        <Form.Item>
          <Button type='primary' htmlType='submit' block>
            Onboard Consultant
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}
