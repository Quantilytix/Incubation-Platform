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
import ProfileDrawer from './ProfileDrawer'

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

  useEffect(() => {
    const getRecentPeriods = () => {
      const now = new Date()
      const months = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(now)
        d.setMonth(now.getMonth() - i)
        return d.toLocaleString('default', { month: 'long' })
      }).reverse()
      const year = now.getFullYear()
      const years = [year, year - 1]
      setLast3Months(months)
      setLast2Years(years.map(String))
    }

    getRecentPeriods()
  }, [])
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.currentUser
        if (!user) return
        const snap = await getDocs(
          query(
            collection(db, 'participants'),
            where('email', '==', user.email)
          )
        )

        if (!snap.empty) {
          profileForm.setFieldsValue(snap.docs[0].data())
        }
      } catch (err) {
        message.error('Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  const handleSaveProfile = async () => {
    try {
      const values = await profileForm.validateFields()
      const user = auth.currentUser
      if (!user) return

      const snap = await getDocs(
        query(collection(db, 'participants'), where('email', '==', user.email))
      )
      if (!snap.empty) {
        const docRef = snap.docs[0].ref
        await docRef.update(values)
        message.success('Profile updated successfully')
        setProfileDrawerVisible(false)
      }
    } catch (err) {
      message.error('Failed to update profile')
    }
  }

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
            else if (key === 'programs') navigate('/incubatee/sme')
            else if (key === 'analytics') navigate('/incubatee/analytics')
          }}
        >
          <Menu.Item key='tracker' icon={<AppstoreOutlined />}>
            Application Tracker
          </Menu.Item>
          <Menu.Item key='programs' icon={<BarChartOutlined />}>
            Programs Overview
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
            <div style={{ cursor: 'pointer', color: '#1677ff' }}>
              <Button
                type='default'
                icon={<UserOutlined />}
                onClick={() => setProfileDrawerVisible(true)}
              >
                Edit Profile
              </Button>
            </div>
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
      <ProfileDrawer
        open={profileDrawerVisible}
        onClose={() => setProfileDrawerVisible(false)}
        form={profileForm}
        onSave={handleSaveProfile}
        last3Months={last3Months}
        last2Years={last2Years}
      />
    </Layout>
  )
}

export default IncubateeLayout
