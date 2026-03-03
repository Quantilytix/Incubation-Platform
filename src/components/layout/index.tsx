// src/components/layout/CustomLayout.tsx
import React, { useEffect, useMemo, useState } from 'react'
import { Layout, Menu, Button, Drawer, Input, Tooltip, Select, Tag } from 'antd'
import { useLogout } from '@refinedev/core'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db, auth } from '@/firebase'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { CurrentUser } from '@/components/layout/current-user'
import {
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
    CalendarOutlined,
    AuditOutlined,
    ProfileOutlined,
    LineChartOutlined,
    ClockCircleOutlined,
    BookOutlined,
    DatabaseOutlined,
    OneToOneOutlined,
    LogoutOutlined,
    EyeOutlined,
    MenuOutlined,
    SearchOutlined,
    LeftOutlined,
    RightOutlined,
    DiffOutlined,
    MailOutlined,
    LinkOutlined,
    SettingOutlined
} from '@ant-design/icons'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { useWindowSize } from 'react-use'
import { LoadingOverlay } from '../shared/LoadingOverlay'
import { useSystemSettings } from '@/contexts/SystemSettingsContext'
import UniversalSearchModal from '../shared/UniversalSearchModal'
import { useActiveProgramId } from '@/lib/useActiveProgramId'
import { CompanyLogo } from '../CompanyLogo'

const { Header, Content } = Layout

type UserRole =
    | 'admin'
    | 'funder'
    | 'consultant'
    | 'incubatee'
    | 'operations'
    | 'director'
    | 'projectadmin'
    | 'investor'
    | 'government'

type AssignmentModel = 'ops_assign_consultant' | 'consultant_self_assign'
type SmeDivisionModel =
    | 'system_equal_random'
    | 'ops_assign_smes_to_consultants'
    | 'consultants_register_their_smes'

type Program = {
    id: string
    name?: string
    title?: string
    programName?: string
    companyCode?: string
    [k: string]: any
}

const isPathMatch = (base: string, path: string) =>
    path === base || path.startsWith(base + '/')

const findSelectedKeyDeep = (items: any[], pathname: string): string | undefined => {
    let bestKey: string | undefined
    let bestLen = -1
    const walk = (arr: any[]) => {
        for (const it of arr) {
            if (it.children) walk(it.children)
            if (it.to && isPathMatch(it.to, pathname)) {
                const len = it.to.length
                if (len > bestLen) {
                    bestLen = len
                    bestKey = it.key
                }
            }
        }
    }
    walk(items)
    return bestKey
}

const pluralize = (s: string) => {
    const v = String(s || '').trim()
    if (!v) return 'Consultants'
    if (v.toLowerCase().endsWith('s')) return v
    return `${v}s`
}

const generateMenu = (items: any[], transformLabel?: (s: string) => string) =>
    items.map(({ key, label, to, icon, children }) => {
        const finalLabel =
            typeof label === 'string' && transformLabel ? transformLabel(label) : label

        if (children) {
            return {
                key,
                icon,
                label: finalLabel,
                children: generateMenu(children, transformLabel)
            }
        }

        return { key, icon, label: <Link to={to}>{finalLabel}</Link> }
    })

export const CustomLayout: React.FC = () => {
    const { user, loading: identityLoading } = useFullIdentity()
    const { getSetting } = useSystemSettings()
    const { mutate: logout } = useLogout()
    const { width } = useWindowSize()

    const MOBILE_BREAKPOINT = 1024
    const isMobile = width < MOBILE_BREAKPOINT
    const isTiny = width < 480

    const location = useLocation()

    const [role, setRole] = useState<UserRole | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(false)
    const [collapsed, setCollapsed] = useState(false)
    const [searchValue, setSearchValue] = useState('')

    const [universalOpen, setUniversalOpen] = useState(false)
    const [universalInitial, setUniversalInitial] = useState('')

    const [programs, setPrograms] = useState<Program[]>([])
    const [programLoading, setProgramLoading] = useState(false)

    // Hook (global program filter) — keep as-is
    const activeProgramId = useActiveProgramId()

    // ---- Settings: prefer context, but FALL BACK to doc(db,'systemSettings', companyCode)
    const [settingsOverride, setSettingsOverride] = useState<{
        consultantLabel?: string
        assignmentModel?: AssignmentModel
        smeDivisionModel?: SmeDivisionModel
    }>({})

    useEffect(() => {
        if (!user?.companyCode) return

        const run = async () => {
            try {
                const snap = await getDoc(doc(db, 'systemSettings', String(user.companyCode)))
                if (!snap.exists()) return
                const data = snap.data() as any

                // allow both direct fields and a "settings" map
                const source = data?.settings && typeof data.settings === 'object' ? data.settings : data

                const consultantLabel = source?.consultantLabel
                const assignmentModel = source?.assignmentModel
                const smeDivisionModel = source?.smeDivisionModel

                setSettingsOverride({
                    consultantLabel: typeof consultantLabel === 'string' ? consultantLabel : undefined,
                    assignmentModel: assignmentModel as any,
                    smeDivisionModel: smeDivisionModel as any
                })
            } catch {
                // silent fallback
            }
        }

        run()
    }, [user?.companyCode])

    const assignmentModel = useMemo(() => {
        const ctxVal = getSetting<AssignmentModel>('assignmentModel', undefined)
        const chosen = (ctxVal ?? settingsOverride.assignmentModel ?? 'ops_assign_consultant') as AssignmentModel
        return String(chosen) as AssignmentModel
    }, [getSetting, settingsOverride.assignmentModel])

    const smeDivisionModel = useMemo(() => {
        const ctxVal = getSetting<SmeDivisionModel | undefined>('smeDivisionModel', undefined)
        const chosen = (ctxVal ?? settingsOverride.smeDivisionModel ?? '') as any
        return String(chosen || '') as SmeDivisionModel | ''
    }, [getSetting, settingsOverride.smeDivisionModel])

    const consultantLabelSingular = useMemo(() => {
        const ctxVal = getSetting<string>('consultantLabel', undefined)
        const chosen = (ctxVal ?? settingsOverride.consultantLabel ?? 'Consultant') as string
        return String(chosen || 'Consultant')
    }, [getSetting, settingsOverride.consultantLabel])

    const consultantLabelPlural = useMemo(
        () => pluralize(consultantLabelSingular),
        [consultantLabelSingular]
    )

    const replaceConsultantText = useMemo(() => {
        return (s: string) =>
            String(s || '')
                .replace(/\bConsultants\b/g, consultantLabelPlural)
                .replace(/\bConsultant\b/g, consultantLabelSingular)
    }, [consultantLabelPlural, consultantLabelSingular])

    useEffect(() => {
        if (isMobile) setCollapsed(false)
    }, [isMobile])

    const openUniversal = (q?: string) => {
        const v = String(q ?? searchValue ?? '').trim()
        setUniversalInitial(v)
        setUniversalOpen(true)
    }

    const setActiveProgram = (programId?: string) => {
        if (typeof window === 'undefined') return
            ; (window as any).__ACTIVE_PROGRAM_ID__ = programId
        window.dispatchEvent(
            new CustomEvent('program-filter-changed', { detail: { programId } })
        )
    }

    // Fetch programs scoped to company
    useEffect(() => {
        const run = async () => {
            if (!user?.companyCode) {
                setPrograms([])
                return
            }

            setProgramLoading(true)
            try {
                const qx = query(
                    collection(db, 'programs'),
                    where('companyCode', '==', user.companyCode)
                )
                const snap = await getDocs(qx)
                const next = snap.docs.map(
                    d => ({ id: d.id, ...(d.data() as any) } as Program)
                )
                next.sort((a, b) => {
                    const an = String(a.name || a.title || a.programName || '').toLowerCase()
                    const bn = String(b.name || b.title || b.programName || '').toLowerCase()
                    return an.localeCompare(bn)
                })
                setPrograms(next)
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('CustomLayout: programs fetch failed', e)
                setPrograms([])
            } finally {
                setProgramLoading(false)
            }
        }

        run()
    }, [user?.companyCode])

    // Role resolution
    useEffect(() => {
        const run = async () => {
            if (identityLoading) return

            const uid = String(
                user?.id || (user as any)?.uid || auth.currentUser?.uid || ''
            )
            if (!uid) {
                setRole(null)
                return
            }

            const roleFromHook = String((user as any)?.role || '')
                .toLowerCase()
                .replace(/\s+/g, '')
            if (roleFromHook) {
                setRole(roleFromHook as any)
                return
            }

            try {
                const snap = await getDoc(doc(db, 'users', uid))
                if (!snap.exists()) {
                    setRole(null)
                    return
                }
                const cleanRole = String(snap.data()?.role || '')
                    .toLowerCase()
                    .replace(/\s+/g, '')
                setRole(cleanRole as any)
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('CustomLayout: role fetch failed', e)
                setRole(null)
            }
        }

        run()
    }, [identityLoading, user])

    const allMenus = useMemo(() => {
        const consultantAssignmentsLabel =
            assignmentModel === 'consultant_self_assign' ? 'Assignments' : 'Active'

        const base = {
            admin: [
                { key: 'dashboard', to: '/admin', label: 'Dashboard', icon: <DashboardOutlined /> },
                { key: 'monitoring', to: '/admin/collections', label: 'Monitoring', icon: <BarChartOutlined /> },
                { key: 'users', to: '/admin/users', label: 'User Management', icon: <TeamOutlined /> },
                { key: 'email', to: '/admin/email', label: 'Mail System', icon: <MailOutlined /> }
            ],
            investor: [
                { key: 'dashboard', to: '/investor', label: 'Dashboard', icon: <DashboardOutlined /> },
                { key: 'opportunities', to: '/investor/opportunities', label: 'Opportunities', icon: <FundProjectionScreenOutlined /> },
                { key: 'portfolio', to: '/investor/portfolio', label: 'Portfolio', icon: <ProfileOutlined /> },
                { key: 'due-diligence', to: '/investor/due-diligence', label: 'Due Diligence', icon: <AuditOutlined /> },
                { key: 'analytics', to: '/investor/analytics', label: 'Analytics', icon: <BarChartOutlined /> },
                { key: 'documents', to: '/investor/documents', label: 'Documents', icon: <FileTextOutlined /> },
                { key: 'calendar', to: '/investor/calendar', label: 'Calendar', icon: <CalendarOutlined /> }
            ],
            government: [
                { key: 'dashboard', to: '/government', label: 'Dashboard', icon: <DashboardOutlined /> },
                { key: 'analytics', to: '/government/analytics', label: 'Analytics', icon: <BarChartOutlined /> },
                { key: 'participants', to: '/government/participants', label: 'Participants', icon: <TeamOutlined /> },
                { key: 'programs', to: '/government/programs', label: 'Programs', icon: <ProjectOutlined /> },
                { key: 'reports', to: '/government/reports', label: 'Reports', icon: <ReadOutlined /> }
            ],
            projectadmin: [
                { key: 'dashboard', to: '/projectadmin', label: 'Dashboard', icon: <DashboardOutlined /> },
                { key: 'applications', to: '/applications', label: 'Applications', icon: <FormOutlined /> },
                { key: 'indicative', to: '/projectadmin/indicative', label: 'Indicative Calendar', icon: <CalendarOutlined /> },
                { key: 'programs', to: '/programs', label: 'Programs Onboarding', icon: <LaptopOutlined /> },
                { key: 'analytics', to: '/projectadmin/monitoring', label: 'M & E Monitoring', icon: <PieChartOutlined /> },
                { key: 'impact', to: '/projectadmin/impact', label: 'Impact Analytics', icon: <FundProjectionScreenOutlined /> },
                { key: 'reports', to: '/projectadmin/reports', label: 'Reports', icon: <ReadOutlined /> }
            ],
            funder: [
                { key: 'dashboard', to: '/funder', label: 'Dashboard', icon: <DashboardOutlined /> },
                { key: 'opportunities', to: '/funder/opportunities', label: 'Opportunities', icon: <PlusCircleOutlined /> },
                { key: 'analytics', to: '/funder/analytics', label: 'Analytics', icon: <BarChartOutlined /> }
            ],
            consultant: [
                { key: 'dashboard', to: '/consultant', label: 'Dashboard', icon: <DashboardOutlined /> },
                {
                    key: 'interventions',
                    label: 'Interventions',
                    icon: <FileProtectOutlined />,
                    children: [
                        { key: 'consultants-assignments', to: '/operations/assignments', label: 'Assignments', icon: <FileProtectOutlined /> },
                        { key: 'allocated-active', label: consultantAssignmentsLabel, to: '/consultant/allocated', icon: <BarChartOutlined /> },
                        { key: 'interventions-appointments', to: '/consultant/appointments', label: 'Appointments', icon: <ClockCircleOutlined /> },
                        { key: 'interventions-calendar', to: '/consultant/indicative', label: 'Indicative Calendar', icon: <CalendarOutlined /> }
                    ]
                },
                {
                    key: 'participants',
                    label: 'Incubatees',
                    icon: <TeamOutlined />,
                    children: [
                        { key: 'participants-db', to: '/operations/participants', label: 'View All', icon: <DatabaseOutlined /> },
                        { key: 'diagnostics', to: '/operations/diagnostics', label: 'Growth Plans', icon: <SolutionOutlined /> },
                        { key: 'applications', to: '/applications', label: 'Applications', icon: <FormOutlined /> },
                        { key: 'compliance', to: '/operations/compliance', label: 'Compliance', icon: <CheckSquareOutlined /> }
                    ]
                },
                { key: 'tasksEvents', to: '/tasksEvents', label: 'Tasks & Events', icon: <BookOutlined /> },
                { key: 'feedback', to: '/consultant/feedback', label: 'Participant Insights', icon: <MessageOutlined /> },
                { key: 'analytics', to: '/consultant/analytics', label: 'Analytics', icon: <LineChartOutlined /> }
            ],
            director: [
                { key: 'dashboard', to: '/director', label: 'Dashboard', icon: <DashboardOutlined /> },
                { key: 'operators', to: '/director/operators', label: 'Operators Onboarding', icon: <UsergroupAddOutlined /> },
                { key: 'programs', to: '/director/programs', label: 'Programs Overview', icon: <LaptopOutlined /> },
                {
                    key: 'portfolio',
                    label: 'Portfolio',
                    icon: <LinkOutlined />,
                    children: [
                        { key: 'overview', label: 'Overview', icon: <DatabaseOutlined />, to: '/director/portfolio' },
                        { key: 'master', label: 'Master View', icon: <DatabaseOutlined />, to: '/shared/incubatees' },
                        { key: 'sectors', label: 'Sector Performance', icon: <PieChartOutlined />, to: '/director/sectors' }
                    ]
                },
                { key: 'company', to: '/director/company', label: 'Company Setup', icon: <BankOutlined /> },
                { key: 'sponsor', to: '/funder', label: 'Sponsor View', icon: <ProfileOutlined /> }
            ],
            incubatee: [
                { key: 'dashboard', to: '/incubatee', label: 'My Dashboard', icon: <DashboardOutlined /> },
                { key: 'forms', to: '/incubatee/forms', label: 'Forms', icon: <SolutionOutlined /> },
                { key: 'diagnostic', to: '/incubatee/diagnostic', label: 'Diagnostic Assessment', icon: <FormOutlined /> },
                { key: 'interventions', to: '/incubatee/interventions', label: 'Tracker', icon: <SearchOutlined /> },
                { key: 'metrics', to: '/incubatee/metrics', label: 'Monthly Metrics', icon: <BarChartOutlined /> },
                { key: 'documents', to: '/incubatee/documents', label: 'Upload Documents', icon: <FileDoneOutlined /> },
                { key: 'profile', to: '/incubatee/profile', label: 'My Profile', icon: <SettingOutlined /> }
            ],
            operations: [
                { key: 'dashboard', to: '/operations', label: 'Dashboard', icon: <DashboardOutlined /> },
                {
                    key: 'surveys',
                    label: 'Surveys',
                    icon: <FormOutlined />,
                    children: [
                        { key: 'surveys-builder', to: '/operations/surveys', label: 'Builder', icon: <SolutionOutlined /> },
                        { key: 'surveys-viewer', to: '/operations/surveys/view', label: 'Viewer', icon: <EyeOutlined /> }
                    ]
                },
                { key: 'impact', to: '/projectadmin/impact', label: 'Impact Analytics', icon: <FundProjectionScreenOutlined /> },
                {
                    key: 'taks',
                    label: 'Tasks',
                    icon: <SolutionOutlined />,
                    to: '/operations/tasks'
                },
                {
                    key: 'users',
                    label: 'System Users',
                    icon: <SolutionOutlined />,
                    to: '/operations/users',
                },
                {
                    key: 'interventions',
                    label: 'Interventions',
                    icon: <FileSearchOutlined />,
                    children: [
                        { key: 'interventions-assignment', to: '/operations/assignments', label: 'Assignments', icon: <FileProtectOutlined /> },
                        { key: 'operations-assignments', to: '/consultant/allocated', label: 'My Assignments', icon: <FileDoneOutlined /> },
                        { key: 'appointments', to: '/shared/appointments', label: 'Appointments', icon: <ClockCircleOutlined /> },
                        { key: 'interventions-db', to: '/interventions', label: 'Database', icon: <FileSearchOutlined /> },
                        { key: 'interventions-calendar', to: '/operations/indicative', label: 'Indicative Calendar', icon: <CalendarOutlined /> }
                    ]
                },
                {
                    key: 'participants',
                    label: 'Incubatees',
                    icon: <TeamOutlined />,
                    children: [
                        { key: 'participants-db', to: '/operations/participants', label: 'View All', icon: <DatabaseOutlined /> },
                        { key: 'diagnostics', to: '/operations/diagnostics', label: 'Growth Plans', icon: <SolutionOutlined /> },
                        { key: 'applications', to: '/applications', label: 'Applications', icon: <FormOutlined /> },
                        { key: 'compliance', to: '/operations/compliance', label: 'Compliance', icon: <CheckSquareOutlined /> },
                        { key: 'success-stories', to: '/operations/success-stories', label: 'Success Stories', icon: <DashboardOutlined /> }
                    ]
                },
                { key: 'programs', to: '/programs', label: 'Programs Onboarding', icon: <LaptopOutlined /> },
                { key: 'resources', to: '/operations/resources', label: 'Resources', icon: <FundProjectionScreenOutlined /> },
                { key: 'lms', label: 'LMS', icon: <DiffOutlined />, to: '/lms/operations/courses' },
                { key: 'system', to: '/system', label: 'System Setup', icon: <BankOutlined /> },
                { key: 'analytics', to: '/operations/reports', label: 'Analytics', icon: <BarChartOutlined /> }
            ]
        } as const

        return base
    }, [assignmentModel])

    const applyLayoutPolicy = (items: any[]) => {
        let next = [...items]

        // Consultant restrictions when ops assigns consultants
        if (role === 'consultant' && assignmentModel === 'ops_assign_consultant') {
            next = next.filter(m => m.key !== 'participants')
            next = next.map(m => {
                if (m.key !== 'interventions') return m
                if (!Array.isArray(m.children)) return m
                return {
                    ...m,
                    children: m.children.filter((c: any) => c.key !== 'consultants-assignments')
                }
            })
        }

        return next
    }

    const roleMenus = useMemo(() => {
        if (!role) return []
        const raw = (allMenus as any)[role] || []
        return applyLayoutPolicy(raw)
    }, [role, allMenus, assignmentModel])

    // IMPORTANT: transformLabel runs through the WHOLE tree (including parent labels like "Consultants")
    const menuItems = useMemo(() => {
        if (!role) return []
        return generateMenu(
            [...roleMenus, { key: 'chat', to: '/chat', label: 'Chat', icon: <MessageOutlined /> }],
            replaceConsultantText
        )
    }, [role, roleMenus, replaceConsultantText])

    const selectedKey = useMemo(() => {
        if (!role) return 'chat'
        return findSelectedKeyDeep(roleMenus, location.pathname) || 'chat'
    }, [role, roleMenus, location.pathname])

    const programOptions = useMemo(() => {
        const opts = programs.map(p => ({
            value: p.id,
            label: String(p.name || p.title || p.programName || 'Untitled Project')
        }))
        return [{ value: '__ALL__', label: 'All Projects' }, ...opts]
    }, [programs])

    const programValue = useMemo(() => {
        return activeProgramId ? activeProgramId : '__ALL__'
    }, [activeProgramId])

    const activeProgramName = useMemo(() => {
        if (!activeProgramId) return ''
        const p = programs.find(x => x.id === activeProgramId)
        return String(p?.name || p?.title || p?.programName || '').trim()
    }, [activeProgramId, programs])

    const headerHeight = 76
    const expandedWidth = 256
    const collapsedWidth = 80
    const sidebarWidth = isMobile ? 0 : collapsed ? collapsedWidth : expandedWidth

    const programControl = useMemo(() => {
        const pillBase: React.CSSProperties = {
            height: 38,
            borderRadius: 9999,
            border: '1px solid dodgerblue',
            boxShadow: '0 6px 16px rgba(0,0,0,0.06)',
            background: '#f0f5ff',
            display: 'flex',
            alignItems: 'center'
        }

        if (role === 'incubatee') {
            const name = activeProgramName || 'My Program'
            return (
                <Tag
                    icon={<ProjectOutlined />}
                    style={{
                        ...pillBase,
                        marginInlineEnd: 0,
                        padding: '0 12px',
                        fontWeight: 650,
                        color: '#1f2937'
                    }}
                >
                    {name}
                </Tag>
            )
        }

        return (
            <Select
                value={programValue}
                loading={programLoading}
                options={programOptions}
                onChange={(v: string) => setActiveProgram(v === '__ALL__' ? undefined : v)}
                suffixIcon={<ProjectOutlined style={{ color: 'dodgerblue' }} />}
                bordered={false}
                dropdownMatchSelectWidth={340}
                style={{
                    ...pillBase,
                    width: isMobile ? '100%' : 260,
                    paddingInline: 6
                }}
            />
        )
    }, [role, programValue, programLoading, programOptions, activeProgramName, isMobile])

    const SidebarMenu = (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                borderRadius: 20,
                padding: 10,
                background: 'rgba(255,255,255,0.92)',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 10px 26px rgba(0,0,0,0.08)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
            }}
        >
            {/* LOGO + COLLAPSE BUTTON (same block) */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'space-between',
                    gap: 10,
                    padding: '6px 6px 10px 6px'
                }}
            >
                <div style={{ flex: 1, minWidth: 0 }}>
                    <CompanyLogo collapsed={collapsed} />
                </div>

                {!isMobile && (
                    <Button
                        size="small"
                        type="text"
                        icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
                        onClick={() => setCollapsed(c => !c)}
                        style={{
                            borderRadius: 9999,
                            flex: '0 0 auto'
                        }}
                    />
                )}
            </div>

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: 4
                }}
            >
                <Menu
                    mode="inline"
                    items={menuItems}
                    selectedKeys={[selectedKey]}
                    inlineCollapsed={!isMobile && collapsed}
                    style={{
                        borderInlineEnd: 'none',
                        background: 'transparent',
                        width: '100%'
                    }}
                    onClick={() => {
                        if (isMobile) setDrawerOpen(false)
                    }}
                />
            </div>

            <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                {!isMobile && collapsed ? (
                    <Tooltip title="Logout" placement="right">
                        <Button
                            block
                            icon={<LogoutOutlined />}
                            onClick={() => logout()}
                            style={{
                                height: 40,
                                borderRadius: 14,
                                border: '1px solid rgba(0,0,0,0.06)',
                                boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                                background: '#fff'
                            }}
                        />
                    </Tooltip>
                ) : (
                    <Button
                        block
                        icon={<LogoutOutlined />}
                        onClick={() => logout()}
                        style={{
                            height: 40,
                            borderRadius: 9999,
                            border: '1px solid rgba(0,0,0,0.06)',
                            boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
                            background: '#fff'
                        }}
                    >
                        Logout
                    </Button>
                )}
            </div>
        </div>
    )

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
                <LoadingOverlay tip="Loading layout..." />
            </div>
        )
    }

    return (
        <Layout style={{ minHeight: '100vh', background: '#f6f8fc' }}>
            {/* Desktop sidebar */}
            {!isMobile && (
                <div
                    style={{
                        position: 'fixed',
                        top: 10,
                        bottom: 10,
                        left: 10,
                        width: collapsed ? collapsedWidth : expandedWidth,
                        transition: 'width 0.2s ease',
                        zIndex: 100
                    }}
                >
                    {SidebarMenu}
                </div>
            )}

            {/* Mobile drawer */}
            <Drawer
                placement="left"
                width={Math.min(320, Math.max(280, Math.floor(width * 0.85)))}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                bodyStyle={{ padding: 12, background: 'transparent' }}
                styles={{ header: { display: 'none' } as any }}
            >
                {SidebarMenu}
            </Drawer>

            {/* Topbar */}
            <Header
                style={{
                    position: 'fixed',
                    top: 0,
                    left: isMobile ? 0 : sidebarWidth + 20,
                    right: 10,
                    height: headerHeight,
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 101
                }}
            >
                <div
                    style={{
                        height: 56,
                        display: 'flex',
                        alignItems: 'center',
                        gap: isTiny ? 8 : 12,
                        padding: isTiny ? '6px 8px' : '8px 12px',
                        borderRadius: 9999,
                        background: 'rgba(255,255,255,0.95)',
                        border: '1px solid rgba(0,0,0,0.06)',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.06)',
                        width: '100%'
                    }}
                >
                    {/* LEFT: hamburger on mobile, current user on desktop */}
                    {isMobile ? (
                        <div
                            role="button"
                            aria-label="Open navigation"
                            onClick={() => setDrawerOpen(true)}
                            style={{
                                display: 'grid',
                                placeItems: 'center',
                                height: 38,
                                width: 38,
                                borderRadius: 9999,
                                cursor: 'pointer',
                                overflow: 'hidden'
                            }}
                        >
                            <MenuOutlined />
                        </div>
                    ) : (
                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
                            <CurrentUser />
                        </div>
                    )}

                    {/* CENTER / RIGHT */}
                    {isMobile ? (
                        <div style={{ flex: 1, minWidth: 0 }}>{programControl}</div>
                    ) : (
                        <>
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                <Input
                                    allowClear
                                    placeholder="Search"
                                    prefix={<SearchOutlined />}
                                    value={searchValue}
                                    onChange={e => setSearchValue(e.target.value)}
                                    onPressEnter={() => {
                                        const q = searchValue.trim()
                                        if (q) openUniversal(q)
                                    }}
                                    style={{
                                        height: 36,
                                        borderRadius: 9999,
                                        width: 'min(520px, 52vw)'
                                    }}
                                />
                            </div>

                            <div
                                style={{
                                    flex: '0 0 auto',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10
                                }}
                            >
                                {programControl}
                            </div>
                        </>
                    )}
                </div>
            </Header>

            <Content
                style={{
                    marginTop: headerHeight,
                    paddingLeft: isMobile ? 12 : sidebarWidth + 20,
                    paddingRight: 12,
                    paddingBottom: 12,
                    transition: 'padding-left 0.2s ease'
                }}
            >
                <div>
                    <Outlet />
                </div>
            </Content>

            <UniversalSearchModal
                open={universalOpen}
                onClose={() => setUniversalOpen(false)}
                companyCode={user?.companyCode}
                activeProgramId={activeProgramId}
                initialQuery={universalInitial}
            />
        </Layout>
    )
}

export default CustomLayout
