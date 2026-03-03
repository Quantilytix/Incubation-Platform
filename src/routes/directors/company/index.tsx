import React, { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Avatar,
    Button,
    Card,
    Col,
    Descriptions,
    Divider,
    Form,
    Grid,
    Input,
    message,
    Modal,
    Row,
    Select,
    Space,
    Tag,
    Typography,
    Upload,
    Segmented
} from 'antd'
import {
    ApartmentOutlined,
    EditOutlined,
    KeyOutlined,
    MailOutlined,
    PhoneOutlined,
    SettingOutlined,
    SwapOutlined,
    UploadOutlined,
    UserOutlined,
    UserSwitchOutlined,
    ExclamationCircleOutlined,
    SafetyCertificateOutlined,
    TeamOutlined,
    BranchesOutlined
} from '@ant-design/icons'
import {
    EmailAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    sendEmailVerification,
    updateEmail,
    updatePassword
} from 'firebase/auth'
import {
    Timestamp,
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from 'firebase/firestore'
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { auth, db } from '@/firebase'
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

type Role = 'admin' | 'consultant' | 'incubatee' | 'operations' | 'director' | 'unknown'
type SectionKey = 'account' | 'security' | 'company' | 'ownership'
type AssignmentModel = 'ops_assign_consultant' | 'consultant_self_assign'
type SmeDivisionModel =
    | 'system_equal_random'
    | 'ops_assign_smes_to_consultants'
    | 'consultants_register_their_smes'

type SystemSettingsDoc = {
    companyCode: string
    companyName?: string

    consultantLabel?: string
    hasDepartments: boolean
    hasBranches: boolean
    assignmentModel: AssignmentModel
    smeDivisionModel?: SmeDivisionModel
    branchScopedManagement?: boolean

    locked?: boolean

    createdAt?: any
    createdByUid?: string
    createdByEmail?: string

    ownerUid?: string
    ownerEmail?: string

    ownershipTransferredAt?: any
    ownershipTransferredByUid?: string
    ownershipTransferredByEmail?: string
}

const prettyAssignment = (m?: AssignmentModel) =>
    m === 'ops_assign_consultant'
        ? 'Ops assigns consultants'
        : m === 'consultant_self_assign'
            ? 'Consultants self-assign'
            : '—'

const prettyDivision = (m?: SmeDivisionModel) =>
    m === 'system_equal_random'
        ? 'System divides SMEs equally (random)'
        : m === 'ops_assign_smes_to_consultants'
            ? 'Ops assigns SMEs to consultants'
            : m === 'consultants_register_their_smes'
                ? 'Consultants manage SMEs they register'
                : '—'

const toTextDate = (v: any) => {
    if (!v) return '—'
    if (v?.toDate) return v.toDate().toLocaleString()
    if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toLocaleString()
    return '—'
}

const normalizeRole = (r?: string): Role => (r || '').toLowerCase().replace(/\s+/g, '') as Role

export const CompanySettingsPage: React.FC = () => {
    const { user } = useFullIdentity()
    const screens = useBreakpoint()
    const isMobile = !screens.md

    const companyCode = String((user as any)?.companyCode || '').trim()
    const role = normalizeRole((user as any)?.role || (user as any)?.roleName || 'unknown')

    const [active, setActive] = useState<SectionKey>('account')
    const [loading, setLoading] = useState(true)

    const [userDoc, setUserDoc] = useState<any>(null)
    const [avatarUrl, setAvatarUrl] = useState<string>('')

    const [settings, setSettings] = useState<SystemSettingsDoc | null>(null)

    const [editProfileOpen, setEditProfileOpen] = useState(false)
    const [changeEmailOpen, setChangeEmailOpen] = useState(false)
    const [changePwdOpen, setChangePwdOpen] = useState(false)
    const [requestOpen, setRequestOpen] = useState(false)

    const [transferOpen, setTransferOpen] = useState(false)
    const [directors, setDirectors] = useState<Array<{ uid: string; email: string; name?: string }>>([])
    const [newOwnerUid, setNewOwnerUid] = useState<string>('')

    const [saving, setSaving] = useState(false)
    const [requestSending, setRequestSending] = useState(false)
    const [transferSending, setTransferSending] = useState(false)

    const [profileForm] = Form.useForm()
    const [emailForm] = Form.useForm()
    const [pwdForm] = Form.useForm()
    const [requestForm] = Form.useForm()

    const canCompanyActions = role === 'director' || role === 'admin'

    const isOwner = useMemo(() => {
        const uid = auth.currentUser?.uid || ''
        if (!uid) return false
        const ownerUid = settings?.ownerUid || settings?.createdByUid || ''
        return ownerUid ? ownerUid === uid : false
    }, [settings])

    const companyNameTag = useMemo(() => {
        const n = String(settings?.companyName || (user as any)?.company || (user as any)?.companyName || '').trim()
        if (n) return `Company: ${n}`
        if (companyCode) return `Company: ${companyCode}`
        return 'Company: —'
    }, [settings, user, companyCode])

    const fetchAll = async () => {
        const cur = auth.currentUser
        if (!cur) {
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const uSnap = await getDoc(doc(db, 'users', cur.uid))
            const udata = uSnap.exists() ? (uSnap.data() as any) : {}
            setUserDoc(udata)
            setAvatarUrl(String(udata?.photoURL || udata?.avatarUrl || ''))

            if (companyCode) {
                const sSnap = await getDoc(doc(db, 'systemSettings', companyCode))
                setSettings(sSnap.exists() ? (sSnap.data() as any) : null)
            } else {
                setSettings(null)
            }

            profileForm.setFieldsValue({
                displayName: udata?.name || udata?.fullName || cur.displayName || '',
                email: cur.email || '',
                phone: udata?.phone || ''
            })
        } catch {
            message.error('Failed to load settings.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAll()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyCode])

    const reauthIfNeeded = async (currentPassword?: string) => {
        const cur = auth.currentUser
        if (!cur) throw new Error('Not signed in')
        const providerId = cur.providerData?.[0]?.providerId

        if (providerId === 'password') {
            if (!currentPassword) throw new Error('Current password is required.')
            const cred = EmailAuthProvider.credential(cur.email || '', currentPassword)
            await reauthenticateWithCredential(cur, cred)
            return
        }

        if (providerId === 'google.com') {
            await reauthenticateWithPopup(cur, new GoogleAuthProvider())
            return
        }

        if (providerId === 'microsoft.com') {
            await reauthenticateWithPopup(cur, new OAuthProvider('microsoft.com'))
            return
        }

        if (!currentPassword) throw new Error('Current password is required.')
        const cred = EmailAuthProvider.credential(cur.email || '', currentPassword)
        await reauthenticateWithCredential(cur, cred)
    }

    const uploadAvatar = async (file: File) => {
        const cur = auth.currentUser
        if (!cur) return message.error('Not signed in.')
        const storage = getStorage()
        const path = `avatars/${cur.uid}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const sref = ref(storage, path)
        await uploadBytes(sref, file)
        const url = await getDownloadURL(sref)

        await updateDoc(doc(db, 'users', cur.uid), {
            avatarUrl: url,
            avatarUpdatedAt: Timestamp.now()
        })

        setAvatarUrl(url)
        message.success('Profile picture updated.')
    }

    const removeAvatar = async () => {
        const cur = auth.currentUser
        if (!cur) return
        const existing = String(userDoc?.avatarPath || '')
        try {
            if (existing) {
                const storage = getStorage()
                await deleteObject(ref(storage, existing))
            }
        } catch {
            // ignore
        }
        await updateDoc(doc(db, 'users', cur.uid), { avatarUrl: '', avatarPath: '' })
        setAvatarUrl('')
        message.success('Profile picture removed.')
    }

    const saveProfile = async () => {
        const cur = auth.currentUser
        if (!cur) return

        setSaving(true)
        try {
            const vals = await profileForm.validateFields()
            await updateDoc(doc(db, 'users', cur.uid), {
                name: String(vals.displayName || '').trim(),
                phone: String(vals.phone || '').trim(),
                updatedAt: Timestamp.now()
            })
            message.success('Profile updated.')
            setEditProfileOpen(false)
            await fetchAll()
        } finally {
            setSaving(false)
        }
    }

    const submitChangeRequest = async () => {
        const cur = auth.currentUser
        if (!cur) return message.error('Not signed in.')
        if (!companyCode) return message.error('Missing company code.')

        setRequestSending(true)
        try {
            const vals = await requestForm.validateFields()
            await addDoc(collection(db, 'systemSettingsChangeRequests'), {
                companyCode,
                companyName: settings?.companyName || '',
                requestedByUid: cur.uid,
                requestedByEmail: cur.email || '',
                requestedAt: Timestamp.now(),
                status: 'pending',
                reason: String(vals.reason || '').trim(),
                currentSettingsSnapshot: settings || null
            })
            message.success('Change request submitted.')
            setRequestOpen(false)
        } finally {
            setRequestSending(false)
        }
    }

    const fetchDirectors = async () => {
        if (!companyCode) return
        const qs = await getDocs(
            query(collection(db, 'users'), where('companyCode', '==', companyCode), where('role', '==', 'director'))
        )
        setDirectors(
            qs.docs
                .map(d => {
                    const data = d.data() as any
                    return { uid: d.id, email: data.email || '', name: data.name || data.fullName || '' }
                })
                .filter(x => !!x.email)
        )
    }

    const openTransfer = async () => {
        if (!canCompanyActions) return message.error('Not allowed.')
        if (!isOwner) {
            Modal.info({ title: 'Restricted', content: 'Only the current owner can transfer ownership.' })
            return
        }
        setNewOwnerUid('')
        setTransferOpen(true)
        await fetchDirectors()
    }

    const confirmTransfer = async () => {
        if (!companyCode) return
        const cur = auth.currentUser
        if (!cur) return
        if (!newOwnerUid) return message.error('Select a new owner.')

        const nextOwner = directors.find(d => d.uid === newOwnerUid)
        if (!nextOwner) return message.error('Invalid selection.')

        Modal.confirm({
            title: 'Transfer ownership?',
            icon: <UserSwitchOutlined />,
            okText: 'Transfer',
            cancelText: 'Cancel',
            content: (
                <div>
                    <div style={{ marginBottom: 8 }}>
                        New owner: <b>{nextOwner.email}</b>
                    </div>
                    <div style={{ color: 'rgba(0,0,0,.65)' }}>
                        This changes who can manage company-level configuration going forward.
                    </div>
                </div>
            ),
            onOk: async () => {
                setTransferSending(true)
                try {
                    await updateDoc(doc(db, 'systemSettings', companyCode), {
                        ownerUid: nextOwner.uid,
                        ownerEmail: nextOwner.email,
                        ownershipTransferredAt: Timestamp.now(),
                        ownershipTransferredByUid: cur.uid,
                        ownershipTransferredByEmail: cur.email || ''
                    } as any)
                    message.success('Ownership transferred.')
                    setTransferOpen(false)
                    await fetchAll()
                } finally {
                    setTransferSending(false)
                }
            }
        })
    }

    const doChangeEmail = async () => {
        const cur = auth.currentUser
        if (!cur) return

        setSaving(true)
        try {
            const vals = await emailForm.validateFields()
            await reauthIfNeeded(vals.currentPassword)

            await updateEmail(cur, String(vals.newEmail).trim())
            await sendEmailVerification(cur)

            message.success('Email updated. Verification email sent.')
            setChangeEmailOpen(false)
            emailForm.resetFields()
            await fetchAll()
        } catch (e: any) {
            message.error(e?.message || 'Failed to change email.')
        } finally {
            setSaving(false)
        }
    }

    const doChangePassword = async () => {
        const cur = auth.currentUser
        if (!cur) return

        setSaving(true)
        try {
            const vals = await pwdForm.validateFields()
            await reauthIfNeeded(vals.currentPassword)
            await updatePassword(cur, vals.newPassword)
            message.success('Password updated.')
            setChangePwdOpen(false)
            pwdForm.resetFields()
        } catch (e: any) {
            message.error(e?.message || 'Failed to change password.')
        } finally {
            setSaving(false)
        }
    }

    const renderAccount = () => {
        const displayName = userDoc?.name || userDoc?.fullName || auth.currentUser?.displayName || '—'
        const email = auth.currentUser?.email || '—'
        const phone = userDoc?.phone || '—'

        return (
            <>
                <MotionCard>
                    <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }}>
                        <Row gutter={[16, 16]} align="middle">
                            <Col flex="none">
                                <Avatar size={72} src={avatarUrl || undefined} icon={<UserOutlined />} />
                            </Col>
                            <Col flex="auto">
                                <Title level={4} style={{ margin: 0 }}>
                                    {displayName}
                                </Title>
                                <Text type="secondary">{companyNameTag}</Text>
                                <div style={{ marginTop: 12 }}>
                                    <Space wrap>
                                        <Upload
                                            accept=".png,.jpg,.jpeg,.webp"
                                            showUploadList={false}
                                            beforeUpload={file => {
                                                uploadAvatar(file as File)
                                                return false
                                            }}
                                        >
                                            <Button type="primary" icon={<UploadOutlined />}>
                                                Upload New Picture
                                            </Button>
                                        </Upload>
                                        <Button danger onClick={removeAvatar} disabled={!avatarUrl}>
                                            Remove
                                        </Button>
                                    </Space>
                                </div>
                            </Col>
                            <Col flex="none">
                                <Button icon={<EditOutlined />} onClick={() => setEditProfileOpen(true)}>
                                    Edit
                                </Button>
                            </Col>
                        </Row>

                        <Divider style={{ margin: '16px 0' }} />

                        <Descriptions bordered size="small" column={1}>
                            <Descriptions.Item label={<Space><UserOutlined />Name</Space>}>
                                {displayName}
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space><MailOutlined />Email</Space>}>
                                <Space>
                                    <span>{email}</span>
                                    {auth.currentUser?.emailVerified ? (
                                        <Tag color="green">Verified</Tag>
                                    ) : (
                                        <Tag color="orange">Unverified</Tag>
                                    )}
                                </Space>
                            </Descriptions.Item>
                            <Descriptions.Item label={<Space><PhoneOutlined />Phone</Space>}>
                                {phone}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                </MotionCard>

                <Modal
                    title={
                        <Space>
                            <EditOutlined />
                            <span>Edit Profile</span>
                        </Space>
                    }
                    open={editProfileOpen}
                    onCancel={() => setEditProfileOpen(false)}
                    onOk={saveProfile}
                    okText="Save"
                    confirmLoading={saving}
                    destroyOnClose
                >
                    <Form form={profileForm} layout="vertical">
                        <Form.Item
                            name="displayName"
                            label="Full name"
                            rules={[{ required: true, message: 'Name is required' }]}
                        >
                            <Input placeholder="e.g. Daniel Rumona" />
                        </Form.Item>

                        <Form.Item
                            name="phone"
                            label="Phone"
                            extra="Phone changes should be verified via SMS. You can capture it now and verify in the Security section."
                        >
                            <Input placeholder="e.g. +27..." />
                        </Form.Item>
                    </Form>
                </Modal>
            </>
        )
    }

    const renderSecurity = () => {
        const emailVerified = !!auth.currentUser?.emailVerified
        return (
            <>
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Security & Login"
                    description="Manage your login credentials. Some actions require re-authentication for security."
                />

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={12}>
                        <MotionCard>
                            <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }}>
                                <Title level={5} style={{ marginTop: 0 }}>
                                    Email Address
                                </Title>
                                <Text type="secondary">
                                    Current: {auth.currentUser?.email || '—'}
                                </Text>

                                <div style={{ marginTop: 12 }}>
                                    <Space wrap>
                                        <Button icon={<MailOutlined />} type="primary" onClick={() => setChangeEmailOpen(true)}>
                                            Change Email
                                        </Button>
                                        {!emailVerified && (
                                            <Button
                                                icon={<SafetyCertificateOutlined />}
                                                onClick={async () => {
                                                    const cur = auth.currentUser
                                                    if (!cur) return
                                                    await sendEmailVerification(cur)
                                                    message.success('Verification email sent.')
                                                }}
                                            >
                                                Send Verification
                                            </Button>
                                        )}
                                    </Space>
                                </div>
                            </Card>
                        </MotionCard>
                    </Col>

                    <Col xs={24} lg={12}>
                        <MotionCard>
                            <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }}>
                                <Title level={5} style={{ marginTop: 0 }}>
                                    Password
                                </Title>
                                <Text type="secondary">
                                    Update your password regularly to keep your account safe.
                                </Text>

                                <div style={{ marginTop: 12 }}>
                                    <Button icon={<KeyOutlined />} type="primary" onClick={() => setChangePwdOpen(true)}>
                                        Change Password
                                    </Button>
                                </div>
                            </Card>
                        </MotionCard>
                    </Col>

                    <Col xs={24}>
                        <MotionCard>
                            <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }}>
                                <Title level={5} style={{ marginTop: 0 }}>
                                    Phone Verification
                                </Title>
                                <Text type="secondary">
                                    Phone changes should be verified via SMS before being trusted for security actions.
                                </Text>

                                <div style={{ marginTop: 12 }}>
                                    <Space wrap>
                                        <Button icon={<PhoneOutlined />} disabled>
                                            Verify Phone (SMS)
                                        </Button>
                                        <Text type="secondary">
                                            TODO: Implement RecaptchaVerifier + signInWithPhoneNumber flow.
                                        </Text>
                                    </Space>
                                </div>
                            </Card>
                        </MotionCard>
                    </Col>
                </Row>

                <Modal
                    title={
                        <Space>
                            <MailOutlined />
                            <span>Change Email</span>
                        </Space>
                    }
                    open={changeEmailOpen}
                    onCancel={() => setChangeEmailOpen(false)}
                    onOk={doChangeEmail}
                    okText="Update Email"
                    confirmLoading={saving}
                    destroyOnClose
                >
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="Re-authentication required"
                        description="For security, you may be prompted to re-login before changing email."
                    />
                    <Form form={emailForm} layout="vertical">
                        <Form.Item
                            name="newEmail"
                            label="New email address"
                            rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
                        >
                            <Input placeholder="e.g. new@email.com" />
                        </Form.Item>

                        <Form.Item
                            name="currentPassword"
                            label="Current password"
                            extra="Only required if you signed in with email/password. Google/Microsoft will pop up instead."
                        >
                            <Input.Password placeholder="Enter current password if applicable" />
                        </Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title={
                        <Space>
                            <KeyOutlined />
                            <span>Change Password</span>
                        </Space>
                    }
                    open={changePwdOpen}
                    onCancel={() => setChangePwdOpen(false)}
                    onOk={doChangePassword}
                    okText="Update Password"
                    confirmLoading={saving}
                    destroyOnClose
                >
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="Use a strong password"
                        description="At least 8 characters, include an uppercase letter, a number and a symbol."
                    />

                    <Form form={pwdForm} layout="vertical">
                        <Form.Item
                            name="currentPassword"
                            label="Current password"
                            extra="Only required if you signed in with email/password. Google/Microsoft will pop up instead."
                        >
                            <Input.Password placeholder="Enter current password if applicable" />
                        </Form.Item>

                        <Form.Item
                            name="newPassword"
                            label="New password"
                            rules={[
                                { required: true, message: 'Password is required' },
                                { min: 8, message: 'Use at least 8 characters' },
                                { pattern: /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, message: 'Add uppercase, number and symbol' }
                            ]}
                        >
                            <Input.Password placeholder="New password" />
                        </Form.Item>

                        <Form.Item
                            name="confirmPassword"
                            label="Confirm new password"
                            dependencies={['newPassword']}
                            rules={[
                                { required: true, message: 'Confirm your password' },
                                ({ getFieldValue }) => ({
                                    validator(_, value) {
                                        return !value || getFieldValue('newPassword') === value
                                            ? Promise.resolve()
                                            : Promise.reject(new Error('Passwords do not match'))
                                    }
                                })
                            ]}
                        >
                            <Input.Password placeholder="Confirm password" />
                        </Form.Item>
                    </Form>
                </Modal>
            </>
        )
    }

    const renderCompany = () => {
        const ownerEmail = settings?.ownerEmail || settings?.createdByEmail || '—'

        return (
            <>
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Company Configuration"
                    description="This shows exactly what was configured during setup. If anything is incorrect, submit a change request."
                />

                <Row gutter={[16, 16]}>
                    <Col xs={24} lg={16}>
                        <MotionCard>
                            <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }} loading={loading}>
                                {!settings ? (
                                    <Alert type="warning" showIcon message="No system settings found for this company." />
                                ) : (
                                    <>
                                        <Descriptions bordered size="small" column={1}>
                                            <Descriptions.Item label={<Space><ApartmentOutlined />Company Name</Space>}>
                                                {settings.companyName || '—'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label={<Space><SettingOutlined />Company Code</Space>}>
                                                {settings.companyCode || companyCode || '—'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label={<Space><TeamOutlined />Consultant Label</Space>}>
                                                <Space>
                                                    <Tag color="blue">{settings.consultantLabel || 'Consultants'}</Tag>
                                                    <Text type="secondary">Intervention delivery roles.</Text>
                                                </Space>
                                            </Descriptions.Item>

                                            <Descriptions.Item label={<Space><ApartmentOutlined />Has Departments</Space>}>
                                                {settings.hasDepartments ? 'Yes' : 'No'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label={<Space><BranchesOutlined />Has Branches / Offices</Space>}>
                                                {settings.hasBranches ? 'Yes' : 'No'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Branch-based Consultant Management">
                                                {settings.hasBranches
                                                    ? settings.branchScopedManagement
                                                        ? 'Yes (office-scoped)'
                                                        : 'No (cross-office allowed)'
                                                    : '—'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Intervention Assignment Model">
                                                {prettyAssignment(settings.assignmentModel)}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="SME Division (only when self-assigning)">
                                                {settings.assignmentModel === 'consultant_self_assign'
                                                    ? prettyDivision(settings.smeDivisionModel)
                                                    : '—'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Owner">{ownerEmail}</Descriptions.Item>
                                            <Descriptions.Item label="Created At">{toTextDate(settings.createdAt)}</Descriptions.Item>
                                        </Descriptions>

                                        {settings.locked && (
                                            <Alert
                                                type="warning"
                                                showIcon
                                                style={{ marginTop: 12 }}
                                                message="Locked configuration"
                                                description="You cannot directly edit these settings. Use Request Change."
                                            />
                                        )}
                                    </>
                                )}
                            </Card>
                        </MotionCard>
                    </Col>

                    <Col xs={24} lg={8}>
                        <MotionCard>
                            <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }}>
                                <Title level={5} style={{ marginTop: 0 }}>
                                    Actions
                                </Title>
                                <Text type="secondary">
                                    Request updates to locked company configuration.
                                </Text>

                                <div style={{ marginTop: 12 }}>
                                    <Space direction="vertical" style={{ width: '100%' }}>
                                        <Button
                                            type="primary"
                                            icon={<ExclamationCircleOutlined />}
                                            onClick={() => {
                                                requestForm.resetFields()
                                                setRequestOpen(true)
                                            }}
                                            block
                                            disabled={!canCompanyActions || !settings}
                                        >
                                            Request Change
                                        </Button>

                                        <Button
                                            icon={<UserSwitchOutlined />}
                                            onClick={openTransfer}
                                            block
                                            disabled={!canCompanyActions || !settings}
                                        >
                                            Transfer Ownership
                                        </Button>

                                        {!isOwner && (
                                            <Text type="secondary">
                                                Ownership transfer is restricted to the current owner.
                                            </Text>
                                        )}
                                    </Space>
                                </div>
                            </Card>
                        </MotionCard>
                    </Col>
                </Row>

                <Modal
                    title={
                        <Space>
                            <ExclamationCircleOutlined />
                            <span>Request Change</span>
                        </Space>
                    }
                    open={requestOpen}
                    onCancel={() => setRequestOpen(false)}
                    onOk={submitChangeRequest}
                    okText="Submit Request"
                    confirmLoading={requestSending}
                    destroyOnClose
                >
                    <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="Describe the change clearly"
                        description="Your request will be reviewed before any locked settings are modified."
                    />

                    <Form form={requestForm} layout="vertical">
                        <Form.Item
                            name="reason"
                            label="Change Request"
                            rules={[
                                { required: true, message: 'Please describe what you want changed and why.' },
                                { min: 10, message: 'Please add a bit more detail.' }
                            ]}
                        >
                            <Input.TextArea rows={5} placeholder="Example: We now have branches and need office-scoped consultant management." />
                        </Form.Item>
                    </Form>
                </Modal>

                <Modal
                    title={
                        <Space>
                            <UserSwitchOutlined />
                            <span>Transfer Ownership</span>
                        </Space>
                    }
                    open={transferOpen}
                    onCancel={() => setTransferOpen(false)}
                    onOk={confirmTransfer}
                    okText="Continue"
                    confirmLoading={transferSending}
                    destroyOnClose
                >
                    <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="Only transfer to another Director"
                        description="Choose the Director account that should become the new owner."
                    />

                    <Select
                        style={{ width: '100%' }}
                        placeholder="Select a Director"
                        value={newOwnerUid || undefined}
                        onChange={setNewOwnerUid}
                        options={directors.map(d => ({
                            label: d.name ? `${d.name} (${d.email})` : d.email,
                            value: d.uid
                        }))}
                        showSearch
                        optionFilterProp="label"
                    />
                </Modal>
            </>
        )
    }

    const renderOwnership = () => (
        <Alert
            type="info"
            showIcon
            message="Ownership"
            description="Ownership actions are available under Company → Actions."
        />
    )

    const content = () => {
        if (loading) {
            return (
                <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }} loading />
            )
        }

        if (active === 'account') return renderAccount()
        if (active === 'security') return renderSecurity()
        if (active === 'company') return renderCompany()
        return renderOwnership()
    }

    const navItems = [
        { key: 'account', label: 'Account', icon: <UserOutlined /> },
        { key: 'security', label: 'Security', icon: <SafetyCertificateOutlined /> },
        { key: 'company', label: 'Company', icon: <SettingOutlined /> },
    ] as Array<{ key: SectionKey; label: string; icon: React.ReactNode }>

    return (
        <div style={{ padding: 24 }}>
            <DashboardHeaderCard
                title="Settings"
                titleIcon={<SettingOutlined />}
                subtitle="Manage your account, security and company configuration."
                subtitleTags={[
                    { label: companyNameTag, color: 'blue' },
                    {
                        label: role !== 'unknown' ? role.toUpperCase() : '—',
                        color: 'default'
                    }
                ]}
            />

            <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
                <Col xs={24} md={7} lg={6}>
                    <MotionCard>
                        <Card style={{ borderRadius: 16, border: '1px solid #eef3ff' }}>
                            <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>
                                Settings
                            </Title>

                            {isMobile ? (
                                <Segmented
                                    block
                                    value={active}
                                    onChange={v => setActive(v as SectionKey)}
                                    options={navItems.map(i => ({ label: i.label, value: i.key }))}
                                />
                            ) : (
                                <Space direction="vertical" style={{ width: '100%' }}>
                                    {navItems.map(i => (
                                        <Button
                                            key={i.key}
                                            type={active === i.key ? 'primary' : 'text'}
                                            icon={i.icon}
                                            onClick={() => setActive(i.key)}
                                            block
                                            style={{
                                                justifyContent: 'flex-start',
                                                borderRadius: 12
                                            }}
                                        >
                                            {i.label}
                                        </Button>
                                    ))}
                                </Space>
                            )}

                            <Divider style={{ margin: '14px 0' }} />


                        </Card>
                    </MotionCard>
                </Col>

                <Col xs={24} md={17} lg={18}>
                    {content()}
                </Col>
            </Row>
        </div>
    )
}
