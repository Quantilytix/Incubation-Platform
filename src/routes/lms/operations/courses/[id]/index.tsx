// src/pages/CourseBuilder.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Card,
    Button,
    Input,
    Select,
    Switch,
    Typography,
    Row,
    Col,
    Space,
    Modal,
    message
} from 'antd'
import {
    PlusOutlined,
    BookOutlined,
    QuestionCircleOutlined,
    CheckSquareOutlined,
    DeleteOutlined,
    MenuOutlined,
    ArrowLeftOutlined,
    LoadingOutlined,
    HistoryOutlined
} from '@ant-design/icons'
import { db } from '@/firebase'
import {
    addDoc,
    collection,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    getDocs,
    where,
    query,
    limit
} from 'firebase/firestore'

import { useFullIdentity } from '@/hooks/useFullIdentity'
import { useActiveProgramId } from '@/lib/useActiveProgramId'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

const { TextArea } = Input
const { Text, Title } = Typography

/* -------------------------------- Types ------------------------------- */

interface QuizQuestion {
    id: string
    question: string
    options: string[]
    correctAnswer: number
}

type ModuleKind = 'lesson' | 'quiz' | 'assignment' | 'review'

interface BaseModule {
    id: string
    type: ModuleKind
    title: string
    description: string
    aiChatEnabled?: boolean
}

interface LessonModule extends BaseModule {
    type: 'lesson'
    duration?: string
    content?: string
    videoUrls?: string[]
    imageUrls?: string[]
}

interface QuizModule extends BaseModule {
    type: 'quiz'
    questions?: QuizQuestion[]
}

interface AssignmentModule extends BaseModule {
    type: 'assignment'
    assignmentPrompt?: string
    answerKey?: string
}

interface ReviewModule extends BaseModule {
    type: 'review'
}

type CourseModule = LessonModule | QuizModule | AssignmentModule | ReviewModule
type CourseStatus = 'draft' | 'active'

type ProgramDoc = {
    id: string
    name: string
}

/* ----------------------- Helpers / Normalization ---------------------- */

function stripUndefinedDeep<T>(val: T): T {
    if (Array.isArray(val)) return val.map(stripUndefinedDeep) as T
    if (val && typeof val === 'object') {
        const out: any = {}
        for (const [k, v] of Object.entries(val as any)) {
            if (v === undefined) continue
            out[k] = stripUndefinedDeep(v)
        }
        return out
    }
    return val
}

function normalizeModules(mods: CourseModule[]): CourseModule[] {
    return (mods ?? []).map(m => {
        if (m.type === 'lesson') {
            const lm = m as LessonModule
            return {
                id: lm.id,
                type: 'lesson',
                title: (lm.title ?? '').trim(),
                description: lm.description ?? '',
                duration: lm.duration ?? '',
                content: lm.content ?? '',
                videoUrls: Array.isArray(lm.videoUrls) ? lm.videoUrls.filter(Boolean) : [],
                imageUrls: Array.isArray(lm.imageUrls) ? lm.imageUrls.filter(Boolean) : []
            } as LessonModule
        }
        if (m.type === 'quiz') {
            const qm = m as QuizModule
            const qs = (qm.questions ?? []).map(q => ({
                id: q.id,
                question: q.question ?? '',
                options: (q.options ?? ['', '', '', '']).slice(0, 4).map(o => o ?? ''),
                correctAnswer:
                    typeof q.correctAnswer === 'number' && q.correctAnswer >= 0 && q.correctAnswer < 4
                        ? q.correctAnswer
                        : 0
            }))
            return {
                id: qm.id,
                type: 'quiz',
                title: (qm.title ?? '').trim(),
                description: qm.description ?? '',
                questions: qs
            } as QuizModule
        }
        if (m.type === 'assignment') {
            const am = m as AssignmentModule
            return {
                id: am.id,
                type: 'assignment',
                title: (am.title ?? '').trim(),
                description: am.description ?? '',
                assignmentPrompt: am.assignmentPrompt ?? '',
                answerKey: am.answerKey ?? ''
            } as AssignmentModule
        }
        const rv = m as ReviewModule
        return {
            id: rv.id,
            type: 'review',
            title: (rv.title ?? '').trim(),
            description: rv.description ?? ''
        } as ReviewModule
    })
}

function parseDurationToMinutes(raw?: string): number {
    if (!raw) return 0
    const s = raw.trim().toLowerCase()
    if (!s) return 0
    const hm = /^(\d+)\s*:\s*(\d+)$/.exec(s)
    if (hm) {
        const h = parseInt(hm[1] || '0', 10)
        const m = parseInt(hm[2] || '0', 10)
        return (isNaN(h) ? 0 : h * 60) + (isNaN(m) ? 0 : m)
    }
    const hMatch = /(\d+)\s*h/.exec(s)
    const mMatch = /(\d+)\s*m(in|ins)?/.exec(s)
    let total = 0
    if (hMatch) total += parseInt(hMatch[1], 10) * 60
    if (mMatch) total += parseInt(mMatch[1], 10)
    if (total > 0) return total
    const num = parseInt(s, 10)
    return isNaN(num) ? 0 : num
}

function minutesToLabel(mins: number): string {
    if (mins <= 0) return '0m'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (!h) return `${m}m`
    if (!m) return `${h}h`
    return `${h}h ${m}m`
}

const capFirstLetter = (s: string) =>
    String(s || '')
        .trim()
        .replace(/_/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ')

/* ------------------------------- Component ---------------------------- */

const CourseBuilder: React.FC = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { id } = useParams<{ id: string }>()
    const isEditMode = !!id && id !== 'new'

    // NOTE: your useFullIdentity returns "id" not "uid"
    const { user } = useFullIdentity() as {
        user:
        | {
            id: string
            email: string | null
            displayName?: string | null
            name?: string | null
            companyCode?: string | null
        }
        | null
    }

    const activeProgramId = useActiveProgramId()

    const userId = String(user?.id || '')
    const userEmail = user?.email || null
    const companyCode = String(user?.companyCode || '')
    const instructorResolved = (user?.displayName || user?.name || '').trim()

    const [modules, setModules] = useState<CourseModule[]>([])
    const [courseTitle, setCourseTitle] = useState('')
    const [courseDescription, setCourseDescription] = useState('')
    const [difficulty, setDifficulty] = useState('')
    const [category, setCategory] = useState('')
    const [courseType, setCourseType] = useState('')

    // Program resolution state
    const [programId, setProgramId] = useState<string>('')
    const [resolvedProgramName, setResolvedProgramName] = useState<string>('')
    const [programsCount, setProgramsCount] = useState<number>(0)
    const [programResolving, setProgramResolving] = useState<boolean>(false)

    // UX state
    const [activeSection, setActiveSection] = useState<number>(-1)
    const [draggedItem, setDraggedItem] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [loading, setLoading] = useState(false)

    const cameFrom = (location.state as any)?.from as string | undefined
    const backTarget = useMemo(() => cameFrom || -1, [cameFrom])
    const [exitOpen, setExitOpen] = useState(false)

    const inFlightRef = useRef(false)
    const cooldownRef = useRef<number | null>(null)
    const COOLDOWN_MS = 2000

    useEffect(() => {
        return () => {
            if (cooldownRef.current !== null) window.clearTimeout(cooldownRef.current)
        }
    }, [])

    const markDirty = () => setDirty(true)

    /* --------------------- Resolve program (FIXED) ---------------------- */
    useEffect(() => {
        const resolveProgram = async () => {
            // Don’t resolve programs in edit mode based on companyCode,
            // because the course already has a programId saved.
            if (!companyCode || isEditMode) return

            setProgramResolving(true)
            try {
                // Try programs collection first
                let programs: ProgramDoc[] = []

                const programsRef = collection(db, 'programs')
                const q1 = query(programsRef, where('companyCode', '==', companyCode), limit(50))
                const snap1 = await getDocs(q1)
                programs = snap1.docs.map(d => ({
                    id: d.id,
                    name: String((d.data() as any)?.name || (d.data() as any)?.title || '')
                }))

                // Fallback if you’re using a different collection name
                if (programs.length === 0) {
                    const fallbackRef = collection(db, 'incubationPrograms')
                    const q2 = query(fallbackRef, where('companyCode', '==', companyCode), limit(50))
                    const snap2 = await getDocs(q2)
                    programs = snap2.docs.map(d => ({
                        id: d.id,
                        name: String((d.data() as any)?.name || (d.data() as any)?.title || '')
                    }))
                }

                setProgramsCount(programs.length)

                if (programs.length === 1) {
                    setProgramId(programs[0].id)
                    setResolvedProgramName(programs[0].name)
                    return
                }

                if (programs.length > 1) {
                    // multiple programs: use activeProgramId if available, otherwise fallback to first
                    const chosenId = activeProgramId || programs[0].id
                    setProgramId(chosenId)

                    const hit = programs.find(p => p.id === chosenId)
                    setResolvedProgramName(hit?.name || '')

                    if (!activeProgramId) {
                        message.warning('Multiple programs found — using the first program because no active program is selected.')
                    }
                    return
                }

                // no programs found
                setProgramId(activeProgramId || '')
                setResolvedProgramName('')
            } catch (e: any) {
                // eslint-disable-next-line no-console
                console.error('[CourseBuilder] resolveProgram error:', e)
                message.error('Failed to resolve program.')
            } finally {
                setProgramResolving(false)
            }
        }

        resolveProgram()
    }, [companyCode, activeProgramId, isEditMode])

    /* ------------------- Total duration (auto calc) --------------------- */
    const totalDurationMinutes = useMemo(() => {
        return (modules ?? []).reduce((sum, m) => {
            if (m.type !== 'lesson') return sum
            return sum + parseDurationToMinutes((m as LessonModule).duration)
        }, 0)
    }, [modules])

    const totalDurationLabel = useMemo(() => minutesToLabel(totalDurationMinutes), [totalDurationMinutes])

    const [aiCourseReviewEnabled, setAiCourseReviewEnabled] = useState<boolean>(false)
    const [aiLessonChatEnabled, setAiLessonChatEnabled] = useState<boolean>(false)

    /* ------------------------ Load course (edit) ------------------------ */
    useEffect(() => {
        if (!isEditMode || !id) return

        const loadCourse = async () => {
            try {
                setLoading(true)
                const ref = doc(db, 'courses', id)
                const snap = await getDoc(ref)

                if (!snap.exists()) {
                    message.error('Course not found.')
                    navigate('/lms/operations/courses')
                    return
                }

                const data = snap.data() as any

                setCourseTitle(String(data.title || ''))
                setCourseDescription(String(data.description || ''))
                setDifficulty(String(data.difficulty || ''))
                setCategory(String(data.category || ''))
                setCourseType(String(data.type || ''))
                setModules((data.modules as CourseModule[]) || [])

                setAiCourseReviewEnabled(Boolean(data.ai?.reviewChatbot?.enabled))
                setAiLessonChatEnabled(Boolean(data.ai?.onLessonChat?.enabled))

                // Use saved programId; if missing, fallback to resolver behavior
                const savedProgramId = String(data.programId || '')
                setProgramId(savedProgramId || activeProgramId || '')
                setResolvedProgramName(String(data.programName || '')) // optional if you store it later

                setDirty(false)
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[CourseBuilder] loadCourse error:', err)
                message.error('Failed to load course.')
            } finally {
                setLoading(false)
            }
        }

        loadCourse()
    }, [isEditMode, id, navigate, activeProgramId])

    /* -------------------------- Module handlers ------------------------- */
    const addModule = (type: ModuleKind) => {
        let newModule: CourseModule

        if (type === 'lesson') {
            newModule = {
                id: crypto.randomUUID(),
                type: 'lesson',
                title: '',
                description: '',
                duration: '10m',
                content: '',
                videoUrls: [],
                imageUrls: []
            }
        } else if (type === 'quiz') {
            newModule = {
                id: crypto.randomUUID(),
                type: 'quiz',
                title: '',
                description: '',
                questions: []
            }
        } else if (type === 'assignment') {
            newModule = {
                id: crypto.randomUUID(),
                type: 'assignment',
                title: '',
                description: '',
                assignmentPrompt: '',
                answerKey: ''
            }
        } else {
            newModule = {
                id: crypto.randomUUID(),
                type: 'review',
                title: 'AI Review',
                description: 'Automatically reviews previous lessons'
            }
        }

        setModules(prev => [...prev, newModule])
        setActiveSection(modules.length)
        markDirty()
    }

    const removeModule = (moduleId: string) => {
        const index = modules.findIndex(m => m.id === moduleId)
        setModules(mods => mods.filter(m => m.id !== moduleId))
        if (activeSection === index) setActiveSection(-1)
        else if (activeSection > index) setActiveSection(prev => prev - 1)
        markDirty()
    }

    const updateModule = (mid: string, field: keyof CourseModule, value: any) => {
        setModules(prev =>
            prev.map(module => (module.id === mid ? ({ ...module, [field]: value } as CourseModule) : module))
        )
        markDirty()
    }

    const handleDragStart = (index: number) => setDraggedItem(index)
    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault()
        if (draggedItem === null || draggedItem === index) return
        const reordered = [...modules]
        const dragged = reordered[draggedItem]
        reordered.splice(draggedItem, 1)
        reordered.splice(index, 0, dragged)
        setModules(reordered)
        setDraggedItem(index)
        markDirty()
    }
    const handleDragEnd = () => setDraggedItem(null)

    const addQuizQuestion = (moduleId: string) => {
        const mod = modules.find(m => m.id === moduleId)
        if (mod && mod.type === 'quiz') {
            const newQuestion: QuizQuestion = {
                id: crypto.randomUUID(),
                question: '',
                options: ['', '', '', ''],
                correctAnswer: 0
            }
            const updated = [...(mod.questions || []), newQuestion]
            updateModule(moduleId, 'questions', updated as any)
        }
    }

    const updateQuizQuestion = (moduleId: string, questionId: string, field: keyof QuizQuestion, value: any) => {
        const mod = modules.find(m => m.id === moduleId)
        if (mod && mod.type === 'quiz' && mod.questions) {
            const updated = mod.questions.map(q => (q.id === questionId ? { ...q, [field]: value } : q))
            updateModule(moduleId, 'questions', updated as any)
        }
    }

    const removeQuizQuestion = (moduleId: string, questionId: string) => {
        const mod = modules.find(m => m.id === moduleId)
        if (mod && mod.type === 'quiz' && mod.questions) {
            const updated = mod.questions.filter(q => q.id !== questionId)
            updateModule(moduleId, 'questions', updated as any)
        }
    }

    const getModuleIcon = (type: ModuleKind) => {
        switch (type) {
            case 'lesson':
                return <BookOutlined style={{ fontSize: 14 }} />
            case 'quiz':
                return <QuestionCircleOutlined style={{ fontSize: 14 }} />
            case 'assignment':
                return <CheckSquareOutlined style={{ fontSize: 14 }} />
            case 'review':
                return <HistoryOutlined style={{ fontSize: 14 }} />
        }
    }

    /* ----------------------------- Save logic --------------------------- */
    const saveCourse = async (status: CourseStatus) => {
        // FIX 1: use user.id not user.uid
        if (!userId || !userEmail) {
            message.error('User not resolved. Please sign in again.')
            return false
        }

        // FIX 2: ensure programId is resolved before saving (new course)
        if (!isEditMode && programsCount > 1 && !programId) {
            message.error('Please select an active program first (multiple programs detected).')
            return false
        }

        if (inFlightRef.current) return false
        inFlightRef.current = true
        setSaving(true)

        try {
            if (status === 'active') {
                if (!courseTitle.trim() || !courseDescription.trim() || !difficulty || !category) {
                    message.error('Complete Title, Description, Difficulty and Category before publishing.')
                    return false
                }
            }

            const normalizedModules = normalizeModules(modules)

            const modulesWithAI: CourseModule[] = (normalizedModules ?? []).map(m => ({
                ...m,
                aiChatEnabled: m.type === 'lesson' ? aiLessonChatEnabled : false
            }))

            // FIX 3: providerId must use user.id
            const basePayload = stripUndefinedDeep({
                title: (courseTitle || '').trim() || '(Untitled Course)',
                description: courseDescription || '',
                difficulty: difficulty || '',
                category: category || '',
                type: courseType || '',
                status,
                modules: modulesWithAI,

                instructorName: instructorResolved || null,
                instructorEmail: userEmail,

                providerId: userId,
                providerEmail: userEmail,

                // Program handling:
                programId: programId || null,
                programName: resolvedProgramName || null,
                programsCount,

                // totals
                totalDurationMinutes,
                totalDurationLabel,

                ai: {
                    reviewChatbot: { enabled: aiCourseReviewEnabled },
                    onLessonChat: {
                        enabled: aiLessonChatEnabled,
                        restrictions: { lessons: true, quizzes: false, assignments: false }
                    }
                }
            })

            if (isEditMode && id) {
                const ref = doc(db, 'courses', id)
                await updateDoc(ref, {
                    ...basePayload,
                    updatedAt: serverTimestamp()
                })
                message.success(status === 'draft' ? 'Draft updated.' : 'Course updated.')
            } else {
                await addDoc(collection(db, 'courses'), {
                    ...basePayload,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
                message.success(status === 'draft' ? 'Draft saved.' : 'Course saved.')
            }

            setDirty(false)

            if (cooldownRef.current !== null) window.clearTimeout(cooldownRef.current)
            cooldownRef.current = window.setTimeout(() => { }, COOLDOWN_MS)

            return true
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[CourseBuilder] saveCourse error:', e)
            message.error('Something went wrong while saving. Please try again.')
            return false
        } finally {
            setSaving(false)
            inFlightRef.current = false
        }
    }

    const handleSaveDraft = async () => {
        if (saving) return
        await saveCourse('draft')
    }

    const handleSaveActive = async () => {
        if (saving) return
        await saveCourse('active')
    }

    const proceedBack = () => {
        if (typeof backTarget === 'number') navigate(backTarget)
        else if (backTarget) navigate(backTarget)
        else navigate('/lms/operations/courses')
    }

    const handleBack = () => {
        if (dirty) {
            setExitOpen(true)
            return
        }
        proceedBack()
    }

    /* -------- Helpers for lesson media URL arrays (unchanged) ----------- */
    function updateStringArrayField(mod: LessonModule, key: 'videoUrls' | 'imageUrls', index: number, next: string) {
        const arr = Array.isArray(mod[key]) ? [...(mod[key] as string[])] : []
        arr[index] = next
        updateModule(mod.id, key as keyof CourseModule, arr)
    }

    function addStringArrayItem(mod: LessonModule, key: 'videoUrls' | 'imageUrls') {
        const arr = Array.isArray(mod[key]) ? [...(mod[key] as string[])] : []
        arr.push('')
        updateModule(mod.id, key as keyof CourseModule, arr)
    }

    function removeStringArrayItem(mod: LessonModule, key: 'videoUrls' | 'imageUrls', index: number) {
        const arr = Array.isArray(mod[key]) ? [...(mod[key] as string[])] : []
        arr.splice(index, 1)
        updateModule(mod.id, key as keyof CourseModule, arr)
    }

    const savingIcon = saving ? <LoadingOutlined style={{ fontSize: 16 }} spin /> : null

    /* ------------------- Category typing (FIXED) ------------------------ */
    // FIX 4: categoryOptions + mergedCategoryOptions now actually used
    const categoryOptions = useMemo(
        () => [
            { value: 'programming', label: 'Programming' },
            { value: 'design', label: 'Design' },
            { value: 'business', label: 'Business' },
            { value: 'marketing', label: 'Marketing' },
            { value: 'data-science', label: 'Data Science' }
        ],
        []
    )

    const [categorySearch, setCategorySearch] = useState('')

    const mergedCategoryOptions = useMemo(() => {
        const base = [...categoryOptions]
        const typed = categorySearch.trim()
        const exists = typed && base.some(o => String(o.value).toLowerCase() === typed.toLowerCase())
        if (typed && !exists) {
            base.unshift({ value: typed, label: `Use "${capFirstLetter(typed)}"` })
        }
        return base
    }, [categoryOptions, categorySearch])

    /* ------------------------------ Render ------------------------------ */

    // UX rule: if company has <=1 program, don’t show Program ID / Total Duration
    const hideProgramFields = programsCount <= 1
    const hideTotalDurationField = true // per your instruction (auto-calculated)

    return (
        <div style={{ padding: 24 }}>
            {/* Exit confirmation */}
            <Modal
                open={exitOpen}
                onCancel={() => setExitOpen(false)}
                onOk={proceedBack}
                okText='Discard & Leave'
                cancelText='Stay'
                title='Leave without saving?'
            >
                <p>You have unsaved changes. Save as draft before leaving, or discard your changes.</p>
            </Modal>

            {/* Top bar */}
            <div
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: '#fff',
                    borderBottom: '1px solid #f0f0f0',
                    marginBottom: 16,
                    padding: '8px 0'
                }}
            >
                <Row justify='space-between' align='middle'>
                    <Col>
                        <Button
                            type='text'
                            icon={saving ? <LoadingOutlined style={{ fontSize: 14 }} spin /> : <ArrowLeftOutlined />}
                            onClick={handleBack}
                            disabled={saving}
                        >
                            Back
                        </Button>
                    </Col>
                    <Col>
                        <Space>
                            <Button onClick={handleSaveDraft} disabled={saving} icon={savingIcon}>
                                Save as Draft
                            </Button>
                            <Button type='primary' onClick={handleSaveActive} disabled={saving} icon={savingIcon}>
                                Save Course
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </div>

            {/* Main layout */}
            <Row gutter={24} align='stretch'>
                {/* LEFT: COURSE STRUCTURE RAIL */}
                <Col xs={24} md={7} lg={6}>
                    <Card
                        bordered={false}
                        style={{
                            height: 'calc(100vh - 140px)',
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#ffffff'
                        }}
                        bodyStyle={{
                            padding: 16,
                            paddingBottom: 12,
                            display: 'flex',
                            flexDirection: 'column'
                        }}
                    >
                        <div style={{ marginBottom: 16 }}>
                            <Title level={4} style={{ marginBottom: 0 }}>
                                Course Structure
                            </Title>
                        </div>

                        <div style={{ overflowY: 'auto', paddingRight: 4 }}>
                            <Space direction='vertical' style={{ width: '100%' }} size={4}>
                                <Button
                                    block
                                    type={activeSection === -1 ? 'primary' : 'default'}
                                    style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                    icon={<BookOutlined style={{ fontSize: 14 }} />}
                                    onClick={() => setActiveSection(-1)}
                                >
                                    Course Information
                                </Button>

                                {modules.map((module, index) => (
                                    <div
                                        key={module.id}
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={e => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        style={{ opacity: draggedItem === index ? 0.5 : 1 }}
                                    >
                                        <Button
                                            block
                                            type={activeSection === index ? 'primary' : 'default'}
                                            style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                            icon={<MenuOutlined style={{ fontSize: 12 }} />}
                                            onClick={() => setActiveSection(index)}
                                        >
                                            <Space size={8}>
                                                {getModuleIcon(module.type)}
                                                <span>{module.title || `${capFirstLetter(module.type)} ${index + 1}`}</span>
                                            </Space>
                                        </Button>
                                    </div>
                                ))}
                            </Space>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                            <Space direction='vertical' style={{ width: '100%' }} size={8}>
                                <Button block icon={<PlusOutlined />} onClick={() => addModule('lesson')}>
                                    Add Lesson
                                </Button>
                                <Button block icon={<PlusOutlined />} onClick={() => addModule('quiz')}>
                                    Add Quiz
                                </Button>
                                <Button block icon={<PlusOutlined />} onClick={() => addModule('assignment')}>
                                    Add Assignment
                                </Button>
                                <Button block icon={<PlusOutlined />} onClick={() => addModule('review')}>
                                    Add AI Review
                                </Button>
                            </Space>
                        </div>
                    </Card>
                </Col>

                {/* RIGHT: DETAIL PANE */}
                <Col xs={24} md={17} lg={18}>
                    {loading ? (
                        <Card>
                            <Space>
                                <LoadingOutlined />
                                <span>Loading course...</span>
                            </Space>
                        </Card>
                    ) : activeSection === -1 ? (
                        <Card>
                            <Title level={4} style={{ marginBottom: 24 }}>
                                Course Information
                            </Title>

                            <Space direction='vertical' size={24} style={{ width: '100%' }}>
                                {/* Program info (shown only when multiple programs exist) */}
                                {!hideProgramFields && (
                                    <Card size='small'>
                                        <Row gutter={[16, 16]} align='middle'>
                                            <Col xs={24} md={12}>
                                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                    <Text strong>Program</Text>
                                                    <Input
                                                        value={programId || ''}
                                                        readOnly
                                                        placeholder={programResolving ? 'Resolving program...' : 'No program resolved'}
                                                    />
                                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                                        {programResolving
                                                            ? 'Resolving program based on company programs + active program.'
                                                            : resolvedProgramName
                                                                ? `Program: ${resolvedProgramName}`
                                                                : 'Select an active program using the global filter.'}
                                                    </Text>
                                                </Space>
                                            </Col>

                                            <Col xs={24} md={12}>
                                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                    <Text strong>Programs Found</Text>
                                                    <Input value={String(programsCount)} readOnly />
                                                    <Text type='secondary' style={{ fontSize: 12 }}>
                                                        Multiple programs → we use activeProgramId.
                                                    </Text>
                                                </Space>
                                            </Col>
                                        </Row>
                                    </Card>
                                )}

                                <Row gutter={24}>
                                    <Col xs={24} md={12}>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Course Type</Text>
                                            <Input
                                                placeholder='e.g., Core, Elective, Foundational, Track'
                                                value={courseType}
                                                onChange={e => {
                                                    setCourseType(e.target.value)
                                                    markDirty()
                                                }}
                                            />
                                            <Text type='secondary' style={{ fontSize: 12 }}>
                                                Optional tag for program filtering.
                                            </Text>
                                        </Space>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Instructor</Text>
                                            <Input value={instructorResolved || userEmail || ''} readOnly />
                                            <Text type='secondary' style={{ fontSize: 12 }}>
                                                Taken from your account.
                                            </Text>
                                        </Space>
                                    </Col>
                                </Row>

                                {/* Total duration hidden (per instruction) */}
                                {!hideTotalDurationField ? (
                                    <Row gutter={24}>
                                        <Col xs={24} md={12}>
                                            <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                <Text strong>Total Duration</Text>
                                                <Input value={totalDurationLabel} readOnly />
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    Auto-calculated from lesson durations.
                                                </Text>
                                            </Space>
                                        </Col>
                                    </Row>
                                ) : null}

                                <Card size='small'>
                                    <Space direction='vertical' style={{ width: '100%' }} size='large'>
                                        <Row justify='space-between' align='middle'>
                                            <Col flex='auto'>
                                                <Text strong>Course Review Chatbot</Text>
                                                <br />
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    Enable a chatbot to answer questions about the overall course.
                                                </Text>
                                            </Col>
                                            <Col>
                                                <Switch
                                                    checked={aiCourseReviewEnabled}
                                                    onChange={v => {
                                                        setAiCourseReviewEnabled(v)
                                                        markDirty()
                                                    }}
                                                />
                                            </Col>
                                        </Row>

                                        <Row justify='space-between' align='middle'>
                                            <Col flex='auto'>
                                                <Text strong>On-Lesson Chat</Text>
                                                <br />
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    Enables chat inside lessons only (never in quizzes or assignments).
                                                </Text>
                                            </Col>
                                            <Col>
                                                <Switch
                                                    checked={aiLessonChatEnabled}
                                                    onChange={v => {
                                                        setAiLessonChatEnabled(v)
                                                        markDirty()
                                                    }}
                                                />
                                            </Col>
                                        </Row>
                                    </Space>
                                </Card>

                                <Row gutter={24}>
                                    <Col xs={24} md={12}>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Course Title</Text>
                                            <Input
                                                placeholder='Enter course title...'
                                                value={courseTitle}
                                                onChange={e => {
                                                    setCourseTitle(e.target.value)
                                                    markDirty()
                                                }}
                                            />
                                        </Space>
                                    </Col>

                                    <Col xs={24} md={12}>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Category</Text>
                                            <Select
                                                showSearch
                                                value={category || undefined}
                                                placeholder='Select or type category'
                                                style={{ width: '100%' }}
                                                options={mergedCategoryOptions}
                                                onSearch={v => setCategorySearch(v)}
                                                filterOption={(input, option) =>
                                                    String(option?.label || '').toLowerCase().includes(input.toLowerCase())
                                                }
                                                onChange={v => {
                                                    setCategory(String(v))
                                                    markDirty()
                                                }}
                                                onBlur={() => setCategorySearch('')}
                                            />
                                            <Text type='secondary' style={{ fontSize: 12 }}>
                                                You can type a new category and select “Use …”.
                                            </Text>
                                        </Space>
                                    </Col>
                                </Row>

                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                    <Text strong>Course Description</Text>
                                    <TextArea
                                        placeholder='Describe what students will learn...'
                                        rows={3}
                                        value={courseDescription}
                                        onChange={e => {
                                            setCourseDescription(e.target.value)
                                            markDirty()
                                        }}
                                    />
                                </Space>

                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                    <Text strong>Difficulty Level</Text>
                                    <Select
                                        value={difficulty || undefined}
                                        onChange={v => {
                                            setDifficulty(String(v))
                                            markDirty()
                                        }}
                                        placeholder='Select difficulty'
                                        style={{ width: '100%' }}
                                        options={[
                                            { value: 'beginner', label: 'Beginner' },
                                            { value: 'intermediate', label: 'Intermediate' },
                                            { value: 'advanced', label: 'Advanced' }
                                        ]}
                                    />
                                </Space>
                            </Space>
                        </Card>
                    ) : activeSection >= 0 && activeSection < modules.length ? (
                        <Card
                            title={
                                <Space>
                                    {getModuleIcon(modules[activeSection].type)}
                                    <span className='capitalize'>
                                        {capFirstLetter(modules[activeSection].type)} {activeSection + 1}
                                    </span>
                                </Space>
                            }
                            extra={
                                <Button
                                    type='text'
                                    danger
                                    size='small'
                                    onClick={() => removeModule(modules[activeSection].id)}
                                    icon={<DeleteOutlined />}
                                />
                            }
                        >
                            <Space direction='vertical' size={16} style={{ width: '100%' }}>
                                <Row gutter={24}>
                                    <Col xs={24} md={modules[activeSection].type === 'lesson' ? 12 : 24}>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Title</Text>
                                            <Input
                                                placeholder={`${capFirstLetter(modules[activeSection].type)} title...`}
                                                value={modules[activeSection].title}
                                                onChange={e => updateModule(modules[activeSection].id, 'title', e.target.value)}
                                            />
                                        </Space>
                                    </Col>

                                    {modules[activeSection].type === 'lesson' && (
                                        <Col xs={24} md={12}>
                                            <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                <Text strong>Duration</Text>
                                                <Input
                                                    placeholder='e.g., 15m, 1h 20m, 1:15'
                                                    value={(modules[activeSection] as LessonModule).duration || ''}
                                                    onChange={e => updateModule(modules[activeSection].id, 'duration', e.target.value)}
                                                />
                                                <Text type='secondary' style={{ fontSize: 12 }}>
                                                    This contributes to the auto-calculated total duration.
                                                </Text>
                                            </Space>
                                        </Col>
                                    )}
                                </Row>

                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                    <Text strong>Description</Text>
                                    <TextArea
                                        placeholder={`${capFirstLetter(modules[activeSection].type)} description...`}
                                        rows={2}
                                        value={modules[activeSection].description}
                                        onChange={e => updateModule(modules[activeSection].id, 'description', e.target.value)}
                                    />
                                </Space>

                                {/* LESSON CONTENT */}
                                {modules[activeSection].type === 'lesson' && (
                                    <>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Content / Notes</Text>
                                            <TextArea
                                                placeholder='Add lesson content, notes, or discussion points...'
                                                rows={8}
                                                value={(modules[activeSection] as LessonModule).content || ''}
                                                onChange={e => updateModule(modules[activeSection].id, 'content', e.target.value)}
                                            />
                                        </Space>

                                        <Row gutter={24}>
                                            <Col xs={24} md={12}>
                                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                    <Row justify='space-between' align='middle'>
                                                        <Col>
                                                            <Text strong>Video URLs</Text>
                                                        </Col>
                                                        <Col>
                                                            <Button
                                                                size='small'
                                                                icon={<PlusOutlined />}
                                                                onClick={() => addStringArrayItem(modules[activeSection] as LessonModule, 'videoUrls')}
                                                            >
                                                                Add Video
                                                            </Button>
                                                        </Col>
                                                    </Row>

                                                    <Space direction='vertical' size={8} style={{ width: '100%' }}>
                                                        {((modules[activeSection] as LessonModule).videoUrls ?? []).map((u, idx) => (
                                                            <Row key={idx} gutter={8}>
                                                                <Col flex='auto'>
                                                                    <Input
                                                                        placeholder='https://... (YouTube/Vimeo/MP4)'
                                                                        value={u}
                                                                        onChange={e =>
                                                                            updateStringArrayField(modules[activeSection] as LessonModule, 'videoUrls', idx, e.target.value)
                                                                        }
                                                                    />
                                                                </Col>
                                                                <Col>
                                                                    <Button
                                                                        type='text'
                                                                        danger
                                                                        icon={<DeleteOutlined />}
                                                                        onClick={() =>
                                                                            removeStringArrayItem(modules[activeSection] as LessonModule, 'videoUrls', idx)
                                                                        }
                                                                    />
                                                                </Col>
                                                            </Row>
                                                        ))}
                                                    </Space>
                                                </Space>
                                            </Col>

                                            <Col xs={24} md={12}>
                                                <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                    <Row justify='space-between' align='middle'>
                                                        <Col>
                                                            <Text strong>Image URLs</Text>
                                                        </Col>
                                                        <Col>
                                                            <Button
                                                                size='small'
                                                                icon={<PlusOutlined />}
                                                                onClick={() => addStringArrayItem(modules[activeSection] as LessonModule, 'imageUrls')}
                                                            >
                                                                Add Image
                                                            </Button>
                                                        </Col>
                                                    </Row>

                                                    <Space direction='vertical' size={8} style={{ width: '100%' }}>
                                                        {((modules[activeSection] as LessonModule).imageUrls ?? []).map((u, idx) => (
                                                            <Row key={idx} gutter={8}>
                                                                <Col flex='auto'>
                                                                    <Input
                                                                        placeholder='https://... (PNG/JPG/WebP)'
                                                                        value={u}
                                                                        onChange={e =>
                                                                            updateStringArrayField(modules[activeSection] as LessonModule, 'imageUrls', idx, e.target.value)
                                                                        }
                                                                    />
                                                                </Col>
                                                                <Col>
                                                                    <Button
                                                                        type='text'
                                                                        danger
                                                                        icon={<DeleteOutlined />}
                                                                        onClick={() =>
                                                                            removeStringArrayItem(modules[activeSection] as LessonModule, 'imageUrls', idx)
                                                                        }
                                                                    />
                                                                </Col>
                                                            </Row>
                                                        ))}
                                                    </Space>
                                                </Space>
                                            </Col>
                                        </Row>
                                    </>
                                )}

                                {/* REVIEW INFO */}
                                {modules[activeSection].type === 'review' && (
                                    <Card size='small' style={{ background: '#fafafa' }}>
                                        <p>
                                            This is an AI Review marker. When learners reach this step, the system will compile all lessons since
                                            the previous review and pass them to the AI.
                                        </p>
                                        <Text type='secondary' style={{ fontSize: 12 }}>
                                            Drop these after every few lessons. The lookback is computed at runtime.
                                        </Text>
                                    </Card>
                                )}

                                {/* QUIZ EDITOR */}
                                {modules[activeSection].type === 'quiz' && (
                                    <Space direction='vertical' size={16} style={{ width: '100%' }}>
                                        <Row justify='space-between' align='middle'>
                                            <Col>
                                                <Text strong>Questions</Text>
                                            </Col>
                                            <Col>
                                                <Button size='small' icon={<PlusOutlined />} onClick={() => addQuizQuestion(modules[activeSection].id)}>
                                                    Add Question
                                                </Button>
                                            </Col>
                                        </Row>

                                        <Space direction='vertical' size={12} style={{ width: '100%' }}>
                                            {(modules[activeSection] as QuizModule).questions?.map((question, qIndex) => (
                                                <Card
                                                    key={question.id}
                                                    size='small'
                                                    bordered
                                                    title={`Question ${qIndex + 1}`}
                                                    extra={
                                                        <Button
                                                            type='text'
                                                            danger
                                                            size='small'
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => removeQuizQuestion(modules[activeSection].id, question.id)}
                                                        />
                                                    }
                                                >
                                                    <Space direction='vertical' size={8} style={{ width: '100%' }}>
                                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                            <Text className='text-xs'>Question</Text>
                                                            <Input
                                                                placeholder='Enter question...'
                                                                value={question.question}
                                                                onChange={e =>
                                                                    updateQuizQuestion(modules[activeSection].id, question.id, 'question', e.target.value)
                                                                }
                                                            />
                                                        </Space>

                                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                                            <Text className='text-xs'>Options (select correct answer)</Text>
                                                            {question.options.map((option, optIndex) => (
                                                                <Row key={optIndex} gutter={8} align='middle'>
                                                                    <Col flex='auto'>
                                                                        <Input
                                                                            placeholder={`Option ${optIndex + 1}`}
                                                                            value={option}
                                                                            onChange={e => {
                                                                                const newOptions = [...question.options]
                                                                                newOptions[optIndex] = e.target.value
                                                                                updateQuizQuestion(modules[activeSection].id, question.id, 'options', newOptions)
                                                                            }}
                                                                        />
                                                                    </Col>
                                                                    <Col>
                                                                        <input
                                                                            type='radio'
                                                                            name={`correct-${question.id}`}
                                                                            checked={question.correctAnswer === optIndex}
                                                                            onChange={() =>
                                                                                updateQuizQuestion(modules[activeSection].id, question.id, 'correctAnswer', optIndex)
                                                                            }
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                    </Col>
                                                                </Row>
                                                            ))}
                                                        </Space>
                                                    </Space>
                                                </Card>
                                            ))}
                                        </Space>
                                    </Space>
                                )}

                                {/* ASSIGNMENT EDITOR */}
                                {modules[activeSection].type === 'assignment' && (
                                    <Space direction='vertical' size={16} style={{ width: '100%' }}>
                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Assignment Instructions</Text>
                                            <TextArea
                                                placeholder='Provide instructions for the assignment...'
                                                rows={6}
                                                value={(modules[activeSection] as AssignmentModule).assignmentPrompt || ''}
                                                onChange={e => updateModule(modules[activeSection].id, 'assignmentPrompt', e.target.value)}
                                            />
                                        </Space>

                                        <Space direction='vertical' size={4} style={{ width: '100%' }}>
                                            <Text strong>Answer Key (For AI Grading)</Text>
                                            <TextArea
                                                placeholder='Provide the ideal answer or key points for AI to grade against...'
                                                rows={6}
                                                value={(modules[activeSection] as AssignmentModule).answerKey || ''}
                                                onChange={e => updateModule(modules[activeSection].id, 'answerKey', e.target.value)}
                                            />
                                        </Space>
                                    </Space>
                                )}
                            </Space>
                        </Card>
                    ) : null}
                </Col>
            </Row>
        </div>
    )
}

export default CourseBuilder
