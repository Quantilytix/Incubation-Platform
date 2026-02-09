import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    Avatar,
    Button,
    Col,
    Descriptions,
    Divider,
    Form,
    Input,
    InputNumber,
    Row,
    Select,
    Space,
    Tag,
    Typography,
    Upload,
    message,
    Segmented,
    Radio,
    DatePicker
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import {
    CloseOutlined,
    EditOutlined,
    IdcardOutlined,
    LockOutlined,
    SafetyOutlined,
    SaveOutlined,
    UploadOutlined,
    UserOutlined
} from '@ant-design/icons'
import {
    EmailAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    updateEmail,
    updatePassword,
    updateProfile
} from 'firebase/auth'
import {
    collection,
    doc,
    getDocs,
    limit,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch,
    getDoc,
    Timestamp,
    FieldValue,
    DocumentReference
} from 'firebase/firestore'
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage'
import dayjs from 'dayjs'
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'
import { auth, db, storage } from '@/firebase'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { MotionCard } from '@/components/shared/Header'
import { Helmet } from 'react-helmet'

const { Title, Text } = Typography
const { Option } = Select

type ProfileValues = Record<string, any>
type SegmentKey = 'details' | 'security'

const fontOptions = ['Dancing Script', 'Great Vibes'] as const

const toLowerTrim = (v: any) => String(v || '').trim().toLowerCase()

const ProfileForm: React.FC = () => {
    const [form] = Form.useForm()
    const [bootLoading, setBootLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const [segment, setSegment] = useState<SegmentKey>('details')
    const [isEditingDetails, setIsEditingDetails] = useState(false)

    const [participantDocId, setParticipantDocId] = useState<string | null>(null)
    const [metricsLocked, setMetricsLocked] = useState(false)

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarList, setAvatarList] = useState<UploadFile[]>([])

    const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | null>(null)
    const [signatureImage, setSignatureImage] = useState<string | null>(null)
    const [typedName, setTypedName] = useState('')
    const [typedFont, setTypedFont] = useState<(typeof fontOptions)[number]>(fontOptions[0])
    const canvasRef = useRef<SignatureCanvas | null>(null)
    const styledRef = useRef<HTMLDivElement>(null)

    const [changingPassword, setChangingPassword] = useState(false)

    const last3Months = useMemo(
        () =>
            Array.from({ length: 3 }, (_, i) =>
                dayjs()
                    .subtract(i + 1, 'month')
                    .format('MMMM')
            ).reverse(),
        []
    )

    const currentYear = dayjs().year()
    const last2Years = useMemo(() => [currentYear - 1, currentYear - 2], [currentYear])

    const sectors = useMemo(
        () => [
            'Agriculture',
            'Mining',
            'Manufacturing',
            'Electricity, Gas and Water',
            'Construction',
            'Wholesale and Retail Trade',
            'Transport, Storage and Communication',
            'Finance, Real Estate and Business Services',
            'Community, Social and Personal Services',
            'Tourism and Hospitality',
            'Information Technology',
            'Education',
            'Health and Social Work',
            'Arts and Culture',
            'Automotive',
            'Chemical',
            'Textile',
            'Forestry and Logging',
            'Fishing',
            'Other'
        ],
        []
    )

    const provinces = useMemo(
        () => [
            'Eastern Cape',
            'Free State',
            'Gauteng',
            'KwaZulu-Natal',
            'Limpopo',
            'Mpumalanga',
            'Northern Cape',
            'North West',
            'Western Cape'
        ],
        []
    )

    const isUpdate = Boolean(participantDocId)

    const pickAvatar = (file: File) => {
        setAvatarFile(file)
        const localUrl = URL.createObjectURL(file)
        setAvatarUrl(localUrl)
        setAvatarList([
            {
                uid: 'avatar',
                name: file.name,
                status: 'done',
                url: localUrl
            }
        ])
        return false
    }

    const uploadAvatarIfNeeded = async (uid: string, targetDocId?: string | null) => {
        if (!avatarFile) return { avatarUrl: undefined as string | undefined, avatarPath: undefined as string | undefined }

        const safeId = targetDocId || uid
        const path = `participants/${safeId}/avatar_${Date.now()}_${avatarFile.name}`
        const r = storageRef(storage, path)
        await uploadBytes(r, avatarFile)
        const url = await getDownloadURL(r)
        return { avatarUrl: url, avatarPath: path }
    }

    const saveTypedSignature = async () => {
        if (!styledRef.current) return
        const canvas = await html2canvas(styledRef.current)
        setSignatureImage(canvas.toDataURL('image/png'))
        message.success('Typed signature generated')
    }

    const saveDrawnSignature = () => {
        if (!canvasRef.current) return
        const dataURL = canvasRef.current.toDataURL('image/png')
        setSignatureImage(dataURL)
        message.success('Drawn signature saved')
    }

    const clearDrawnSignature = () => {
        if (!canvasRef.current) return
        canvasRef.current.clear()
        setSignatureImage(null)
    }

    const uploadSignatureIfNeeded = async (uid: string) => {
        if (!signatureImage) return null
        const blob = await (await fetch(signatureImage)).blob()
        const fileName = `signatures/${uid}_${Date.now()}.png`
        const fileRef = storageRef(storage, fileName)
        await uploadBytes(fileRef, blob)
        return await getDownloadURL(fileRef)
    }

    const buildMetricsPayload = (values: ProfileValues) => {
        const monthly: Record<string, any> = {}
        const annual: Record<string, any> = {}

        Object.entries(values).forEach(([key, value]) => {
            if (key.startsWith('revenue_')) {
                const suffix = key.replace('revenue_', '')
                if (isNaN(Number(suffix))) {
                    if (!monthly[suffix]) monthly[suffix] = {}
                    monthly[suffix].revenue = value ?? 0
                } else {
                    if (!annual[suffix]) annual[suffix] = {}
                    annual[suffix].revenue = value ?? 0
                }
            }

            if (key.startsWith('permHeadcount_')) {
                const suffix = key.replace('permHeadcount_', '')
                if (isNaN(Number(suffix))) {
                    if (!monthly[suffix]) monthly[suffix] = {}
                    monthly[suffix].permanent = value ?? 0
                } else {
                    if (!annual[suffix]) annual[suffix] = {}
                    annual[suffix].permanent = value ?? 0
                }
            }

            if (key.startsWith('tempHeadcount_')) {
                const suffix = key.replace('tempHeadcount_', '')
                if (isNaN(Number(suffix))) {
                    if (!monthly[suffix]) monthly[suffix] = {}
                    monthly[suffix].temporary = value ?? 0
                } else {
                    if (!annual[suffix]) annual[suffix] = {}
                    annual[suffix].temporary = value ?? 0
                }
            }
        })

        return {
            headcountHistory: {
                monthly: Object.fromEntries(
                    Object.entries(monthly).map(([k, v]) => [
                        k,
                        { permanent: v?.permanent ?? 0, temporary: v?.temporary ?? 0 }
                    ])
                ),
                annual: Object.fromEntries(
                    Object.entries(annual).map(([k, v]) => [
                        k,
                        { permanent: v?.permanent ?? 0, temporary: v?.temporary ?? 0 }
                    ])
                )
            },
            revenueHistory: {
                monthly: Object.fromEntries(
                    Object.entries(monthly).map(([k, v]) => [k, v?.revenue ?? 0])
                ),
                annual: Object.fromEntries(
                    Object.entries(annual).map(([k, v]) => [k, v?.revenue ?? 0])
                )
            }
        }
    }

    const findOrCreateParticipant = async (uid: string, email: string) => {
        // Prefer uid query (new canonical path)
        const byUidQ = query(collection(db, 'participants'), where('uid', '==', uid), limit(1))
        const byUidSnap = await getDocs(byUidQ)
        if (!byUidSnap.empty) {
            return { ref: byUidSnap.docs[0].ref, id: byUidSnap.docs[0].id, data: byUidSnap.docs[0].data() as any }
        }

        // Fallback: by email, then attach uid to that participant doc (migration)
        const byEmailQ = query(collection(db, 'participants'), where('email', '==', email), limit(1))
        const byEmailSnap = await getDocs(byEmailQ)
        if (!byEmailSnap.empty) {
            const d = byEmailSnap.docs[0]
            await setDoc(d.ref, { uid, updatedAt: serverTimestamp() }, { merge: true })
            return { ref: d.ref, id: d.id, data: d.data() as any }
        }

        return { ref: null as any, id: null as any, data: null as any }
    }

    const readApplicationLock = async (uid: string, email: string) => {
        // Prefer uid-based lock
        const byUidQ = query(collection(db, 'applications'), where('uid', '==', uid), limit(1))
        const byUidSnap = await getDocs(byUidQ)
        if (!byUidSnap.empty) {
            const app = byUidSnap.docs[0].data() as any
            return Boolean(app?.applicationStatus)
        }

        // Fallback: email-based, then attach uid (migration)
        const byEmailQ = query(collection(db, 'applications'), where('email', '==', email), limit(1))
        const byEmailSnap = await getDocs(byEmailQ)
        if (!byEmailSnap.empty) {
            const d = byEmailSnap.docs[0]
            const app = d.data() as any
            await setDoc(d.ref, { uid, updatedAt: serverTimestamp() }, { merge: true })
            return Boolean(app?.applicationStatus)
        }

        return false
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user) {
                setBootLoading(false)
                return
            }

            setBootLoading(true)

            const uid = user.uid
            const authEmail = toLowerTrim(user.email)
            const userRef = doc(db, 'users', uid)
            const userSnap = await getDoc(userRef)
            const userData = userSnap.exists() ? (userSnap.data() as any) : {}

            const fallbackName = userData?.name || user.displayName || ''
            const fallbackAvatar = userData?.photoURL || user.photoURL || null
            setAvatarUrl(fallbackAvatar)

            const locked = await readApplicationLock(uid, authEmail)
            setMetricsLocked(locked)

            const found = await findOrCreateParticipant(uid, authEmail)
            if (found?.id) {
                setParticipantDocId(found.id)

                const data = found.data || {}
                const flatFields: Record<string, any> = {}

                Object.entries(data.headcountHistory?.monthly || {}).forEach(([month, v]: any) => {
                    flatFields[`permHeadcount_${month}`] = v?.permanent ?? 0
                    flatFields[`tempHeadcount_${month}`] = v?.temporary ?? 0
                })
                Object.entries(data.headcountHistory?.annual || {}).forEach(([year, v]: any) => {
                    flatFields[`permHeadcount_${year}`] = v?.permanent ?? 0
                    flatFields[`tempHeadcount_${year}`] = v?.temporary ?? 0
                })
                Object.entries(data.revenueHistory?.monthly || {}).forEach(([month, v]: any) => {
                    flatFields[`revenue_${month}`] = v ?? 0
                })
                Object.entries(data.revenueHistory?.annual || {}).forEach(([year, v]: any) => {
                    flatFields[`revenue_${year}`] = v ?? 0
                })

                const initialValues: ProfileValues = {
                    participantName: data.participantName ?? fallbackName,
                    email: data.email ?? authEmail,
                    beneficiaryName: data.beneficiaryName,
                    gender: data.gender,
                    idNumber: data.idNumber,
                    phone: data.phone,
                    sector: data.sector,
                    natureOfBusiness: data.natureOfBusiness,
                    beeLevel: data.beeLevel,
                    youthOwnedPercent: data.youthOwnedPercent,
                    femaleOwnedPercent: data.femaleOwnedPercent,
                    blackOwnedPercent: data.blackOwnedPercent,
                    dateOfRegistration: data.dateOfRegistration
                        ? dayjs(data.dateOfRegistration.toDate?.() || data.dateOfRegistration)
                        : null,
                    yearsOfTrading: data.yearsOfTrading,
                    registrationNumber: data.registrationNumber,
                    businessAddress: data.businessAddress,
                    city: data.city,
                    postalCode: data.postalCode,
                    province: data.province,
                    hub: data.hub,
                    location: data.location,
                    ...flatFields
                }

                form.resetFields()
                form.setFieldsValue(initialValues)

                setAvatarUrl(data.avatarUrl || fallbackAvatar)
                setSignatureImage(userData?.signatureURL || null)
                setTypedName(userData?.name || fallbackName)
                setIsEditingDetails(false)
            } else {
                // First-time setup
                setParticipantDocId(null)
                const initialValues: ProfileValues = {
                    participantName: fallbackName,
                    email: authEmail
                }
                form.resetFields()
                form.setFieldsValue(initialValues)
                setSignatureImage(userData?.signatureURL || null)
                setTypedName(userData?.name || fallbackName)
                setIsEditingDetails(true)
            }

            setBootLoading(false)
        })

        return () => unsubscribe()
    }, [form])

    const saveAll = async () => {
        try {
            setSaving(true)
            const user = auth.currentUser
            if (!user) throw new Error('No authenticated user')

            const validated = await form.validateFields()
            const values = { ...form.getFieldsValue(true), ...validated }

            const uid = user.uid
            const nextEmail = toLowerTrim(values.email)
            const currentAuthEmail = toLowerTrim(user.email)

            // Date conversion
            if (values.dateOfRegistration && typeof values.dateOfRegistration?.toDate === 'function') {
                values.dateOfRegistration = Timestamp.fromDate(values.dateOfRegistration.toDate())
            }

            // Security: email change (requires reauth in some cases)
            const emailChanged = Boolean(nextEmail) && Boolean(currentAuthEmail) && nextEmail !== currentAuthEmail

            // Security: password change (only if toggled)
            if (changingPassword) {
                const oldPassword = values.oldPassword
                const newPassword = values.newPassword

                if (!oldPassword || !newPassword) {
                    message.error('Provide current and new password')
                    setSaving(false)
                    return
                }

                const cred = EmailAuthProvider.credential(user.email || '', oldPassword)
                await reauthenticateWithCredential(user, cred)
                await updatePassword(user, newPassword)

                form.resetFields(['oldPassword', 'newPassword'])
                setChangingPassword(false)
            }

            if (emailChanged) {
                try {
                    await updateEmail(user, nextEmail)
                } catch (e: any) {
                    message.error(
                        e?.code === 'auth/requires-recent-login'
                            ? 'Please log in again to change email.'
                            : 'Failed to change email.'
                    )
                    setSaving(false)
                    return
                }
            }

            // Display name sync
            const displayName = String(values.participantName || '').trim()
            if (displayName && user.displayName !== displayName) {
                await updateProfile(user, { displayName })
            }

            // Avatar upload
            const { avatarUrl: newAvatarUrl, avatarPath } = await uploadAvatarIfNeeded(uid, participantDocId)

            // Signature upload
            const signatureURL = await uploadSignatureIfNeeded(uid)

            // Participant payload
            const baseProfile: Record<string, any> = {
                uid,
                participantName: displayName,
                email: nextEmail,
                beneficiaryName: values.beneficiaryName,
                gender: values.gender,
                idNumber: values.idNumber,
                phone: values.phone,
                sector: values.sector,
                natureOfBusiness: values.natureOfBusiness,
                beeLevel: values.beeLevel,
                youthOwnedPercent: values.youthOwnedPercent,
                femaleOwnedPercent: values.femaleOwnedPercent,
                blackOwnedPercent: values.blackOwnedPercent,
                dateOfRegistration: values.dateOfRegistration,
                yearsOfTrading: values.yearsOfTrading,
                registrationNumber: values.registrationNumber,
                businessAddress: values.businessAddress,
                city: values.city,
                postalCode: values.postalCode,
                province: values.province,
                hub: values.hub,
                location: values.location,
                updatedAt: serverTimestamp()
            }

            if (newAvatarUrl) baseProfile.avatarUrl = newAvatarUrl
            if (avatarPath) baseProfile.avatarPath = avatarPath

            const participantPayload = metricsLocked ? baseProfile : { ...baseProfile, ...buildMetricsPayload(values) }

            const batch = writeBatch(db)

            // users/{uid} sync
            batch.set(
                doc(db, 'users', uid),
                {
                    name: displayName,
                    email: nextEmail,
                    ...(newAvatarUrl ? { photoURL: newAvatarUrl } : {}),
                    ...(signatureURL ? { signatureURL } : {}),
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            )

            // participants
            if (participantDocId) {
                batch.set(doc(db, 'participants', participantDocId), participantPayload, { merge: true })
            } else {
                const newRef = doc(collection(db, 'participants'))
                batch.set(newRef, { ...participantPayload, setup: true, createdAt: serverTimestamp() })
                setParticipantDocId(newRef.id)
            }

            // Migrate any applications keyed by email (legacy)
            if (emailChanged) {
                const appsByOldEmail = query(
                    collection(db, 'applications'),
                    where('email', '==', currentAuthEmail)
                )
                const appsSnap = await getDocs(appsByOldEmail)
                appsSnap.docs.forEach(d => {
                    batch.set(
                        d.ref,
                        { email: nextEmail, uid, updatedAt: serverTimestamp() },
                        { merge: true }
                    )
                })
            }

            await batch.commit()

            if (newAvatarUrl) setAvatarUrl(newAvatarUrl)
            if (signatureURL) setSignatureImage(signatureURL)

            setAvatarFile(null)
            setAvatarList([])
            setIsEditingDetails(false)

            message.success('Profile saved')
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to save profile')
        } finally {
            setSaving(false)
        }
    }

    const v = form.getFieldsValue(true) as any
    const headerName = v?.participantName || 'My Profile'
    const headerCompany = v?.beneficiaryName || ''
    const headerLocation = [v?.city, v?.province].filter(Boolean).join(', ')
    const showMetrics = !metricsLocked

    return (
        <>
            <Helmet>
                <title>Profile | Smart Incubation</title>
            </Helmet>

            {(bootLoading || saving) ? (
                <LoadingOverlay tip={saving ? 'Saving...' : 'Loading...'} />
            ) : (
                <div style={{ padding: 24, minHeight: '100vh' }}>
                    <Row gutter={[16, 16]}>
                        <Col span={24}>
                            <MotionCard
                                style={{ borderRadius: 12 }}
                                title={<Text strong>My Profile</Text>}
                                extra={
                                    <Space>
                                        <div
                                            style={{
                                                background: '#f5f7fa',
                                                padding: 6,
                                                borderRadius: 12,
                                                display: 'inline-flex',
                                                border: '1px solid #e5e7eb'
                                            }}
                                        >
                                            <Segmented
                                                value={segment}
                                                onChange={val => setSegment(val as SegmentKey)}
                                                options={[
                                                    {
                                                        label: (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <IdcardOutlined />
                                                                Details
                                                            </span>
                                                        ),
                                                        value: 'details'
                                                    },
                                                    {
                                                        label: (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <SafetyOutlined />
                                                                Security
                                                            </span>
                                                        ),
                                                        value: 'security'
                                                    }
                                                ]}
                                                style={{
                                                    background: 'transparent'
                                                }}
                                            />
                                        </div>
                                        {isUpdate && segment === 'details' && !isEditingDetails ? (
                                            <Button
                                                type='primary'
                                                icon={<EditOutlined />}
                                                onClick={() => setIsEditingDetails(true)}
                                            >
                                                Edit
                                            </Button>
                                        ) : null}
                                    </Space>
                                }
                            >
                                <Row gutter={[16, 16]} align='middle'>
                                    <Col flex='64px'>
                                        <Avatar
                                            size={56}
                                            src={avatarUrl || undefined}
                                            icon={!avatarUrl ? <UserOutlined /> : undefined}
                                        />
                                    </Col>

                                    <Col flex='auto'>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <Text strong style={{ fontSize: 16 }}>
                                                {headerName}
                                            </Text>
                                            {metricsLocked ? (
                                                <Tag icon={<LockOutlined />} color='default'>
                                                    Metrics locked
                                                </Tag>
                                            ) : null}
                                        </div>
                                        {headerCompany ? <Text type='secondary'>{headerCompany}</Text> : null}
                                        {headerLocation ? (
                                            <div>
                                                <Text type='secondary'>{headerLocation}</Text>
                                            </div>
                                        ) : null}
                                    </Col>

                                    <Col>
                                        <Upload accept='image/*' showUploadList={false} beforeUpload={pickAvatar}>
                                            <Button icon={<UploadOutlined />}>Change photo</Button>
                                        </Upload>
                                    </Col>
                                </Row>
                            </MotionCard>
                        </Col>

                        <Col span={24}>
                            <Form layout='vertical' form={form}>
                                {segment === 'details' ? (
                                    <>
                                        {!isEditingDetails && isUpdate ? (
                                            <Row gutter={[16, 16]}>
                                                <Col xs={24} lg={12}>
                                                    <MotionCard style={{ borderRadius: 12 }} title='Personal Information'>
                                                        <Descriptions column={1} size='small'>
                                                            <Descriptions.Item label='Owner Name'>
                                                                {v?.participantName || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Gender'>
                                                                {v?.gender || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='ID Number'>
                                                                {v?.idNumber || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Email'>
                                                                {v?.email || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Phone'>
                                                                {v?.phone || '-'}
                                                            </Descriptions.Item>
                                                        </Descriptions>
                                                    </MotionCard>
                                                </Col>

                                                <Col xs={24} lg={12}>
                                                    <MotionCard style={{ borderRadius: 12 }} title='Business Information'>
                                                        <Descriptions column={1} size='small'>
                                                            <Descriptions.Item label='Company Name'>
                                                                {v?.beneficiaryName || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Sector'>
                                                                {v?.sector || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Nature of Business'>
                                                                {v?.natureOfBusiness || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='B-BBEE Level'>
                                                                {v?.beeLevel || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Youth-Owned %'>
                                                                {typeof v?.youthOwnedPercent === 'number' ? `${v.youthOwnedPercent}%` : '-'}
                                                            </Descriptions.Item>

                                                            <Descriptions.Item label='Female-Owned %'>
                                                                {typeof v?.femaleOwnedPercent === 'number' ? `${v.femaleOwnedPercent}%` : '-'}
                                                            </Descriptions.Item>

                                                            <Descriptions.Item label='Black-Owned %'>
                                                                {typeof v?.blackOwnedPercent === 'number' ? `${v.blackOwnedPercent}%` : '-'}
                                                            </Descriptions.Item>

                                                        </Descriptions>
                                                    </MotionCard>
                                                </Col>

                                                <Col span={24}>
                                                    <MotionCard style={{ borderRadius: 12 }} title='Address'>
                                                        <Descriptions
                                                            size='small'
                                                            column={{ xs: 1, sm: 2, md: 3 }}
                                                            labelStyle={{ whiteSpace: 'nowrap' }}
                                                            contentStyle={{
                                                                wordBreak: 'break-word',
                                                                overflowWrap: 'anywhere',
                                                                whiteSpace: 'normal'
                                                            }}
                                                        >
                                                            <Descriptions.Item label='Business Address' span={3}>
                                                                {v?.businessAddress || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='City'>{v?.city || '-'}</Descriptions.Item>
                                                            <Descriptions.Item label='Postal Code'>
                                                                {v?.postalCode || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Province'>
                                                                {v?.province || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Host Community'>
                                                                {v?.hub || '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label='Location Type'>
                                                                {v?.location || '-'}
                                                            </Descriptions.Item>
                                                        </Descriptions>
                                                    </MotionCard>
                                                </Col>
                                            </Row>
                                        ) : (
                                            <MotionCard style={{ borderRadius: 12 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <Title level={5} style={{ margin: 0 }}>
                                                        {isUpdate ? 'Edit Details' : 'Set up your profile'}
                                                    </Title>

                                                    {isUpdate ? (
                                                        <Button
                                                            icon={<CloseOutlined />}
                                                            onClick={() => {
                                                                setIsEditingDetails(false)
                                                                setAvatarFile(null)
                                                                setAvatarList([])
                                                            }}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    ) : null}
                                                </div>

                                                <Divider orientation='left'>Personal Details</Divider>
                                                <Row gutter={16}>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item
                                                            name='participantName'
                                                            label='Owner Name'
                                                            rules={[{ required: true }]}
                                                        >
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>

                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='gender' label='Gender' rules={[{ required: true }]}>
                                                            <Select>
                                                                <Option value='Male'>Male</Option>
                                                                <Option value='Female'>Female</Option>
                                                                <Option value='Other'>Other</Option>
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>

                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='idNumber' label='ID Number' rules={[{ required: true }]}>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Row gutter={16}>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item
                                                            name='email'
                                                            label='Email'
                                                            rules={[{ required: true }, { type: 'email' }]}
                                                        >
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name='phone' label='Phone'>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Divider orientation='left'>Company Info</Divider>
                                                <Row gutter={16}>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item
                                                            name='beneficiaryName'
                                                            label='Company Name'
                                                            rules={[{ required: true }]}
                                                        >
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name='sector' label='Sector' rules={[{ required: true }]}>
                                                            <Select>
                                                                {sectors.map(s => (
                                                                    <Option key={s} value={s}>
                                                                        {s}
                                                                    </Option>
                                                                ))}
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Row>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name='natureOfBusiness'
                                                            label='Nature of Business (What your business offers)'
                                                        >
                                                            <Input.TextArea rows={3} />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Row gutter={16}>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name='beeLevel' label='B-BBEE Level'>
                                                            <Select>
                                                                {[1, 2, 3, 4].map(level => (
                                                                    <Option key={level} value={level}>
                                                                        Level {level}
                                                                    </Option>
                                                                ))}
                                                                <Option value='5+'>Level 5 and above</Option>
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name='youthOwnedPercent' label='Youth-Owned %'>
                                                            <InputNumber addonAfter='%' min={0} max={100} style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Row gutter={16}>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name='femaleOwnedPercent' label='Female-Owned %'>
                                                            <InputNumber addonAfter='%' min={0} max={100} style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={12}>
                                                        <Form.Item name='blackOwnedPercent' label='Black-Owned %'>
                                                            <InputNumber addonAfter='%' min={0} max={100} style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Row gutter={16}>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='dateOfRegistration' label='Date of Registration'>
                                                            <DatePicker style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='yearsOfTrading' label='Years of Trading'>
                                                            <InputNumber min={0} style={{ width: '100%' }} />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='registrationNumber' label='Registration Number'>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Divider orientation='left'>Location</Divider>
                                                <Row gutter={16}>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='businessAddress' label='Business Address'>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='city' label='City'>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='postalCode' label='Postal Code'>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Row gutter={16}>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='province' label='Province'>
                                                            <Select>
                                                                {provinces.map(p => (
                                                                    <Option key={p} value={p}>
                                                                        {p}
                                                                    </Option>
                                                                ))}
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='hub' label='Host Community'>
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col xs={24} md={8}>
                                                        <Form.Item name='location' label='Location Type'>
                                                            <Select>
                                                                <Option value='Urban'>Urban</Option>
                                                                <Option value='Rural'>Rural</Option>
                                                                <Option value='Township'>Township</Option>
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                {showMetrics ? (
                                                    <>
                                                        <Divider orientation='left'>Headcount & Revenue</Divider>

                                                        <Title level={5}>Monthly Data</Title>
                                                        {last3Months.map(month => (
                                                            <Row gutter={16} key={month}>
                                                                <Col xs={24} md={8}>
                                                                    <Form.Item name={`revenue_${month}`} label={`Revenue (${month})`}>
                                                                        <InputNumber
                                                                            style={{ width: '100%' }}
                                                                            formatter={val =>
                                                                                `R ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                                                            }
                                                                            parser={val =>
                                                                                Number(val?.replace(/R\s?|(,*)/g, '') || 0)
                                                                            }
                                                                        />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col xs={24} md={8}>
                                                                    <Form.Item name={`permHeadcount_${month}`} label='Permanent Staff'>
                                                                        <InputNumber min={0} style={{ width: '100%' }} />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col xs={24} md={8}>
                                                                    <Form.Item name={`tempHeadcount_${month}`} label='Temporary Staff'>
                                                                        <InputNumber min={0} style={{ width: '100%' }} />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>
                                                        ))}

                                                        <Title level={5}>Annual Data</Title>
                                                        {last2Years.map(year => (
                                                            <Row gutter={16} key={year}>
                                                                <Col xs={24} md={8}>
                                                                    <Form.Item name={`revenue_${year}`} label={`Revenue (${year})`}>
                                                                        <InputNumber
                                                                            style={{ width: '100%' }}
                                                                            formatter={val =>
                                                                                `R ${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                                                                            }
                                                                            parser={val =>
                                                                                Number(val?.replace(/R\s?|(,*)/g, '') || 0)
                                                                            }
                                                                        />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col xs={24} md={8}>
                                                                    <Form.Item name={`permHeadcount_${year}`} label='Permanent Staff'>
                                                                        <InputNumber min={0} style={{ width: '100%' }} />
                                                                    </Form.Item>
                                                                </Col>
                                                                <Col xs={24} md={8}>
                                                                    <Form.Item name={`tempHeadcount_${year}`} label='Temporary Staff'>
                                                                        <InputNumber min={0} style={{ width: '100%' }} />
                                                                    </Form.Item>
                                                                </Col>
                                                            </Row>
                                                        ))}
                                                    </>
                                                ) : null}

                                                <Divider />
                                                <Button
                                                    type='primary'
                                                    block
                                                    icon={isUpdate ? <EditOutlined /> : <SaveOutlined />}
                                                    onClick={saveAll}
                                                >
                                                    {isUpdate ? 'Update Profile' : 'Save Profile'}
                                                </Button>
                                            </MotionCard>
                                        )}
                                    </>
                                ) : (
                                    <Row gutter={[16, 16]}>
                                        <Col xs={24} lg={12}>
                                            <MotionCard style={{ borderRadius: 12 }} title='Account'>
                                                <Row gutter={16}>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name='participantName'
                                                            label='Owner Name'
                                                            rules={[{ required: true }]}
                                                        >
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={24}>
                                                        <Form.Item
                                                            name='email'
                                                            label='Email'
                                                            rules={[{ required: true }, { type: 'email' }]}
                                                        >
                                                            <Input />
                                                        </Form.Item>
                                                    </Col>
                                                </Row>

                                                <Divider />

                                                {!changingPassword ? (
                                                    <Button icon={<LockOutlined />} onClick={() => setChangingPassword(true)}>
                                                        Change Password
                                                    </Button>
                                                ) : (
                                                    <>
                                                        <Row gutter={16}>
                                                            <Col span={12}>
                                                                <Form.Item
                                                                    label='Current Password'
                                                                    name='oldPassword'
                                                                    rules={[{ required: true }]}
                                                                >
                                                                    <Input.Password />
                                                                </Form.Item>
                                                            </Col>
                                                            <Col span={12}>
                                                                <Form.Item
                                                                    label='New Password'
                                                                    name='newPassword'
                                                                    rules={[{ required: true }]}
                                                                >
                                                                    <Input.Password />
                                                                </Form.Item>
                                                            </Col>
                                                        </Row>
                                                        <Button
                                                            type='text'
                                                            danger
                                                            onClick={() => {
                                                                setChangingPassword(false)
                                                                form.resetFields(['oldPassword', 'newPassword'])
                                                            }}
                                                        >
                                                            Cancel Password Change
                                                        </Button>
                                                    </>
                                                )}

                                                <Divider />
                                                <Button
                                                    type='primary'
                                                    block
                                                    icon={<SaveOutlined />}
                                                    onClick={saveAll}
                                                >
                                                    Save Security Changes
                                                </Button>
                                            </MotionCard>
                                        </Col>

                                        <Col xs={24} lg={12}>
                                            <MotionCard style={{ borderRadius: 12 }} title='Signature'>
                                                {signatureImage ? (
                                                    <div style={{ marginBottom: 12 }}>
                                                        <img
                                                            src={signatureImage}
                                                            alt='signature'
                                                            style={{ maxWidth: 260, border: '1px solid #e5e7eb' }}
                                                        />
                                                    </div>
                                                ) : null}

                                                <Radio.Group
                                                    onChange={e => setSignatureType(e.target.value)}
                                                    value={signatureType}
                                                    style={{ marginBottom: 16 }}
                                                >
                                                    <Radio value='typed'>Typed</Radio>
                                                    <Radio value='drawn'>Drawn</Radio>
                                                </Radio.Group>

                                                {signatureType === 'typed' ? (
                                                    <>
                                                        <div style={{ marginBottom: 12 }}>
                                                            <Input
                                                                placeholder='Your full name'
                                                                value={typedName}
                                                                onChange={e => setTypedName(e.target.value)}
                                                                style={{ maxWidth: 360 }}
                                                            />
                                                        </div>

                                                        <div style={{ marginBottom: 12 }}>
                                                            <Select
                                                                value={typedFont}
                                                                onChange={val => setTypedFont(val)}
                                                                style={{ width: 240 }}
                                                            >
                                                                {fontOptions.map(f => (
                                                                    <Option key={f} value={f}>
                                                                        {f}
                                                                    </Option>
                                                                ))}
                                                            </Select>
                                                        </div>

                                                        <div
                                                            ref={styledRef}
                                                            style={{
                                                                fontFamily: typedFont,
                                                                fontSize: 40,
                                                                padding: '10px 20px',
                                                                border: '1px dashed #cbd5e1',
                                                                background: '#fff',
                                                                marginBottom: 12,
                                                                display: 'inline-block'
                                                            }}
                                                        >
                                                            {typedName || 'Your signature'}
                                                        </div>

                                                        <Space>
                                                            <Button type='primary' onClick={saveTypedSignature}>
                                                                Generate
                                                            </Button>
                                                            <Button
                                                                onClick={() => {
                                                                    setSignatureImage(null)
                                                                }}
                                                            >
                                                                Clear
                                                            </Button>
                                                        </Space>
                                                    </>
                                                ) : null}

                                                {signatureType === 'drawn' ? (
                                                    <>
                                                        <div
                                                            style={{
                                                                border: '1px dashed #cbd5e1',
                                                                width: '100%',
                                                                maxWidth: 420,
                                                                height: 170,
                                                                marginBottom: 12,
                                                                position: 'relative',
                                                                background: '#fff'
                                                            }}
                                                        >
                                                            <SignatureCanvas
                                                                ref={ref => {
                                                                    canvasRef.current = ref
                                                                }}
                                                                penColor='black'
                                                                canvasProps={{
                                                                    width: 420,
                                                                    height: 170,
                                                                    style: { background: 'white', width: '100%', height: '100%' }
                                                                }}
                                                            />
                                                        </div>
                                                        <Space>
                                                            <Button onClick={clearDrawnSignature}>Clear</Button>
                                                            <Button type='primary' onClick={saveDrawnSignature}>
                                                                Save
                                                            </Button>
                                                        </Space>
                                                    </>
                                                ) : null}

                                                <Divider />
                                                <Button type='primary' block icon={<SaveOutlined />} onClick={saveAll}>
                                                    Save Signature
                                                </Button>
                                            </MotionCard>
                                        </Col>
                                    </Row>
                                )}
                            </Form>
                        </Col>
                    </Row>
                </div>
            )}
        </>
    )
}

export default ProfileForm
