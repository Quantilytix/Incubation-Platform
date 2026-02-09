import React, { useEffect, useState } from 'react'
import {
    Layout,
    Menu,
    Avatar,
    Spin,
    message,
    Button,
    Typography,
    Upload,
    Tooltip
} from 'antd'
import {
    AppstoreOutlined,
    BarChartOutlined,
    LineChartOutlined,
    UserOutlined,
    MenuUnfoldOutlined,
    MenuFoldOutlined,
    EditOutlined
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { auth, db, storage } from '@/firebase'
import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const { Header, Sider, Content } = Layout
const { Title } = Typography

const IncubateeLayout: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const [logoUrl, setLogoUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [collapsed, setCollapsed] = useState(false)
    const [participantDocId, setParticipantDocId] = useState<string | null>(null)

    const selectedKey = location.pathname.includes('/tracker')
        ? 'tracker'
        : location.pathname.includes('/analytics')
            ? 'analytics'
            : location.pathname.includes('/profile')
                ? 'profile'
                : location.pathname.includes('/sme')
                    ? 'sme'
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
                    const docRef = snapshot.docs[0]
                    const data = docRef.data()
                    setParticipantDocId(docRef.id)
                    if (data.logoUrl) setLogoUrl(data.logoUrl)
                }
            } catch (err) {
                message.error('Failed to load logo.')
                console.error(err)
            } finally {
                setLoading(false)
            }
        }

        fetchLogoFromParticipants()
    }, [])

    const handleUpload = async (file: File) => {
        if (!participantDocId) return
        const fileRef = ref(storage, `logos/${Date.now()}_${file.name}`)
        await uploadBytes(fileRef, file)
        const url = await getDownloadURL(fileRef)

        await updateDoc(doc(db, 'participants', participantDocId), {
            logoUrl: url
        })
        setLogoUrl(url)
        message.success('Logo updated successfully.')
        return false // prevent auto-upload
    }

    const siderWidth = 220
    const headerHeight = 64

    return (
        <Layout style={{ height: '100vh' }}>
            <Sider
                theme='light'
                width={240}
                collapsible
                collapsed={collapsed}
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
                        height: 64,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '12px',
                        borderBottom: '1px solid #f0f0f0',
                        position: 'relative'
                    }}
                >
                    {loading ? (
                        <Spin />
                    ) : logoUrl ? (
                        <img
                            src={logoUrl}
                            alt='Logo'
                            style={{ height: 48, objectFit: 'contain' }}
                        />
                    ) : (
                        <Avatar size={48} icon={<UserOutlined />} />
                    )}

                    {/* 🖼 Edit icon overlay */}
                    <Upload
                        showUploadList={false}
                        beforeUpload={handleUpload}
                        accept='image/*'
                    >
                        <Tooltip title='Edit Logo'>
                            <Button
                                shape='circle'
                                icon={<EditOutlined />}
                                size='small'
                                style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: 8
                                }}
                            />
                        </Tooltip>
                    </Upload>
                </div>

                <Menu
                    theme='light'
                    mode='inline'
                    selectedKeys={[selectedKey]}
                    onClick={({ key }) => {
                        navigate(`/incubatee-apply/${key}`)
                    }}
                >
                    <Menu.Item key='tracker' icon={<AppstoreOutlined />}>
                        Application Tracker
                    </Menu.Item>
                    <Menu.Item key='profile' icon={<UserOutlined />}>
                        My Profile
                    </Menu.Item>
                    <Menu.Item key='sme' icon={<BarChartOutlined />}>
                        Submit Application
                    </Menu.Item>
                    <Menu.Item key='analytics' icon={<LineChartOutlined />}>
                        Analytics
                    </Menu.Item>
                </Menu>
            </Sider>

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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Button
                            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                            onClick={() => setCollapsed(!collapsed)}
                        />
                        <Title level={4} style={{ margin: 0 }}>
                            Smart Incubation Platform
                        </Title>
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
                </Header>

                <Content
                    style={{
                        marginTop: headerHeight,
                        height: `calc(100vh - ${headerHeight}px)`,
                        background: '#f5f5f5'
                    }}
                >
                    <div
                        style={{
                            padding: 15,
                            background: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                    >
                        <Outlet />
                    </div>
                </Content>
            </Layout>
        </Layout>
    )
}

export default IncubateeLayout
