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
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Search } = Input
const { Title, Text } = Typography

export const BranchManagement: React.FC = () => {
  const { user, loading: userLoading } = useFullIdentity()
  const [branches, setBranches] = useState<Branch[]>([])
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null)
  const [searchText, setSearchText] = useState('')
  const [initializing, setInitializing] = useState(false)
  const [newBranchId, setNewBranchId] = useState<string | null>(null)

  const fetchBranches = async () => {
    if (!user?.companyCode) return
    try {
      setLoading(true)
      const branchData = await branchService.getAllBranches(user.companyCode)
      setBranches(branchData)
      setFilteredBranches(branchData)
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to fetch branches'
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!userLoading && user?.companyCode) {
      fetchBranches()
    }
  }, [userLoading, user])

  useEffect(() => {
    const filtered = branches.filter(branch => {
      const locationStr =
        typeof branch.location === 'string'
          ? branch.location
          : `${branch.location.address} ${branch.location.city}`
      const contactEmail =
        typeof branch.contact === 'object' ? branch.contact.email : ''
      return (
        branch.name.toLowerCase().includes(searchText.toLowerCase()) ||
        locationStr.toLowerCase().includes(searchText.toLowerCase()) ||
        contactEmail.toLowerCase().includes(searchText.toLowerCase())
      )
    })
    setFilteredBranches(filtered)
  }, [searchText, branches])

  const showModal = (edit: boolean = false, branch: Branch | null = null) => {
    setIsEditMode(edit)
    setCurrentBranch(branch)
    setIsModalVisible(true)
  }

  const handleCancel = () => {
    setIsModalVisible(false)
    setCurrentBranch(null)
  }

  const handleSubmit = async (values: any) => {
    if (!user?.companyCode) {
      message.error('User company code is missing.')
      return
    }

    try {
      let branchId = ''
      if (isEditMode && currentBranch) {
        await branchService.updateBranch(currentBranch.id, values)
        branchId = currentBranch.id
        message.success('Branch updated successfully!')
      } else {
        const newBranch = await branchService.createBranch({
          ...values,
          companyCode: user.companyCode
        })
        branchId = newBranch.id
        setNewBranchId(newBranch.id)
        message.success('Branch created successfully!')
      }

      setIsModalVisible(false)
      setCurrentBranch(null)
      await fetchBranches()
    } catch (error: any) {
      message.error(error.message || 'Operation failed')
    }
  }

  const handleDelete = async (branchId: string) => {
    try {
      await branchService.deleteBranch(branchId)
      message.success('Branch deleted successfully!')
      await fetchBranches()
    } catch (error: any) {
      message.error(error.message || 'Failed to delete branch')
    }
  }

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
      render: (_: any, record: Branch) => {
        const locationStr =
          typeof record.location === 'string'
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
      render: (_: any, record: Branch) => {
        const contactEmail =
          typeof record.contact === 'object' ? record.contact.email : ''
        const contactPhone =
          typeof record.contact === 'object' ? record.contact.phone : ''
        return (
          <div>
            <div style={{ marginBottom: 4 }}>
              <MailOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text copyable={{ text: contactEmail }}>{contactEmail}</Text>
            </div>
            <div>
              <PhoneOutlined style={{ color: '#722ed1', marginRight: 8 }} />
              <Text copyable={{ text: contactPhone }}>{contactPhone}</Text>
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
      render: (companyCode: string) => <Tag color="blue">{companyCode}</Tag>,
      width: '10%'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Branch) => (
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
            Manage branches and their information. Directors can create, edit,
            and manage all branches.
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

            <Button icon={<ReloadOutlined />} onClick={fetchBranches} loading={loading}>
              Refresh
            </Button>

            {branches.length === 0 && !loading && (
              <Popconfirm
                title="Initialize Sample Branches?"
                onConfirm={handleInitializeBranches}
                okText="Initialize"
                cancelText="Cancel"
              >
                <Button type="dashed" loading={initializing}>
                  Initialize Branches
                </Button>
              </Popconfirm>
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
          rowClassName={record =>
            record.id === newBranchId ? 'highlighted-row' : ''
          }
          scroll={{ x: 800 }}
        />

        <Modal
          title={isEditMode ? `Edit Branch: ${currentBranch?.name}` : 'Create New Branch'}
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

      <style>{`
        .highlighted-row {
          background-color: #e6fffb !important;
          animation: fadeOut 8s forwards;
        }
        @keyframes fadeOut {
          0% { background-color: #e6fffb; }
          100% { background-color: white; }
        }
      `}</style>
    </div>
  )
}
