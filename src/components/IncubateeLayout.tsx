import React, { useEffect, useState } from 'react'
import {
  Layout,
  Menu,
  Avatar,
  Spin,
  message,
  Button,
  Typography,
  Form
} from 'antd'
import {
  AppstoreOutlined,
  BarChartOutlined,
  LineChartOutlined,
  UserOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { auth, db } from '@/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

const { Header, Sider, Content } = Layout
const { Title } = Typography

const IncubateeLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [profileDrawerVisible, setProfileDrawerVisible] = useState(false)
  const [profileForm] = Form.useForm()
  const [last3Months, setLast3Months] = useState<string[]>([])
  const [last2Years, setLast2Years] = useState<string[]>([])
  const selectedKey = location.pathname.includes('/tracker')
    ? 'tracker'
    : location.pathname.includes('/analytics')
    ? 'analytics'
    : location.pathname.includes('/profile')
    ? 'profile'
    : 'programs'

  useEffect(() => {
    const fetchLogoFromParticipants = async () => {
      try {
        const user = auth.currentUser
        if (!user?.email) return

        const q = query(
          collection(db, 'participants'),
          where('email', '==', user.email)
        )
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data()
          if (data.logoUrl) {
            setLogoUrl(data.logoUrl)
          }
        }
      } catch (err) {
        message.error('Failed to load incubatee logo.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogoFromParticipants()
  }, [])

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ✅ Sidebar with logo */}
      <Sider theme='light' width={240}>
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          {loading ? (
            <Spin />
          ) : logoUrl ? (
            <img
              src={logoUrl}
              alt='Incubatee Logo'
              style={{ height: 48, objectFit: 'contain' }}
            />
          ) : (
            <Avatar size={48} icon={<UserOutlined />} />
          )}
        </div>

        <Menu
          theme='light'
          mode='inline'
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            if (key === 'tracker') navigate('/incubatee/tracker')
            else if (key === 'profile') navigate('/incubatee/profile')
            else if (key === 'programs') navigate('/incubatee/sme')
            else if (key === 'analytics') navigate('/incubatee/analytics')
          }}
        >
          <Menu.Item key='tracker' icon={<AppstoreOutlined />}>
            Application Tracker
          </Menu.Item>
          <Menu.Item key='profile' icon={<UserOutlined />}>
            My Profile
          </Menu.Item>
          <Menu.Item key='programs' icon={<BarChartOutlined />}>
            Programs
          </Menu.Item>
          <Menu.Item key='analytics' icon={<LineChartOutlined />}>
            Analytics
          </Menu.Item>
        </Menu>
      </Sider>

      {/* ✅ Main Content With Header */}
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <Title level={4} style={{ margin: 0 }}>
            Smart Incubation Platform
          </Title>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type='primary'
              danger
              onClick={() => {
                auth.signOut()
                navigate('/')
              }}
            >
              Logout
            </Button>
          </div>
        </Header>

        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default IncubateeLayout
