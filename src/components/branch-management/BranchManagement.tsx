import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Space,
  Tooltip,
  Popconfirm,
  message,
  Input,
  Tag,
  Typography,
  Card
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined
} from '@ant-design/icons'
import { BranchForm } from './BranchForm'
import { branchService } from '@/services/branchService'
import { Branch } from '@/types/types'

const { Search } = Input
const { Title, Text } = Typography

export const BranchManagement: React.FC = () => {
  const [branches, setBranches] = useState<Branch[]>([])
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null)
  const [searchText, setSearchText] = useState('')
  const [initializing, setInitializing] = useState(false)

  // Fetch branches
  const fetchBranches = async () => {
    try {
      setLoading(true)
      console.log('Fetching branches...')
      const branchData = await branchService.getAllBranches()
      console.log('Branches fetched successfully:', branchData)
      setBranches(branchData)
      setFilteredBranches(branchData)
    } catch (error) {
      console.error('Error fetching branches:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch branches'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [])

  // Filter branches based on search text
  useEffect(() => {
    const filtered = branches.filter(branch => {
      const locationStr = typeof branch.location === 'string' 
        ? branch.location 
        : `${branch.location.address} ${branch.location.city}`
      const contactEmail = typeof branch.contact === 'object' 
        ? branch.contact.email 
        : ''
      
      return (
        branch.name.toLowerCase().includes(searchText.toLowerCase()) ||
        locationStr.toLowerCase().includes(searchText.toLowerCase()) ||
        contactEmail.toLowerCase().includes(searchText.toLowerCase())
      )
    })
    setFilteredBranches(filtered)
  }, [searchText, branches])

  // Handle modal visibility
  const showModal = (edit: boolean = false, branch: Branch | null = null) => {
    setIsEditMode(edit)
    setCurrentBranch(branch)
    setIsModalVisible(true)
  }

  const handleCancel = () => {
    setIsModalVisible(false)
    setCurrentBranch(null)
  }

  // Handle form submission
  const handleSubmit = async (values: any) => {
    try {
      if (isEditMode && currentBranch) {
        await branchService.updateBranch(currentBranch.id, values)
        message.success('Branch updated successfully!')
      } else {
        await branchService.createBranch(values)
        message.success('Branch created successfully!')
      }
      
      setIsModalVisible(false)
      setCurrentBranch(null)
      await fetchBranches()
    } catch (error: any) {
      message.error(error.message || 'Operation failed')
    }
  }

  // Handle branch deletion
  const handleDelete = async (branchId: string) => {
    try {
      await branchService.deleteBranch(branchId)
      message.success('Branch deleted successfully!')
      await fetchBranches()
    } catch (error: any) {
      message.error(error.message || 'Failed to delete branch')
    }
  }

  // Initialize branches
  const handleInitializeBranches = async () => {
    try {
      setInitializing(true)
      await branchService.initializeBranches()
      message.success('Branches initialized successfully!')
      await fetchBranches()
    } catch (error: any) {
      message.error(error.message || 'Failed to initialize branches')
    } finally {
      setInitializing(false)
    }
  }

  // Table columns
  const columns = [
    {
      title: 'Branch Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Branch) => (
        <div>
          <Text strong>{name}</Text>
          {record.name.includes('Head Office') && (
            <Tag color="gold" style={{ marginLeft: 8 }}>
              HQ
            </Tag>
          )}
        </div>
      ),
      width: '25%'
    },
    {
      title: 'Location',
      key: 'location',
      render: (text: any, record: Branch) => {
        const locationStr = typeof record.location === 'string' 
          ? record.location 
          : `${record.location.address}, ${record.location.city}`
        return (
          <Space>
            <EnvironmentOutlined style={{ color: '#1890ff' }} />
            <Text>{locationStr}</Text>
          </Space>
        )
      },
      width: '25%'
    },
    {
      title: 'Contact Information',
      key: 'contact',
      render: (text: any, record: Branch) => {
        const contactEmail = typeof record.contact === 'object' 
          ? record.contact.email 
          : ''
        const contactPhone = typeof record.contact === 'object' 
          ? record.contact.phone 
          : ''
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <MailOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text copyable={{ text: contactEmail }}>
                {contactEmail}
              </Text>
            </div>
            <div>
              <PhoneOutlined style={{ color: '#722ed1', marginRight: 8 }} />
              <Text copyable={{ text: contactPhone }}>
                {contactPhone}
              </Text>
            </div>
          </div>
        )
      },
      width: '30%'
    },
    {
      title: 'Company',
      dataIndex: 'companyCode',
      key: 'companyCode',
      render: (companyCode: string) => (
        <Tag color="blue">{companyCode}</Tag>
      ),
      width: '10%'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text: any, record: Branch) => (
        <Space size="small">
          <Tooltip title="Edit Branch">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showModal(true, record)}
              size="small"
            />
          </Tooltip>
          
          <Popconfirm
            title="Delete Branch"
            description={
              <div>
                <p>Are you sure you want to delete this branch?</p>
                <p style={{ color: '#ff4d4f', fontSize: '12px' }}>
                  This action cannot be undone.
                </p>
              </div>
            }
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete Branch">
              <Button
                type="text"
                icon={<DeleteOutlined />}
                danger
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
      width: '10%'
    }
  ]

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Title level={3}>Branch Management</Title>
          <Text type="secondary">
            Manage branches and their information. Directors can create, edit, and manage all branches.
          </Text>
        </div>

        <div
          style={{
            marginBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}
        >
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
            >
              Add Branch
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchBranches}
              loading={loading}
            >
              Refresh
            </Button>

            {branches.length === 0 && !loading && (
              <Button
                type="dashed"
                loading={initializing}
                onClick={handleInitializeBranches}
              >
                Initialize Branches
              </Button>
            )}
          </Space>

          <Search
            placeholder="Search branches by name, location, or contact"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onSearch={value => setSearchText(value)}
            style={{ width: 300 }}
            allowClear
          />
        </div>

        <Table
          dataSource={filteredBranches}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: total => `Total ${total} branches`
          }}
          scroll={{ x: 800 }}
        />

        {/* Branch Create/Edit Modal */}
        <Modal
          title={isEditMode ? 'Edit Branch' : 'Create New Branch'}
          open={isModalVisible}
          onCancel={handleCancel}
          footer={null}
          maskClosable={false}
          width={600}
        >
          <BranchForm
            initialValues={currentBranch}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEditMode={isEditMode}
          />
        </Modal>
      </Card>
    </div>
  )
} 
