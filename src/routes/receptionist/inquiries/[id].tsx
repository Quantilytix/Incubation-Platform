import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Breadcrumb, Button, Space } from 'antd'
import { HomeOutlined, ArrowLeftOutlined, EditOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import InquiryDetail from '@/components/receptionist/InquiryDetail'

const InquiryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  if (!id) {
    return <div>Invalid inquiry ID</div>
  }

  const handleEdit = () => {
    navigate(`/receptionist/inquiries/${id}/edit`)
  }

  const handleBack = () => {
    navigate('/receptionist/inquiries')
  }

  return (
    <div>
      {/* Breadcrumb Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Breadcrumb>
          <Breadcrumb.Item>
            <Link to="/receptionist/dashboard">
              <HomeOutlined /> Dashboard
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link to="/receptionist/inquiries">
              Inquiries
            </Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item>
            Inquiry Details
          </Breadcrumb.Item>
        </Breadcrumb>

        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
            Back to List
          </Button>
          <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
            Edit Inquiry
          </Button>
        </Space>
      </div>

      {/* Inquiry Detail Component */}
      <InquiryDetail inquiryId={id} onEdit={handleEdit} />
    </div>
  )
}

export default InquiryDetailPage 