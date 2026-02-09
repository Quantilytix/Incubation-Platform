import React, { useEffect, useMemo, useState } from 'react'
import {
    Form,
    Input,
    Select,
    InputNumber,
    Divider,
    Row,
    Col,
    Button,
    DatePicker,
    Typography,
    message,
    Alert,
    Card,
    Descriptions,
    Avatar,
    Upload,
    Space,
    Tag
} from 'antd'
import type { UploadFile } from 'antd/es/upload/interface'
import {
    SaveOutlined,
    EditOutlined,
    CloseOutlined,
    UploadOutlined,
    UserOutlined,
    LockOutlined
} from '@ant-design/icons'
import { db, auth } from '@/firebase'
import {
    collection,
    getDocs,
    query,
    where,
    setDoc,
    doc,
    getDoc,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import dayjs from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'
import { MotionCard } from '@/components/shared/Header'

const { Title, Text } = Typography

type ProfileValues = Record<string, any>

const ProfileForm: React.FC = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [bootLoading, setBootLoading] = useState(true)
    const [form] = Form.useForm()

    const [participantDocId, setParticipantDocId] = useState<string | null>(null)
    const [metricsLocked, setMetricsLocked] = useState(false)
    const [isEditing, setIsEditing] = useState(false)

    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    const [avatarList, setAvatarList] = useState<UploadFile[]>([])

    const isUpdate = Boolean(participantDocId)

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async user => {
            if (!user) {
                setBootLoading(false)
                return
            }

            setBootLoading(true)

            const userRef = doc(db, 'users', user.uid)
            const userSnap = await getDoc(userRef)

            const fallbackEmail = user.email || ''
            const fallbackName = userSnap.exists() ? userSnap.data()?.name || '' : ''
            const fallbackAvatar = (userSnap.exists() ? userSnap.data()?.photoURL : null) || user.photoURL

            // Lock metrics if application exists with applicationStatus
            try {
                const appQ = query(
                    collection(db, 'applications'),
                    where('email', '==', fallbackEmail)
                )
                const appSnap = await getDocs(appQ)

                if (!appSnap.empty) {
                    const app = appSnap.docs[0].data() as any
                    setMetricsLocked(Boolean(app?.applicationStatus))
                } else {
                    setMetricsLocked(false)
                }
            } catch {
                setMetricsLocked(false)
            }

            const q = query(collection(db, 'participants'), where('email', '==', fallbackEmail))
            const snapshot = await getDocs(q)

            let initialValues: ProfileValues = {
                email: fallbackEmail,
                participantName: fallbackName
            }

            if (!snapshot.empty) {
                const docRef = snapshot.docs[0]
                const data = docRef.data() as any
                setParticipantDocId(docRef.id)

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

                const {
                    participantName,
                    email,
                    beneficiaryName,
                    gender,
                    idNumber,
                    phone,
                    sector,
                    natureOfBusiness,
                    beeLevel,
                    youthOwnedPercent,
                    femaleOwnedPercent,
                    blackOwnedPercent,
                    dateOfRegistration,
                    yearsOfTrading,
                    registrationNumber,
                    businessAddress,
                    city,
                    postalCode,
                    province,
                    hub,
                    location,
                    avatarUrl: savedAvatarUrl
                } = data

                initialValues = {
                    email: email ?? fallbackEmail,
                    participantName: participantName ?? fallbackName,
                    beneficiaryName,
                    gender,
                    idNumber,
                    phone,
                    sector,
                    natureOfBusiness,
                    beeLevel,
                    youthOwnedPercent,
                    femaleOwnedPercent,
                    blackOwnedPercent,
                    dateOfRegistration: dateOfRegistration
                        ? dayjs(dateOfRegistration.toDate?.() || dateOfRegistration)
                        : null,
                    yearsOfTrading,
                    registrationNumber,
                    businessAddress,
                    city,
                    postalCode,
                    province,
                    hub,
                    location,
                    ...flatFields
                }

                setAvatarUrl(savedAvatarUrl || fallbackAvatar || null)
                setIsEditing(false)
            } else {
                setParticipantDocId(null)
                setAvatarUrl(fallbackAvatar || null)
                setIsEditing(true)

                initialValues = {
                    email: fallbackEmail,
                    participantName: fallbackName
                }
            }

            form.resetFields()
            form.setFieldsValue(initialValues)

            setBootLoading(false)
        })

        return () => unsubscribe()
    }, [form])

    const uploadAvatarIfNeeded = async (uid: string, targetDocId?: string | null) => {
        if (!avatarFile) return { avatarUrl: undefined as string | undefined, avatarPath: undefined as string | undefined }

        const storage = getStorage()
        const safeId = targetDocId || uid
        const path = `participants/${safeId}/avatar_${Date.now()}_${avatarFile.name}`
        const r = storageRef(storage, path)

        await uploadBytes(r, avatarFile)
        const url = await getDownloadURL(r)

        return { avatarUrl: url, avatarPath: path }
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

    const onSave = async () => {
        try {
            setLoading(true)

            const validated = await form.validateFields()
            const values = { ...form.getFieldsValue(true), ...validated }

            if (
                values.dateOfRegistration &&
                typeof values.dateOfRegistration === 'object' &&
                typeof values.dateOfRegistration.toDate === 'function'
            ) {
                values.dateOfRegistration = Timestamp.fromDate(values.dateOfRegistration.toDate())
            }

            const user = auth.currentUser
            if (!user) throw new Error('User not authenticated')

            const {
                participantName,
                email,
                beneficiaryName,
                gender,
                idNumber,
                phone,
                sector,
                natureOfBusiness,
                beeLevel,
                youthOwnedPercent,
                femaleOwnedPercent,
                blackOwnedPercent,
                dateOfRegistration,
                yearsOfTrading,
                registrationNumber,
                businessAddress,
                city,
                postalCode,
                province,
                hub,
                location
            } = values

            const { avatarUrl: newAvatarUrl, avatarPath } = await uploadAvatarIfNeeded(
                user.uid,
                participantDocId
            )

            const baseProfile: Record<string, any> = {
                participantName,
                email,
                beneficiaryName,
                gender,
                idNumber,
                phone,
                sector,
                natureOfBusiness,
                beeLevel,
                youthOwnedPercent,
                femaleOwnedPercent,
                blackOwnedPercent,
                dateOfRegistration,
                yearsOfTrading,
                registrationNumber,
                businessAddress,
                city,
                postalCode,
                province,
                hub,
                location,
                updatedAt: serverTimestamp()
            }

            if (newAvatarUrl) baseProfile.avatarUrl = newAvatarUrl
            if (avatarPath) baseProfile.avatarPath = avatarPath

            // Always enforce: if metricsLocked, never write metrics regardless of UI state
            const payload = metricsLocked ? baseProfile : { ...baseProfile, ...buildMetricsPayload(values) }

            if (participantDocId) {
                await setDoc(doc(db, 'participants', participantDocId), payload, { merge: true })
                message.success('Profile updated successfully')
                if (newAvatarUrl) setAvatarUrl(newAvatarUrl)
                setIsEditing(false)
                setAvatarFile(null)
                setAvatarList([])
            } else {
                const newDocRef = doc(collection(db, 'participants'))
                await setDoc(newDocRef, { ...payload, setup: true, createdAt: serverTimestamp() })
                setParticipantDocId(newDocRef.id)
                message.success('Profile saved successfully')
                if (newAvatarUrl) setAvatarUrl(newAvatarUrl)
                setIsEditing(false)
                setAvatarFile(null)
                setAvatarList([])
                navigate('/incubatee/sme')
            }
        } catch (error) {
            console.error(error)
            message.error('Failed to save profile')
        } finally {
            setLoading(false)
        }
    }

    const onPickAvatar = (file: File) => {
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

    const v = form.getFieldsValue(true) as any
    const headerName = v?.participantName || 'My Profile'
    const headerCompany = v?.beneficiaryName || ''
    const headerLocation = [v?.city, v?.province].filter(Boolean).join(', ')
    const canShowMetrics = !metricsLocked

    const buttonText = isUpdate ? 'Update Profile' : 'Save Profile'
    const buttonIcon = isUpdate ? <EditOutlined /> : <SaveOutlined />

    return (
        <>
            <Helmet>
                <title>Profile Setup | Smart Incubation</title>
            </Helmet>

            {(bootLoading || loading) ? (
                <LoadingOverlay tip={loading ? 'Saving profile...' : 'Loading profile...'} />
            ) : (

                <div style={{ padding: 24, minHeight: '100vh' }}>
                    <Row gutter={[16, 16]}>
                        <Col span={24}>
                            <MotionCard
                                style={{ borderRadius: 12 }}
                                title={<Text strong>My Profile</Text>}
                                extra={
                                    isUpdate && !isEditing ? (
                                        <Button
                                            type='primary'
                                            icon={<EditOutlined />}
                                            onClick={() => setIsEditing(true)}
                                        >
                                            Edit
                                        </Button>
                                    ) : null
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
                                            {metricsLocked && (
                                                <Tag icon={<LockOutlined />} color='default'>
                                                    Metrics locked
                                                </Tag>
                                            )}
                                        </div>
                                        {headerCompany ? <Text type='secondary'>{headerCompany}</Text> : null}
                                        {headerLocation ? (
                                            <div>
                                                <Text type='secondary'>{headerLocation}</Text>
                                            </div>
                                        ) : null}
                                    </Col>
                                    <Col>
                                        {isEditing && (
                                            <Upload
                                                accept='image/*'
                                                showUploadList={false}
                                                beforeUpload={onPickAvatar}
                                            >
                                                <Button icon={<UploadOutlined />}>Change photo</Button>
                                            </Upload>
                                        )}
                                    </Col>
                                </Row>
                            </MotionCard>
                        </Col>

                        {!isEditing && isUpdate ? (
                            <>
                                <Col xs={24} lg={12}>
                                    <MotionCard
                                        style={{ borderRadius: 12 }}
                                        bodyStyle={{ padding: 16 }}
                                        title='Personal Information'
                                    >
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
                                    <MotionCard
                                        style={{ borderRadius: 12 }}
                                        bodyStyle={{ padding: 16 }}
                                        title='Business Information'
                                    >
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
                                                {typeof v?.youthOwnedPercent === 'number'
                                                    ? `${v?.youthOwnedPercent}%`
                                                    : '-'}
                                            </Descriptions.Item>
                                            <Descriptions.Item label='Female-Owned %'>
                                                {typeof v?.femaleOwnedPercent === 'number'
                                                    ? `${v?.femaleOwnedPercent}%`
                                                    : '-'}
                                            </Descriptions.Item>
                                            <Descriptions.Item label='Black-Owned %'>
                                                {typeof v?.blackOwnedPercent === 'number'
                                                    ? `${v?.blackOwnedPercent}%`
                                                    : '-'}
                                            </Descriptions.Item>
                                        </Descriptions>
                                    </MotionCard>
                                </Col>

                                <Col span={24}>
                                    <MotionCard
                                        style={{ borderRadius: 12 }}
                                        bodyStyle={{ padding: 16 }}
                                        title='Address'
                                    >
                                        <Descriptions
                                            size="small"
                                            column={{ xs: 1, sm: 2, md: 3 }}
                                            labelStyle={{ whiteSpace: 'nowrap' }}
                                            contentStyle={{
                                                wordBreak: 'break-word',
                                                overflowWrap: 'anywhere',
                                                whiteSpace: 'normal'
                                            }}
                                        >
                                            <Descriptions.Item label="Business Address" span={3}>
                                                {v?.businessAddress || '-'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="City">
                                                {v?.city || '-'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Postal Code">
                                                {v?.postalCode || '-'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Province">
                                                {v?.province || '-'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Host Community">
                                                {v?.hub || '-'}
                                            </Descriptions.Item>

                                            <Descriptions.Item label="Location Type">
                                                {v?.location || '-'}
                                            </Descriptions.Item>
                                        </Descriptions>

                                    </MotionCard>
                                </Col>
                            </>
                        ) : (
                            <Col span={24}>
                                <MotionCard style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <Title level={5} style={{ margin: 0 }}>
                                            {isUpdate ? 'Edit Profile' : 'Set up your profile'}
                                        </Title>

                                        {isUpdate && (
                                            <Button
                                                icon={<CloseOutlined />}
                                                onClick={() => {
                                                    setIsEditing(false)
                                                    setAvatarFile(null)
                                                    setAvatarList([])
                                                }}
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>

                                    {avatarList.length > 0 && (
                                        <div style={{ marginBottom: 12 }}>
                                            <Upload
                                                accept='image/*'
                                                beforeUpload={onPickAvatar}
                                                fileList={avatarList}
                                                onRemove={() => {
                                                    setAvatarFile(null)
                                                    setAvatarList([])
                                                }}
                                                maxCount={1}
                                            >
                                                <Button icon={<UploadOutlined />}>Change photo</Button>
                                            </Upload>
                                        </div>
                                    )}

                                    <Form layout='vertical' form={form}>
                                        <Divider orientation='left'>Personal Details</Divider>
                                        <Row gutter={16}>
                                            <Col xs={24} md={8}>
                                                <Form.Item
                                                    name='participantName'
                                                    label='Owner Name'
                                                    rules={[{ required: true }]}
                                                >
                                                    <Input disabled />
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item
                                                    name='gender'
                                                    label='Gender'
                                                    rules={[{ required: true }]}
                                                >
                                                    <Select>
                                                        <Select.Option value='Male'>Male</Select.Option>
                                                        <Select.Option value='Female'>Female</Select.Option>
                                                        <Select.Option value='Other'>Other</Select.Option>
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Form.Item
                                                    name='idNumber'
                                                    label='ID Number'
                                                    rules={[{ required: true }]}
                                                >
                                                    <Input />
                                                </Form.Item>
                                            </Col>
                                        </Row>

                                        <Row gutter={16}>
                                            <Col xs={24} md={12}>
                                                <Form.Item name='email' label='Email' rules={[{ type: 'email' }]}>
                                                    <Input disabled />
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
                                                        {sectors.map(sector => (
                                                            <Select.Option key={sector} value={sector}>
                                                                {sector}
                                                            </Select.Option>
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
                                                            <Select.Option key={level} value={level}>
                                                                Level {level}
                                                            </Select.Option>
                                                        ))}
                                                        <Select.Option key='5plus' value='5+'>
                                                            Level 5 and above
                                                        </Select.Option>
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
                                                            <Select.Option key={p} value={p}>
                                                                {p}
                                                            </Select.Option>
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
                                                        <Select.Option value='Urban'>Urban</Select.Option>
                                                        <Select.Option value='Rural'>Rural</Select.Option>
                                                        <Select.Option value='Township'>Township</Select.Option>
                                                    </Select>
                                                </Form.Item>
                                            </Col>
                                        </Row>

                                        {canShowMetrics && (
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
                                                                    parser={val => Number(val?.replace(/R\s?|(,*)/g, '') || 0)}
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
                                                                    parser={val => Number(val?.replace(/R\s?|(,*)/g, '') || 0)}
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
                                        )}

                                        <Divider />

                                        <Space style={{ width: '100%' }} direction='vertical'>
                                            <Button type='primary' onClick={onSave} block icon={buttonIcon}>
                                                {buttonText}
                                            </Button>

                                            {isUpdate && (
                                                <Button
                                                    block
                                                    icon={<CloseOutlined />}
                                                    onClick={() => {
                                                        setIsEditing(false)
                                                        setAvatarFile(null)
                                                        setAvatarList([])
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                        </Space>
                                    </Form>
                                </MotionCard>
                            </Col>
                        )}
                    </Row>
                </div>
            )}
        </>
    )
}

export default ProfileForm
