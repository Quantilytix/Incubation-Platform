import React from 'react'
import { Form, Upload, Button, message, Typography, Card, Layout } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { Helmet } from 'react-helmet'

const { Title } = Typography

export const DocumentHub: React.FC = () => {
  const [form] = Form.useForm()

  const onFinish = (values: any) => {
    console.log('Document Upload:', values)
    message.success('All documents uploaded successfully')
  }

  const normFile = (e: any) => {
    if (Array.isArray(e)) return e
    return e?.fileList
  }

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
      <Card style={{ padding: 24 }}>
        <Helmet>
          <title>Documents Tracking</title>
        </Helmet>

        <Title level={4}>Upload Compliance & Brand Documents</Title>

        <Form layout='vertical' form={form} onFinish={onFinish}>
          <Form.Item
            name='beee'
            label='B-BBEE Certificate'
            valuePropName='fileList'
            getValueFromEvent={normFile}
            rules={[
              { required: true, message: 'Please upload your BEEE certificate' }
            ]}
          >
            <Upload beforeUpload={() => false} multiple={false}>
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name='taxPin'
            label='Tax Pin'
            valuePropName='fileList'
            getValueFromEvent={normFile}
            rules={[{ required: true, message: 'Please upload your Tax Pin' }]}
          >
            <Upload beforeUpload={() => false} multiple={false}>
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            name='financials'
            label='Management Accounts / Financial Statements'
            valuePropName='fileList'
            getValueFromEvent={normFile}
            rules={[
              { required: true, message: 'Please upload your financials' }
            ]}
          >
            <Upload beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit'>
              Upload All
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </Layout>
  )
}
