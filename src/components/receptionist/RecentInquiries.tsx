import React from 'react'
import { Card, List, Tag, Button, Space, Empty, Badge } from 'antd'
import { EyeOutlined, EditOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Inquiry, PRIORITY_COLORS, STATUS_COLORS } from '@/types/inquiry'
import { formatDistanceToNow } from 'date-fns'

interface RecentInquiriesProps {
  inquiries: Inquiry[]
  onRefresh: () => void
}

const RecentInquiries: React.FC<RecentInquiriesProps> = ({ inquiries, onRefresh }) => {
  const navigate = useNavigate()

  const handleViewInquiry = (inquiryId: string) => {
    navigate(`/receptionist/inquiries/${inquiryId}`)
  }

  const handleEditInquiry = (inquiryId: string) => {
    navigate(`/receptionist/inquiries/${inquiryId}/edit`)
  }

  const handleViewAll = () => {
    navigate('/receptionist/inquiries')
  }

  if (inquiries.length === 0) {
    return (
      <Card 
        title="Recent Inquiries"
        extra={
          <Button type="link" onClick={handleViewAll}>
            View All
          </Button>
        }
      >
        <Empty 
          description="No recent inquiries"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Card>
    )
  }

  return (
    <Card 
      title="Recent Inquiries"
      extra={
        <Button type="link" onClick={handleViewAll}>
          View All ({inquiries.length})
        </Button>
      }
    >
      <List
        itemLayout="vertical"
        dataSource={inquiries}
        renderItem={(inquiry) => (
          <List.Item
            key={inquiry.id}
            actions={[
              <Button 
                key="view"
                type="text" 
                icon={<EyeOutlined />}
                onClick={() => handleViewInquiry(inquiry.id)}
              >
                View
              </Button>,
              <Button 
                key="edit"
                type="text" 
                icon={<EditOutlined />}
                onClick={() => handleEditInquiry(inquiry.id)}
              >
                Edit
              </Button>
            ]}
          >
            <List.Item.Meta
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>
                    {inquiry.contactInfo.firstName} {inquiry.contactInfo.lastName}
                  </span>
                  {inquiry.source === 'SME' && (
                    <Badge 
                      count={<UserOutlined style={{ color: '#1890ff' }} />}
                      title="SME Inquiry"
                      style={{ backgroundColor: '#e6f7ff' }}
                    />
                  )}
                  <Tag 
                    color={PRIORITY_COLORS[inquiry.priority]}
                    style={{ fontSize: '10px' }}
                  >
                    {inquiry.priority}
                  </Tag>
                  <Tag 
                    color={STATUS_COLORS[inquiry.status]}
                    style={{ fontSize: '10px' }}
                  >
                    {inquiry.status}
                  </Tag>
                </div>
              }
              description={
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ color: '#666' }}>
                    {inquiry.inquiryDetails.inquiryType}
                    {inquiry.contactInfo.company && ` • ${inquiry.contactInfo.company}`}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {formatDistanceToNow(inquiry.submittedAt, { addSuffix: true })} • {inquiry.source}
                  </div>
                </Space>
              }
            />
            <div style={{ 
              maxWidth: '100%', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#666',
              fontSize: '14px'
            }}>
              {inquiry.inquiryDetails.description}
            </div>
          </List.Item>
        )}
      />
    </Card>
  )
}

export default RecentInquiries 