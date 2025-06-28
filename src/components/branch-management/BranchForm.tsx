import React from 'react'
import { Form, Input, Button, Space } from 'antd'
import { Branch, BranchFormData } from '@/types/types'

interface BranchFormProps {
  initialValues?: Branch | null
  onSubmit: (values: BranchFormData) => Promise<void>
  onCancel: () => void
  isEditMode: boolean
}

export const BranchForm: React.FC<BranchFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isEditMode
}) => {
  const [form] = Form.useForm()

  // Convert Branch to BranchFormData for form
  const getFormValues = () => {
    if (!initialValues) return {}
    
    return {
      name: initialValues.name,
      location: typeof initialValues.location === 'string' 
        ? initialValues.location 
        : `${initialValues.location.address}, ${initialValues.location.city}`,
      contactEmail: typeof initialValues.contact === 'object' 
        ? initialValues.contact.email 
        : '',
      contactPhone: typeof initialValues.contact === 'object' 
        ? initialValues.contact.phone 
        : '',
      companyCode: initialValues.companyCode
    }
  }

  React.useEffect(() => {
    if (isEditMode && initialValues) {
      form.setFieldsValue(getFormValues())
    }
  }, [initialValues, isEditMode, form])

  const handleSubmit = async (values: BranchFormData) => {
    await onSubmit(values)
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      autoComplete="off"
      initialValues={isEditMode ? getFormValues() : { companyCode: 'ETC' }}
    >
      <Form.Item
        name="name"
        label="Branch Name"
        rules={[
          { required: true, message: 'Please enter branch name' },
          { min: 2, message: 'Branch name must be at least 2 characters' }
        ]}
      >
        <Input placeholder="e.g., Springs (Head Office)" />
      </Form.Item>

      <Form.Item
        name="location"
        label="Location"
        rules={[
          { required: true, message: 'Please enter location' },
          { min: 3, message: 'Location must be at least 3 characters' }
        ]}
      >
        <Input placeholder="e.g., Springs, Gauteng" />
      </Form.Item>

      <Form.Item
        name="contactEmail"
        label="Contact Email"
        rules={[
          { required: true, message: 'Please enter contact email' },
          { type: 'email', message: 'Please enter a valid email address' }
        ]}
      >
        <Input placeholder="e.g., springs@company.co.za" />
      </Form.Item>

      <Form.Item
        name="contactPhone"
        label="Contact Phone"
        rules={[
          { required: true, message: 'Please enter contact phone' },
          { pattern: /^\+?[\d\s\-\(\)]+$/, message: 'Please enter a valid phone number' }
        ]}
      >
        <Input placeholder="e.g., +27 11 000 0000" />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit">
            {isEditMode ? 'Update Branch' : 'Create Branch'}
          </Button>
          <Button onClick={onCancel}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
} 
