import React, { useState } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Divider,
  Typography,
  Card,
  Tag,
  Upload,
  message
} from 'antd'
import { PlusOutlined, InboxOutlined } from '@ant-design/icons'
import {
  PREDEFINED_TASK_TYPES,
  TaskType,
  ProofType
} from '../../types/TaskType'

const { Title, Text } = Typography
const { Dragger } = Upload

interface TaskModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: (values: any) => void
  form: any
  consultants: any[]
  projectAdmins: any[]
  operationsUsers: any[]
  departments: any[]
  userDepartment: any
}

export const TaskModal: React.FC<TaskModalProps> = ({
  open,
  onCancel,
  onSubmit,
  form,
  consultants,
  projectAdmins,
  operationsUsers,
  departments,
  userDepartment
}) => {
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [selectedTaskType, setSelectedTaskType] = useState<TaskType | null>(
    null
  )
  const [customTaskType, setCustomTaskType] = useState<TaskType | null>(null)
  const [customProofTypes, setCustomProofTypes] = useState<ProofType[]>([])

  const handleTaskTypeChange = (typeId: string) => {
    if (typeId === 'custom') {
      setSelectedTaskType(null)
      setCustomTaskType({
        id: 'custom',
        name: '',
        category: 'custom',
        proofRequired: false,
        proofTypes: []
      })
    } else {
      const taskType = PREDEFINED_TASK_TYPES.find(t => t.id === typeId)
      setSelectedTaskType(taskType || null)
      setCustomTaskType(null)
    }
  }

  const addCustomProofType = () => {
    const newProofType: ProofType = {
      id: `proof-${Date.now()}`,
      name: '',
      description: '',
      required: true,
      fileTypes: ['pdf']
    }
    setCustomProofTypes([...customProofTypes, newProofType])
  }

  const updateCustomProofType = (
    index: number,
    field: keyof ProofType,
    value: any
  ) => {
    const updated = [...customProofTypes]
    updated[index] = { ...updated[index], [field]: value }
    setCustomProofTypes(updated)
  }

  const removeCustomProofType = (index: number) => {
    const updated = [...customProofTypes]
    updated.splice(index, 1)
    setCustomProofTypes(updated)
  }

  const getUsersByRole = () => {
    switch (selectedRole) {
      case 'consultant':
        return consultants
      case 'projectadmin':
        return projectAdmins
      case 'operations':
        return operationsUsers
      default:
        return []
    }
  }

  return (
    <Modal
      title='Add New Task'
      open={open}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <Form form={form} layout='vertical' onFinish={onSubmit}>
        <Form.Item
          name='title'
          label='Task Title'
          rules={[{ required: true, message: 'Please input task title' }]}
        >
          <Input placeholder='Enter task title' />
        </Form.Item>

        <Form.Item
          name='taskType'
          label='Task Type'
          rules={[{ required: true, message: 'Please select task type' }]}
        >
          <Select
            placeholder='Select task type'
            onChange={handleTaskTypeChange}
          >
            {PREDEFINED_TASK_TYPES.map(type => (
              <Select.Option key={type.id} value={type.id}>
                <Space>
                  {type.name}
                  {type.proofRequired && (
                    <Tag color='orange'>Proof Required</Tag>
                  )}
                </Space>
              </Select.Option>
            ))}
            <Select.Option value='custom'>Custom Task Type</Select.Option>
          </Select>
        </Form.Item>

        {selectedTaskType && (
          <Card size='small' style={{ marginBottom: 16 }}>
            <Text strong>{selectedTaskType.name}</Text>
            <br />
            <Text type='secondary'>{selectedTaskType.description}</Text>
            {selectedTaskType.proofRequired && (
              <>
                <Divider />
                <Text strong>Proof Requirements:</Text>
                <ul>
                  {selectedTaskType.proofTypes.map(proof => (
                    <li key={proof.id}>
                      <Text>{proof.name}</Text>
                      {proof.required && <Tag color='red'>Required</Tag>}
                      <br />
                      <Text type='secondary' style={{ fontSize: '12px' }}>
                        {proof.description}
                      </Text>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        )}

        {customTaskType && (
          <Card
            title='Custom Task Configuration'
            size='small'
            style={{ marginBottom: 16 }}
          >
            <Form.Item label='Task Type Name'>
              <Input
                placeholder='Enter custom task type name'
                value={customTaskType.name}
                onChange={e =>
                  setCustomTaskType({
                    ...customTaskType,
                    name: e.target.value
                  })
                }
              />
            </Form.Item>

            <Form.Item label='Description'>
              <Input.TextArea
                placeholder='Describe this task type'
                value={customTaskType.description}
                onChange={e =>
                  setCustomTaskType({
                    ...customTaskType,
                    description: e.target.value
                  })
                }
              />
            </Form.Item>

            <Form.Item>
              <Button
                type='dashed'
                onClick={() =>
                  setCustomTaskType({
                    ...customTaskType,
                    proofRequired: !customTaskType.proofRequired
                  })
                }
              >
                {customTaskType.proofRequired ? 'Remove' : 'Add'} Proof
                Requirement
              </Button>
            </Form.Item>

            {customTaskType.proofRequired && (
              <>
                <Divider />
                <Title level={5}>Proof Requirements</Title>
                {customProofTypes.map((proof, index) => (
                  <Card key={proof.id} size='small' style={{ marginBottom: 8 }}>
                    <Space direction='vertical' style={{ width: '100%' }}>
                      <Input
                        placeholder='Proof type name'
                        value={proof.name}
                        onChange={e =>
                          updateCustomProofType(index, 'name', e.target.value)
                        }
                      />
                      <Input.TextArea
                        placeholder='Description of what needs to be uploaded'
                        value={proof.description}
                        onChange={e =>
                          updateCustomProofType(
                            index,
                            'description',
                            e.target.value
                          )
                        }
                      />
                      <Space>
                        <Select
                          mode='multiple'
                          placeholder='Allowed file types'
                          value={proof.fileTypes}
                          onChange={value =>
                            updateCustomProofType(index, 'fileTypes', value)
                          }
                        >
                          <Select.Option value='pdf'>PDF</Select.Option>
                          <Select.Option value='doc'>DOC</Select.Option>
                          <Select.Option value='docx'>DOCX</Select.Option>
                          <Select.Option value='xlsx'>XLSX</Select.Option>
                          <Select.Option value='jpg'>JPG</Select.Option>
                          <Select.Option value='png'>PNG</Select.Option>
                        </Select>
                        <Button
                          danger
                          onClick={() => removeCustomProofType(index)}
                        >
                          Remove
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                ))}
                <Button
                  type='dashed'
                  onClick={addCustomProofType}
                  icon={<PlusOutlined />}
                >
                  Add Proof Type
                </Button>
              </>
            )}
          </Card>
        )}

        <Form.Item name='assignedRole' label='Assign Role'>
          <Select
            placeholder='Select role'
            onChange={value => {
              setSelectedRole(value)
              form.setFieldsValue({ assignedTo: undefined })
            }}
          >
            <Select.Option value='consultant'>Consultant</Select.Option>
            <Select.Option value='projectadmin'>Project Admin</Select.Option>
            <Select.Option value='operations'>Operations</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name='assignedTo'
          label='Assign To'
          rules={[{ required: true }]}
        >
          <Select disabled={!selectedRole} placeholder='Select user'>
            {getUsersByRole().map(user => (
              <Select.Option key={user.email} value={user.email}>
                {user.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name='dueDate'
          label='Due Date'
          rules={[{ required: true, message: 'Please select due date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name='priority'
          label='Priority'
          rules={[{ required: true, message: 'Please select priority' }]}
        >
          <Select placeholder='Select priority'>
            <Select.Option value='High'>High</Select.Option>
            <Select.Option value='Medium'>Medium</Select.Option>
            <Select.Option value='Low'>Low</Select.Option>
          </Select>
        </Form.Item>

        {userDepartment?.isMain && (
          <Form.Item
            name='department'
            label='Department'
            rules={[{ required: true, message: 'Please select a department' }]}
          >
            <Select placeholder='Select department'>
              {departments.map(dep => (
                <Select.Option key={dep.id} value={dep.id}>
                  {dep.name || dep.id}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item>
          <Button type='primary' htmlType='submit' block>
            Add Task
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}
