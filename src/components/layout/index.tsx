import React, { useEffect, useMemo, useState } from 'react'
import { Layout, Menu, Typography, Spin, Button, Drawer } from 'antd'
import { useGetIdentity, useLogout } from '@refinedev/core'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { Link, Outlet } from 'react-router-dom'
import { CurrentUser } from '@/components/layout/current-user'
import { useWindowSize } from 'react-use'
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
  CheckSquareOutlined,
  FileProtectOutlined,
  PlusCircleOutlined,
  ProjectOutlined,
  FormOutlined,
  LaptopOutlined,
  TeamOutlined,
  FileDoneOutlined,
  MessageOutlined,
  BankOutlined,
  UserOutlined,
  CalendarOutlined,
  AuditOutlined,
  ProfileOutlined,
  DollarOutlined,
  LineChartOutlined,
  ClockCircleOutlined,
  PhoneOutlined,
  FieldTimeOutlined,
  MoneyCollectOutlined,
  PaperClipOutlined,
  BarsOutlined,
  QuestionCircleOutlined,
  BoxPlotOutlined,
  HeatMapOutlined,
  DoubleRightOutlined,
  DatabaseOutlined,
  SendOutlined,
  GroupOutlined,
  BlockOutlined,
  DotChartOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  LogoutOutlined,
  BulbOutlined
} from '@ant-design/icons'
import { Upload, message } from 'antd'
import {} from '@ant-design/icons'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const { Header, Sider, Content } = Layout
const { Title } = Typography

type UserRole =
  | 'admin'
  | 'funder'
  | 'consultant'
  | 'incubatee'
  | 'participant'
  | 'operations'
  | 'projectmanager'
  | 'director'
  | 'projectadmin'
  | 'investor'
  | 'government'
  | 'receptionist'

export const CustomLayout: React.FC = () => {
  const [logoUploading, setLogoUploading] = useState(false)
  const storage = getStorage()
  const { width } = useWindowSize()
  const isMobile = width < 768
  const { data: identity } = useGetIdentity()
  const { mutate: logout } = useLogout()
  const [role, setRole] = useState<UserRole | null>(null)
  const [department, setDepartment] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [drawerVisible, setDrawerVisible] = useState(false)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!identity?.id) return
      const docRef = doc(db, 'users', String(identity.id))
      const userSnap = await getDoc(docRef)
      if (userSnap.exists()) {
        const userData = userSnap.data()
        const cleanRole = userData.role?.toLowerCase()?.replace(/\s+/g, '')
        setRole(cleanRole)
        setDepartment(userData.departmentName || null) // <-- add this line
      }
    }
    fetchUserRole()
  }, [identity])

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (!identity?.id) return

      const userRef = doc(db, 'users', String(identity.id))
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) return

      const userData = userSnap.data()
      const cleanRole = userData.role?.toLowerCase()?.replace(/\s+/g, '')
      setRole(cleanRole)

      // If participant, fetch participant-specific logo
      if (cleanRole === 'incubatee' && userData.participantId) {
        const participantRef = doc(db, 'participants', userData.participantId)
        const participantSnap = await getDoc(participantRef)
        if (participantSnap.exists()) {
          const participantData = participantSnap.data()
          setLogoUrl(participantData.logoUrl || null)
        }
      }
    }

    fetchUserDetails()
  }, [identity])

  const getDashboardTitle = (role: UserRole | null) => {
    if (!role) return ''
    const nameMap = {
      projectadmin: 'Center Coordinator',
      projectmanager: 'Project Manager',
      funder: 'Sponsor',
      consultant: 'Consultant',
      operations: 'Operations',
      auxiliary: 'Auxiliary',
      admin: 'Admin',
      director: 'CEO',
      incubatee: 'Incubatee',
      investor: 'Investor',
      government: 'Government',
      receptionist: 'Receptionist'
    }

    return `${nameMap[role] || role} Dashboard`
  }

  const lepharoDepartments = [
    'ROM (Recruitment, Onboarding and Maintenance)',
    'HSE (Health, Safety & Environment) and Labour Compliance',
    'IHF (InHouse Finance)',
    'M&E (Monitoring and Evaluation',
    'Financial Compliance',
    'PDS (Personal Development Services)',
    'Legal Advisory Services',
    'Wellness Services',
    'Training Academy',
    'Marketing and Communication',
    'Market Linkages'
  ]

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
    investor: [
      {
        key: 'dashboard',
        to: '/investor',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'opportunities',
        to: '/investor/opportunities',
        label: 'Opportunities',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'portfolio',
        to: '/investor/portfolio',
        label: 'Portfolio',
        icon: <ProfileOutlined />
      },
      {
        key: 'due-diligence',
        to: '/investor/due-diligence',
        label: 'Due Diligence',
        icon: <AuditOutlined />
      },
      {
        key: 'analytics',
        to: '/investor/analytics',
        label: 'Analytics',
        icon: <BarChartOutlined />
      },
      {
        key: 'documents',
        to: '/investor/documents',
        label: 'Documents',
        icon: <FileTextOutlined />
      },
      {
        key: 'calendar',
        to: '/investor/calendar',
        label: 'Calendar',
        icon: <CalendarOutlined />
      }
    ],
    government: [
      {
        key: 'dashboard',
        to: '/government',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'analytics',
        to: '/government/analytics',
        label: 'Analytics',
        icon: <BarChartOutlined />
      },
      {
        key: 'participants',
        to: '/government/participants',
        label: 'Participants',
        icon: <TeamOutlined />
      },
      {
        key: 'programs',
        to: '/government/programs',
        label: 'Programs',
        icon: <ProjectOutlined />
      },
      {
        key: 'reports',
        to: '/government/reports',
        label: 'Reports',
        icon: <ReadOutlined />
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
        key: 'programs',
        to: '/programs',
        label: 'Programs Onboarding',
        icon: <LaptopOutlined />
      },
      {
        key: 'applications',
        to: '/applications',
        label: 'Applications',
        icon: <FormOutlined />
      },
      {
        key: 'interventions',
        icon: <FileSearchOutlined />,
        label: 'Interventions',
        children: [
          {
            key: 'interventions-db',
            label: <Link to='/interventions'>Database</Link>,
            icon: <DatabaseOutlined />
          },
          {
            key: 'interventions-movs',
            label: <Link to='/projectadmin/movs/approvals'>MOVs</Link>,
            icon: <PaperClipOutlined />
          }
        ]
      },
      {
        key: 'inquiries',
        label: 'Inquiries',
        icon: <QuestionCircleOutlined />,
        children: [
          {
            key: 'inquiries-db',
            label: <Link to='/receptionist/inquiries'>All</Link>,
            icon: <DatabaseOutlined />
          },

          {
            key: 'inquiries-followups',
            label: <Link to='/projectadmin/follow-ups'>Follow Ups</Link>,
            icon: <ClockCircleOutlined />
          }
        ]
      },
      {
        key: 'user-management',
        to: '/admin',
        label: 'User Management',
        icon: <UserOutlined />
      },
      {
        key: 'resources',
        icon: <ProjectOutlined />,
        label: 'Resources',
        children: [
          {
            key: 'resources-db',
            label: <Link to='/resources'>Resources Database</Link>
          },
          {
            key: 'resources-req',
            label: <Link to='/resources/requests'>Incubatee Requests</Link>
          },
          {
            key: 'resources-internal',
            label: <Link to='/resources/internal'>Internal Requests</Link>
          },
          {
            key: 'resources-all',
            label: (
              <Link to='/resources/allocations'>Resources Allocations</Link>
            )
          }
        ]
      },

      {
        key: 'reports',
        to: '/projectadmin/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ],
    projectmanager: [
      {
        key: 'dashboard',
        to: '/projectmanager',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'resources',
        icon: <ProjectOutlined />,
        label: 'Resources',
        children: [
          {
            key: 'resources-db',
            label: <Link to='/resources'>Resources Database</Link>
          },
          {
            key: 'resources-internal',
            label: (
              <Link to='/projectmanager/inhouse/requests'>
                Internal Requests
              </Link>
            )
          }
        ]
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
        key: 'finances',
        to: '/consultant/interventions/finance',
        label: 'Financial Portal',
        icon: <DollarOutlined />
      },
      {
        key: 'linkages',
        to: '/consultant/interventions/linkages',
        label: 'Linkages Portal',
        icon: <LinkOutlined />
      },
      {
        key: 'appointments',
        to: '/consultant/appointments',
        label: 'Appointments',
        icon: <ClockCircleOutlined />
      },
      {
        key: 'allocated',
        label: 'Interventions',
        icon: <FileProtectOutlined />,
        children: [
          {
            key: 'allocated-active',
            label: 'Active',
            to: '/consultant/allocated'
          },
          {
            key: 'allocated-history',
            label: 'History',
            to: '/consultant/allocated/history'
          }
        ]
      },
      {
        key: 'queries',
        to: '/consultant/queries',
        label: 'Queries',
        icon: <QuestionCircleOutlined />
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
        icon: <LineChartOutlined />
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
        key: 'user-management',
        to: '/admin',
        label: 'User Management',
        icon: <UserOutlined />
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
      },
      {
        key: 'expenses',
        to: '/expenses',
        label: 'Project Expenses',
        icon: <FundProjectionScreenOutlined />
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
        key: 'tracker',
        icon: <FileSearchOutlined />,
        label: 'Tracker',
        children: [
          {
            key: 'interventions-tracker',
            label: <Link to='/incubatee/interventions'>Interventions</Link>,
            icon: <BarsOutlined />
          },
          {
            key: 'appointments-tracker',
            label: <Link to='/incubatee/appointments'>Appointments</Link>,
            icon: <ClockCircleOutlined />
          },
          {
            key: 'metrics-tracker',
            label: <Link to='/incubatee/metrics'>Metrics</Link>,
            icon: <BarChartOutlined />
          },
          {
            key: 'inquiries-tracker',
            label: <Link to='/incubatee/inquiries'>Inquiries</Link>,
            icon: <QuestionCircleOutlined />
          },
          {
            key: 'resources-tracker',
            label: <Link to='/incubatee/resources'>Resources</Link>,
            icon: <BoxPlotOutlined />
          }
        ]
      },
      {
        key: 'roadmap',
        to: '/incubatee/roadmap',
        label: 'Roadmap',
        icon: <HeatMapOutlined />
      },

      {
        key: 'documents',
        label: 'Engagement Portal',
        icon: <FileDoneOutlined />,
        children: [
          {
            key: 'documents-hub',
            label: <Link to='/incubatee/documents/hub'>System</Link>,
            icon: <BarsOutlined />
          },
          {
            key: 'compliance-tracker',
            label: <Link to='/incubatee/documents/compliance'>Compliance</Link>,
            icon: <ClockCircleOutlined />
          }
        ]
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
        key: 'user-management',
        to: '/admin',
        label: 'User Management',
        icon: <UserOutlined />
      },
      {
        key: 'requested',
        to: '/operations/inhouse/requested',
        label: 'Requests',
        icon: <FileDoneOutlined />
      },
      {
        key: 'verification',
        to: '/operations/inhouse/verification',
        label: 'Verification',
        icon: <FileDoneOutlined />
      },
      {
        key: 'invoices',
        to: '/operations/inhouse/invoices',
        label: 'Invoices & Processing',
        icon: <FileTextOutlined />
      },
      {
        key: 'payments',
        to: '/operations/inhouse/payments',
        label: 'Payments Tracker',
        icon: <DollarOutlined />
      },
      {
        key: 'reported',
        to: '/operations/inhouse/reported',
        label: 'Reports & Analytics',
        icon: <BarChartOutlined />
      },
      {
        key: 'analytics',
        to: '/operations/monitoring',
        label: 'M & E Monitoring',
        icon: <PieChartOutlined />
      },
      {
        key: 'linkages',
        to: '/consultant/interventions/linkages',
        label: 'Linkages Portal',
        icon: <LinkOutlined />
      },
      {
        key: 'wellness-portal',
        label: 'Wellness Portal',
        icon: <LinkOutlined />,
        children: [
          {
            key: 'interventions',
            to: '/consultant/interventions/wellness',
            label: 'Intervention Portal',
            icon: <PaperClipOutlined />
          },
          {
            key: 'forms',
            to: '/operations/forms',
            label: 'Forms Portal',
            icon: <LinkOutlined />
          }
        ]
      },
      {
        key: 'pds-portal',
        label: 'Psychometric Portal',
        icon: <ThunderboltOutlined />,
        children: [
          {
            key: 'interventions',
            to: '/consultant/interventions/pds',
            label: 'Intervention Portal',
            icon: <PaperClipOutlined />
          },
          {
            key: 'forms',
            to: '/operations/forms',
            label: 'Forms Portal',
            icon: <LinkOutlined />
          }
        ]
      },
      {
        key: 'impact',
        to: '/operations/impact',
        label: 'Impact Analytics',
        icon: <FundProjectionScreenOutlined />
      },
      {
        key: 'diagnostic',
        to: '/operations/plan',
        label: 'Diagnostic Plan',
        icon: <AuditOutlined />,
        children: [
          {
            key: 'plan',
            to: '/operations/plan',
            label: 'Plan Builder',
            icon: <BlockOutlined />
          },
          {
            key: 'gap',
            to: '/operations/gap',
            label: 'GAP Analytics',
            icon: <DotChartOutlined />
          }
        ]
      },
      {
        key: 'training-portal',
        label: 'Training Portal',
        icon: <FormOutlined />,
        children: [
          {
            key: 'forms',
            to: '/operations/forms',
            label: 'Forms Portal',
            icon: <LinkOutlined />
          },
          {
            key: 'registration',
            to: '/operations/training/register',
            label: 'Registration',
            icon: <FormOutlined />
          },
          {
            key: 'completion',
            to: '/operations/training/completion',
            label: 'Module Tracker',
            icon: <ClockCircleOutlined />
          }
        ]
      },
      {
        key: 'marketing-portal',
        label: 'Marketing Portal',
        icon: <FormOutlined />,
        children: [
          {
            key: 'forms',
            to: '/operations/forms',
            label: 'Forms Portal',
            icon: <LinkOutlined />
          }
        ]
      },
      {
        key: 'finance',
        to: '/operations/finance',
        label: 'Finance',
        icon: <MoneyCollectOutlined />
      },

      {
        key: 'requests',
        to: '/operations/requests',
        label: 'Requests',
        icon: <PhoneOutlined />
      },
      {
        key: 'programs',
        to: '/programs',
        label: 'Programs Onboarding',
        icon: <LaptopOutlined />
      },
      {
        key: 'interventions',
        icon: <FileSearchOutlined />,
        label: 'Interventions',
        children: [
          {
            key: 'interventions-db',
            label: <Link to='/interventions'>Database</Link>,
            icon: <DatabaseOutlined />
          },
          {
            key: 'movs',
            to: '/projectadmin/movs',
            label: 'Verification (MOVs)',
            icon: <PaperClipOutlined />
          },
          {
            key: 'interventions-req',
            label: <Link to='/operations/requests'>Requests</Link>,
            icon: <SendOutlined />
          },
          {
            key: 'interventions-manager',
            label: <Link to='/operations/interventions'>Setup</Link>,
            icon: <GroupOutlined />
          }
        ]
      },
      {
        key: 'monitoring-interventions',
        icon: <FileSearchOutlined />,
        label: 'Interventions',
        children: [
          {
            key: 'interventions-db',
            label: <Link to='/interventions'>Database</Link>,
            icon: <DatabaseOutlined />
          },
          {
            key: 'movs',
            to: '/operations/monitoring/movs',
            label: 'MOVs Verification ',
            icon: <PaperClipOutlined />
          },
          {
            key: 'interventions-req',
            label: <Link to='/operations/requests'>Requests</Link>,
            icon: <SendOutlined />
          },
          {
            key: 'interventions-manager',
            label: <Link to='/operations/interventions'>Setup</Link>,
            icon: <GroupOutlined />
          }
        ]
      },
      {
        key: 'consultants',
        to: '/operations/consultants',
        label: 'Consultants',
        icon: <TeamOutlined />,
        children: [
          {
            key: 'consultants-db',
            to: '/operations/consultants',
            label: 'Manage',
            icon: <DatabaseOutlined />
          },
          {
            key: 'assignments',
            to: '/operations/assignments',
            label: 'Assignments',
            icon: <FileProtectOutlined />
          }
        ]
      },
      {
        key: 'personell',
        label: 'Personell',
        icon: <TeamOutlined />,
        children: [
          {
            key: 'personell',
            label: 'Personell',
            to: '/operations/consultants',
            icon: <TeamOutlined />
          },
          {
            key: 'hr-leave',
            to: '/operations/hr/leave',
            label: 'Leave Management',
            icon: <BulbOutlined />
          }
        ]
      },

      {
        key: 'participants',
        to: '/operations/participants',
        label: 'Participants',
        icon: <UserOutlined />
      },
      {
        key: 'monitoring-participants',
        label: 'Participants',
        icon: <UserOutlined />,
        children: [
          {
            key: 'monitoring-participants',
            to: '/operations/participants',
            label: 'Participants',
            icon: <DatabaseOutlined />
          },
          {
            key: 'groups',
            to: '/operations/groupHistory',
            label: 'Group Movemement',
            icon: <FieldTimeOutlined />
          },
          {
            key: 'compliance',
            to: '/operations/compliance',
            label: 'Compliance',
            icon: <CheckSquareOutlined />
          }
        ]
      },

      {
        key: 'compliance',
        to: '/operations/compliance',
        label: 'Compliance',
        icon: <CheckSquareOutlined />
      },
      {
        key: 'hse-compliance',
        to: '/consultant/interventions/hse',
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
        key: 'kpis',
        icon: <BankOutlined />,
        label: 'KPIs',
        children: [
          {
            key: 'kpis-tracker',
            label: <Link to='/operations/kpis/KPITrackerView'>Tracker</Link>
          },
          {
            key: 'kpis-setup',
            label: <Link to='/operations/kpis/KPIManager'>Setup</Link>
          }
        ]
      },
      {
        key: 'reports',
        to: '/operations/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ],

    receptionist: [
      {
        key: 'dashboard',
        to: '/receptionist',
        label: 'Dashboard',
        icon: <DashboardOutlined />
      },
      {
        key: 'inquiries',
        to: '/receptionist/inquiries',
        label: 'All Inquiries',
        icon: <FileTextOutlined />
      },
      {
        key: 'new-inquiry',
        to: '/receptionist/inquiries/new',
        label: 'New Inquiry',
        icon: <PlusCircleOutlined />
      },
      {
        key: 'contacts',
        to: '/receptionist/contacts',
        label: 'Contacts',
        icon: <UserOutlined />
      },
      {
        key: 'follow-ups',
        to: '/receptionist/follow-ups',
        label: 'Follow-ups',
        icon: <ClockCircleOutlined />
      },
      {
        key: 'reports',
        to: '/receptionist/reports',
        label: 'Reports',
        icon: <ReadOutlined />
      }
    ],
    auxiliary: [
      {
        key: 'timesheet',
        to: '/auxiliary',
        label: 'Timesheet',
        icon: <ClockCircleOutlined />
      },
      {
        key: 'leave',
        to: '/auxiliary/leave',
        label: 'Leave Management',
        icon: <DoubleRightOutlined />
      }
    ]
  }

  let baseMenus = allMenus[role] || []

  const renderMenu = (items: any[]): any[] =>
    items.map((item: any) => {
      if (item.children) {
        return {
          key: item.key,
          icon: item.icon,
          label: item.label,
          children: renderMenu(item.children)
        }
      }

      return {
        key: item.key,
        icon: item.icon,
        label: <Link to={item.to}>{item.label}</Link>
      }
    })

  const menuItems = useMemo(() => {
    if (!role) return []

    let baseMenus = allMenus[role] || []

    // Department-based menu logic for Operations role
    if (role === 'operations' && department) {
      // Example logic - customize as you see fit for each department

      if (department === 'Financial Compliance') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'consultants',
            'finance',
            'diagnostic',
            'assignments',
            'interventions',
            'participants',
            'compliance',
            'resources',
            'reports'
          ].includes(m.key)
        )
      } else if (department.startsWith('HSE')) {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'consultants',
            'assignments',
            'diagnostic',
            'movs',
            'hse-compliance',
            'interventions',
            'kpis',
            'reports'
          ].includes(m.key)
        )
      } else if (department.startsWith('M&E')) {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'personell',
            'assignments',
            'kpis',
            'movs',
            'monitoring-participants',
            'monitoring-interventions',
            'resources',
            'reports'
          ].includes(m.key)
        )
      } else if (department.startsWith('IHF')) {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'verification',
            'requested',
            'user-management',
            'payments',
            'invoices',
            'reported'
          ].includes(m.key)
        )
      } else if (department === 'Market Linkages') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'consultants',
            'diagnostic',
            'linkages',
            'interventions',
            'participants',
            'reports'
          ].includes(m.key)
        )
      } else if (department === 'PDS (Personal Development Services)') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'diagnostic',
            'pds-portal',
            'assignments',
            'reports'
          ].includes(m.key)
        )
      } else if (department === 'Training Academy') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'interventions',
            'diagnostic',
            'training-portal',
            'reports'
          ].includes(m.key)
        )
      } else if (department === 'Legal Advisory Services') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'diagnostic',
            'assignments',
            'interventions',
            'consultants',
            'reports'
          ].includes(m.key)
        )
      } else if (department === 'Wellness Services') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'assignments',
            'diagnostic',
            'wellness-portal',
            'interventions',
            'consultants',
            'reports'
          ].includes(m.key)
        )
      } else if (department === 'Marketing and Communication') {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'consultants',
            'interventions',
            'diagnostic',
            'assignments',
            'resources',
            'reports'
          ].includes(m.key)
        )
      } else if (department.startsWith('ROM')) {
        baseMenus = baseMenus.filter(m =>
          [
            'dashboard',
            'programs',
            'assignments',
            'diagnostic',
            'interventions',
            'applications',
            'kpis',
            'participants',
            'reports'
          ].includes(m.key)
        )
      }
    }

    // Always add chat
    return [
      ...renderMenu(baseMenus),
      {
        key: 'chat',
        label: <Link to='/chat'>Chat</Link>,
        icon: <MessageOutlined />
      }
    ]
  }, [role, department])

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
  const renderDesktopSider = () => (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
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
      <div
        style={{
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        <img
          src='/assets/images/lepharo.png'
          alt='Logo'
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            height: 'auto',
            width: collapsed ? '40px' : '120px',
            transition: 'width 0.2s ease-in-out',
            objectFit: 'contain'
          }}
        />
      </div>

      <Menu
        theme='light'
        mode='inline'
        items={menuItems}
        style={{ borderRight: 'none' }}
      />

      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button block danger onClick={() => logout()}>
          {collapsed ? <LogoutOutlined /> : 'Logout'}
        </Button>
      </div>
    </Sider>
  )

  const renderMobileDrawer = () => (
    <Drawer
      placement='left'
      closable={false}
      onClose={() => setDrawerVisible(false)}
      open={drawerVisible}
      width={250}
      bodyStyle={{ padding: 0 }}
    >
      <div
        style={{
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px',
          borderBottom: '1px solid #f0f0f0'
        }}
      >
        <img
          src='/assets/images/lepharo.png'
          alt='Logo'
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            height: 'auto',
            width: '120px',
            objectFit: 'contain'
          }}
        />
      </div>

      <Menu
        theme='light'
        mode='inline'
        items={menuItems}
        style={{ borderRight: 'none' }}
        onClick={() => setDrawerVisible(false)}
      />

      <div style={{ padding: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button block danger onClick={() => logout()}>
          Logout
        </Button>
      </div>
    </Drawer>
  )

  return (
    <Layout style={{ height: '100vh' }}>
      {/* Desktop Sider */}
      {!isMobile && renderDesktopSider()}

      {/* Mobile Drawer */}
      {isMobile && renderMobileDrawer()}
      {/* Layout */}
      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : siderWidth,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <Header
          style={{
            background: '#ffffff',
            padding: isMobile ? '0 16px' : '0 24px',
            height: headerHeight,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid #e0e0e0',
            position: 'sticky',
            top: 0,
            zIndex: 90
          }}
        >
          <Button
            type='text'
            icon={
              isMobile ? (
                <MenuUnfoldOutlined />
              ) : collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            onClick={() =>
              isMobile ? setDrawerVisible(true) : setCollapsed(!collapsed)
            }
            style={{
              fontSize: '18px',
              width: 48,
              height: 48
            }}
          />

          <Title
            level={4}
            style={{
              margin: 0,
              flex: 1,
              textAlign: 'center',
              fontSize: isMobile ? '16px' : '18px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {getDashboardTitle(role)}
          </Title>

          <CurrentUser />
        </Header>

        <Content
          style={{
            background: '#f5f5f5',
            minHeight: `calc(100vh - ${headerHeight}px)`
          }}
        >
          <div
            style={{
              background: '#fff',

              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              minHeight: `calc(100vh - ${
                headerHeight + (isMobile ? 32 : 48)
              }px)`
            }}
          >
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
