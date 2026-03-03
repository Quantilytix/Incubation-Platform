import React, { useEffect, useMemo, useState } from 'react'
import {
    Card,
    Row,
    Col,
    Statistic,
    Typography,
    Divider,
    Tabs,
    Space,
    Tag,
    Button,
    Segmented,
    Progress,
    List,
    Grid,
    Tooltip,
    Empty
} from 'antd'
import {
    UserOutlined,
    TeamOutlined,
    BankOutlined,
    FileTextOutlined,
    ApartmentOutlined,
    SolutionOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    ThunderboltOutlined,
    ReloadOutlined,
    ArrowRightOutlined
} from '@ant-design/icons'
import { collection, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore'
import { db } from '@/firebase'
import { useNavigate } from 'react-router-dom'

// adjust path to yours (you’ve used this before)
import { DashboardHeaderCard } from '@/components/shared/Header'

// modules (you’ll create this wrapper below)
import { AdminUsersModule } from './modules/AdminUsersModule'

const { Title, Text } = Typography
const { TabPane } = Tabs
const { useBreakpoint } = Grid

type AnyDoc = { id: string;[k: string]: any }
type SegmentKey = 'Overview' | 'Data' | 'Governance'

const safeLower = (v: any) => (v ?? '').toString().trim().toLowerCase()

export const AdminDashboard: React.FC = () => {
    const screens = useBreakpoint()
    const navigate = useNavigate()

    const [segment, setSegment] = useState<SegmentKey>('Overview')
    const [activeTab, setActiveTab] = useState('users')

    const [users, setUsers] = useState<AnyDoc[]>([])
    const [applications, setApplications] = useState<AnyDoc[]>([])
    const [participants, setParticipants] = useState<AnyDoc[]>([])
    const [consultants, setConsultants] = useState<AnyDoc[]>([])
    const [interventionsDb, setInterventionsDb] = useState<AnyDoc[]>([])
    const [assignedInterventions, setAssignedInterventions] = useState<AnyDoc[]>([])
    const [events, setEvents] = useState<AnyDoc[]>([])
    const [tasks, setTasks] = useState<AnyDoc[]>([])
    const [resources, setResources] = useState<AnyDoc[]>([])

    const [loading, setLoading] = useState({
        users: true,
        applications: true,
        participants: true,
        consultants: true,
        interventionsDb: true,
        assignedInterventions: true,
        events: true,
        tasks: true,
        resources: true
    })

    const mapSnap = (snap: QuerySnapshot<DocumentData>) =>
        snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))

    useEffect(() => {
        const unsubs: Array<() => void> = []

        unsubs.push(
            onSnapshot(collection(db, 'users'), snap => {
                setUsers(mapSnap(snap))
                setLoading(s => ({ ...s, users: false }))
            })
        )

        unsubs.push(
            onSnapshot(collection(db, 'applications'), snap => {
                setApplications(mapSnap(snap))
                setLoading(s => ({ ...s, applications: false }))
            })
        )

        unsubs.push(
            onSnapshot(collection(db, 'participants'), snap => {
                setParticipants(mapSnap(snap))
                setLoading(s => ({ ...s, participants: false }))
            })
        )

        unsubs.push(
            onSnapshot(collection(db, 'consultants'), snap => {
                setConsultants(mapSnap(snap))
                setLoading(s => ({ ...s, consultants: false }))
            })
        )

        unsubs.push(
            onSnapshot(collection(db, 'interventionsDatabase'), snap => {
                setInterventionsDb(mapSnap(snap))
                setLoading(s => ({ ...s, interventionsDb: false }))
            })
        )

        unsubs.push(
            onSnapshot(collection(db, 'assignedInterventions'), snap => {
                setAssignedInterventions(mapSnap(snap))
                setLoading(s => ({ ...s, assignedInterventions: false }))
            })
        )

        // optional “admin-wide” collections (safe even if empty)
        unsubs.push(
            onSnapshot(collection(db, 'events'), snap => {
                setEvents(mapSnap(snap))
                setLoading(s => ({ ...s, events: false }))
            })
        )
        unsubs.push(
            onSnapshot(collection(db, 'tasks'), snap => {
                setTasks(mapSnap(snap))
                setLoading(s => ({ ...s, tasks: false }))
            })
        )
        unsubs.push(
            onSnapshot(collection(db, 'resources'), snap => {
                setResources(mapSnap(snap))
                setLoading(s => ({ ...s, resources: false }))
            })
        )

        return () => unsubs.forEach(u => u())
    }, [])

    const metrics = useMemo(() => {
        const totalUsers = users.length
        const totalApplications = applications.length
        const totalParticipants = participants.length
        const totalConsultants = consultants.length
        const totalInterventions = interventionsDb.length
        const totalAssigned = assignedInterventions.length

        // Companies (best-effort: collect companyCode from users/applications/participants)
        const companyCodes = new Set<string>()
        const addCompany = (cc: any) => {
            const code = (cc ?? '').toString().trim()
            if (code) companyCodes.add(code)
        }
        users.forEach(u => addCompany(u.companyCode || u.company_code))
        applications.forEach(a => addCompany(a.companyCode || a.company_code))
        participants.forEach(p => addCompany(p.companyCode || p.company_code))
        const totalCompanies = companyCodes.size

        const roleCounts = users.reduce(
            (acc, u) => {
                const r = safeLower(u.role)
                if (!r) return acc
                acc[r] = (acc[r] || 0) + 1
                return acc
            },
            {} as Record<string, number>
        )

        const usersPerCompany = totalCompanies ? totalUsers / totalCompanies : 0
        const participantsPerCompany = totalCompanies ? totalParticipants / totalCompanies : 0
        const consultantsPerCompany = totalCompanies ? totalConsultants / totalCompanies : 0

        const assignmentCoverage = totalInterventions ? (totalAssigned / totalInterventions) * 100 : 0

        // app statuses (best-effort)
        const statusCounts: Record<string, number> = {}
        for (const a of applications) {
            const s = safeLower(a.status || a.applicationStatus || 'unknown')
            statusCounts[s] = (statusCounts[s] || 0) + 1
        }
        const topStatuses = Object.entries(statusCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)

        // recent activity quick list (best-effort on createdAt)
        const recentUsers = [...users]
            .sort((a, b) => {
                const ta = a.createdAt?.seconds || 0
                const tb = b.createdAt?.seconds || 0
                return tb - ta
            })
            .slice(0, 5)

        return {
            totalUsers,
            totalCompanies,
            totalApplications,
            totalParticipants,
            totalConsultants,
            totalInterventions,
            totalAssigned,
            roleCounts,
            usersPerCompany,
            participantsPerCompany,
            consultantsPerCompany,
            assignmentCoverage,
            topStatuses,
            recentUsers,
            totalEvents: events.length,
            totalTasks: tasks.length,
            totalResources: resources.length
        }
    }, [users, applications, participants, consultants, interventionsDb, assignedInterventions, events, tasks, resources])

    const isBusy =
        loading.users ||
        loading.applications ||
        loading.participants ||
        loading.consultants ||
        loading.interventionsDb ||
        loading.assignedInterventions

    const cols = screens.lg ? 6 : screens.md ? 3 : 1

    return (
        <div style={{ padding: 20 }}>
            {/* Header */}
            <DashboardHeaderCard
                title="Admin Dashboard"
                subtitle="Control panel for system-wide oversight, data health, and governance."
                right={
                    <Space wrap>
                        <Segmented
                            value={segment}
                            onChange={v => setSegment(v as SegmentKey)}
                            options={['Overview', 'Data', 'Governance']}
                        />
                        <Tooltip title="Refresh happens in real-time; this just helps you visually re-check.">
                            <Button icon={<ReloadOutlined />} onClick={() => { }} />
                        </Tooltip>
                    </Space>
                }
            />

            {/* Segment content */}
            <div style={{ marginTop: 14 }}>
                {segment === 'Overview' && (
                    <>
                        <Row gutter={[16, 16]}>
                            <Col xs={24} sm={24} md={24} lg={24}>
                                <Card
                                    style={{ borderRadius: 14 }}
                                    bodyStyle={{ padding: 16 }}
                                    title={
                                        <Space>
                                            <ThunderboltOutlined />
                                            <span>System Snapshot</span>
                                            {isBusy && <Tag color="processing">Loading…</Tag>}
                                            {!isBusy && <Tag color="success">Live</Tag>}
                                        </Space>
                                    }
                                    extra={
                                        <Space>
                                            <Button onClick={() => setActiveTab('users')} icon={<UserOutlined />}>
                                                Users
                                            </Button>
                                            <Button
                                                type="primary"
                                                onClick={() => navigate('/admin/settings')}
                                                icon={<SettingOutlined />}
                                            >
                                                Settings
                                            </Button>
                                        </Space>
                                    }
                                >
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={12} md={8} lg={24 / cols}>
                                            <Card style={{ borderRadius: 12 }} bordered>
                                                <Statistic
                                                    title="Companies"
                                                    value={metrics.totalCompanies}
                                                    prefix={<BankOutlined />}
                                                />
                                                <Text type="secondary">Detected across users/apps/participants</Text>
                                            </Card>
                                        </Col>

                                        <Col xs={24} sm={12} md={8} lg={24 / cols}>
                                            <Card style={{ borderRadius: 12 }} bordered>
                                                <Statistic title="Total Users" value={metrics.totalUsers} prefix={<UserOutlined />} />
                                                <Text type="secondary">
                                                    ~{metrics.usersPerCompany.toFixed(1)} users/company
                                                </Text>
                                            </Card>
                                        </Col>

                                        <Col xs={24} sm={12} md={8} lg={24 / cols}>
                                            <Card style={{ borderRadius: 12 }} bordered>
                                                <Statistic
                                                    title="Participants"
                                                    value={metrics.totalParticipants}
                                                    prefix={<TeamOutlined />}
                                                />
                                                <Text type="secondary">
                                                    ~{metrics.participantsPerCompany.toFixed(1)} / company
                                                </Text>
                                            </Card>
                                        </Col>

                                        <Col xs={24} sm={12} md={8} lg={24 / cols}>
                                            <Card style={{ borderRadius: 12 }} bordered>
                                                <Statistic
                                                    title="Applications"
                                                    value={metrics.totalApplications}
                                                    prefix={<FileTextOutlined />}
                                                />
                                                <Text type="secondary">Pipeline volume</Text>
                                            </Card>
                                        </Col>

                                        <Col xs={24} sm={12} md={8} lg={24 / cols}>
                                            <Card style={{ borderRadius: 12 }} bordered>
                                                <Statistic
                                                    title="Consultants"
                                                    value={metrics.totalConsultants}
                                                    prefix={<SolutionOutlined />}
                                                />
                                                <Text type="secondary">
                                                    ~{metrics.consultantsPerCompany.toFixed(1)} / company
                                                </Text>
                                            </Card>
                                        </Col>

                                        <Col xs={24} sm={12} md={8} lg={24 / cols}>
                                            <Card style={{ borderRadius: 12 }} bordered>
                                                <Statistic
                                                    title="Interventions"
                                                    value={metrics.totalInterventions}
                                                    prefix={<ApartmentOutlined />}
                                                />
                                                <div style={{ marginTop: 10 }}>
                                                    <Text type="secondary">Assignment coverage</Text>
                                                    <Progress
                                                        percent={Number.isFinite(metrics.assignmentCoverage) ? Number(metrics.assignmentCoverage.toFixed(1)) : 0}
                                                        size="small"
                                                    />
                                                </div>
                                            </Card>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        </Row>

                        <Divider />

                        <Row gutter={[16, 16]}>
                            <Col xs={24} lg={12}>
                                <Card style={{ borderRadius: 14 }} title="Roles Breakdown" extra={<Tag>users.role</Tag>}>
                                    {Object.keys(metrics.roleCounts).length === 0 ? (
                                        <Empty description="No role data found yet" />
                                    ) : (
                                        <Space wrap>
                                            {Object.entries(metrics.roleCounts)
                                                .sort((a, b) => b[1] - a[1])
                                                .slice(0, 10)
                                                .map(([role, count]) => (
                                                    <Tag key={role} color={role.includes('admin') ? 'gold' : 'blue'}>
                                                        {role}: {count}
                                                    </Tag>
                                                ))}
                                        </Space>
                                    )}
                                </Card>
                            </Col>

                            <Col xs={24} lg={12}>
                                <Card style={{ borderRadius: 14 }} title="Top Application Statuses" extra={<Tag>applications.status</Tag>}>
                                    {metrics.topStatuses.length === 0 ? (
                                        <Empty description="No application statuses found yet" />
                                    ) : (
                                        <List
                                            dataSource={metrics.topStatuses}
                                            renderItem={([status, count]) => (
                                                <List.Item>
                                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                        <Space>
                                                            <SafetyCertificateOutlined />
                                                            <Text>{status}</Text>
                                                        </Space>
                                                        <Tag>{count}</Tag>
                                                    </Space>
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </Card>
                            </Col>
                        </Row>

                        <Divider />

                        <Row gutter={[16, 16]}>
                            <Col xs={24} lg={12}>
                                <Card
                                    style={{ borderRadius: 14 }}
                                    title="Recent Users"
                                    extra={
                                        <Button type="link" onClick={() => setActiveTab('users')} icon={<ArrowRightOutlined />}>
                                            Manage Users
                                        </Button>
                                    }
                                >
                                    {metrics.recentUsers.length === 0 ? (
                                        <Empty description="No users yet" />
                                    ) : (
                                        <List
                                            dataSource={metrics.recentUsers}
                                            renderItem={(u: AnyDoc) => (
                                                <List.Item>
                                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                        <Space>
                                                            <UserOutlined />
                                                            <div>
                                                                <Text strong>{u.name || u.displayName || u.email || u.id}</Text>
                                                                <div>
                                                                    <Text type="secondary">{u.email || ''}</Text>
                                                                </div>
                                                            </div>
                                                        </Space>
                                                        <Tag color={safeLower(u.role).includes('admin') ? 'gold' : 'blue'}>
                                                            {u.role || 'unknown'}
                                                        </Tag>
                                                    </Space>
                                                </List.Item>
                                            )}
                                        />
                                    )}
                                </Card>
                            </Col>

                            <Col xs={24} lg={12}>
                                <Card style={{ borderRadius: 14 }} title="Quick Actions">
                                    <Space wrap>
                                        <Button icon={<UserOutlined />} onClick={() => { setActiveTab('users'); setSegment('Overview') }}>
                                            User Management
                                        </Button>
                                        <Button icon={<SettingOutlined />} onClick={() => navigate('/admin/settings')}>
                                            System Settings
                                        </Button>
                                        <Button icon={<FileTextOutlined />} onClick={() => navigate('/admin/audit')}>
                                            Audit & Logs
                                        </Button>
                                        <Button icon={<ApartmentOutlined />} onClick={() => navigate('/admin/data')}>
                                            Data Explorer
                                        </Button>
                                    </Space>

                                    <Divider />

                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} sm={8}>
                                            <Card bordered style={{ borderRadius: 12 }}>
                                                <Statistic title="Events" value={metrics.totalEvents} />
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={8}>
                                            <Card bordered style={{ borderRadius: 12 }}>
                                                <Statistic title="Tasks" value={metrics.totalTasks} />
                                            </Card>
                                        </Col>
                                        <Col xs={24} sm={8}>
                                            <Card bordered style={{ borderRadius: 12 }}>
                                                <Statistic title="Resources" value={metrics.totalResources} />
                                            </Card>
                                        </Col>
                                    </Row>
                                </Card>
                            </Col>
                        </Row>
                    </>
                )}

                {segment === 'Data' && (
                    <>
                        <Card style={{ borderRadius: 14 }} title="Data Health & Inventory">
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={8}>
                                    <Card bordered style={{ borderRadius: 12 }}>
                                        <Statistic title="Users" value={metrics.totalUsers} />
                                        <Text type="secondary">Collection: users</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered style={{ borderRadius: 12 }}>
                                        <Statistic title="Applications" value={metrics.totalApplications} />
                                        <Text type="secondary">Collection: applications</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered style={{ borderRadius: 12 }}>
                                        <Statistic title="Participants" value={metrics.totalParticipants} />
                                        <Text type="secondary">Collection: participants</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered style={{ borderRadius: 12 }}>
                                        <Statistic title="Consultants" value={metrics.totalConsultants} />
                                        <Text type="secondary">Collection: consultants</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered style={{ borderRadius: 12 }}>
                                        <Statistic title="Interventions DB" value={metrics.totalInterventions} />
                                        <Text type="secondary">Collection: interventionsDatabase</Text>
                                    </Card>
                                </Col>
                                <Col xs={24} md={8}>
                                    <Card bordered style={{ borderRadius: 12 }}>
                                        <Statistic title="Assigned Interventions" value={metrics.totalAssigned} />
                                        <Text type="secondary">Collection: assignedInterventions</Text>
                                    </Card>
                                </Col>
                            </Row>

                            <Divider />

                            <Space wrap>
                                <Tag color="processing">Tip</Tag>
                                <Text type="secondary">
                                    If you want “Companies” to be rock-solid, create a dedicated <Text code>companies</Text> collection and
                                    derive everything from it (instead of guessing from codes).
                                </Text>
                            </Space>
                        </Card>
                    </>
                )}

                {segment === 'Governance' && (
                    <>
                        <Card style={{ borderRadius: 14 }} title="Governance & Control">
                            <Row gutter={[16, 16]}>
                                <Col xs={24} md={12}>
                                    <Card bordered style={{ borderRadius: 12 }} title="Security Posture">
                                        <List
                                            dataSource={[
                                                { k: 'Admin accounts', v: Object.entries(metrics.roleCounts).find(([r]) => r.includes('admin'))?.[1] ?? 0 },
                                                { k: 'Companies detected', v: metrics.totalCompanies },
                                                { k: 'Assignment coverage', v: `${metrics.assignmentCoverage.toFixed(1)}%` }
                                            ]}
                                            renderItem={(it: any) => (
                                                <List.Item>
                                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                                        <Space>
                                                            <SafetyCertificateOutlined />
                                                            <Text>{it.k}</Text>
                                                        </Space>
                                                        <Tag>{it.v}</Tag>
                                                    </Space>
                                                </List.Item>
                                            )}
                                        />
                                    </Card>
                                </Col>

                                <Col xs={24} md={12}>
                                    <Card bordered style={{ borderRadius: 12 }} title="Admin Actions">
                                        <Space wrap>
                                            <Button type="primary" icon={<SettingOutlined />} onClick={() => navigate('/admin/settings')}>
                                                Manage Settings
                                            </Button>
                                            <Button icon={<FileTextOutlined />} onClick={() => navigate('/admin/audit')}>
                                                View Logs
                                            </Button>
                                            <Button icon={<ApartmentOutlined />} onClick={() => navigate('/admin/data')}>
                                                Explore Data
                                            </Button>
                                        </Space>

                                        <Divider />

                                        <Text type="secondary">
                                            Next step: add “Policy checks” here (e.g. enforce role-required fields, missing companyCode, orphaned
                                            docs, etc.).
                                        </Text>
                                    </Card>
                                </Col>
                            </Row>
                        </Card>
                    </>
                )}
            </div>

            <Divider />


        </div>
    )
}
