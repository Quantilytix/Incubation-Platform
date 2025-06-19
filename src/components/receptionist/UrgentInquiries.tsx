import React from 'react'
import { Card, List, Tag, Button, Badge, Empty, Space } from 'antd'
import { ExclamationCircleOutlined, ClockCircleOutlined, EyeOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Inquiry, PRIORITY_COLORS } from '@/types/inquiry'
import { formatDistanceToNow } from 'date-fns'

interface UrgentInquiriesProps {
  urgentInquiries: Inquiry[]
  pendingFollowUps: number
  onRefresh: () => void
}

const UrgentInquiries: React.FC<UrgentInquiriesProps> = ({ 
  urgentInquiries, 
  pendingFollowUps, 
  onRefresh 
}) => {
  const navigate = useNavigate()

  const handleViewInquiry = (inquiryId: string) => {
    navigate(`/receptionist/inquiries/${inquiryId}`)
  }

  const handleViewFollowUps = () => {
    navigate('/receptionist/follow-ups')
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Pending Follow-ups Alert */}
      {pendingFollowUps > 0 && (
        <Card 
          size="small"
          style={{ 
            border: '1px solid #fa8c16',
            backgroundColor: '#fff7e6'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClockCircleOutlined style={{ color: '#fa8c16' }} />
              <span style={{ fontWeight: 500 }}>
                {pendingFollowUps} Pending Follow-up{pendingFollowUps > 1 ? 's' : ''}
              </span>
            </div>
            <Button 
              type="link" 
              size="small"
              onClick={handleViewFollowUps}
              style={{ color: '#fa8c16' }}
            >
              View All
            </Button>
          </div>
        </Card>
      )}

      {/* Urgent Inquiries */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ExclamationCircleOutlined style={{ color: '#f5222d' }} />
            <span>Urgent Inquiries</span>
            {urgentInquiries.length > 0 && (
              <Badge count={urgentInquiries.length} style={{ backgroundColor: '#f5222d' }} />
            )}
          </div>
        }
        size="small"
      >
        {urgentInquiries.length === 0 ? (
          <Empty 
            description="No urgent inquiries"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '20px 0' }}
          />
        ) : (
          <List
            size="small"
            dataSource={urgentInquiries}
            renderItem={(inquiry) => (
              <List.Item
                key={inquiry.id}
                actions={[
                  <Button 
                    key="view"
                    type="text" 
                    icon={<EyeOutlined />}
                    size="small"
                    onClick={() => handleViewInquiry(inquiry.id)}
                  >
                    View
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>
                        {inquiry.contactInfo.firstName} {inquiry.contactInfo.lastName}
                      </span>
                      {inquiry.source === 'SME' && (
                        <Badge 
                          count={<UserOutlined style={{ color: '#1890ff', fontSize: '10px' }} />}
                          title="SME Inquiry"
                          style={{ backgroundColor: '#e6f7ff' }}
                        />
                      )}
                      <Tag 
                        color={PRIORITY_COLORS[inquiry.priority]}
                        style={{ fontSize: '10px', margin: 0 }}
                      >
                        {inquiry.priority}
                      </Tag>
                    </div>
                  }
                  description={
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {inquiry.inquiryDetails.inquiryType} • {formatDistanceToNow(inquiry.submittedAt, { addSuffix: true })}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  )
}

export default UrgentInquiries 