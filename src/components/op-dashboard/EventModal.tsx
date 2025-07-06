import React, { useState } from 'react'
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Button,
  Space,
  Typography,
  Card,
  Tag,
  Checkbox,
  Row,
  Col,
  Badge,
  Avatar,
  Divider,
  Empty
} from 'antd'
import { UserOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons'
import { EVENT_TYPES, EVENT_FORMATS, EventType } from '../../types/EventType'

const { Title, Text } = Typography

interface EventModalProps {
  open: boolean
  onCancel: () => void
  onSubmit: (values: any) => void
  form: any
  consultants: any[]
  projectAdmins: any[]
  operationsUsers: any[]
  participants: any[]
}

interface ParticipantSelectionModalProps {
  open: boolean
  onCancel: () => void
  onConfirm: (selected: string[]) => void
  allUsers: any[]
  selectedParticipants: string[]
}

const ParticipantSelectionModal: React.FC<ParticipantSelectionModalProps> = ({
  open,
  onCancel,
  onConfirm,
  allUsers,
  selectedParticipants
}) => {
  const [localSelected, setLocalSelected] =
    useState<string[]>(selectedParticipants)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch =
      user.label && user.label.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || user.role === filterRole
    return matchesSearch && matchesRole
  })

  const handleSelectAll = () => {
    setLocalSelected(filteredUsers.map(u => u.value))
  }

  const handleDeselectAll = () => {
    setLocalSelected([])
  }

  const handleConfirm = () => {
    onConfirm(localSelected)
    onCancel()
  }

  return (
    <Modal
      title='Select Event Participants'
      open={open}
      onCancel={onCancel}
      width={700}
      footer={[
        <Button key='cancel' onClick={onCancel}>
          Cancel
        </Button>,
        <Button key='confirm' type='primary' onClick={handleConfirm}>
          Confirm Selection ({localSelected.length})
        </Button>
      ]}
    >
      <Space direction='vertical' style={{ width: '100%' }} size='middle'>
        <Row gutter={16}>
          <Col flex={1}>
            <Input
              placeholder='Search participants...'
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </Col>
          <Col>
            <Select
              placeholder='Filter by role'
              style={{ width: 150 }}
              value={filterRole}
              onChange={setFilterRole}
            >
              <Select.Option value='all'>All Roles</Select.Option>
              <Select.Option value='consultant'>Consultant</Select.Option>
              <Select.Option value='projectadmin'>Project Admin</Select.Option>
              <Select.Option value='operations'>Operations</Select.Option>
              <Select.Option value='participant'>Participant</Select.Option>
            </Select>
          </Col>
        </Row>

        <Row justify='space-between'>
          <Col>
            <Space>
              <Button size='small' onClick={handleSelectAll}>
                Select All ({filteredUsers.length})
              </Button>
              <Button size='small' onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Space>
          </Col>
          <Col>
            <Text type='secondary'>
              {localSelected.length} of {allUsers.length} selected
            </Text>
          </Col>
        </Row>

        <Divider style={{ margin: '8px 0' }} />

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filteredUsers.length === 0 ? (
            <Empty description='No participants found' />
          ) : (
            <Row gutter={[8, 8]}>
              {filteredUsers.map(user => (
                <Col span={24} key={user.value}>
                  <Card size='small' style={{ marginBottom: 4 }}>
                    <Checkbox
                      checked={localSelected.includes(user.value)}
                      onChange={e => {
                        if (e.target.checked) {
                          setLocalSelected([...localSelected, user.value])
                        } else {
                          setLocalSelected(
                            localSelected.filter(id => id !== user.value)
                          )
                        }
                      }}
                    >
                      <Space>
                        <Avatar size='small' icon={<UserOutlined />} />
                        <span>{user.label}</span>
                        <Tag color='blue'>{user.role}</Tag>
                      </Space>
                    </Checkbox>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      </Space>
    </Modal>
  )
}

export const EventModal: React.FC<EventModalProps> = ({
  open,
  onCancel,
  onSubmit,
  form,
  consultants,
  projectAdmins,
  operationsUsers,
  participants
}) => {
  const [selectedEventType, setSelectedEventType] = useState<EventType | null>(
    null
  )
  const [selectedFormat, setSelectedFormat] = useState<string>('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [participantModalOpen, setParticipantModalOpen] = useState(false)

  const handleEventTypeChange = (typeId: string) => {
    const eventType = EVENT_TYPES.find(t => t.id === typeId)
    setSelectedEventType(eventType || null)
  }

  // Combine all users for participant selection with better formatting
  const allUsers = [
    ...consultants.map(u => ({
      value: u.id || u.email,
      label: u.name || u.email,
      role: 'consultant'
    })),
    ...projectAdmins.map(u => ({
      value: u.id || u.email,
      label: u.name || u.email,
      role: 'projectadmin'
    })),
    ...operationsUsers.map(u => ({
      value: u.id || u.email,
      label: u.name || u.email,
      role: 'operations'
    })),
    ...participants.map(u => ({
      value: u.id || u.email,
      label: u.name || u.email,
      role: 'participant'
    }))
  ]

  const getParticipantPreview = () => {
    const selectedUsers = allUsers.filter(u =>
      selectedParticipants.includes(u.value)
    )
    const groupedByRole = selectedUsers.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return Object.entries(groupedByRole).map(([role, count]) => (
      <Tag key={role} color='blue'>
        {role}: {count}
      </Tag>
    ))
  }

  const handleFormSubmit = (values: any) => {
    onSubmit({
      ...values,
      participants: selectedParticipants
    })
    setSelectedParticipants([])
  }

  return (
    <>
      <Modal
        title='Add New Event'
        open={open}
        onCancel={onCancel}
        footer={null}
        width={800}
      >
        <Form form={form} layout='vertical' onFinish={handleFormSubmit}>
          <Form.Item
            name='title'
            label='Event Title'
            rules={[{ required: true, message: 'Please input event title' }]}
          >
            <Input placeholder='Enter event title' />
          </Form.Item>

          <Form.Item
            name='eventType'
            label='Event Type'
            rules={[{ required: true, message: 'Please select event type' }]}
          >
            <Select
              placeholder='Select event type'
              onChange={handleEventTypeChange}
            >
              {EVENT_TYPES.map(type => (
                <Select.Option key={type.id} value={type.id}>
                  {type.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {selectedEventType && (
            <Card size='small' style={{ marginBottom: 16 }}>
              <Text strong>{selectedEventType.name}</Text>
              <br />
              <Text type='secondary'>{selectedEventType.description}</Text>
              <br />
              <Space wrap style={{ marginTop: 8 }}>
                {selectedEventType.requiresParticipants && (
                  <Tag color='blue'>Participants Required</Tag>
                )}
                {selectedEventType.requiresLocation && (
                  <Tag color='green'>Location Required</Tag>
                )}
                {selectedEventType.requiresLink && (
                  <Tag color='orange'>Link Required</Tag>
                )}
              </Space>
            </Card>
          )}

          <Form.Item
            name='format'
            label='Event Format'
            rules={[{ required: true, message: 'Please select event format' }]}
          >
            <Select
              placeholder='Select event format'
              onChange={setSelectedFormat}
            >
              {EVENT_FORMATS.map(format => (
                <Select.Option key={format.value} value={format.value}>
                  {format.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name='date'
            label='Event Date'
            rules={[{ required: true, message: 'Please select event date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Space style={{ width: '100%' }}>
            <Form.Item
              name='startTime'
              label='Start Time'
              rules={[{ required: true, message: 'Please select start time' }]}
            >
              <TimePicker format='HH:mm' />
            </Form.Item>
            <Form.Item
              name='endTime'
              label='End Time'
              rules={[{ required: true, message: 'Please select end time' }]}
            >
              <TimePicker format='HH:mm' />
            </Form.Item>
          </Space>

          {selectedEventType?.requiresParticipants && (
            <Form.Item label='Event Participants'>
              <Card
                size='small'
                style={{ cursor: 'pointer' }}
                onClick={() => setParticipantModalOpen(true)}
              >
                <Space direction='vertical' style={{ width: '100%' }}>
                  <Space>
                    <TeamOutlined />
                    <Text strong>Selected Participants</Text>
                    <Badge count={selectedParticipants.length} showZero />
                  </Space>
                  {selectedParticipants.length > 0 ? (
                    <Space wrap>{getParticipantPreview()}</Space>
                  ) : (
                    <Text type='secondary'>Click to select participants</Text>
                  )}
                  <Button type='link' size='small' style={{ padding: 0 }}>
                    View All & Select
                  </Button>
                </Space>
              </Card>
            </Form.Item>
          )}

          {(selectedEventType?.requiresLocation ||
            selectedFormat === 'in-person' ||
            selectedFormat === 'hybrid') && (
            <Form.Item
              name='location'
              label='Location'
              rules={[{ required: true, message: 'Please enter location' }]}
            >
              <Input.TextArea
                placeholder='Enter event location or address'
                rows={2}
              />
            </Form.Item>
          )}

          {(selectedEventType?.requiresLink ||
            selectedFormat === 'virtual' ||
            selectedFormat === 'hybrid') && (
            <Form.Item
              name='link'
              label='Online Meeting Link'
              rules={[
                {
                  required: selectedFormat === 'virtual',
                  message: 'Please enter meeting link for virtual events'
                },
                { type: 'url', message: 'Please enter a valid URL' }
              ]}
            >
              <Input placeholder='https://...' />
            </Form.Item>
          )}

          <Form.Item name='description' label='Description'>
            <Input.TextArea
              placeholder='Event description (optional)'
              rows={3}
            />
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Add Event
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <ParticipantSelectionModal
        open={participantModalOpen}
        onCancel={() => setParticipantModalOpen(false)}
        onConfirm={setSelectedParticipants}
        allUsers={allUsers}
        selectedParticipants={selectedParticipants}
      />
    </>
  )
}
