// src/pages/success-stories/SuccessStoryIntakePage.tsx
import React, { useEffect, useMemo, useState } from 'react'
import {
    App,
    Button,
    Card,
    Checkbox,
    Col,
    DatePicker,
    Descriptions,
    Divider,
    Empty,
    Form,
    Input,
    Modal,
    Row,
    Select,
    Space,
    Spin,
    Steps,
    Table,
    Tag,
    Typography,
    Upload,
} from 'antd'
import type { UploadFile, UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    FileTextOutlined,
    CheckCircleOutlined,
    SaveOutlined,
    UploadOutlined,
    PictureOutlined,
    TeamOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    RocketOutlined,
    ReloadOutlined,
    InfoCircleOutlined,
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import dayjs from 'dayjs'
import { auth, db, storage } from '@/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    Timestamp,
    where,
    orderBy,
    limit,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { DashboardHeaderCard, MotionCard } from '@/components/shared/Header'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

const { Title, Text } = Typography
const { TextArea } = Input
const { Step } = Steps

type ProgramOption = { id: string; title: string }

type ParticipantOption = {
    id: string
    beneficiaryName?: string
    ownerName?: string
    email?: string
    sector?: string
    stage?: string
    province?: string
    city?: string
    hub?: string
    location?: string
}

type UploadedImage = {
    uid: string
    name: string
    size: number
    type?: string
    url: string
    path: string
    uploadedAt: Timestamp
}

type AssignmentStatus = 'assigned' | 'in-progress' | 'completed' | 'cancelled' | 'pending'
type ConsultantStatus = 'pending' | 'accepted' | 'declined'
type UserStatus = 'pending' | 'accepted' | 'declined'

interface Assignment {
    id: string
    groupId?: string | null
    participantId: string
    beneficiaryName: string
    interventionId: string
    interventionTitle: string
    subtitle?: string | null

    implementationDate?: Timestamp | null
    createdAt?: Timestamp
    updatedAt?: Timestamp
    dueDate?: Timestamp | null
    countedAt?: Timestamp | null

    type?: any
    assigneeType?: 'Consultant' | 'Operations' | string
    consultantId: string
    consultantName: string

    status?: AssignmentStatus
    consultantStatus?: ConsultantStatus
    userStatus?: UserStatus
    consultantCompletionStatus?: 'pending' | 'done'
    userCompletionStatus?: 'pending' | 'confirmed' | 'rejected'

    notes?: string
    timeSpent?: number
    timeSpentHours?: number
    progress?: number

    targetType?: 'percentage' | 'number'
    targetValue?: any
    targetMetric?: any

    areaOfSupport?: string
    companyCode?: string

    resources?: Array<{ type?: string; label?: string; link?: string }>
    invoiceId?: string
}

const MAX_IMAGES = 8
const MAX_IMAGE_MB = 6

const roundBtn: React.CSSProperties = { borderRadius: 12 }
const softCard: React.CSSProperties = {
    borderRadius: 14,
    border: '1px solid #eef2ff',
    boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
}

const safeString = (v: any) => (typeof v === 'string' ? v.trim() : '')
const splitLines = (raw?: string) =>
    (raw || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)

const formatAnyDate = (v: any) => {
    if (!v) return '-'
    if (v instanceof Timestamp) return dayjs(v.toDate()).format('YYYY-MM-DD HH:mm')
    if (typeof v?.toDate === 'function') return dayjs(v.toDate()).format('YYYY-MM-DD HH:mm')
    if (v instanceof Date) return dayjs(v).format('YYYY-MM-DD HH:mm')
    if (typeof v === 'string') return dayjs(v).isValid() ? dayjs(v).format('YYYY-MM-DD HH:mm') : v
    return '-'
}

const toTs = (v: any): Timestamp | null => {
    if (!v) return null
    if (v instanceof Timestamp) return v
    if (typeof v?.toDate === 'function') return Timestamp.fromDate(v.toDate())
    if (v instanceof Date) return Timestamp.fromDate(v)
    return null
}

const pickString = (obj: any, paths: string[]) => {
    for (const p of paths) {
        const val = p.split('.').reduce((acc: any, k) => (acc ? acc[k] : undefined), obj)
        if (typeof val === 'string' && val.trim()) return val.trim()
    }
    return ''
}

const extractCandidateDates = (a: Assignment) => {
    const candidates: Timestamp[] = []
    const push = (t?: Timestamp | null) => {
        if (t && t instanceof Timestamp) candidates.push(t)
    }
    push(a.implementationDate || null)
    push(a.createdAt)
    push(a.countedAt || null)
    push(a.updatedAt)
    push(a.dueDate || null)
    return candidates
}

const computeDerivedFromAssignments = (items: Assignment[]) => {
    const dates = items.flatMap(extractCandidateDates)
    const start = dates.length ? dates.reduce((m, t) => (t.toMillis() < m.toMillis() ? t : m), dates[0]) : null
    const end = dates.length ? dates.reduce((m, t) => (t.toMillis() > m.toMillis() ? t : m), dates[0]) : null

    const times = items.map(a => {
        const v = typeof a.timeSpent === 'number' ? a.timeSpent : typeof a.timeSpentHours === 'number' ? a.timeSpentHours : 0
        return Number.isFinite(v) ? v : 0
    })
    const totalTimeSpent = Math.round(times.reduce((s, n) => s + n, 0) * 100) / 100

    const progresses = items
        .map(a => (typeof a.progress === 'number' ? a.progress : null))
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const avgProgress = progresses.length ? Math.round((progresses.reduce((s, n) => s + n, 0) / progresses.length) * 10) / 10 : null

    return {
        startDate: start,
        endDate: end,
        totalTimeSpent: totalTimeSpent || 0,
        avgProgress,
    }
}

const SuccessStoryIntakePage: React.FC = () => {
    const { message, modal } = App.useApp()
    const [form] = Form.useForm()

    const [bootLoading, setBootLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)

    const [currentUser, setCurrentUser] = useState<{ uid: string; email?: string | null } | null>(null)
    const [companyCode, setCompanyCode] = useState<string>('')

    const [step, setStep] = useState(0)

    const [successStoryId, setSuccessStoryId] = useState<string>('')

    const [programsLoading, setProgramsLoading] = useState(false)
    const [programs, setPrograms] = useState<ProgramOption[]>([])
    const [programId, setProgramId] = useState<string>('')
    const [programTitle, setProgramTitle] = useState<string>('')

    const [participantsLoading, setParticipantsLoading] = useState(false)
    const [participants, setParticipants] = useState<ParticipantOption[]>([])
    const [participantId, setParticipantId] = useState<string>('')
    const [participantSnap, setParticipantSnap] = useState<ParticipantOption | null>(null)

    const [applicationLoading, setApplicationLoading] = useState(false)
    const [applicationSnap, setApplicationSnap] = useState<any | null>(null)

    const [assignmentsLoading, setAssignmentsLoading] = useState(false)
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([])

    const [fileList, setFileList] = useState<UploadFile[]>([])
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async user => {
            if (!user) {
                setCurrentUser(null)
                setCompanyCode('')
                setBootLoading(false)
                return
            }

            setCurrentUser({ uid: user.uid, email: user.email })
            try {
                const userRef = doc(db, 'users', user.uid)
                const snap = await getDoc(userRef)
                if (snap.exists()) {
                    const data = snap.data()
                    setCompanyCode(safeString(data?.companyCode))
                }
            } catch (err) {
                console.error(err)
            } finally {
                setBootLoading(false)
            }
        })

        return () => unsub()
    }, [])

    const fetchPrograms = async () => {
        if (!companyCode) return
        setProgramsLoading(true)
        try {
            const qRef = query(collection(db, 'programs'), where('companyCode', '==', companyCode))
            const snap = await getDocs(qRef)
            const list: ProgramOption[] = snap.docs.map(d => {
                const data = d.data()
                return {
                    id: d.id,
                    title: safeString(data?.title) || safeString(data?.programTitle) || safeString(data?.name) || d.id,
                }
            })
            list.sort((a, b) => a.title.localeCompare(b.title))
            setPrograms(list)
        } catch (err) {
            console.error(err)
            message.error('Failed to load programs.')
        } finally {
            setProgramsLoading(false)
        }
    }

    const fetchParticipants = async () => {
        if (!companyCode) return
        setParticipantsLoading(true)

        try {
            const appsQ = query(
                collection(db, 'applications'),
                where('companyCode', '==', companyCode),
                where('applicationStatus', '==', 'accepted')
            )
            const appsSnap = await getDocs(appsQ)

            if (appsSnap.empty) {
                setParticipants([])
                return
            }

            const participantIds = Array.from(
                new Set(
                    appsSnap.docs
                        .map(d => safeString(d.data()?.participantId))
                        .filter(Boolean)
                )
            )

            const chunks: string[][] = []
            for (let i = 0; i < participantIds.length; i += 30) chunks.push(participantIds.slice(i, i + 30))

            const participantsMap = new Map<string, ParticipantOption>()

            await Promise.all(
                chunks.map(async idsChunk => {
                    const participantsQ = query(collection(db, 'participants'), where('__name__', 'in', idsChunk))
                    const participantsSnap = await getDocs(participantsQ)

                    participantsSnap.docs.forEach(pDoc => {
                        const data = pDoc.data()
                        participantsMap.set(pDoc.id, {
                            id: pDoc.id,
                            beneficiaryName: safeString(data?.beneficiaryName),
                            ownerName: safeString(data?.ownerName),
                            email: safeString(data?.email),
                            sector: safeString(data?.sector),
                            stage: safeString(data?.stage),
                            province: safeString(data?.province),
                            city: safeString(data?.city),
                            hub: safeString(data?.hub),
                            location: safeString(data?.location),
                        })
                    })
                })
            )

            appsSnap.docs.forEach(aDoc => {
                const a = aDoc.data() as any
                const pid = safeString(a?.participantId)
                if (!pid) return
                if (participantsMap.has(pid)) return

                participantsMap.set(pid, {
                    id: pid,
                    beneficiaryName: safeString(a?.beneficiaryName) || safeString(a?.businessName),
                    ownerName: safeString(a?.participantName) || safeString(a?.ownerName),
                    email: safeString(a?.email),
                    sector: safeString(a?.sector),
                    stage: safeString(a?.stage),
                    province: safeString(a?.province),
                    city: safeString(a?.city),
                    hub: safeString(a?.hub),
                    location: safeString(a?.location),
                })
            })

            const list = Array.from(participantsMap.values()).sort((a, b) =>
                (a.beneficiaryName || '').localeCompare(b.beneficiaryName || '')
            )
            setParticipants(list)
        } catch (err) {
            console.error(err)
            message.error('Failed to load participants.')
        } finally {
            setParticipantsLoading(false)
        }
    }

    useEffect(() => {
        if (!companyCode) return
        ;(async () => {
            await Promise.all([fetchPrograms(), fetchParticipants()])
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyCode])

    const fetchAcceptedApplication = async (pid: string, progId: string) => {
        if (!pid || !progId || !companyCode) return
        setApplicationLoading(true)
        try {
            const qRef = query(
                collection(db, 'applications'),
                where('companyCode', '==', companyCode),
                where('programId', '==', progId),
                where('participantId', '==', pid),
                where('applicationStatus', '==', 'accepted'),
                orderBy('submittedAt', 'desc'),
                limit(1)
            )
            const snap = await getDocs(qRef)
            if (snap.empty) {
                setApplicationSnap(null)
                return
            }
            const d = snap.docs[0]
            setApplicationSnap({ id: d.id, ...d.data() })
        } catch (err) {
            console.error(err)
            setApplicationSnap(null)
        } finally {
            setApplicationLoading(false)
        }
    }

    const fetchAssignments = async (pid: string) => {
        if (!pid || !companyCode) return
        setAssignmentsLoading(true)
        try {
            const qRef = query(
                collection(db, 'assignedInterventions'),
                where('companyCode', '==', companyCode),
                where('participantId', '==', pid)
            )
            const snap = await getDocs(qRef)
            const list: Assignment[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
            list.sort((a, b) => {
                const ad = a?.createdAt?.toDate?.()?.getTime?.() ?? 0
                const bd = b?.createdAt?.toDate?.()?.getTime?.() ?? 0
                return bd - ad
            })
            setAssignments(list)
        } catch (err) {
            console.error(err)
            message.error('Failed to load assigned interventions.')
        } finally {
            setAssignmentsLoading(false)
        }
    }

    const onSelectProgram = async (val: string) => {
        const p = programs.find(x => x.id === val)
        setProgramId(val)
        setProgramTitle(p?.title || '')
        if (participantId) await fetchAcceptedApplication(participantId, val)
    }

    const onSelectParticipant = async (val: string) => {
        const p = participants.find(x => x.id === val) || null
        setParticipantId(val)
        setParticipantSnap(p)

        await fetchAssignments(val)
        if (programId) await fetchAcceptedApplication(val, programId)

        // User-friendly: seed challenges text from application (if available later) only when field is empty
        const existing = safeString(form.getFieldValue('challengesText'))
        if (!existing && applicationSnap) {
            const ch = pickString(applicationSnap, ['challenges', 'challengeBlockers', 'profile.challenges'])
            if (ch) form.setFieldValue('challengesText', ch)
        }
    }

    const ensureDocId = async () => {
        if (successStoryId) return successStoryId
        if (!companyCode) throw new Error('Missing companyCode')
        if (!currentUser?.uid) throw new Error('Not authenticated')

        const baseRef = await addDoc(collection(db, 'successStories'), {
            companyCode,
            status: 'draft',
            createdBy: { uid: currentUser.uid, email: currentUser.email || null },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        })

        setSuccessStoryId(baseRef.id)
        message.success('Draft created.')
        return baseRef.id
    }

    const validateImagesBeforeUpload = async (file: File) => {
        const isImage = file.type.startsWith('image/')
        if (!isImage) {
            message.error('Only image files are allowed.')
            return Upload.LIST_IGNORE
        }

        const mb = file.size / (1024 * 1024)
        if (mb > MAX_IMAGE_MB) {
            message.error(`Image must be smaller than ${MAX_IMAGE_MB}MB.`)
            return Upload.LIST_IGNORE
        }

        if (fileList.length >= MAX_IMAGES) {
            message.error(`You can upload up to ${MAX_IMAGES} images.`)
            return Upload.LIST_IGNORE
        }

        if (!successStoryId) {
            try {
                await ensureDocId()
            } catch (err) {
                console.error(err)
                message.error('Save draft first before uploading images.')
                return Upload.LIST_IGNORE
            }
        }

        return true
    }

    const handleRemoveImage = async (f: UploadFile) => {
        const img = uploadedImages.find(x => x.uid === f.uid)
        if (!img) {
            setFileList(prev => prev.filter(x => x.uid !== f.uid))
            return true
        }

        const ok = await new Promise<boolean>(resolve => {
            modal.confirm({
                title: 'Remove image?',
                content: 'This will remove the image from storage.',
                okText: 'Remove',
                okButtonProps: { danger: true, style: roundBtn, icon: <DeleteOutlined /> },
                cancelButtonProps: { style: roundBtn },
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
            })
        })
        if (!ok) return false

        try {
            await deleteObject(ref(storage, img.path))
            setUploadedImages(prev => prev.filter(x => x.uid !== f.uid))
            setFileList(prev => prev.filter(x => x.uid !== f.uid))
            message.success('Image removed.')
            return true
        } catch (err) {
            console.error(err)
            message.error('Failed to remove image.')
            return false
        }
    }

    const uploadProps: UploadProps = {
        accept: 'image/*',
        listType: 'picture-card',
        fileList,
        multiple: true,
        beforeUpload: validateImagesBeforeUpload as any,
        onChange: info => setFileList(info.fileList.slice(0, MAX_IMAGES)),
        onRemove: handleRemoveImage,
        customRequest: async options => {
            const user = auth.currentUser
            if (!user) {
                options.onError?.(new Error('Not authenticated'))
                message.error('You must be signed in.')
                return
            }
            if (!companyCode) {
                options.onError?.(new Error('Missing companyCode'))
                message.error('Company information is missing.')
                return
            }

            let id = successStoryId
            if (!id) {
                try {
                    id = await ensureDocId()
                } catch (err) {
                    console.error(err)
                    options.onError?.(new Error('Missing successStoryId'))
                    return
                }
            }

            const file = options.file as File

            try {
                const safeName = file.name.replace(/[^\w.\-]+/g, '_')
                const path = `successStories/${companyCode}/${id}/images/${user.uid}_${Date.now()}_${safeName}`
                const fileRef = ref(storage, path)

                const snap = await uploadBytes(fileRef, file, { contentType: file.type })
                const url = await getDownloadURL(snap.ref)

                const img: UploadedImage = {
                    uid: (options.file as any).uid,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    url,
                    path,
                    uploadedAt: Timestamp.now(),
                }

                setUploadedImages(prev => {
                    const filtered = prev.filter(x => x.uid !== img.uid)
                    return [...filtered, img]
                })

                options.onSuccess?.({ url }, file)
                message.success('Image uploaded.')
            } catch (err) {
                console.error(err)
                options.onError?.(err as any)
                message.error('Upload failed.')
            }
        },
    }

    const assignmentsColumns: ColumnsType<Assignment> = [
        {
            title: 'Select',
            dataIndex: 'id',
            width: 84,
            render: (_, r) => (
                <Checkbox
                    checked={selectedAssignmentIds.includes(r.id)}
                    onChange={e => {
                        setSelectedAssignmentIds(prev => {
                            if (e.target.checked) return Array.from(new Set([...prev, r.id]))
                            return prev.filter(x => x !== r.id)
                        })
                    }}
                />
            ),
        },
        {
            title: 'Intervention',
            dataIndex: 'interventionTitle',
            render: (_, r) => (
                <Space direction="vertical" size={2}>
                    <Text strong>{r.interventionTitle}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.areaOfSupport || 'Unspecified area'}
                    </Text>
                </Space>
            ),
        },
        {
            title: 'Delivery',
            width: 220,
            render: (_, r) => (
                <Space direction="vertical" size={2}>
                    <Text>{r.consultantName || '-'}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.assigneeType || 'Unspecified'}
                    </Text>
                </Space>
            ),
        },
        {
            title: 'Progress',
            width: 140,
            render: (_, r) => {
                const p = typeof r.progress === 'number' ? r.progress : null
                return p === null ? <Text type="secondary">-</Text> : <Tag style={{ borderRadius: 999 }}>{p}%</Tag>
            },
        },
        {
            title: 'Time',
            width: 120,
            render: (_, r) => {
                const v =
                    typeof r.timeSpent === 'number'
                        ? r.timeSpent
                        : typeof r.timeSpentHours === 'number'
                          ? r.timeSpentHours
                          : null
                return v === null ? <Text type="secondary">-</Text> : <Tag style={{ borderRadius: 999 }}>{v}h</Tag>
            },
        },
        {
            title: 'Key Date',
            width: 160,
            render: (_, r) => {
                const d = r.implementationDate || r.countedAt || r.updatedAt || r.createdAt || r.dueDate
                return <Text type="secondary">{d?.toDate ? dayjs(d.toDate()).format('YYYY-MM-DD') : '-'}</Text>
            },
        },
    ]

    const buildPayload = async (targetStatus: 'draft' | 'published', strict: boolean) => {
        if (!companyCode) {
            message.error('Company information is missing.')
            return null
        }
        if (!currentUser?.uid) {
            message.error('You must be signed in.')
            return null
        }
        if (!programId) {
            message.error('Select a program.')
            return null
        }
        if (!participantId) {
            message.error('Select a participant.')
            return null
        }

        const values = form.getFieldsValue(true)

        const headline = safeString(values.headline)
        const summary = safeString(values.summary)
        const outcomes = splitLines(values.outcomesText)
        const challenges = splitLines(values.challengesText)
        const before = safeString(values.beforeText)
        const after = safeString(values.afterText)

        const quoteText = safeString(values.quoteText)
        const quoteAuthor = safeString(values.quoteAuthor)
        const quoteRole = safeString(values.quoteRole)

        if (strict) {
            if (!headline) {
                message.error('Add a headline.')
                return null
            }
            if (!summary) {
                message.error('Add a short summary.')
                return null
            }
            if (!selectedAssignmentIds.length) {
                message.error('Select at least one delivered intervention.')
                return null
            }
            if (!outcomes.length) {
                message.error('Add at least one outcome.')
                return null
            }
            if (outcomes.length > 6) {
                message.error('Limit outcomes to 6 lines.')
                return null
            }
        }

        const selectedItemsFull = assignments.filter(a => selectedAssignmentIds.includes(a.id))
        const derived = computeDerivedFromAssignments(selectedItemsFull)

        const selectedItems = selectedItemsFull.map(a => ({
            assignmentId: a.id,
            interventionId: a.interventionId,
            interventionTitle: a.interventionTitle,
            type: a.type || null,
            assigneeType: a.assigneeType || null,
            consultantId: a.consultantId || null,
            consultantName: a.consultantName || null,

            createdAt: a.createdAt || null,
            implementationDate: a.implementationDate || null,
            dueDate: a.dueDate || null,
            countedAt: a.countedAt || null,
            updatedAt: a.updatedAt || null,

            notes: a.notes || null,
            timeSpent: typeof a.timeSpent === 'number' ? a.timeSpent : typeof a.timeSpentHours === 'number' ? a.timeSpentHours : null,
            progress: typeof a.progress === 'number' ? a.progress : null,

            targetType: a.targetType || null,
            targetValue: a.targetValue ?? null,
            targetMetric: a.targetMetric ?? null,

            areaOfSupport: a.areaOfSupport || null,
            resources: Array.isArray(a.resources) ? a.resources : [],
            invoiceId: a.invoiceId || null,
            groupId: a.groupId || null,
            status: a.status || null,
        }))

        const images = uploadedImages.map(i => ({
            url: i.url,
            path: i.path,
            name: i.name,
            size: i.size,
            contentType: i.type,
            uploadedAt: i.uploadedAt,
        }))

        const coverImageUrl = safeString(values.coverImageUrl) || images[0]?.url || null

        const appStage = applicationSnap ? pickString(applicationSnap, ['stage', 'participant.stage', 'profile.stage']) : ''
        const appMotivation = applicationSnap ? pickString(applicationSnap, ['motivation', 'profile.motivation']) : ''
        const appChallenges = applicationSnap ? pickString(applicationSnap, ['challenges', 'profile.challenges', 'challengeBlockers']) : ''
        const appSubmittedAt = applicationSnap?.submittedAt ?? null

        const payload = {
            companyCode,
            status: targetStatus,

            program: {
                programId,
                title: programTitle,
            },

            participant: {
                participantId,
                beneficiaryName: participantSnap?.beneficiaryName || safeString(values.beneficiaryName) || null,
                ownerName: participantSnap?.ownerName || safeString(values.ownerName) || null,
                email: participantSnap?.email || safeString(values.participantEmail) || null,
                sector: participantSnap?.sector || null,
                stage: participantSnap?.stage || null,
                province: participantSnap?.province || null,
                city: participantSnap?.city || null,
                hub: participantSnap?.hub || null,
                location: participantSnap?.location || null,
            },

            application: applicationSnap
                ? {
                      applicationId: applicationSnap.id,
                      submittedAt: appSubmittedAt,
                      stage: appStage || null,
                      motivation: appMotivation || null,
                      challenges: appChallenges || null,
                      complianceScore: typeof applicationSnap.complianceScore === 'number' ? applicationSnap.complianceScore : null,
                      ageGroup: safeString(applicationSnap.ageGroup) || null,
                      gender: safeString(applicationSnap.gender) || null,
                  }
                : null,

            interventions: {
                assignmentIds: selectedAssignmentIds,
                items: selectedItems,
                derived: {
                    startDate: derived.startDate || null,
                    endDate: derived.endDate || null,
                    totalTimeSpent: typeof derived.totalTimeSpent === 'number' ? derived.totalTimeSpent : 0,
                    avgProgress: typeof derived.avgProgress === 'number' ? derived.avgProgress : null,
                },
            },

            story: {
                headline: headline || null,
                summary: summary || null,
                before: before || (applicationSnap ? appChallenges || null : null),
                after: after || null,
                outcomes: outcomes.slice(0, 6),
                challenges,
                quote: quoteText
                    ? {
                          text: quoteText,
                          author: quoteAuthor || null,
                          role: quoteRole || null,
                      }
                    : null,
            },

            media: {
                coverImageUrl,
                images,
            },

            updatedAt: serverTimestamp(),
        }

        return payload
    }

    const saveDraft = async () => {
        setSaving(true)
        try {
            const id = await ensureDocId()
            const payload = await buildPayload('draft', false)
            if (!payload) return

            await setDoc(
                doc(db, 'successStories', id),
                {
                    ...payload,
                    createdBy: { uid: currentUser?.uid || '', email: currentUser?.email || null },
                    createdAt: serverTimestamp(),
                },
                { merge: true }
            )

            message.success('Draft saved.')
        } catch (err) {
            console.error(err)
            message.error('Failed to save draft.')
        } finally {
            setSaving(false)
        }
    }

    const publish = async () => {
        const ok = await new Promise<boolean>(resolve => {
            modal.confirm({
                title: 'Publish this success story?',
                content: 'Publishing makes this visible wherever success stories are displayed.',
                okText: 'Publish',
                okButtonProps: { style: { ...roundBtn }, icon: <RocketOutlined /> },
                cancelButtonProps: { style: roundBtn },
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
            })
        })
        if (!ok) return

        setPublishing(true)
        try {
            const id = await ensureDocId()
            const payload = await buildPayload('published', true)
            if (!payload) return

            await setDoc(
                doc(db, 'successStories', id),
                {
                    ...payload,
                    publishedAt: serverTimestamp(),
                    createdBy: { uid: currentUser?.uid || '', email: currentUser?.email || null },
                    createdAt: serverTimestamp(),
                },
                { merge: true }
            )

            message.success('Published.')
        } catch (err) {
            console.error(err)
            message.error('Failed to publish.')
        } finally {
            setPublishing(false)
        }
    }

    const resetAll = async () => {
        const ok = await new Promise<boolean>(resolve => {
            modal.confirm({
                title: 'Reset this intake?',
                content: 'This clears the form state and local uploads list. It does not delete saved Firestore data.',
                okText: 'Reset',
                okButtonProps: { danger: true, style: roundBtn, icon: <DeleteOutlined /> },
                cancelButtonProps: { style: roundBtn },
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
            })
        })
        if (!ok) return

        setStep(0)
        setSuccessStoryId('')
        setProgramId('')
        setProgramTitle('')
        setParticipantId('')
        setParticipantSnap(null)
        setApplicationSnap(null)
        setAssignments([])
        setSelectedAssignmentIds([])
        setFileList([])
        setUploadedImages([])
        form.resetFields()
    }

    const canGoNext = () => {
        if (step === 0) return Boolean(programId && participantId)
        if (step === 1) return selectedAssignmentIds.length > 0
        if (step === 2) return true
        return true
    }

    const next = async () => {
        if (!canGoNext()) {
            message.warning('Complete the required selections before continuing.')
            return
        }
        setStep(prev => Math.min(prev + 1, 3))
    }

    const prev = () => setStep(s => Math.max(s - 1, 0))

    const derivedPreview = useMemo(() => {
        const selected = assignments.filter(a => selectedAssignmentIds.includes(a.id))
        return computeDerivedFromAssignments(selected)
    }, [assignments, selectedAssignmentIds])

    const headerTags = useMemo(() => {
        const tags: { label: string; color: any }[] = []
        if (programTitle) tags.push({ label: programTitle, color: 'blue' })
        if (participantSnap?.beneficiaryName) tags.push({ label: participantSnap.beneficiaryName, color: 'purple' })
        return tags
    }, [participantSnap?.beneficiaryName, programTitle])

    const seedChallengesFromApplication = () => {
        const existing = safeString(form.getFieldValue('challengesText'))
        if (existing) return
        if (!applicationSnap) {
            message.info('No accepted application found for this program + participant.')
            return
        }
        const ch = pickString(applicationSnap, ['challenges', 'challengeBlockers', 'profile.challenges'])
        if (!ch) {
            message.info('Application has no challenges text.')
            return
        }
        form.setFieldValue('challengesText', ch)
        message.success('Challenges imported.')
    }

    return (
        <>
            <Helmet>
                <title>Success Story Intake</title>
            </Helmet>

            {(bootLoading || saving || publishing) && (
                <LoadingOverlay tip={saving ? 'Saving...' : publishing ? 'Publishing...' : 'Loading...'} />
            )}

            <DashboardHeaderCard
                title="Success Story Intake"
                titleIcon={<FileTextOutlined />}
                subtitle="Select the program and participant, pick delivered interventions, write the story, then add media."
                subtitleTags={headerTags}
                extraRight={
                    <Space wrap>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchPrograms()
                                fetchParticipants()
                                if (participantId) fetchAssignments(participantId)
                                if (participantId && programId) fetchAcceptedApplication(participantId, programId)
                            }}
                            style={roundBtn}
                        >
                            Refresh
                        </Button>

                        <Button
                            icon={<SaveOutlined />}
                            type="primary"
                            onClick={saveDraft}
                            style={{ ...roundBtn, boxShadow: '0 10px 22px rgba(22,119,255,0.20)' }}
                        >
                            Save Draft
                        </Button>

                        <Button
                            icon={<RocketOutlined />}
                            type="primary"
                            onClick={publish}
                            style={{
                                ...roundBtn,
                                background: '#16a34a',
                                borderColor: '#16a34a',
                                boxShadow: '0 10px 22px rgba(22,163,74,0.20)',
                            }}
                        >
                            Publish
                        </Button>

                        <Button danger icon={<DeleteOutlined />} onClick={resetAll} style={roundBtn}>
                            Reset
                        </Button>
                    </Space>
                }
            />

            <Row gutter={[12, 12]}>
                <Col xs={24} lg={16}>
                    <MotionCard style={softCard} bodyStyle={{ padding: 16 }} title="Build the story">
                        <Steps current={step} style={{ marginBottom: 16 }}>
                            <Step title="Context" icon={<TeamOutlined />} />
                            <Step title="Interventions" icon={<CheckCircleOutlined />} />
                            <Step title="Story" icon={<EditOutlined />} />
                            <Step title="Media" icon={<PictureOutlined />} />
                        </Steps>

                        <Form form={form} layout="vertical">
                            {step === 0 && (
                                <>
                                    <Row gutter={[12, 0]}>
                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="Program"
                                                required
                                                validateStatus={!programId ? 'warning' : undefined}
                                                help={!programId ? 'Select a program to continue.' : undefined}
                                            >
                                                <SelectProgram
                                                    loading={programsLoading}
                                                    value={programId || undefined}
                                                    options={programs}
                                                    onChange={onSelectProgram}
                                                />
                                            </Form.Item>
                                        </Col>

                                        <Col xs={24} md={12}>
                                            <Form.Item
                                                label="Participant"
                                                required
                                                validateStatus={!participantId ? 'warning' : undefined}
                                                help={!participantId ? 'Select a participant to continue.' : undefined}
                                            >
                                                <SelectParticipant
                                                    loading={participantsLoading}
                                                    value={participantId || undefined}
                                                    options={participants}
                                                    onChange={onSelectParticipant}
                                                />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Card
                                        size="small"
                                        style={{
                                            borderRadius: 14,
                                            border: '1px solid #eef2ff',
                                            background: 'linear-gradient(90deg,#f8fbff,#ffffff)',
                                        }}
                                    >
                                        <Row gutter={[12, 12]}>
                                            <Col xs={24} md={12}>
                                                <Title level={5} style={{ margin: 0 }}>
                                                    Participant Snapshot
                                                </Title>

                                                {participantSnap ? (
                                                    <Descriptions size="small" column={1} style={{ marginTop: 8 }}>
                                                        <Descriptions.Item label="Business">
                                                            {participantSnap.beneficiaryName || '-'}
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Owner">
                                                            {participantSnap.ownerName || '-'}
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Email">
                                                            {participantSnap.email || '-'}
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Sector">
                                                            {participantSnap.sector || '-'}
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Stage">
                                                            {participantSnap.stage || '-'}
                                                        </Descriptions.Item>
                                                        <Descriptions.Item label="Location">
                                                            {[participantSnap.city, participantSnap.province].filter(Boolean).join(', ') || '-'}
                                                        </Descriptions.Item>
                                                    </Descriptions>
                                                ) : (
                                                    <Empty description="Select a participant to see details." />
                                                )}
                                            </Col>

                                            <Col xs={24} md={12}>
                                                <Title level={5} style={{ margin: 0 }}>
                                                    Accepted Application (optional)
                                                </Title>

                                                <div style={{ marginTop: 8 }}>
                                                    {applicationLoading ? (
                                                        <Spin />
                                                    ) : applicationSnap ? (
                                                        <Descriptions size="small" column={1}>
                                                            <Descriptions.Item label="Compliance Score">
                                                                {typeof applicationSnap.complianceScore === 'number' ? `${applicationSnap.complianceScore}%` : '-'}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label="Submitted">
                                                                {formatAnyDate(applicationSnap.submittedAt)}
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label="Motivation">
                                                                <Text type="secondary">
                                                                    {(() => {
                                                                        const s = pickString(applicationSnap, ['motivation', 'profile.motivation'])
                                                                        return s ? (s.length > 140 ? s.slice(0, 140) + '…' : s) : '-'
                                                                    })()}
                                                                </Text>
                                                            </Descriptions.Item>
                                                            <Descriptions.Item label="Challenges">
                                                                <Text type="secondary">
                                                                    {(() => {
                                                                        const s = pickString(applicationSnap, ['challenges', 'challengeBlockers', 'profile.challenges'])
                                                                        return s ? (s.length > 140 ? s.slice(0, 140) + '…' : s) : '-'
                                                                    })()}
                                                                </Text>
                                                            </Descriptions.Item>
                                                        </Descriptions>
                                                    ) : (
                                                        <Empty description="No accepted application found for this program + participant." />
                                                    )}
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card>
                                </>
                            )}

                            {step === 1 && (
                                <>
                                    <Row gutter={[12, 12]} align="middle">
                                        <Col xs={24} md={16}>
                                            <Title level={5} style={{ margin: 0 }}>
                                                Delivered Interventions
                                            </Title>
                                            <Text type="secondary">
                                                Select the interventions that represent what was actually delivered.
                                            </Text>
                                        </Col>
                                        <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <Tag color={selectedAssignmentIds.length ? 'blue' : 'gold'} style={{ borderRadius: 999 }}>
                                                Selected: {selectedAssignmentIds.length}
                                            </Tag>
                                        </Col>
                                    </Row>

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Table
                                        rowKey="id"
                                        loading={assignmentsLoading}
                                        dataSource={assignments}
                                        columns={assignmentsColumns}
                                        pagination={{ pageSize: 6 }}
                                        locale={{ emptyText: <Empty description="No assigned interventions found." /> }}
                                    />

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Card size="small" style={{ borderRadius: 14, border: '1px solid #eef2ff' }}>
                                        <Row gutter={[12, 12]}>
                                            <Col xs={24} md={8}>
                                                <Space direction="vertical" size={0}>
                                                    <Text type="secondary">Derived start</Text>
                                                    <Text strong>{derivedPreview.startDate ? dayjs(derivedPreview.startDate.toDate()).format('YYYY-MM-DD') : '-'}</Text>
                                                </Space>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Space direction="vertical" size={0}>
                                                    <Text type="secondary">Derived end</Text>
                                                    <Text strong>{derivedPreview.endDate ? dayjs(derivedPreview.endDate.toDate()).format('YYYY-MM-DD') : '-'}</Text>
                                                </Space>
                                            </Col>
                                            <Col xs={24} md={8}>
                                                <Space direction="vertical" size={0}>
                                                    <Text type="secondary">Total time</Text>
                                                    <Text strong>{derivedPreview.totalTimeSpent || 0}h</Text>
                                                </Space>
                                            </Col>
                                        </Row>
                                    </Card>
                                </>
                            )}

                            {step === 2 && (
                                <>
                                    <Title level={5} style={{ marginTop: 0 }}>
                                        Story
                                    </Title>

                                    <Form.Item
                                        name="headline"
                                        label="Headline"
                                        rules={[{ required: true, message: 'Headline is required.' }]}
                                    >
                                        <Input placeholder="Short and factual (no marketing language)" />
                                    </Form.Item>

                                    <Form.Item
                                        name="summary"
                                        label="Summary"
                                        rules={[{ required: true, message: 'Summary is required.' }]}
                                    >
                                        <TextArea rows={4} placeholder="2–4 lines describing what changed and why it matters." />
                                    </Form.Item>

                                    <Row gutter={[12, 0]}>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="beforeText" label="Before (optional)">
                                                <TextArea rows={4} placeholder="Baseline context. Leave blank to default from application challenges." />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="afterText" label="After (optional)">
                                                <TextArea rows={4} placeholder="What improved (specific and measurable if possible)." />
                                            </Form.Item>
                                        </Col>
                                    </Row>

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Row gutter={[12, 12]} align="middle">
                                        <Col xs={24} md={16}>
                                            <Space direction="vertical" size={0}>
                                                <Text strong>Challenges (optional)</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>
                                                    One per line. No need to force categories.
                                                </Text>
                                            </Space>
                                        </Col>
                                        <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <Button
                                                icon={<InfoCircleOutlined />}
                                                onClick={seedChallengesFromApplication}
                                                style={roundBtn}
                                                disabled={!applicationSnap}
                                            >
                                                Import from application
                                            </Button>
                                        </Col>
                                    </Row>

                                    <Form.Item name="challengesText">
                                        <TextArea rows={5} placeholder={`Example:\nNo tax clearance\nInconsistent pricing\nLimited market access`} />
                                    </Form.Item>

                                    <Form.Item
                                        name="outcomesText"
                                        label="Outcomes (required, one per line, max 6)"
                                        rules={[
                                            {
                                                validator: async (_, val) => {
                                                    const lines = splitLines(val)
                                                    if (!lines.length) throw new Error('Add at least one outcome.')
                                                    if (lines.length > 6) throw new Error('Limit outcomes to 6 lines.')
                                                    return Promise.resolve()
                                                },
                                            },
                                        ]}
                                    >
                                        <TextArea rows={6} placeholder={`Example:\nCompleted company registration updates\nImproved reporting process\nHeld 3 sessions with documented resources`} />
                                    </Form.Item>

                                    <Divider style={{ margin: '10px 0' }} />

                                    <Title level={5} style={{ marginTop: 0 }}>
                                        Quote (optional)
                                    </Title>

                                    <Form.Item name="quoteText" label="Quote text">
                                        <TextArea rows={3} placeholder="Keep it short and direct." />
                                    </Form.Item>

                                    <Row gutter={[12, 0]}>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="quoteAuthor" label="Quote author (optional)">
                                                <Input placeholder="Name" />
                                            </Form.Item>
                                        </Col>
                                        <Col xs={24} md={12}>
                                            <Form.Item name="quoteRole" label="Quote role (optional)">
                                                <Input placeholder="Role (e.g., Owner)" />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                </>
                            )}

                            {step === 3 && (
                                <>
                                    <Title level={5} style={{ marginTop: 0 }}>
                                        Media
                                    </Title>

                                    <Card
                                        size="small"
                                        style={{
                                            borderRadius: 14,
                                            border: '1px solid #eef2ff',
                                            background: 'linear-gradient(90deg,#f8fbff,#ffffff)',
                                        }}
                                    >
                                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                            <Row gutter={[12, 12]} align="middle">
                                                <Col xs={24} md={16}>
                                                    <Text strong>Images</Text>
                                                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,.45)' }}>
                                                        Max {MAX_IMAGES} images. Up to {MAX_IMAGE_MB}MB each. Saving draft will be triggered if needed.
                                                    </div>
                                                </Col>
                                                <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <Tag color="geekblue" style={{ borderRadius: 999 }}>
                                                        Uploaded: {uploadedImages.length}/{MAX_IMAGES}
                                                    </Tag>
                                                </Col>
                                            </Row>

                                            <Upload {...uploadProps}>
                                                {fileList.length >= MAX_IMAGES ? null : (
                                                    <div style={{ display: 'grid', gap: 6, placeItems: 'center' }}>
                                                        <div style={{ fontSize: 18 }}>
                                                            <UploadOutlined />
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,.55)' }}>Upload</div>
                                                    </div>
                                                )}
                                            </Upload>

                                            <Form.Item name="coverImageUrl" label="Cover Image URL (optional)">
                                                <Input placeholder="Leave blank to use first uploaded image" suffix={<EyeOutlined />} />
                                            </Form.Item>
                                        </Space>
                                    </Card>
                                </>
                            )}

                            <Divider style={{ margin: '10px 0' }} />

                            <Row justify="space-between" align="middle">
                                <Col>
                                    <Space>
                                        <Button onClick={prev} disabled={step === 0} style={roundBtn}>
                                            Back
                                        </Button>
                                        <Button
                                            type="primary"
                                            onClick={next}
                                            disabled={step === 3}
                                            style={{ ...roundBtn, boxShadow: '0 10px 22px rgba(22,119,255,0.20)' }}
                                        >
                                            Next
                                        </Button>
                                    </Space>
                                </Col>
                                <Col>
                                    <Tag color={successStoryId ? 'green' : 'gold'} style={{ borderRadius: 999 }}>
                                        {successStoryId ? 'Draft created' : 'Not saved yet'}
                                    </Tag>
                                </Col>
                            </Row>
                        </Form>
                    </MotionCard>
                </Col>

                <Col xs={24} lg={8}>
                    <MotionCard style={softCard} bodyStyle={{ padding: 16 }} title="Quick review">
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                            <Card size="small" style={{ borderRadius: 14, border: '1px solid #eef2ff' }}>
                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                    <Space>
                                        <FileTextOutlined />
                                        <Text strong>Readiness</Text>
                                    </Space>
                                    <Divider style={{ margin: '8px 0' }} />

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Program</Text>
                                        {programId ? (
                                            <Tag color="blue" style={{ borderRadius: 999 }}>
                                                Selected
                                            </Tag>
                                        ) : (
                                            <Tag style={{ borderRadius: 999 }}>Missing</Tag>
                                        )}
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Participant</Text>
                                        {participantId ? (
                                            <Tag color="purple" style={{ borderRadius: 999 }}>
                                                Selected
                                            </Tag>
                                        ) : (
                                            <Tag style={{ borderRadius: 999 }}>Missing</Tag>
                                        )}
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Interventions</Text>
                                        {selectedAssignmentIds.length ? (
                                            <Tag color="geekblue" style={{ borderRadius: 999 }}>
                                                {selectedAssignmentIds.length}
                                            </Tag>
                                        ) : (
                                            <Tag style={{ borderRadius: 999 }}>0</Tag>
                                        )}
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Images</Text>
                                        {uploadedImages.length ? (
                                            <Tag color="green" style={{ borderRadius: 999 }}>
                                                {uploadedImages.length}
                                            </Tag>
                                        ) : (
                                            <Tag style={{ borderRadius: 999 }}>0</Tag>
                                        )}
                                    </Space>
                                </Space>
                            </Card>

                            <Card size="small" style={{ borderRadius: 14, border: '1px solid #eef2ff' }}>
                                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                    <Space>
                                        <InfoCircleOutlined />
                                        <Text strong>Derived from selected interventions</Text>
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Start</Text>
                                        <Text>{derivedPreview.startDate ? dayjs(derivedPreview.startDate.toDate()).format('YYYY-MM-DD') : '-'}</Text>
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">End</Text>
                                        <Text>{derivedPreview.endDate ? dayjs(derivedPreview.endDate.toDate()).format('YYYY-MM-DD') : '-'}</Text>
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Total time</Text>
                                        <Text>{derivedPreview.totalTimeSpent || 0}h</Text>
                                    </Space>

                                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Text type="secondary">Avg progress</Text>
                                        <Text>{typeof derivedPreview.avgProgress === 'number' ? `${derivedPreview.avgProgress}%` : '-'}</Text>
                                    </Space>
                                </Space>
                            </Card>

                            <Button
                                icon={<SaveOutlined />}
                                type="primary"
                                onClick={saveDraft}
                                block
                                style={{ ...roundBtn, boxShadow: '0 10px 22px rgba(22,119,255,0.20)' }}
                            >
                                Save Draft
                            </Button>

                            <Button
                                icon={<RocketOutlined />}
                                type="primary"
                                onClick={publish}
                                block
                                style={{
                                    ...roundBtn,
                                    background: '#16a34a',
                                    borderColor: '#16a34a',
                                    boxShadow: '0 10px 22px rgba(22,163,74,0.20)',
                                }}
                            >
                                Publish
                            </Button>

                            <Button danger icon={<DeleteOutlined />} onClick={resetAll} block style={roundBtn}>
                                Reset
                            </Button>
                        </Space>
                    </MotionCard>
                </Col>
            </Row>
        </>
    )
}

export default SuccessStoryIntakePage

/* ---------------- small local helpers to keep JSX clean ---------------- */

const SelectProgram: React.FC<{
    loading: boolean
    value?: string
    options: ProgramOption[]
    onChange: (v: string) => void
}> = ({ loading, value, options, onChange }) => {
    return (
        <Select
            showSearch
            loading={loading}
            placeholder="Select program"
            optionFilterProp="label"
            value={value}
            onChange={onChange}
            options={options.map(p => ({ label: p.title, value: p.id }))}
        />
    )
}

const SelectParticipant: React.FC<{
    loading: boolean
    value?: string
    options: ParticipantOption[]
    onChange: (v: string) => void
}> = ({ loading, value, options, onChange }) => {
    return (
        <Select
            showSearch
            loading={loading}
            placeholder="Select participant"
            optionFilterProp="label"
            value={value}
            onChange={onChange}
            options={options.map(p => ({
                label: `${p.beneficiaryName || 'Unnamed'}${p.email ? ` • ${p.email}` : ''}`,
                value: p.id,
            }))}
        />
    )
}