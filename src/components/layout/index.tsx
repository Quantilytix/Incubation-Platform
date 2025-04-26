import React, { useEffect, useMemo, useState } from 'react'
import { Layout, Menu, Typography, Spin, Button } from 'antd'
import { useGetIdentity, useLogout } from '@refinedev/core'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Link, Outlet } from 'react-router-dom'
import { CurrentUser } from '@/components/layout/current-user'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type UserRole =
  | 'funder'
  | 'consultant'
  | 'incubatee'
  | 'operations'
  | 'director'
  | 'projectadmin'

export const CustomLayout: React.FC = () => {
  const { data: identity } = useGetIdentity()
  const { mutate: logout } = useLogout()
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!identity?.id) return
      const docRef = doc(db, 'users', String(identity.id))
      const userSnap = await getDoc(docRef)
      if (userSnap.exists()) {
        const userData = userSnap.data()
        const cleanRole = userData.role?.toLowerCase()?.replace(/\s+/g, '')
        setRole(cleanRole)
      }
    }
    fetchUserRole()
  }, [identity])

  const menuItems = useMemo(() => {
    const items = (list: { key: string; to: string; label: string }[]) =>
      list.map(({ key, to, label }) => ({
        key,
        label: <Link to={to}>{label}</Link>
      }))

    const menus: Record<UserRole, any[]> = {
      projectadmin: items([
        { key: 'dashboard', to: '/projectadmin', label: 'Dashboard' },
        {
          key: 'analytics',
          to: '/projectadmin/monitoring',
          label: 'M & E Monitoring'
        },
        {
          key: 'impact',
          to: '/projectadmin/impact',
          label: 'Impact Analytics'
        },
        {
          key: 'reports',
          to: '/projectadmin/reports',
          label: 'Reports'
        }
      ]),
      funder: items([
        { key: 'dashboard', to: '/funder', label: 'Dashboard' },
        { key: 'analytics', to: '/funder/analytics', label: 'Analytics' },
        { key: 'reports', to: '/funder', label: 'Reports' }
      ]),
      consultant: items([
        { key: 'dashboard', to: '/consultant', label: 'Dashboard' },
        { key: 'allocated', to: '/consultant/allocated', label: 'Allocated' },
        { key: 'feedback', to: '/consultant/feedback', label: 'Feedback' },
        { key: 'analytics', to: '/consultant/analytics', label: 'Analytics' }
      ]),
       director: items([
        { key: 'dashboard', to: '/director', label: 'My Dashboard' },
        { key: 'sponsor', to: '/funder', label: 'Sponsor View' }
      ]),
        incubatee: items([
        { key: 'dashboard', to: '/incubatee', label: 'My Dashboard' },
        {
          key: 'interventions',
          to: '/incubatee/interventions',
          label: 'Interventions Tracker'
        },
        {
          key: 'projects',
          to: '/incubatee/projects',
          label: 'Key Metrics Tracker'
        },
        {
          key: 'documents',
          to: '/incubatee/documents',
          label: 'Documents Upload'
        }
      ]),
      operations: items([
        { key: 'dashboard', to: '/operations', label: 'Dashboard' },
        { key: 'admin', to: '/operations/admin', label: 'System Configuration' },
        {
          key: 'assignments',
          to: '/operations/assignments',
          label: 'Interventions Assignments'
        },
        {
          key: 'participants',
          to: '/operations/participants',
          label: 'Participants'
        },
        {
          key: 'compliance',
          to: '/operations/compliance',
          label: 'Compliance'
        },

        { key: 'resources', to: '/operations/resources', label: 'Resources' },
        { key: 'forms', to: '/operations/forms', label: 'Forms' },
        { key: 'reports', to: '/operations/reports', label: 'Reports' }
      ])
    }

    return role
      ? [
          ...menus[role],
          {
            key: 'chat',
            label: <Link to='/chat'>Chat</Link>
          }
        ]
      : []
  }, [role])

  const getDashboardTitle = (role: UserRole | null) => {
    if (!role) return ''
    const nameMap = {
      projectadmin: 'Project Admin',
      funder: 'Sponsor',
      consultant: 'Consultant',
      operations: 'Operations',
      admin: 'Admin',
      director: 'Director',
      incubatee: 'Incubatee'
    }
    return `Smart Incubation : ${nameMap[role] || role} Dashboard`
  }

  if (!role) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <Spin tip='Loading layout...' size='large' />
      </div>
    )
  }

  const siderWidth = 220
  const headerHeight = 64

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sider */}
      <Sider
        width={siderWidth}
        style={{
          background: '#ffffff',
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '2px 0 5px rgba(0,0,0,0.06)'
        }}
      >
        <div>
          <div
            style={{
              height: headerHeight,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
              borderBottom: '1px solid #f0f0f0',
              backgroundColor: '#ffffff',
              padding: '4px 8px'
            }}
          >
            <div style={{ fontSize: 12, color: '#999' }}>Powered By</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                background: 'linear-gradient(to right, #8e2de2, #4a00e0)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1
              }}
            >
              Quantilytix
            </div>
            <span
              style={{
                fontSize: 10,
                color: '#999',
                marginTop: 2,
                fontStyle: 'italic'
              }}
            >
              Unlocking endless possibilities
            </span>
          </div>

          <Menu
            theme='light'
            mode='inline'
            items={menuItems}
            style={{ borderRight: 'none' }}
          />
        </div>

        {/* Logout at bottom */}
        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <Button block danger onClick={() => logout()}>
            Logout
          </Button>
        </div>
      </Sider>

      {/* Main Layout */}
      <Layout
        style={{
          marginLeft: siderWidth,
          width: `calc(100% - ${siderWidth}px)`
        }}
      >
        {/* Header with CurrentUser */}
        <Header
          style={{
            background: '#ffffff',
            padding: '0 24px',
            position: 'fixed',
            top: 0,
            left: siderWidth,
            right: 0,
            height: headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e0e0e0',
            zIndex: 90
          }}
        >
          <div style={{ flex: 1, textAlign: 'center' }}>
            <Title level={4} style={{ margin: 0 }}>
              {getDashboardTitle(role)}
            </Title>
          </div>
          <div>
            <CurrentUser /> {/* ✅ Avatar with initials */}
          </div>
        </Header>

        {/* Scrollable content */}
        <Content
          style={{
            marginTop: headerHeight,
            padding: 24,
            overflowY: 'auto',
            height: `calc(100vh - ${headerHeight}px)`,
            background: '#f5f5f5'
          }}
        >
          <div
            style={{
              padding: 24,
              background: '#fff',
              borderRadius: 6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              minHeight: 360
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </div>
  )
}
