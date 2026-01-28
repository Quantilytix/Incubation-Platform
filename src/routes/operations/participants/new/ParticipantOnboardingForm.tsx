import React, { useEffect, useMemo, useState } from 'react'
import {
    Form,
    Input,
    Button,
    Select,
    Steps,
    Card,
    Row,
    Col,
    message,
    Space,
    Tag,
    InputNumber,
    DatePicker,
    Divider,
    Descriptions,
    Checkbox,
    Collapse,
    Empty,
    Upload,
    Alert,
    Progress
} from 'antd'
import { RightCircleFilled, UploadOutlined } from '@ant-design/icons'
import { auth, db, storage } from '@/firebase'
import {
    collection,
    getDocs,
    addDoc,
    query,
    where,
    Timestamp,
    doc,
    setDoc
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useFullIdentity } from '@/hooks/useFullIdentity'

const { Option } = Select
const { Step } = Steps

const stages = ['Startup', 'Growth', 'Mature', 'Decline']
const provinces = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape'
]
const developmentTypes = ['Enterprise Development', 'Supplier Development']

const sectors = [
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
]

const getAgeGroup = (age: number) => {
    if (age <= 18) return 'Youth'
    if (age <= 35) return 'Youth'
    if (age <= 59) return 'Adult'
    return 'Senior'
}

const getAgeFromID = (id: string): number => {
    if (!id || id.length < 6) return 0
    const birthYear = parseInt(id.substring(0, 2), 10)
    const birthMonth = parseInt(id.substring(2, 4), 10) - 1
    const birthDay = parseInt(id.substring(4, 6), 10)

    const currentYear = new Date().getFullYear()
    const century = birthYear <= currentYear % 100 ? 2000 : 1900
    const birthDate = new Date(century + birthYear, birthMonth, birthDay)

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--

    return Number.isFinite(age) && age > 0 && age < 120 ? age : 0
}



type InterventionOpt = { id: string; title: string; area?: string }

// ✅ SWOT state (local UI + synced into Form)
type SwotKey = 'strengths' | 'weaknesses' | 'opportunities' | 'threats'
type SwotState = Record<SwotKey, string[]>

// =====================
// ✅ Compliance config
// =====================
type DocCfg = { type: string; requiresExpiry: boolean }

const documentConfig: DocCfg[] = [
    { type: 'Certified ID Copy', requiresExpiry: false },
    { type: 'Proof of Address', requiresExpiry: false },
    { type: 'B-BBEE Certificate', requiresExpiry: true },
    { type: 'Tax PIN', requiresExpiry: true },
    { type: 'CIPC', requiresExpiry: true },
    { type: 'Management Accounts', requiresExpiry: true },
    { type: 'Three Months Bank Statements', requiresExpiry: true }
]

type ComplianceDocDraft = DocCfg & {
    file: File | null
    expiryDate: dayjs.Dayjs | null
}

type UploadedComplianceDoc = {
    type: string
    requiresExpiry: boolean
    url: string | null
    fileName: string | null
    expiryDate: string | null
    status: 'valid' | 'missing' | 'expiring' | 'expired' | 'upload_failed'
}

export const ParticipantOnboardingForm: React.FC = () => {
    const [form] = Form.useForm()
    const navigate = useNavigate()
    const { user } = useFullIdentity()

    const [currentStep, setCurrentStep] = useState(0)
    const [interventionsOptions, setInterventionsOptions] = useState<InterventionOpt[]>([])
    const [selectedInterventions, setSelectedInterventions] = useState<InterventionOpt[]>([])
    const [selectedSector, setSelectedSector] = useState<string>('')
    const [loading, setLoading] = useState(false)

    const [interventionSearch, setInterventionSearch] = useState('')

    const idNumber = Form.useWatch('idNumber', form)

    // ✅ Compliance state
    const [documentFields, setDocumentFields] = useState<ComplianceDocDraft[]>(
        documentConfig.map(d => ({ ...d, file: null, expiryDate: null }))
    )
    const [uploadingDocs, setUploadingDocs] = useState(false)
    const [complianceScore, setComplianceScore] = useState(0)

    const [swot, setSwot] = useState<SwotState>({
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: []
    })

    const groupedByArea = useMemo(() => {
        const q = interventionSearch.trim().toLowerCase()

        const filtered = q
            ? interventionsOptions.filter(i =>
                `${i.title} ${i.area || ''}`.toLowerCase().includes(q)
            )
            : interventionsOptions

        const map = new Map<string, InterventionOpt[]>()
        filtered.forEach(i => {
            const area = i.area || 'Other'
            map.set(area, [...(map.get(area) || []), i])
        })

        const areas = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
        return areas.map(([area, items]) => ({
            area,
            items: items.sort((a, b) => a.title.localeCompare(b.title))
        }))
    }, [interventionsOptions, interventionSearch])

    // ✅ same dynamic periods as ProfileForm
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

    // =====================
    // ✅ Fetch interventions
    // =====================
    useEffect(() => {
        const fetchInterventions = async () => {
            try {
                if (!user?.companyCode) return

                const q = query(
                    collection(db, 'interventions'),
                    where('companyCode', '==', user.companyCode)
                )

                const snapshot = await getDocs(q)

                const interventionsList: InterventionOpt[] = snapshot.docs.map(d => {
                    const data: any = d.data()
                    return {
                        id: data.id || d.id,
                        title: data.interventionTitle || data.title || 'Untitled',
                        area: data.areaOfSupport || data.area || ''
                    }
                })

                setInterventionsOptions(interventionsList)
            } catch (error) {
                console.error('Error fetching interventions:', error)
            }
        }

        fetchInterventions()
    }, [user?.companyCode])

    const handleRemoveIntervention = (id: string) => {
        setSelectedInterventions(prev => prev.filter(i => i.id !== id))
    }

    useEffect(() => {
        if (!idNumber) return
        const age = getAgeFromID(String(idNumber))
        if (age > 0) form.setFieldsValue({ age })
    }, [idNumber, form])

    // =====================
    // ✅ Step validation map
    // =====================
    const stepFieldNames: string[][] = useMemo(
        () => [
            // 0: Owner/Profile
            [
                'participantName',
                'gender',
                'idNumber',
                'phone',
                'beeLevel',
                'youthOwnedPercent',
                'femaleOwnedPercent',
                'blackOwnedPercent',
                'dateOfRegistration',
                'yearsOfTrading',
                'registrationNumber'
            ],
            // 1: Basic Info
            ['enterpriseName', 'email', 'sector', 'otherSector', 'stage', 'developmentType', 'age', 'incubatorCode'],
            // 2: Business Info
            [
                'natureOfBusiness',
                'businessAddress',
                'businessAddressProvince',
                'businessAddressCity',
                'locationType',
                'postalCode',
                'hub',
                'location',
                'websiteUrl',
                'facebook',
                'instagram',
                'x',
                'linkedIn',
                'other',
                'swot'
            ],
            // 3: Revenue & Employees
            [
                ...last3Months.flatMap(m => [`revenue_${m}`, `permHeadcount_${m}`, `tempHeadcount_${m}`]),
                ...last2Years.flatMap(y => [`revenue_${y}`, `permHeadcount_${y}`, `tempHeadcount_${y}`])
            ],
            // 4: Interventions
            [],
            // 5: Compliance (we validate in-place: expiry required if file present and requiresExpiry)
            [],
            // 6: Review
            []
        ],
        [last3Months, last2Years]
    )

    const createParticipantAccount = async (payload: {
        email: string
        name: string
        companyCode: string
    }) => {
        const currentUser = auth.currentUser
        if (!currentUser) throw new Error('Not authenticated')

        const token = await currentUser.getIdToken()

        console.log("createParticipantAccount payload:", payload)

        const res = await fetch(
            'https://us-central1-incubation-platform-61610.cloudfunctions.net/createParticipantAccount',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            }
        )

        const data = await res.json()
        if (!res.ok || !data?.ok) {
            throw new Error(data?.error || 'Failed to create user account')
        }

        return data
    }

    const addSwotItem = (key: SwotKey, raw: string) => {
        const value = String(raw || '').trim()
        if (!value) return

        setSwot(prev => {
            // de-dupe (case-insensitive)
            const exists = prev[key].some(x => x.toLowerCase() === value.toLowerCase())
            if (exists) return prev

            const next = { ...prev, [key]: [...prev[key], value] }
            // keep form in sync
            form.setFieldsValue({ swot: next })
            return next
        })
    }

    const removeSwotItem = (key: SwotKey, item: string) => {
        setSwot(prev => {
            const next = { ...prev, [key]: prev[key].filter(x => x !== item) }
            form.setFieldsValue({ swot: next })
            return next
        })
    }



    const handleNext = async () => {
        try {
            const fields = stepFieldNames[currentStep] || []
            if (fields.length) await form.validateFields(fields)

            // ✅ extra compliance validation when leaving compliance step
            if (steps[currentStep]?.title === 'Compliance') {
                const missingExpiry = documentFields.filter(d => d.requiresExpiry && d.file && !d.expiryDate)
                if (missingExpiry.length) {
                    message.error('Please set expiry dates for documents that require expiry.')
                    return
                }
            }

            setCurrentStep(prev => prev + 1)
        } catch (error) {
            console.error(error)
        }
    }

    const handlePrev = () => {
        setCurrentStep(prev => prev - 1)
    }

    const buildHistoriesFromForm = (values: any) => {
        const monthly: Record<string, any> = {}
        const annual: Record<string, any> = {}

        Object.entries(values).forEach(([key, value]) => {
            if (key.startsWith('revenue_')) {
                const suffix = key.replace('revenue_', '')
                const isYear = !isNaN(Number(suffix))
                const target = isYear ? annual : monthly
                if (!target[suffix]) target[suffix] = {}
                target[suffix].revenue = value ?? 0
            }

            if (key.startsWith('permHeadcount_')) {
                const suffix = key.replace('permHeadcount_', '')
                const isYear = !isNaN(Number(suffix))
                const target = isYear ? annual : monthly
                if (!target[suffix]) target[suffix] = {}
                target[suffix].permanent = value ?? 0
            }

            if (key.startsWith('tempHeadcount_')) {
                const suffix = key.replace('tempHeadcount_', '')
                const isYear = !isNaN(Number(suffix))
                const target = isYear ? annual : monthly
                if (!target[suffix]) target[suffix] = {}
                target[suffix].temporary = value ?? 0
            }
        })

        const headcountHistory = {
            monthly: Object.fromEntries(
                Object.entries(monthly).map(([k, v]) => [
                    k,
                    { permanent: v.permanent ?? 0, temporary: v.temporary ?? 0 }
                ])
            ),
            annual: Object.fromEntries(
                Object.entries(annual).map(([k, v]) => [
                    k,
                    { permanent: v.permanent ?? 0, temporary: v.temporary ?? 0 }
                ])
            )
        }

        const revenueHistory = {
            monthly: Object.fromEntries(Object.entries(monthly).map(([k, v]) => [k, v.revenue ?? 0])),
            annual: Object.fromEntries(Object.entries(annual).map(([k, v]) => [k, v.revenue ?? 0]))
        }

        return { headcountHistory, revenueHistory }
    }

    // ==========================
    // ✅ Compliance helper logic
    // ==========================
    const getDocStatus = (doc: { file: File | null; requiresExpiry: boolean; expiryDate: dayjs.Dayjs | null }) => {
        if (!doc.file) return 'missing' as const
        if (!doc.requiresExpiry) return 'valid' as const
        if (!doc.expiryDate) return 'expired' as const // treat as invalid if required and not set

        const today = dayjs()
        const oneWeekFromNow = today.add(7, 'day')

        if (doc.expiryDate.isBefore(today, 'day')) return 'expired' as const
        if (doc.expiryDate.isBefore(oneWeekFromNow, 'day')) return 'expiring' as const
        return 'valid' as const
    }

    const calculateCompliance = (docs: { status: string }[]) => {
        const total = docs.length
        if (!total) return 0
        const validCount = docs.filter(d => d.status === 'valid').length
        return Math.round((validCount / total) * 100)
    }

    // live score while user edits docs
    useEffect(() => {
        const statuses = documentFields.map(d => ({ status: getDocStatus(d) }))
        setComplianceScore(calculateCompliance(statuses))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [documentFields])

    const handleFileUpload = (file: File, index: number) => {
        const updated = [...documentFields]
        updated[index].file = file
        setDocumentFields(updated)
        return false // prevent auto upload
    }

    const uploadFileAndGetURL = async (file: File, folder = 'participant_documents') => {
        const fileName = `${Date.now()}_${file.name}`
        const fileRef = ref(storage, `${folder}/${fileName}`)
        await uploadBytes(fileRef, file)
        const url = await getDownloadURL(fileRef)
        return { url, name: fileName }
    }

    const uploadAllDocuments = async (): Promise<UploadedComplianceDoc[]> => {
        const uploaded: UploadedComplianceDoc[] = []

        for (const d of documentFields) {
            if (!d.file) {
                uploaded.push({
                    type: d.type,
                    requiresExpiry: d.requiresExpiry,
                    url: null,
                    fileName: null,
                    expiryDate: null,
                    status: 'missing'
                })
                continue
            }

            try {
                const { url, name } = await uploadFileAndGetURL(d.file)
                const status = getDocStatus(d)

                uploaded.push({
                    type: d.type,
                    requiresExpiry: d.requiresExpiry,
                    url,
                    fileName: name,
                    expiryDate: d.requiresExpiry ? (d.expiryDate?.format('YYYY-MM-DD') || null) : null,
                    status
                })
            } catch (e) {
                console.error('Upload failed:', d.type, e)
                uploaded.push({
                    type: d.type,
                    requiresExpiry: d.requiresExpiry,
                    url: null,
                    fileName: null,
                    expiryDate: d.requiresExpiry ? (d.expiryDate?.format('YYYY-MM-DD') || null) : null,
                    status: 'upload_failed'
                })
            }
        }

        return uploaded
    }

    const getMissingDocuments = () => documentFields.filter(d => !d.file)
    const getExpiredOrExpiringDocuments = () =>
        documentFields.filter(d => {
            const s = getDocStatus(d)
            return s === 'expired' || s === 'expiring'
        })

    // =====================
    // Submit
    // =====================
    const handleFinish = async () => {
        setLoading(true)

        try {
            const values = form.getFieldsValue(true)

            const email = String(values.email || '').trim()
            const name = String(values.participantName || '').trim()
            const companyCode = String(user?.companyCode || '').trim()

            const registeredBy = {
                uid: user?.uid || auth.currentUser?.uid || null,
                email: user?.email || auth.currentUser?.email || null,
                name: user?.name || user?.displayName || null,
                createdAt: Timestamp.now()
            }


            if (!email || !name || !companyCode) {
                message.error('Missing participant name, email, or company code.')
                return
            }

            // convert date to Firestore Timestamp
            let dateOfRegistration = values.dateOfRegistration
            if (dateOfRegistration && typeof dateOfRegistration?.toDate === 'function') {
                dateOfRegistration = Timestamp.fromDate(dateOfRegistration.toDate())
            }

            // upload documents
            setUploadingDocs(true)
            const uploadedDocs = await uploadAllDocuments()
            setUploadingDocs(false)

            const computedScore = calculateCompliance(uploadedDocs)
            const MIN_SCORE = 10
            if (computedScore < MIN_SCORE) {
                message.error(`Compliance must be ${MIN_SCORE}% or higher. Your current score is ${computedScore}%.`)
                return
            }

            // Create Auth account ONCE
            const account = await createParticipantAccount({ email, name, companyCode })
            const authUid = account.uid

            const { headcountHistory, revenueHistory } = buildHistoriesFromForm(values)

            // Normalize selected interventions ONCE (this will go into applications)
            const requiredInterventions = selectedInterventions.map(i => ({
                title: i.title,
                id: i.id,
                area: i.area || ''
            }))

            // participants = profile + compliance + histories (NO required interventions here)
            const participant = {
                companyCode,
                authUid,

                participantName: values.participantName,
                gender: values.gender,
                idNumber: values.idNumber,
                phone: values.phone || '',
                beeLevel: values.beeLevel || '',
                youthOwnedPercent: values.youthOwnedPercent ?? 0,
                femaleOwnedPercent: values.femaleOwnedPercent ?? 0,
                blackOwnedPercent: values.blackOwnedPercent ?? 0,
                dateOfRegistration: dateOfRegistration || null,
                yearsOfTrading: values.yearsOfTrading ?? 0,
                registrationNumber: values.registrationNumber || '',

                beneficiaryName: values.enterpriseName,
                email: values.email,
                sector: values.sector === 'Other' ? values.otherSector : values.sector,
                stage: values.stage,
                developmentType: values.developmentType,
                age: values.age,
                ageGroup: getAgeGroup(Number(values.age)),
                incubatorCode: values.incubatorCode || '',
                swot: form.getFieldValue('swot') || swot,


                natureOfBusiness: values.natureOfBusiness || '',
                businessAddress: values.businessAddress,
                businessAddressProvince: values.businessAddressProvince,
                businessAddressCity: values.businessAddressCity,

                // duplicates for older participant schema fields (province/city/locationType)
                province: values.businessAddressProvince,
                city: values.businessAddressCity,
                location: values.location || '',
                postalCode: values.postalCode,
                hub: values.hub || '',
                locationType: values.locationType,

                websiteUrl: values.websiteUrl || '',
                socialMedia: {
                    facebook: values.facebook || '',
                    instagram: values.instagram || '',
                    x: values.x || '',
                    linkedIn: values.linkedIn || '',
                    other: values.other || ''
                },

                complianceScore: computedScore,
                complianceDocuments: uploadedDocs,

                // keep interventions container, but NO required here
                interventions: {
                    assigned: [],
                    completed: [],
                    participationRate: 0
                },

                revenueHistory,
                headcountHistory,

                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }

            // 1) Save participant (capture id)
            const participantRef = await addDoc(collection(db, 'participants'), participant)
            const participantId = participantRef.id

            // 2) Save manual application (this is where required interventions belong)
            const manualApplication = {
                participantId,
                companyCode,

                registeredBy,

                // if you later add activeProgramId/programName, plug them in here
                programId: null,
                programName: null,

                applicationStatus: 'accepted',
                manuallyCreated: true,

                swot: form.getFieldValue('swot') || swot,

                submittedAt: Timestamp.now(),
                acceptedAt: Timestamp.now(),

                // fields commonly used by applications views
                beneficiaryName: participant.beneficiaryName,
                participantName: participant.participantName,
                email: participant.email,
                gender: participant.gender,
                ageGroup: participant.ageGroup,
                stage: participant.stage,
                province: participant.province,
                hub: participant.hub,

                complianceScore: participant.complianceScore,
                complianceDocuments: participant.complianceDocuments,

                interventions: {
                    required: requiredInterventions, // moved here
                    assigned: [],
                    completed: [],
                    participationRate: 0
                },

                // no AI
                aiEvaluation: null,
                growthPlanDocUrl: null,

                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            }

            // deterministic ID prevents duplicates
            await setDoc(doc(db, 'applications', participantId), manualApplication)

            message.success('Participant successfully onboarded!')
            navigate('/operations/participants')
        } catch (error: any) {
            console.error('Error adding participant:', error)
            message.error(error?.message || 'Failed to onboard participant.')
        } finally {
            setUploadingDocs(false)
            setLoading(false)
        }
    }


    // =====================
    // Review rendering
    // =====================
    const renderReview = () => {
        const v = form.getFieldsValue(true)
        const sectorValue = v?.sector === 'Other' ? v?.otherSector : v?.sector

        return (
            <>
                <Divider orientation="left">Owner / Profile</Divider>
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Owner Name">{v?.participantName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Gender">{v?.gender || '-'}</Descriptions.Item>
                    <Descriptions.Item label="ID Number">{v?.idNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Phone">{v?.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="B-BBEE Level">{v?.beeLevel || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Youth-Owned %">{v?.youthOwnedPercent ?? 0}%</Descriptions.Item>
                    <Descriptions.Item label="Female-Owned %">{v?.femaleOwnedPercent ?? 0}%</Descriptions.Item>
                    <Descriptions.Item label="Black-Owned %">{v?.blackOwnedPercent ?? 0}%</Descriptions.Item>
                    <Descriptions.Item label="Registration Date">
                        {v?.dateOfRegistration ? dayjs(v.dateOfRegistration).format('YYYY-MM-DD') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Years Trading">{v?.yearsOfTrading ?? '-'}</Descriptions.Item>
                    <Descriptions.Item label="Registration #">{v?.registrationNumber || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Incubator Code">{v?.incubatorCode || '-'}</Descriptions.Item>
                </Descriptions>

                <Divider orientation="left">Company / Basic Info</Divider>
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Company Name">{v?.enterpriseName || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Email">{v?.email || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Sector">{sectorValue || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Stage">{v?.stage || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Development Type">{v?.developmentType || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Age">{v?.age ?? '-'}</Descriptions.Item>
                </Descriptions>

                <Divider orientation="left">Business / Location</Divider>
                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Business Address" span={2}>{v?.businessAddress || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Province">{v?.businessAddressProvince || '-'}</Descriptions.Item>
                    <Descriptions.Item label="City">{v?.businessAddressCity || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Location Type">{v?.locationType || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Postal Code">{v?.postalCode || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Host Community">{v?.hub || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Location / Area Name">{v?.location || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Nature of Business" span={2}>{v?.natureOfBusiness || '-'}</Descriptions.Item>
                </Descriptions>

                <Divider orientation="left">SWOT</Divider>
                <Descriptions bordered size="small" column={1}>
                    {(['strengths', 'weaknesses', 'opportunities', 'threats'] as SwotKey[]).map(k => (
                        <Descriptions.Item
                            key={k}
                            label={k.charAt(0).toUpperCase() + k.slice(1)}
                        >
                            {(form.getFieldValue('swot')?.[k] || swot[k])?.length ? (
                                <Space wrap>
                                    {(form.getFieldValue('swot')?.[k] || swot[k]).map((x: string) => (
                                        <Tag key={x}>• {x}</Tag>
                                    ))}
                                </Space>
                            ) : (
                                '-'
                            )}
                        </Descriptions.Item>
                    ))}
                </Descriptions>

                <Divider orientation="left">Compliance</Divider>
                <Alert
                    type={complianceScore >= 10 ? 'success' : 'warning'}
                    showIcon
                    message={`Compliance Score: ${complianceScore}%`}
                    description={
                        <>
                            {getMissingDocuments().length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <strong>Missing:</strong>{' '}
                                    {getMissingDocuments().map(d => d.type).join(', ')}
                                </div>
                            )}
                            {getExpiredOrExpiringDocuments().length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <strong>Expired/Expiring:</strong>{' '}
                                    {getExpiredOrExpiringDocuments().map(d => d.type).join(', ')}
                                </div>
                            )}
                        </>
                    }
                />

                <Divider orientation="left">Interventions</Divider>
                <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label="Selected Interventions">
                        {selectedInterventions.length ? (
                            <Space wrap>
                                {selectedInterventions.map(i => (
                                    <Tag key={i.id}>{i.title}{i.area ? ` (${i.area})` : ''}</Tag>
                                ))}
                            </Space>
                        ) : (
                            '-'
                        )}
                    </Descriptions.Item>
                </Descriptions>
            </>
        )
    }

    // =====================
    // ✅ Steps
    // =====================
    const steps = [
        {
            title: 'Owner/Profile',
            content: (
                <>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="participantName" label="Owner Name" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
                                <Select placeholder="Select gender">
                                    <Option value="Male">Male</Option>
                                    <Option value="Female">Female</Option>
                                    <Option value="Other">Other</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="idNumber" label="ID Number" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="phone" label="Phone">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="beeLevel" label="B-BBEE Level">
                                <Select placeholder="Select level">
                                    {[1, 2, 3, 4].map(level => (
                                        <Option key={level} value={`Level ${level}`}>Level {level}</Option>
                                    ))}
                                    <Option value="Level 5 and above">Level 5 and above</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="dateOfRegistration" label="Date of Registration">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="youthOwnedPercent" label="Youth-Owned %">
                                <InputNumber addonAfter="%" min={0} max={100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="femaleOwnedPercent" label="Female-Owned %">
                                <InputNumber addonAfter="%" min={0} max={100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item name="blackOwnedPercent" label="Black-Owned %">
                                <InputNumber addonAfter="%" min={0} max={100} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="yearsOfTrading" label="Years of Trading">
                                <InputNumber min={0} style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="registrationNumber" label="Registration Number">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>
                </>
            )
        },
        {
            title: 'Basic Info',
            content: (
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="enterpriseName"
                            label="Enterprise Name"
                            rules={[{ required: true }]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                            name="email"
                            label="Email"
                            rules={[{ type: 'email', required: true }]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item
                            name="sector"
                            label="Sector"
                            rules={[{ required: true }]}
                        >
                            <Select placeholder="Select sector" onChange={v => setSelectedSector(v)}>
                                {sectors.map(s => (
                                    <Option key={s} value={s}>{s}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        {selectedSector === 'Other' && (
                            <Form.Item
                                name="otherSector"
                                label="Specify Other Sector"
                                rules={[{ required: true }]}
                            >
                                <Input />
                            </Form.Item>
                        )}
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="stage"
                            label="Company Stage"
                            rules={[{ required: true }]}
                        >
                            <Select placeholder="Select stage">
                                {stages.map(stage => (
                                    <Option key={stage} value={stage}>{stage}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="developmentType"
                            label="Development Type"
                            rules={[{ required: true }]}
                        >
                            <Select placeholder="Select development type">
                                {developmentTypes.map(type => (
                                    <Option key={type} value={type}>{type}</Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="incubatorCode" label="Incubator Code">
                            <Input placeholder="Optional" />
                        </Form.Item>
                    </Col>
                </Row>
            )
        },
        {
            title: 'Business Info',
            content: (
                <>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="natureOfBusiness" label="Nature of Business (What your business offers)">
                                <Input.TextArea rows={3} />
                            </Form.Item>

                            <Form.Item name="businessAddress" label="Business Address" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Form.Item name="businessAddressProvince" label="Province" rules={[{ required: true }]}>
                                <Select placeholder="Select province">
                                    {provinces.map(p => (
                                        <Option key={p} value={p}>{p}</Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="businessAddressCity" label="City" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Form.Item name="locationType" label="Location Type" rules={[{ required: true }]}>
                                <Select placeholder="Select location type">
                                    <Option value="Urban">Urban</Option>
                                    <Option value="Township">Township</Option>
                                    <Option value="Rural">Rural</Option>
                                </Select>
                            </Form.Item>

                            <Form.Item name="postalCode" label="Postal Code" rules={[{ required: true }]}>
                                <Input />
                            </Form.Item>

                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item name="hub" label="Host Community">
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item name="location" label="Location / Area Name">
                                        <Input placeholder="e.g. Soweto, Mmabatho, CBD..." />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="websiteUrl" label="Website URL">
                                <Input />
                            </Form.Item>
                            <Form.Item name="facebook" label="Facebook">
                                <Input />
                            </Form.Item>
                            <Form.Item name="instagram" label="Instagram">
                                <Input />
                            </Form.Item>
                            <Form.Item name="x" label="X (Twitter)">
                                <Input />
                            </Form.Item>
                            <Form.Item name="linkedIn" label="LinkedIn">
                                <Input />
                            </Form.Item>
                            <Form.Item name="other" label="Other Link">
                                <Input />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left">SWOT Analysis</Divider>

                    {/* keep SWOT stored in form */}
                    <Form.Item name={['swot']} initialValue={swot} hidden>
                        <Input />
                    </Form.Item>

                    <Row gutter={[16, 16]}>
                        {(
                            [
                                { key: 'strengths', title: 'Strengths', hint: 'Internal positives (skills, assets, advantages)' },
                                { key: 'weaknesses', title: 'Weaknesses', hint: 'Internal gaps (skills, systems, constraints)' },
                                { key: 'opportunities', title: 'Opportunities', hint: 'External chances (markets, partnerships, trends)' },
                                { key: 'threats', title: 'Threats', hint: 'External risks (competition, regulation, costs)' }
                            ] as { key: SwotKey; title: string; hint: string }[]
                        ).map(({ key, title, hint }) => (
                            <Col xs={24} md={12} key={key}>
                                <Card
                                    size="small"
                                    title={title}
                                    style={{ borderRadius: 12 }}
                                    bodyStyle={{ padding: 12 }}
                                >
                                    <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>{hint}</div>

                                    <Input
                                        placeholder={`Type and press Enter...`}
                                        onPressEnter={(e) => {
                                            const target = e.currentTarget as HTMLInputElement
                                            addSwotItem(key, target.value)
                                            target.value = ''
                                        }}
                                        allowClear
                                    />

                                    <div style={{ marginTop: 10 }}>
                                        {swot[key].length ? (
                                            <Space wrap>
                                                {swot[key].map(item => (
                                                    <Tag
                                                        key={item}
                                                        closable
                                                        onClose={(ev) => {
                                                            ev.preventDefault()
                                                            removeSwotItem(key, item)
                                                        }}
                                                        style={{ padding: '4px 8px', borderRadius: 999 }}
                                                    >
                                                        • {item}
                                                    </Tag>
                                                ))}
                                            </Space>
                                        ) : (
                                            <div style={{ fontSize: 12, opacity: 0.6 }}>No items yet.</div>
                                        )}
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </>
            )
        },
        {
            title: 'Revenue & Employees',
            content: (
                <>
                    <Divider orientation="left">Monthly Data (Last 3 Months)</Divider>
                    {last3Months.map(month => (
                        <Row gutter={16} key={month}>
                            <Col span={8}>
                                <Form.Item name={`revenue_${month}`} label={`Revenue (${month})`}>
                                    <InputNumber style={{ width: '100%' }} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={`permHeadcount_${month}`} label={`Permanent Staff (${month})`}>
                                    <InputNumber style={{ width: '100%' }} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={`tempHeadcount_${month}`} label={`Temporary Staff (${month})`}>
                                    <InputNumber style={{ width: '100%' }} min={0} />
                                </Form.Item>
                            </Col>
                        </Row>
                    ))}

                    <Divider orientation="left">Annual Data (Last 2 Years)</Divider>
                    {last2Years.map(year => (
                        <Row gutter={16} key={year}>
                            <Col span={8}>
                                <Form.Item name={`revenue_${year}`} label={`Revenue (${year})`}>
                                    <InputNumber style={{ width: '100%' }} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={`permHeadcount_${year}`} label={`Permanent Staff (${year})`}>
                                    <InputNumber style={{ width: '100%' }} min={0} />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item name={`tempHeadcount_${year}`} label={`Temporary Staff (${year})`}>
                                    <InputNumber style={{ width: '100%' }} min={0} />
                                </Form.Item>
                            </Col>
                        </Row>
                    ))}
                </>
            )
        },
        {
            title: 'Interventions',
            content: (
                <Row gutter={16}>
                    <Col span={24}>
                        <Input
                            placeholder="Search interventions..."
                            value={interventionSearch}
                            onChange={e => setInterventionSearch(e.target.value)}
                            style={{ marginBottom: 12 }}
                            allowClear
                        />

                        {groupedByArea.length === 0 ? (
                            <Empty description="No interventions found" />
                        ) : (
                            <Checkbox.Group
                                style={{ width: '100%' }}
                                value={selectedInterventions.map(i => i.id)}
                                onChange={(ids) => {
                                    const idSet = new Set(ids as string[])
                                    const next = interventionsOptions.filter(i => idSet.has(i.id))
                                    setSelectedInterventions(next)
                                }}
                            >
                                <Collapse>
                                    {groupedByArea.map(group => (
                                        <Collapse.Panel
                                            key={group.area}
                                            header={`${group.area} (${group.items.length})`}
                                        >
                                            <Row gutter={[12, 12]}>
                                                {group.items.map(it => (
                                                    <Col span={12} key={it.id}>
                                                        <Checkbox value={it.id}>{it.title}</Checkbox>
                                                    </Col>
                                                ))}
                                            </Row>
                                        </Collapse.Panel>
                                    ))}
                                </Collapse>
                            </Checkbox.Group>
                        )}

                        <Space wrap style={{ marginTop: 12 }}>
                            {selectedInterventions.map(i => (
                                <Tag key={i.id} closable onClose={() => handleRemoveIntervention(i.id)}>
                                    {i.title}
                                </Tag>
                            ))}
                        </Space>
                    </Col>
                </Row>
            )
        },
        // ✅ NEW STEP: Compliance
        {
            title: 'Compliance',
            content: (
                <>
                    <Alert
                        showIcon
                        type={complianceScore >= 10 ? 'success' : 'warning'}
                        message={`Compliance Score: ${complianceScore}%`}
                        description="Upload the required documents. Expiring within 7 days counts as NOT valid."
                        style={{ marginBottom: 12 }}
                    />

                    {uploadingDocs && (
                        <div style={{ marginBottom: 12 }}>
                            <Progress percent={60} status="active" />
                        </div>
                    )}

                    <Space direction="vertical" style={{ width: '100%' }}>
                        {documentFields.map((docItem, index) => {
                            const status = getDocStatus(docItem)

                            return (
                                <Card key={docItem.type} size="small">
                                    <Row gutter={16} align="middle">
                                        <Col span={7}>
                                            <strong>{docItem.type}</strong>
                                            <div style={{ fontSize: 12, opacity: 0.8 }}>
                                                Status: {status}
                                            </div>
                                        </Col>

                                        <Col span={7}>
                                            <Upload
                                                beforeUpload={(file) => handleFileUpload(file as File, index)}
                                                fileList={
                                                    docItem.file
                                                        ? [{ uid: '-1', name: docItem.file.name, status: 'done' }]
                                                        : []
                                                }
                                                onRemove={() => {
                                                    const updated = [...documentFields]
                                                    updated[index].file = null
                                                    setDocumentFields(updated)
                                                }}
                                            >
                                                <Button icon={<UploadOutlined />}>Upload</Button>
                                            </Upload>
                                        </Col>

                                        <Col span={10}>
                                            {docItem.requiresExpiry ? (
                                                <DatePicker
                                                    placeholder="Expiry Date"
                                                    style={{ width: '100%' }}
                                                    value={docItem.expiryDate}
                                                    onChange={(date) => {
                                                        const updated = [...documentFields]
                                                        updated[index].expiryDate = date
                                                        setDocumentFields(updated)
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ fontSize: 12, opacity: 0.8 }}>No expiry required</div>
                                            )}
                                        </Col>
                                    </Row>
                                </Card>
                            )
                        })}
                    </Space>
                </>
            )
        },
        {
            title: 'Review',
            content: <>{renderReview()}</>
        }
    ]

    return (
        <div style={{ padding: 24 }}>
            <Helmet>
                <title>Add New Participant | Incubation Platform</title>
            </Helmet>

            <Card>
                <Steps current={currentStep} style={{ marginBottom: 24 }}>
                    {steps.map(step => (
                        <Step key={step.title} title={step.title} />
                    ))}
                </Steps>

                <Form form={form} layout="vertical" onFinish={handleFinish}>
                    {steps[currentStep].content}

                    <div style={{ marginTop: 24 }}>
                        {currentStep > 0 && (
                            <Button onClick={handlePrev} style={{ marginRight: 8 }}>
                                Previous
                            </Button>
                        )}

                        {currentStep < steps.length - 1 && (
                            <Button type="primary" onClick={handleNext}>
                                Next
                            </Button>
                        )}

                        {currentStep === steps.length - 1 && (
                            <Button type="primary" htmlType="submit" loading={loading}>
                                Submit
                            </Button>
                        )}
                    </div>
                </Form>
            </Card>
        </div>
    )
}

export default ParticipantOnboardingForm
