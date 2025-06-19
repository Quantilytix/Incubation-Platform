import React from 'react'
import { Card, Button, Space } from 'antd'
import { PlusOutlined, SearchOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

interface QuickActionsProps {
  onRefresh: () => void
}

const QuickActions: React.FC<QuickActionsProps> = ({ onRefresh }) => {
  const navigate = useNavigate()

  const handleNewInquiry = () => {
    navigate('/receptionist/inquiries/new')
  }

  const handleViewAllInquiries = () => {
    navigate('/receptionist/inquiries')
  }

  const handleSearchInquiries = () => {
    navigate('/receptionist/inquiries?search=true')
  }

  const handleViewContacts = () => {
    navigate('/receptionist/contacts')
  }

  return (
    <Card 
      title="Quick Actions" 
      size="small"
      style={{ marginBottom: '16px' }}
    >
      <Space wrap size="small">
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={handleNewInquiry}
          size="large"
        >
          New Inquiry
        </Button>
        
        <Button 
          icon={<FileTextOutlined />}
          onClick={handleViewAllInquiries}
        >
          View All Inquiries
        </Button>
        
        <Button 
          icon={<SearchOutlined />}
          onClick={handleSearchInquiries}
        >
          Search
        </Button>
        
        <Button 
          icon={<UserOutlined />}
          onClick={handleViewContacts}
        >
          Contacts
        </Button>
      </Space>
    </Card>
  )
}

export default QuickActions 