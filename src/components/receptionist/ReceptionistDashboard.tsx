import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { inquiryService } from '@/services/inquiryService'
import { ReceptionistDashboardData } from '@/types/inquiry'
import DashboardMetrics from './DashboardMetrics'
import RecentInquiries from './RecentInquiries'
import UrgentInquiries from './UrgentInquiries'
import QuickActions from './QuickActions'
import { Card, Spin, Alert, Row, Col, Button, message } from 'antd'
import { ReloadOutlined, DatabaseOutlined } from '@ant-design/icons'
import { initializeTestInquiries } from '@/utils/initializeTestData'

const ReceptionistDashboard: React.FC = () => {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState<ReceptionistDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Get user's assigned branch
  const assignedBranch = user?.assignedBranch

  const fetchDashboardData = async (showRefreshing = false) => {
    console.log('ReceptionistDashboard: Starting data fetch...')
    console.log('ReceptionistDashboard: User:', user)
    console.log('ReceptionistDashboard: User role:', user?.role)
    console.log('ReceptionistDashboard: User companyCode:', user?.companyCode)
    console.log('ReceptionistDashboard: User uid:', user?.uid)
    console.log('ReceptionistDashboard: Assigned branch:', assignedBranch)
    
    if (!user) {
      setError('User not authenticated. Please log in.')
      setLoading(false)
      return
    }

    if (!assignedBranch) {
      console.warn('ReceptionistDashboard: No branch assigned to receptionist')
      setError('No branch assigned to your account. Please contact your administrator to assign you to a branch.')
      setLoading(false)
      return
    }

    try {
      if (showRefreshing) setRefreshing(true)
      else setLoading(true)
      
      setError(null)
      
      console.log('ReceptionistDashboard: Calling inquiryService.getReceptionistDashboard...')
      
      // Test Firestore connectivity first
      console.log('ReceptionistDashboard: Testing Firestore connectivity...')
      try {
        const testResult = await inquiryService.getInquiries({ limit: 1 })
        console.log('ReceptionistDashboard: Firestore test successful, got', testResult.length, 'results')
      } catch (testError) {
        console.error('ReceptionistDashboard: Firestore test failed:', testError)
        throw new Error(`Firestore connectivity test failed: ${testError instanceof Error ? testError.message : 'Unknown error'}`)
      }
      
      // Fetch dashboard data for the receptionist's branch
      console.log('ReceptionistDashboard: Using branch ID:', assignedBranch)
      
      const data = await inquiryService.getReceptionistDashboard(
        assignedBranch,
        user?.uid // Pass user ID for personal stats
      )
      
      console.log('ReceptionistDashboard: Dashboard data received:', data)
      setDashboardData(data)
    } catch (err) {
      console.error('ReceptionistDashboard: Error fetching dashboard data:', err)
      
      // More detailed error handling
      if (err instanceof Error) {
        if (err.message.includes('permission-denied')) {
          setError('Access denied. Please ensure you have proper permissions for your assigned branch.')
        } else if (err.message.includes('not-found')) {
          setError('Branch data not found. Please contact your administrator.')
        } else {
          setError(`Error: ${err.message}`)
        }
      } else {
        setError('Failed to load dashboard data. Please try again.')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [assignedBranch, user?.uid])

  const handleRefresh = () => {
    fetchDashboardData(true)
  }

  const handleInitializeTestData = async () => {
    if (!assignedBranch || !user?.uid) {
      message.error('Missing branch assignment or user information')
      return
    }

    try {
      setRefreshing(true)
      await initializeTestInquiries(
        assignedBranch,
        user.uid,
        user.companyCode || 'LEPHARO'
      )
      message.success('Test inquiries created successfully!')
      // Refresh dashboard after creating test data
      await fetchDashboardData()
    } catch (error) {
      console.error('Error initializing test data:', error)
      message.error('Failed to create test inquiries')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ margin: '20px' }}>
        <Alert
          message="Error Loading Dashboard"
          description={error}
          type="error"
          showIcon
          action={
            <Button onClick={handleRefresh} type="primary">
              Try Again
            </Button>
          }
          style={{ marginBottom: '16px' }}
        />
        
        {error.includes('No branch assigned') && (
          <Alert
            message="Branch Assignment Required"
            description={
              <div>
                <p>As a receptionist, you need to be assigned to a specific branch to access the dashboard.</p>
                <p><strong>For Directors:</strong> Use the User Management interface to assign this receptionist to a branch.</p>
                <p><strong>For System Administrators:</strong> Use the branch assignment script or User Management interface.</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: '16px' }}
          />
        )}
      </div>
    )
  }

  if (!dashboardData) {
    return (
      <Alert
        message="No Data Available"
        description="Dashboard data could not be loaded."
        type="warning"
        showIcon
        style={{ margin: '20px' }}
      />
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header with refresh button */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px' 
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>
            Receptionist Dashboard
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#666' }}>
            Branch: {assignedBranch || 'Not Assigned'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button 
            icon={<DatabaseOutlined />}
            onClick={handleInitializeTestData}
            loading={refreshing}
            type="dashed"
            style={{ color: '#52c41a', borderColor: '#52c41a' }}
          >
            Add Test Data
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={refreshing}
            type="default"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <QuickActions onRefresh={handleRefresh} />

      {/* Dashboard Metrics */}
      <DashboardMetrics dashboardData={dashboardData} />

      {/* Main Content Grid */}
      <Row gutter={[24, 24]} style={{ marginTop: '24px' }}>
        {/* Recent Inquiries */}
        <Col xs={24} lg={16}>
          <RecentInquiries 
            inquiries={dashboardData.recentInquiries}
            onRefresh={handleRefresh}
          />
        </Col>

        {/* Urgent Items Sidebar */}
        <Col xs={24} lg={8}>
          <UrgentInquiries 
            urgentInquiries={dashboardData.urgentInquiries}
            pendingFollowUps={dashboardData.pendingFollowUps}
            onRefresh={handleRefresh}
          />
        </Col>
      </Row>

      {/* Personal Performance Card */}
      <Card 
        title="My Performance" 
        style={{ marginTop: '24px' }}
        extra={
          <span style={{ fontSize: '14px', color: '#666' }}>
            Your statistics for this branch
          </span>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#1890ff' }}>
                {dashboardData.myStats.totalSubmitted}
              </div>
              <div style={{ color: '#666' }}>Total Submitted</div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#52c41a' }}>
                {dashboardData.myStats.conversionRate.toFixed(1)}%
              </div>
              <div style={{ color: '#666' }}>Conversion Rate</div>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#fa8c16' }}>
                {dashboardData.myStats.averageResponseTime}h
              </div>
              <div style={{ color: '#666' }}>Avg Response Time</div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default ReceptionistDashboard 