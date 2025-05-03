import React, { useEffect, useMemo, useState } from 'react'
import { Layout, Menu, Typography, Spin, Button } from 'antd'
import { useGetIdentity, useLogout } from '@refinedev/core'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Link, Outlet } from 'react-router-dom'
import { CurrentUser } from '@/components/layout/current-user'
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  DashboardOutlined,
  PieChartOutlined,
  BarChartOutlined,
  FundProjectionScreenOutlined,
  FileTextOutlined,
  ReadOutlined,
  FileSearchOutlined,
  UsergroupAddOutlined,
  CheckSquareOutlined,
  FileProtectOutlined,
  PlusCircleOutlined,
  ProjectOutlined,
  FormOutlined,
  LaptopOutlined,
  TeamOutlined,
  FileDoneOutlined,
  SolutionOutlined,
  MessageOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  AuditOutlined,
  ProfileOutlined
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type UserRole =
  | 'admin'
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
  const [collapsed, setCollapsed] = useState(false)

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

  const allMenus = {
    admin: [
      {
        key: 'dashboard',
        to: '/admin',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'monitoring',
        to: '/admin/monitoring',
        label: 'Monitoring',
        icon: <BarChartOutlined />
      }
    ],

    projectadmin: [
      {
        key: 'dashboard',
        to: '/projectadmin',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'analytics',
        to: '/projectadmin/monitoring',
        label: 'M & E Monitoring',
        icon: <PieChartOutlined />
      },
      {
        key: 'impact',
        to: '/projectadmin/impact',
        label: 'Impact Analytics',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'reports',
       to: '/operations/reports',

        
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ],

    funder: [
      {
        key: 'dashboard',
        to: '/funder',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'opportunities',
        to: '/funder/opportunities',
        label: 'Opportunities',
        icon: <PlusCircleOutlined />
      },
      {
        key: 'analytics',
        to: '/funder/analytics',
        label: 'Analytics',
        icon: <BarChartOutlined />
      }
    ],

    consultant: [
      {
        key: 'dashboard',
        to: '/consultant',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'allocated',
        to: '/consultant/allocated',
        label: 'Interventions',
        icon: <FileProtectOutlined />
      },
      {
        key: 'feedback',
        to: '/consultant/feedback',
        label: 'Participant Insights',
        icon: <MessageOutlined />
      },
      {
        key: 'analytics',
        to: '/consultant/analytics',
        label: 'Analytics',
        icon: <PieChartOutlined />
      }
    ],

    director: [
      {
        key: 'dashboard',
        to: '/director',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'operators',
        to: '/director/operators',
        label: 'Operators Onboarding',
        icon: <UsergroupAddOutlined />
      },
      {
        key: 'programs',
        to: '/programs',
        label: 'Programs Onboarding',
        icon: <LaptopOutlined />
      },
      {
        key: 'expenses',
        to: '/expenses',
        label: 'Project Expenses',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'system',
        to: '/system',
        label: 'System Setup',
        icon: <BankOutlined />
      },
      {
        key: 'sponsor',
        to: '/funder',
        label: 'Sponsor View',
        icon: <ProfileOutlined />
      }
    ],

    incubatee: [
      {
        key: 'dashboard',
        to: '/incubatee',
        label: 'My Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'interventions',
        to: '/incubatee/interventions',
        label: 'Tracker',
        icon: <SolutionOutlined />
      },
      {
        key: 'projects',
        to: '/incubatee/projects',
        label: 'Key Metrics',
        icon: <BarChartOutlined />
      },
      {
        key: 'documents',
        to: '/incubatee/documents',
        label: 'Upload Documents',
        icon: <FileDoneOutlined />
      }
    ],

    operations: [
      {
        key: 'dashboard',
        to: '/operations',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'assignments',
        to: '/operations/assignments',
        label: 'Assignments',
        icon: <FileProtectOutlined />
      },
      {
        key: 'interventions',
        to: '/interventions',
        label: 'Interventions Database',
        icon: <FileSearchOutlined />
      },
      {
        key: 'consultants',
        to: '/operations/consultants',
        label: 'Consultants',
        icon: <TeamOutlined />
      },
      {
        key: 'participants',
        to: '/operations/participants',
        label: 'Participants',
        icon: <UserOutlined />
      },
      {
        key: 'compliance',
        to: '/operations/compliance',
        label: 'Compliance',
        icon: <CheckSquareOutlined />
      },
      {
        key: 'resources',
        to: '/operations/resources',
        label: 'Resources',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'applications',
        to: '/applications',
        label: 'Applications',
        icon: <FormOutlined />
      },
      {
        key: 'system',
        to: '/system',
        label: 'System Setup',
        icon: <BankOutlined />
      },
      {
        key: 'reports',
        to: '/operations/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ]
  }

  const menuItems = useMemo(() => {
    if (!role) return []
    return [
      ...(allMenus[role] || []).map(({ key, to, label, icon }) => ({
        key,
        icon,
        label: <Link to={to}>{label}</Link>
      })),
      {
        key: 'chat',
        label: <Link to='/chat'>Chat</Link>,
        icon: <MessageOutlined />
      }
    ]
  }, [role])

  const siderWidth = 220
  const headerHeight = 64

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

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Sider */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={value => setCollapsed(value)}
        collapsedWidth={80}
        width={siderWidth}
        trigger={null}
        style={{
          background: '#ffffff',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 100,
          boxShadow: '2px 0 5px rgba(0,0,0,0.06)'
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '18px',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <img
            src='/assets/images/impala.png'
            alt='Lepharo Logo'
            style={{
              maxHeight: '60px',
              width: collapsed ? '40px' : '120px',
              transition: 'width 0.2s ease-in-out',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Menu */}
        <Menu
          theme='light'
          mode='inline'
          items={menuItems}
          style={{ borderRight: 'none' }}
        />

        <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
          <Button block danger onClick={() => logout()}>
            Logout
          </Button>
        </div>
      </Sider>

      {/* Layout */}
      <Layout
        style={{
          marginLeft: collapsed ? 80 : siderWidth,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <Header
          style={{
            background: '#ffffff',
            padding: '0 24px',
            position: 'fixed',
            top: 0,
            left: collapsed ? 80 : siderWidth,
            right: 0,
            height: headerHeight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e0e0e0',
            zIndex: 90,
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <Button
            type='text'
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '18px',
              width: 48,
              height: 48
            }}
          />
          <Title level={4} style={{ margin: 0, flex: 1, textAlign: 'center' }}>
            {getDashboardTitle(role)}
          </Title>
          <CurrentUser />
        </Header>

        <Content
          style={{
            marginTop: headerHeight,
            overflowY: 'auto',
            height: `calc(100vh - ${headerHeight}px)`,
            background: '#f5f5f5'
          }}
        >
          <div
            style={{
              padding: 15,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              minHeight: 360
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
