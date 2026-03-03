import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    Steps,
    Card,
    Typography,
    Button,
    Space,
    Alert,
    Upload,
    message,
    Modal,
    Spin,
    Form,
    Input,
    Grid,
    Radio,
    Select,
    Tag,
    Divider,
    Descriptions
} from 'antd'
import {
    SmileOutlined,
    SafetyCertificateOutlined,
    EditOutlined,
    SolutionOutlined,
    InboxOutlined,
    SettingOutlined
} from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { useNavigate } from 'react-router-dom'

// Firebase
import { db, auth } from '@/firebase'
import {
    collection,
    getDocs,
    query,
    where,
    doc,
    getDoc,
    setDoc,
    Timestamp,
    onSnapshot,
    runTransaction
} from 'firebase/firestore'
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
    EmailAuthProvider,
    getAuth,
    GoogleAuthProvider,
    OAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    updatePassword
} from 'firebase/auth'

// Signature helpers
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'

// App bits
import { useFullIdentity } from '@/hooks/useFullIdentity'
import { LoadingOverlay } from '@/components/shared/LoadingOverlay'

const { Title, Paragraph, Text } = Typography
const { Dragger } = Upload
const { useBreakpoint } = Grid
const { Option } = Select

type Role = 'admin' | 'consultant' | 'incubatee' | 'operations' | 'director' | 'unknown'
type ProviderKey = 'google' | 'microsoft' | 'zoom'

type ConnectionDoc = {
    provider: ProviderKey
    status: 'connected' | 'not_connected'
    updatedAt?: Timestamp
    scopes?: string[]
    hasRefreshToken?: boolean
    externalAccountEmail?: string
}

type AssignmentModel = 'ops_assign_consultant' | 'consultant_self_assign'
type SmeDivisionModel =
    | 'system_equal_random'
    | 'ops_assign_smes_to_consultants'
    | 'consultants_register_their_smes'

type SystemSettingsDoc = {
    companyCode: string
    companyName?: string

    consultantLabel?: string
    consultantLabelDescription?: string

    hasDepartments: boolean
    hasBranches: boolean
    assignmentModel: AssignmentModel
    smeDivisionModel?: SmeDivisionModel
    branchScopedManagement?: boolean
    locked: true
    createdAt: Timestamp
    createdByUid: string
    createdByEmail?: string

    ownerUid?: string
    ownerEmail?: string
    ownershipTransferredAt?: Timestamp
    ownershipTransferredByUid?: string
    ownershipTransferredByEmail?: string
}

const FUNCTIONS_BASE = 'https://us-central1-lph-smart-inc.cloudfunctions.net'
const FONT_OPTIONS = ['Dancing Script', 'Great Vibes', 'Pacifico', 'Satisfy']
const roleKey = (r?: string): Role => (r || '').toLowerCase().replace(/\s+/g, '') as Role

// Toggle off to bring consent back later
const HIDE_CONSENT = true

const normalizeName = (v?: string) =>
    String(v || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-]/g, '')

const cleanCode = (v?: string) =>
    String(v || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '')

const WelcomeWizard: React.FC = () => {
    const navigate = useNavigate()
    const { user } = useFullIdentity()
    const screens = useBreakpoint()
    const isMobile = !screens.md

    // whether this user must register company details (directors)
    const [mustRegisterCompany, setMustRegisterCompany] = useState<boolean>(true)

    // Connections (kept even if consent is hidden — future-proof)
    const [connections, setConnections] = useState<Record<ProviderKey, ConnectionDoc | undefined>>({
        google: undefined,
        microsoft: undefined,
        zoom: undefined
    })

    // Who am I?
    const [userRole, setUserRole] = useState<Role>('unknown')
    const [participantId, setParticipantId] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)

    // step states
    const [popiaSigned, setPopiaSigned] = useState(false)
    const [signatureURL, setSignatureURL] = useState<string | null>(null)

    // consent-related (kept but hidden if HIDE_CONSENT)
    const [consentGiven, setConsentGiven] = useState(false)
    const [consentVendors, setConsentVendors] = useState({ google: false, zoom: false, teams: false })

    // director-only profile data
    const [directorProfileComplete, setDirectorProfileComplete] = useState(false)
    const [directorForm] = Form.useForm()

    // director system settings
    const [systemSettingsComplete, setSystemSettingsComplete] = useState(false)
    const [systemSettingsLocked, setSystemSettingsLocked] = useState(false)
    const [systemSettingsPreview, setSystemSettingsPreview] = useState<SystemSettingsDoc | null>(null)
    const [settingsForm] = Form.useForm()
    const [savingSettings, setSavingSettings] = useState(false)

    // NEW: prevent code collisions + only show preview when name+code match
    const [companyCodeConflict, setCompanyCodeConflict] = useState<{
        code: string
        message: string
        ownerEmail?: string
        existingName?: string
    } | null>(null)

    // UI
    const [current, setCurrent] = useState(0)
    const [loading, setLoading] = useState(true)
    const storage = getStorage()

    // Signature state (typed / drawn / upload optional)
    const [sigMode, setSigMode] = useState<'typed' | 'drawn' | 'upload'>('typed')
    const [typedName, setTypedName] = useState('')
    const [typedFont, setTypedFont] = useState(FONT_OPTIONS[0])
    const styledRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<SignatureCanvas>(null)

    // password step state
    const [mustChangePassword, setMustChangePassword] = useState(false)
    const [pwdStepComplete, setPwdStepComplete] = useState(false)
    const [pwdForm] = Form.useForm()

    // loading guards
    const [savingPwd, setSavingPwd] = useState(false)
    const [savingSig, setSavingSig] = useState(false)

    const resolveCompanyCode = async () => {
        const fromHook = (user as any)?.companyCode
        if (fromHook) return cleanCode(fromHook)

        const fromForm = directorForm.getFieldValue('companyCode')
        if (fromForm) return cleanCode(fromForm)

        if (auth.currentUser?.uid) {
            const uref = await getDoc(doc(db, 'users', auth.currentUser.uid))
            const cc = (uref.data() as any)?.companyCode
            if (cc) return cleanCode(cc)
        }
        return ''
    }

    const resolveCompanyName = async () => {
        const fromHook = (user as any)?.company || (user as any)?.companyName
        if (fromHook) return String(fromHook).trim()

        const fromForm = directorForm.getFieldValue('company')
        if (fromForm) return String(fromForm).trim()

        if (auth.currentUser?.uid) {
            const uref = await getDoc(doc(db, 'users', auth.currentUser.uid))
            const cn = (uref.data() as any)?.company || (uref.data() as any)?.companyName
            if (cn) return String(cn).trim()
        }
        return ''
    }

    const checkSystemSettingsMatchByCode = async (companyCode: string, companyName: string) => {
        const code = cleanCode(companyCode)
        const name = String(companyName || '').trim()
        if (!code) return { exists: false as const }

        const ref = doc(db, 'systemSettings', code)
        const snap = await getDoc(ref)
        if (!snap.exists()) return { exists: false as const }

        const ss = snap.data() as SystemSettingsDoc
        const storedName = String(ss.companyName || '').trim()

        const nameMatches = normalizeName(storedName) === normalizeName(name) && !!storedName && !!name
        const codeMatches = cleanCode(ss.companyCode) === code || cleanCode(ss.companyCode || code) === code

        return {
            exists: true as const,
            ss,
            nameMatches,
            codeMatches,
            storedName
        }
    }

    // Resolve role, preload progress
    useEffect(() => {
        const off = onAuthStateChanged(getAuth(), async u => {
            if (!u) {
                setLoading(false)
                return
            }
            setUserId(u.uid)

            // role
            let r = roleKey((user as any)?.role || (user as any)?.roleName)
            if (!r || r === 'unknown') {
                const us = await getDocs(query(collection(db, 'users'), where('email', '==', u.email)))
                if (!us.empty) r = roleKey(us.docs[0].data().role)
            }
            setUserRole(r || 'unknown')

            // participant by email (for POPIA)
            const ps = await getDocs(query(collection(db, 'participants'), where('email', '==', u.email)))
            if (!ps.empty) setParticipantId(ps.docs[0].id)

            // profile (signature/consent and prefill director fields)
            const uref = doc(db, 'users', u.uid)
            const udal = await getDoc(uref)
            let profile: any = null

            if (udal.exists()) {
                profile = udal.data()
                setMustRegisterCompany(profile.mustRegister !== false)

                if (profile.signatureURL) setSignatureURL(profile.signatureURL)
                if (profile.consents?.integrations) {
                    setConsentGiven(!!profile.consents.integrations.master)
                    setConsentVendors({
                        google: !!profile.consents.integrations.google,
                        zoom: !!profile.consents.integrations.zoom,
                        teams: !!profile.consents.integrations.teams
                    })
                }

                if (r === 'director') {
                    directorForm.setFieldsValue({
                        company: profile.company || '',
                        companyCode: profile.companyCode || ''
                    })
                    setDirectorProfileComplete(Boolean(profile.company && profile.companyCode))
                }
            }

            // System settings (company-level) for directors:
            // Only show "already configured" when BOTH name and code match.
            if (r === 'director') {
                const companyCode = cleanCode(profile?.companyCode || (user as any)?.companyCode || '')
                const companyName = String(profile?.company || (user as any)?.company || (user as any)?.companyName || '').trim()

                if (companyCode) {
                    const check = await checkSystemSettingsMatchByCode(companyCode, companyName)

                    if (check.exists) {
                        const ss = check.ss
                        const locked = !!ss.locked

                        if (locked && check.codeMatches && check.nameMatches) {
                            setCompanyCodeConflict(null)
                            setSystemSettingsPreview(ss)
                            setSystemSettingsLocked(true)
                            setSystemSettingsComplete(true)
                        } else if (!locked) {
                            // If not locked, allow only owner (or empty owner) to proceed
                            const ownerOk = !ss.ownerUid || ss.ownerUid === u.uid
                            if (!ownerOk) {
                                setCompanyCodeConflict({
                                    code: companyCode,
                                    message: 'This company code is already in use by another organisation.',
                                    ownerEmail: ss.ownerEmail,
                                    existingName: ss.companyName
                                })
                            } else {
                                setCompanyCodeConflict(null)
                                setSystemSettingsPreview(ss)
                                setSystemSettingsLocked(false)
                                setSystemSettingsComplete(false)
                            }
                        } else {
                            // Locked but mismatch name/code -> conflict
                            setCompanyCodeConflict({
                                code: companyCode,
                                message: 'This company code already has locked settings under a different company name.',
                                ownerEmail: ss.ownerEmail,
                                existingName: ss.companyName
                            })
                            setSystemSettingsPreview(null)
                            setSystemSettingsLocked(false)
                            setSystemSettingsComplete(false)
                        }
                    } else {
                        setCompanyCodeConflict(null)
                        setSystemSettingsPreview(null)
                        setSystemSettingsLocked(false)
                        setSystemSettingsComplete(false)
                    }
                }
            }

            // POPIA check
            if (!ps.empty) {
                const pid = ps.docs[0].id
                const apps = await getDocs(query(collection(db, 'applications'), where('participantId', '==', pid)))
                if (!apps.empty) {
                    const first = apps.docs[0].data() as any
                    const signed = { ...(first?.signedAgreements || {}) }
                    const legacy = Array.isArray(first?.signContracts)
                        ? first.signContracts
                        : Array.isArray(first?.signedContracts)
                            ? first.signedContracts
                            : []
                    legacy.forEach((slug: string) => {
                        if (!signed[slug]) signed[slug] = true
                    })
                    setPopiaSigned(!!signed['popia-act'])
                }
            }

            // Must-change-password logic
            const needsResetFromDoc = profile?.mustChangePassword
            const nonIncubatee = (r || 'unknown') !== 'incubatee'
            const must = typeof needsResetFromDoc === 'boolean' ? needsResetFromDoc : nonIncubatee
            setMustChangePassword(must)
            setPwdStepComplete(!must)

            setLoading(false)
        })

        return () => off()
    }, [user, directorForm])

    // Steps list (POPIA for incubatees; Director Profile + System Settings for directors)
    const steps = useMemo(() => {
        const base = [
            {
                key: 'welcome',
                title: 'Welcome',
                icon: <SmileOutlined />,
                isComplete: false
            }
        ]

        const passwordStep = {
            key: 'password',
            title: 'Change Password',
            icon: <SafetyCertificateOutlined />,
            isComplete: pwdStepComplete
        }

        const director = {
            key: 'directorProfile',
            title: 'Company Details',
            icon: <SolutionOutlined />,
            isComplete: directorProfileComplete
        }

        const systemSettings = {
            key: 'systemSettings',
            title: 'System Settings',
            icon: <SettingOutlined />,
            isComplete: systemSettingsComplete
        }

        const sig = {
            key: 'signature',
            title: 'Signature Setup',
            icon: <EditOutlined />,
            isComplete: !!signatureURL
        }

        const popia = {
            key: 'popia',
            title: 'Sign POPIA',
            icon: <SafetyCertificateOutlined />,
            isComplete: popiaSigned
        }

        if (userRole !== 'incubatee') {
            const maybePwd = mustChangePassword ? [passwordStep] : []
            const maybeDirector = userRole === 'director' && mustRegisterCompany ? [director, systemSettings] : []
            return [...base, ...maybePwd, ...maybeDirector, sig]
        }

        return [...base, popia, sig]
    }, [
        userRole,
        popiaSigned,
        signatureURL,
        directorProfileComplete,
        systemSettingsComplete,
        pwdStepComplete,
        mustChangePassword,
        mustRegisterCompany
    ])

    // Hide consent entirely while you work on it
    const visibleSteps = useMemo(
        () => (HIDE_CONSENT ? steps.filter(s => s.key !== 'consent') : steps),
        [steps]
    )

    const currentKey = visibleSteps[current]?.key

    useEffect(() => {
        if (current >= visibleSteps.length) setCurrent(Math.max(0, visibleSteps.length - 1))
    }, [visibleSteps.length, current])

    // On load, jump to first incomplete (after welcome has been "started")
    useEffect(() => {
        if (!loading && visibleSteps.length) {
            const firstIncomplete = visibleSteps.findIndex(s => !s.isComplete)
            setCurrent(firstIncomplete === -1 ? visibleSteps.length - 1 : firstIncomplete)
        }
    }, [loading, visibleSteps])

    // ---- Signature helpers ----
    const dataURLToBlob = async (dataUrl: string) => {
        const res = await fetch(dataUrl)
        return await res.blob()
    }

    const uploadSigBlob = async (blob: Blob, filename = 'signature.png') => {
        if (!auth.currentUser) throw new Error('Not signed in')
        const uid = auth.currentUser.uid
        const path = `signatures/${uid}/${Date.now()}_${filename}`
        const ref = storageRef(storage, path)
        await uploadBytes(ref, blob)
        return await getDownloadURL(ref)
    }

    const saveTypedSignature = async () => {
        if (!styledRef.current) return message.error('Signature preview not ready')
        setSavingSig(true)
        try {
            const canvas = await html2canvas(styledRef.current)
            const dataURL = canvas.toDataURL('image/png')
            const blob = await dataURLToBlob(dataURL)
            const url = await uploadSigBlob(blob, 'typed.png')
            await setDoc(doc(db, 'users', auth.currentUser!.uid), { signatureURL: url }, { merge: true })
            setSignatureURL(url)
            message.success('Typed signature saved to your profile.')
        } catch (e: any) {
            message.error(e?.message || 'Failed to save signature.')
        } finally {
            setSavingSig(false)
        }
    }

    const saveDrawnSignature = async () => {
        const c = canvasRef.current
        if (!c || c.isEmpty()) return message.warning('Please draw your signature first.')
        setSavingSig(true)
        try {
            const dataURL = c.toDataURL('image/png')
            const blob = await dataURLToBlob(dataURL)
            const url = await uploadSigBlob(blob, 'drawn.png')
            await setDoc(doc(db, 'users', auth.currentUser!.uid), { signatureURL: url }, { merge: true })
            setSignatureURL(url)
            message.success('Drawn signature saved to your profile.')
        } catch (e: any) {
            message.error(e?.message || 'Failed to save signature.')
        } finally {
            setSavingSig(false)
        }
    }

    const clearDrawnSignature = () => canvasRef.current?.clear()

    const handleUploadSignatureFile = async (file: File) => {
        setSavingSig(true)
        try {
            const url = await uploadSigBlob(file, file.name)
            await setDoc(doc(db, 'users', auth.currentUser!.uid), { signatureURL: url }, { merge: true })
            setSignatureURL(url)
            message.success('Signature image uploaded.')
        } finally {
            setSavingSig(false)
        }
    }

    const uploadProps: UploadProps = {
        multiple: false,
        accept: '.png,.jpg,.jpeg,.gif,.webp',
        showUploadList: false,
        customRequest: async (options: any) => {
            const { file, onError, onSuccess } = options
            try {
                await handleUploadSignatureFile(file as File)
                onSuccess?.('ok')
            } catch (e: any) {
                message.error(e?.message || 'Upload failed')
                onError?.(e)
            }
        }
    }

    // ---- Consent helpers (kept for future) ----
    const persistConsent = async () => {
        if (!auth.currentUser) return
        const uid = auth.currentUser.uid
        await setDoc(
            doc(db, 'users', uid),
            {
                consents: {
                    integrations: {
                        master: true,
                        google: consentVendors.google,
                        zoom: consentVendors.zoom,
                        teams: consentVendors.teams,
                        updatedAt: Timestamp.now()
                    }
                }
            },
            { merge: true }
        )
        setConsentGiven(true)
    }

    const goNext = () => {
        let idx = current + 1
        while (idx < visibleSteps.length && visibleSteps[idx].isComplete) idx++
        setCurrent(Math.min(idx, visibleSteps.length - 1))
    }
    const goPrev = () => setCurrent(Math.max(0, current - 1))

    const saveDirectorProfile = async (vals?: any) => {
        if (!auth.currentUser) return
        const uid = auth.currentUser.uid

        const values = vals ?? (await directorForm.validateFields())
        const company = String(values.company || '').trim()
        const companyCode = cleanCode(values.companyCode)

        if (!company || !companyCode) return

        // collision check:
        // - if settings exist and locked: only allow if name+code match
        // - if settings exist and owned by someone else: block
        setCompanyCodeConflict(null)

        const check = await checkSystemSettingsMatchByCode(companyCode, company)
        if (check.exists) {
            const ss = check.ss

            if (ss.locked) {
                if (!(check.codeMatches && check.nameMatches)) {
                    setCompanyCodeConflict({
                        code: companyCode,
                        message: 'This company code already has locked settings under a different company name.',
                        ownerEmail: ss.ownerEmail,
                        existingName: ss.companyName
                    })
                    throw new Error('Company code conflict')
                }
            } else {
                const ownerOk = !ss.ownerUid || ss.ownerUid === uid
                if (!ownerOk) {
                    setCompanyCodeConflict({
                        code: companyCode,
                        message: 'This company code is already in use by another organisation.',
                        ownerEmail: ss.ownerEmail,
                        existingName: ss.companyName
                    })
                    throw new Error('Company code conflict')
                }
            }
        }

        await setDoc(
            doc(db, 'users', uid),
            { company, companyCode },
            { merge: true }
        )

        setDirectorProfileComplete(true)

        // refresh settings state after saving profile
        const post = await checkSystemSettingsMatchByCode(companyCode, company)
        if (post.exists && post.ss.locked && post.codeMatches && post.nameMatches) {
            setSystemSettingsPreview(post.ss)
            setSystemSettingsLocked(true)
            setSystemSettingsComplete(true)
        } else {
            setSystemSettingsPreview(post.exists ? post.ss : null)
            setSystemSettingsLocked(false)
            setSystemSettingsComplete(false)
        }

        message.success('Company details saved.')
    }

    const saveSystemSettings = async () => {
        if (!auth.currentUser) return message.error('Not signed in')

        if (!directorProfileComplete) {
            try {
                await saveDirectorProfile()
            } catch {
                return
            }
        }

        const companyCode = (await resolveCompanyCode()).trim()
        const companyName = (await resolveCompanyName()).trim()
        if (!companyCode) return message.error('Company Code is missing. Please complete Company Details first.')
        if (!companyName) return message.error('Company Name is missing. Please complete Company Details first.')

        if (companyCodeConflict) {
            message.error('Resolve the company code conflict first.')
            return
        }

        if (systemSettingsLocked) {
            message.warning('These settings are locked and cannot be changed.')
            return
        }

        const vals = await settingsForm.validateFields()

        const hasDepartments = vals.hasDepartments === 'yes'
        const hasBranches = vals.hasBranches === 'yes'
        const assignmentModel: AssignmentModel = vals.assignmentModel

        const smeDivisionModel: SmeDivisionModel | undefined =
            assignmentModel === 'consultant_self_assign'
                ? (vals.smeDivisionModel as SmeDivisionModel)
                : undefined

        const branchScopedManagement: boolean | undefined =
            hasBranches ? (vals.branchScopedManagement === 'yes') : undefined

        const consultantLabel = String(vals.consultantLabel || '').trim()

        const payloadBase: SystemSettingsDoc = {
            companyCode,
            companyName,

            consultantLabel,
            consultantLabelDescription: 'These are the people responsible for intervention delivery on the platform.',

            hasDepartments,
            hasBranches,
            assignmentModel,
            smeDivisionModel,
            branchScopedManagement,

            locked: true,
            createdAt: Timestamp.now(),
            createdByUid: auth.currentUser.uid,
            createdByEmail: auth.currentUser.email || undefined,

            ownerUid: auth.currentUser.uid,
            ownerEmail: auth.currentUser.email || undefined
        }

        // remove undefined keys
        const payload: any = { ...payloadBase }
        Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

        setSavingSettings(true)
        try {
            await runTransaction(db, async tx => {
                const ref = doc(db, 'systemSettings', companyCode)
                const snap = await tx.get(ref)

                if (snap.exists()) {
                    const existing = snap.data() as SystemSettingsDoc
                    const isLocked = !!existing.locked

                    if (isLocked) {
                        const nameMatches =
                            normalizeName(existing.companyName) === normalizeName(companyName)

                        if (!nameMatches) {
                            throw new Error('Company code already has locked settings under a different name.')
                        }
                        throw new Error('Settings already locked for this company.')
                    }

                    if (existing.ownerUid && existing.ownerUid !== auth.currentUser!.uid) {
                        throw new Error('Company code is already claimed by another organisation.')
                    }
                }

                tx.set(ref, payload, { merge: false })
            })

            await setDoc(
                doc(db, 'users', auth.currentUser.uid),
                {
                    systemSettingsConfigured: true,
                    systemSettingsCompanyCode: companyCode,
                    systemSettingsConfiguredAt: Timestamp.now()
                },
                { merge: true }
            )

            setSystemSettingsPreview(payload as SystemSettingsDoc)
            setSystemSettingsLocked(true)
            setSystemSettingsComplete(true)
            message.success('System settings saved and locked.')
            goNext()
        } catch (e: any) {
            const msg = e?.message || 'Failed to save system settings.'
            message.error(msg)

            // force conflict state when collision is detected
            if (String(msg).toLowerCase().includes('claimed') || String(msg).toLowerCase().includes('different')) {
                const snap = await getDoc(doc(db, 'systemSettings', companyCode))
                const ss = snap.exists() ? (snap.data() as SystemSettingsDoc) : undefined
                setCompanyCodeConflict({
                    code: companyCode,
                    message: msg,
                    ownerEmail: ss?.ownerEmail,
                    existingName: ss?.companyName
                })
            }
        } finally {
            setSavingSettings(false)
        }
    }

    const finish = async () => {
        if (!userId) return

        await setDoc(
            doc(db, 'users', userId),
            { firstLoginComplete: true, firstLoginCompletedAt: Timestamp.now() },
            { merge: true }
        )

        const uref = await getDoc(doc(db, 'users', userId))
        const r = roleKey((uref.data() as any)?.role)
        const email = auth.currentUser?.email || ''
        const norm = (v?: string) => (v || '').trim().toLowerCase()

        if (r === 'incubatee') {
            const appsSnap = await getDocs(query(collection(db, 'applications'), where('email', '==', email)))
            const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
            if (apps.length === 0) return navigate('/incubatee/sme')

            const pending = apps.find(app => ['pending', ''].includes(norm(app.applicationStatus)))
            const accepted = apps.find(app => norm(app.applicationStatus) === 'accepted')

            if (accepted) {
                const gapDone = norm(accepted.gapAnalysisStatus) === 'completed'
                if (!gapDone) {
                    const participantsSnap = await getDocs(query(collection(db, 'participants'), where('email', '==', email)))
                    const participantDoc = participantsSnap.docs[0]
                    const participant = participantDoc ? { id: participantDoc.id, ...(participantDoc.data() as any) } : null

                    return navigate('/incubatee/gap-analysis', {
                        state: {
                            participantId: participant?.id ?? null,
                            prefillData: {
                                companyName: participant?.beneficiaryName ?? '',
                                region: participant?.province ?? '',
                                contactDetails: participant?.phone ?? '',
                                email: participant?.email ?? email,
                                dateOfEngagement: accepted?.dateAccepted ?? null
                            }
                        }
                    })
                }
                return navigate('/incubatee')
            }

            if (pending) return navigate('/incubatee/tracker')
            return navigate('/incubatee/sme')
        }

        navigate(`/${r || 'unknown'}`)
    }

    useEffect(() => {
        if (!userId) return
        const unsub = onSnapshot(collection(db, 'users', userId, 'connections'), snap => {
            const next: Record<ProviderKey, ConnectionDoc | undefined> = {
                google: undefined,
                microsoft: undefined,
                zoom: undefined
            }
            snap.forEach(d => {
                const id = d.id as ProviderKey
                if (id === 'google' || id === 'microsoft' || id === 'zoom') {
                    const data = d.data() as any
                    next[id] = {
                        provider: id,
                        status: data.status ?? 'connected',
                        updatedAt: data.updatedAt,
                        scopes: data.scopes ?? [],
                        hasRefreshToken: !!data.hasRefreshToken,
                        externalAccountEmail: data.externalAccountEmail ?? undefined
                    }
                }
            })
            setConnections(next)
        })
        return () => unsub()
    }, [userId])

    // ---- Renderers ----
    const renderWelcome = () => (
        <Card bordered={false} style={{ background: 'linear-gradient(135deg, #ffffff, #f7faff)', borderRadius: 14 }}>
            <Title level={3} style={{ marginTop: 0, marginBottom: 6 }}>
                First-time Setup
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>
                Complete these steps once so your organisation runs cleanly from day one.
            </Paragraph>

            <Divider style={{ margin: '14px 0' }} />

            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                {userRole === 'incubatee' && <li>Sign POPIA consent</li>}
                {userRole === 'director' && (
                    <>
                        <li>Confirm company details</li>
                        <li>Lock your system settings (cannot be changed later)</li>
                    </>
                )}
                <li>Set up your digital signature (type, draw, or upload)</li>
                {!HIDE_CONSENT && <li>Optionally connect email & meeting tools</li>}
            </ul>

            <Space style={{ marginTop: 16 }}>
                <Button
                    type='primary'
                    onClick={() => {
                        const nextSteps = [...visibleSteps]
                        nextSteps[0] = { ...nextSteps[0], isComplete: true }
                        // local state only: move next
                        goNext()
                    }}
                    block={isMobile}
                >
                    Let’s get started
                </Button>
            </Space>
        </Card>
    )

    const reauthAndRetryPasswordUpdate = async (newPassword: string) => {
        const cur = auth.currentUser
        if (!cur) throw new Error('Not signed in')

        const providerId = cur.providerData?.[0]?.providerId

        if (providerId === 'password') {
            return new Promise<void>((resolve, reject) => {
                const modal = Modal.confirm({
                    title: 'Re-authentication required',
                    content: (
                        <Form
                            layout='vertical'
                            onFinish={async (vals: any) => {
                                try {
                                    const cred = EmailAuthProvider.credential(cur.email || '', vals.currentPassword)
                                    await reauthenticateWithCredential(cur, cred)
                                    await updatePassword(cur, newPassword)
                                    modal.destroy()
                                    resolve()
                                } catch (e: any) {
                                    message.error(e?.message || 'Re-authentication failed.')
                                }
                            }}
                        >
                            <Form.Item
                                name='currentPassword'
                                label='Current password'
                                rules={[{ required: true, message: 'Please enter your current password' }]}
                            >
                                <Input.Password autoFocus />
                            </Form.Item>
                            <Button type='primary' htmlType='submit'>
                                Confirm
                            </Button>
                        </Form>
                    ),
                    icon: null,
                    okButtonProps: { style: { display: 'none' } },
                    cancelText: 'Cancel',
                    onCancel: () => reject(new Error('User cancelled re-authentication'))
                })
            })
        }

        if (providerId === 'google.com') {
            await reauthenticateWithPopup(cur, new GoogleAuthProvider())
            await updatePassword(cur, newPassword)
            return
        }

        if (providerId === 'microsoft.com') {
            await reauthenticateWithPopup(cur, new OAuthProvider('microsoft.com'))
            await updatePassword(cur, newPassword)
            return
        }

        return new Promise<void>((resolve, reject) => {
            const modal = Modal.confirm({
                title: 'Re-authentication required',
                content: (
                    <Form
                        layout='vertical'
                        onFinish={async (vals: any) => {
                            try {
                                const cred = EmailAuthProvider.credential(cur.email || '', vals.currentPassword)
                                await reauthenticateWithCredential(cur, cred)
                                await updatePassword(cur, newPassword)
                                modal.destroy()
                                resolve()
                            } catch (e: any) {
                                message.error(e?.message || 'Re-authentication failed.')
                            }
                        }}
                    >
                        <Form.Item
                            name='currentPassword'
                            label='Current password'
                            rules={[{ required: true, message: 'Please enter your current password' }]}
                        >
                            <Input.Password autoFocus />
                        </Form.Item>
                        <Button type='primary' htmlType='submit'>
                            Confirm
                        </Button>
                    </Form>
                ),
                icon: null,
                okButtonProps: { style: { display: 'none' } },
                cancelText: 'Cancel',
                onCancel: () => reject(new Error('User cancelled re-authentication'))
            })
        })
    }

    const renderPassword = () => (
        <Card bordered={false} style={{ borderRadius: 14, background: '#fff' }}>
            <Title level={4} style={{ marginTop: 0 }}>
                Change your default password
            </Title>
            <Alert
                type='warning'
                showIcon
                style={{ marginBottom: 12 }}
                message='Default password in use'
                description={
                    <span>
                        For security, please change the default password <b>Password@1</b> now.
                    </span>
                }
            />
            <Form
                form={pwdForm}
                layout='vertical'
                onFinish={async (vals: any) => {
                    const cur = auth.currentUser
                    if (!cur) return message.error('You are not signed in')
                    setSavingPwd(true)
                    try {
                        await updatePassword(cur, vals.newPassword)
                        await setDoc(doc(db, 'users', cur.uid), { mustChangePassword: false, passwordChangedAt: Timestamp.now() }, { merge: true })
                        setPwdStepComplete(true)
                        setMustChangePassword(false)
                        message.success('Password updated.')
                        goNext()
                    } catch (e: any) {
                        if (e?.code === 'auth/requires-recent-login') {
                            try {
                                await reauthAndRetryPasswordUpdate(vals.newPassword)
                                await setDoc(doc(db, 'users', cur.uid), { mustChangePassword: false, passwordChangedAt: Timestamp.now() }, { merge: true })
                                setPwdStepComplete(true)
                                setMustChangePassword(false)
                                message.success('Password updated.')
                                goNext()
                            } catch {
                                // no-op
                            }
                        } else {
                            message.error(e?.message || 'Failed to update password.')
                        }
                    } finally {
                        setSavingPwd(false)
                    }
                }}
            >
                <Form.Item
                    name='newPassword'
                    label='New password'
                    rules={[
                        { required: true, message: 'Please enter a new password' },
                        { min: 8, message: 'Use at least 8 characters' },
                        {
                            validator: (_, v) =>
                                v === 'Password@1'
                                    ? Promise.reject(new Error('Please choose a password different from the default'))
                                    : Promise.resolve()
                        },
                        {
                            pattern: /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
                            message: 'Add an uppercase, a number and a symbol'
                        }
                    ]}
                    hasFeedback
                >
                    <Input.Password placeholder='Enter a strong password' />
                </Form.Item>

                <Form.Item
                    name='confirmPassword'
                    label='Confirm new password'
                    dependencies={['newPassword']}
                    hasFeedback
                    rules={[
                        { required: true, message: 'Please confirm the password' },
                        ({ getFieldValue }) => ({
                            validator(_, value) {
                                return !value || getFieldValue('newPassword') === value
                                    ? Promise.resolve()
                                    : Promise.reject(new Error('Passwords do not match'))
                            }
                        })
                    ]}
                >
                    <Input.Password placeholder='Re-enter password' />
                </Form.Item>

                <Space wrap>
                    <Button onClick={goPrev} block={isMobile} disabled={savingPwd}>
                        Back
                    </Button>
                    <Button type='primary' htmlType='submit' block={isMobile} loading={savingPwd} disabled={savingPwd}>
                        Update Password
                    </Button>
                </Space>
            </Form>
        </Card>
    )

    const renderDirectorProfile = () => (
        <Card bordered={false} style={{ borderRadius: 14 }}>
            <Title level={4} style={{ marginTop: 0 }}>
                Company Details
            </Title>

            <Alert
                type='info'
                showIcon
                message='This scopes data correctly per organisation.'
                style={{ marginBottom: 12 }}
            />

            {companyCodeConflict && (
                <Alert
                    type='error'
                    showIcon
                    style={{ marginBottom: 12 }}
                    message='Company code conflict'
                    description={
                        <div>
                            <div style={{ marginBottom: 6 }}>{companyCodeConflict.message}</div>
                            {companyCodeConflict.existingName && (
                                <div>
                                    Existing company: <b>{companyCodeConflict.existingName}</b>
                                </div>
                            )}
                            {companyCodeConflict.ownerEmail && (
                                <div>
                                    Owner email: <b>{companyCodeConflict.ownerEmail}</b>
                                </div>
                            )}
                            <div style={{ marginTop: 6 }}>
                                Use a different company code (or contact the owner if this is intended).
                            </div>
                        </div>
                    }
                />
            )}

            <Form
                form={directorForm}
                layout='vertical'
                onFinish={async vals => {
                    try {
                        await saveDirectorProfile(vals)
                    } catch {
                        // conflict already handled
                    }
                }}
            >
                <Form.Item
                    name='company'
                    label='Company Name'
                    rules={[{ required: true, message: 'Please enter company name' }]}
                >
                    <Input placeholder='e.g. Lepharo Incubation' />
                </Form.Item>

                <Form.Item
                    name='companyCode'
                    label='Company Code'
                    rules={[{ required: true, message: 'Please enter company code' }]}
                    extra='This must be unique. Example: LPH001 (no spaces).'
                >
                    <Input
                        placeholder='e.g. LPH001'
                        onChange={() => {
                            if (companyCodeConflict) setCompanyCodeConflict(null)
                        }}
                    />
                </Form.Item>

                <Space wrap>
                    <Button onClick={goPrev} block={isMobile}>
                        Back
                    </Button>
                    <Button type='primary' htmlType='submit' block={isMobile}>
                        Save
                    </Button>
                    <Button
                        type='primary'
                        onClick={async () => {
                            try {
                                await saveDirectorProfile()
                                if (!companyCodeConflict) goNext()
                            } catch {
                                // no-op
                            }
                        }}
                        disabled={!directorProfileComplete || !!companyCodeConflict}
                        block={isMobile}
                    >
                        Next
                    </Button>
                </Space>
            </Form>
        </Card>
    )

    const renderSystemSettings = () => {
        const assignmentModel = Form.useWatch('assignmentModel', settingsForm) as AssignmentModel | undefined
        const hasBranches = Form.useWatch('hasBranches', settingsForm) as 'yes' | 'no' | undefined

        const pretty = (ss: SystemSettingsDoc) => {
            const assignment =
                ss.assignmentModel === 'ops_assign_consultant'
                    ? 'Ops assigns consultants'
                    : 'Consultants assign themselves'

            const division =
                ss.assignmentModel !== 'consultant_self_assign'
                    ? '—'
                    : ss.smeDivisionModel === 'system_equal_random'
                        ? 'System divides SMEs equally (random)'
                        : ss.smeDivisionModel === 'ops_assign_smes_to_consultants'
                            ? 'Ops assigns SMEs to consultants'
                            : 'Consultants get SMEs they register'

            const branches = ss.hasBranches ? 'Yes' : 'No'
            const branchScope = ss.hasBranches ? (ss.branchScopedManagement ? 'Yes' : 'No') : '—'

            return { assignment, division, branches, branchScope, hasDepartments: ss.hasDepartments ? 'Yes' : 'No' }
        }

        if (companyCodeConflict) {
            return (
                <Card bordered={false} style={{ borderRadius: 14 }}>
                    <Title level={4} style={{ marginTop: 0 }}>
                        System Settings (Director)
                    </Title>
                    <Alert
                        type='error'
                        showIcon
                        message='Cannot continue'
                        description='Resolve the company code conflict from Company Details first.'
                        style={{ marginBottom: 12 }}
                    />
                    <Button onClick={() => setCurrent(visibleSteps.findIndex(s => s.key === 'directorProfile'))} block={isMobile}>
                        Back to Company Details
                    </Button>
                </Card>
            )
        }

        return (
            <Card bordered={false} style={{ borderRadius: 14 }}>
                <Title level={4} style={{ marginTop: 0 }}>
                    System Settings (Director)
                </Title>

                <Alert
                    type='error'
                    showIcon
                    message='Locked configuration'
                    description='These settings cannot be changed later on. Make sure you choose correctly.'
                    style={{ marginBottom: 12 }}
                />

                {systemSettingsLocked && systemSettingsPreview ? (
                    <>
                        <Alert
                            type='success'
                            showIcon
                            message='Settings locked'
                            description='Your organisation configuration has been saved and locked.'
                            style={{ marginBottom: 12 }}
                        />

                        <Descriptions bordered size='small' column={1}>
                            {(() => {
                                const p = pretty(systemSettingsPreview)
                                return (
                                    <>
                                        <Descriptions.Item label='Company Code'>{systemSettingsPreview.companyCode}</Descriptions.Item>
                                        <Descriptions.Item label='Company Name'>{systemSettingsPreview.companyName || '-'}</Descriptions.Item>
                                        <Descriptions.Item label='Has Departments'>{p.hasDepartments}</Descriptions.Item>
                                        <Descriptions.Item label='Has Branches / Offices'>{p.branches}</Descriptions.Item>
                                        <Descriptions.Item label='Branch-based Consultant Management'>{p.branchScope}</Descriptions.Item>
                                        <Descriptions.Item label='Intervention Assignment Model'>{p.assignment}</Descriptions.Item>
                                        <Descriptions.Item label='SME Division (when self-assigning)'>{p.division}</Descriptions.Item>
                                    </>
                                )
                            })()}
                        </Descriptions>

                        <div style={{ marginTop: 16 }}>
                            <Space wrap style={{ width: '100%' }}>
                                <Button onClick={goPrev} block={isMobile}>
                                    Back
                                </Button>
                                <Button type='primary' onClick={goNext} block={isMobile}>
                                    Next
                                </Button>
                            </Space>
                        </div>
                    </>
                ) : (
                    <Spin spinning={savingSettings}>
                        <Form
                            form={settingsForm}
                            layout='vertical'
                            initialValues={{
                                hasDepartments: 'yes',
                                hasBranches: 'no',
                                assignmentModel: 'ops_assign_consultant',
                                consultantLabel: 'Consultants'
                            }}
                        >
                            <Card size='small' style={{ borderRadius: 12, marginBottom: 12 }}>
                                <Alert
                                    type='info'
                                    showIcon
                                    message='Naming your consultants'
                                    description='These are the people responsible for intervention delivery on the platform.'
                                    style={{ marginBottom: 12 }}
                                />

                                <Form.Item
                                    name='consultantLabel'
                                    label='What does your company call its Consultants?'
                                    rules={[{ required: true, message: 'Please enter a name (e.g. Mentors, Coaches, Advisors)' }]}
                                    extra='Examples: Mentors, Coaches, Advisors, Specialists. This label will appear across your dashboard.'
                                >
                                    <Input placeholder='e.g. Mentors' />
                                </Form.Item>

                                <Form.Item
                                    name='hasDepartments'
                                    label='1) Does your company have departments?'
                                    rules={[{ required: true, message: 'Please select an option' }]}
                                >
                                    <Radio.Group>
                                        <Radio value='yes'>Yes</Radio>
                                        <Radio value='no'>No</Radio>
                                    </Radio.Group>
                                </Form.Item>

                                <Form.Item
                                    name='hasBranches'
                                    label='2) Does your company have branches / offices?'
                                    rules={[{ required: true, message: 'Please select an option' }]}
                                    extra='If SMEs apply under a specific office, you can scope consultants to manage SMEs within that office.'
                                >
                                    <Radio.Group>
                                        <Radio value='yes'>Yes</Radio>
                                        <Radio value='no'>No</Radio>
                                    </Radio.Group>
                                </Form.Item>

                                {hasBranches === 'yes' && (
                                    <Form.Item
                                        name='branchScopedManagement'
                                        label='If yes: Should consultants manage SMEs only within their office?'
                                        rules={[{ required: true, message: 'Please select an option' }]}
                                    >
                                        <Radio.Group>
                                            <Radio value='yes'>Yes (office-scoped)</Radio>
                                            <Radio value='no'>No (cross-office allowed)</Radio>
                                        </Radio.Group>
                                    </Form.Item>
                                )}
                            </Card>

                            <Card size='small' style={{ borderRadius: 12 }}>
                                <Form.Item
                                    name='assignmentModel'
                                    label='3) How do you manage intervention assignment?'
                                    rules={[{ required: true, message: 'Please select an option' }]}
                                >
                                    <Radio.Group style={{ display: 'grid', gap: 8 }}>
                                        <Radio value='ops_assign_consultant'>
                                            Ops assign consultant (ops allocates interventions to consultants)
                                        </Radio>
                                        <Radio value='consultant_self_assign'>
                                            Consultant assigns themself (consultant picks/accepts assignments)
                                        </Radio>
                                    </Radio.Group>
                                </Form.Item>

                                {assignmentModel === 'consultant_self_assign' && (
                                    <Form.Item
                                        name='smeDivisionModel'
                                        label='If consultants assign themselves: how are SMEs divided?'
                                        rules={[{ required: true, message: 'Please select an option' }]}
                                    >
                                        <Radio.Group style={{ display: 'grid', gap: 8 }}>
                                            <Radio value='system_equal_random'>System divides SMEs equally and randomly</Radio>
                                            <Radio value='ops_assign_smes_to_consultants'>Ops assigns SMEs to consultants</Radio>
                                            <Radio value='consultants_register_their_smes'>Consultants get SMEs which they register</Radio>
                                        </Radio.Group>
                                    </Form.Item>
                                )}
                            </Card>

                            <Divider style={{ margin: '14px 0' }} />

                            <Space wrap style={{ width: '100%' }}>
                                <Button onClick={goPrev} block={isMobile} disabled={savingSettings}>
                                    Back
                                </Button>

                                <Button
                                    type='primary'
                                    onClick={() => {
                                        Modal.confirm({
                                            title: 'Lock these settings?',
                                            content: (
                                                <div>
                                                    <p style={{ marginBottom: 8 }}>
                                                        Once saved, these settings <b>cannot be changed later</b>.
                                                    </p>
                                                    <p style={{ marginBottom: 0, color: 'rgba(0,0,0,.65)' }}>
                                                        Make sure the selections match how your organisation actually operates.
                                                    </p>
                                                </div>
                                            ),
                                            okText: 'Yes, save & lock',
                                            cancelText: 'Cancel',
                                            onOk: saveSystemSettings
                                        })
                                    }}
                                    block={isMobile}
                                    loading={savingSettings}
                                    disabled={savingSettings}
                                >
                                    Save & Lock Settings
                                </Button>
                            </Space>
                        </Form>
                    </Spin>
                )}
            </Card>
        )
    }

    const renderSignature = () => (
        <>
            <Card bordered={false} style={{ borderRadius: 14 }}>
                <Title level={4} style={{ marginTop: 0 }}>
                    Set up your signature
                </Title>
                <Spin spinning={savingSig}>
                    {signatureURL && (
                        <Alert
                            type='success'
                            showIcon
                            message='Signature on file'
                            description='You can replace it using one of the methods below.'
                            style={{ marginBottom: 12 }}
                        />
                    )}

                    <Radio.Group value={sigMode} onChange={e => setSigMode(e.target.value)} style={{ marginBottom: 12 }}>
                        <Radio value='typed'>Type</Radio>
                        <Radio value='drawn'>Draw</Radio>
                        <Radio value='upload'>Upload (optional)</Radio>
                    </Radio.Group>

                    {sigMode === 'typed' && (
                        <div>
                            <div style={{ marginBottom: 12, maxWidth: 340 }}>
                                <Input placeholder='Your full name' value={typedName} onChange={e => setTypedName(e.target.value)} />
                            </div>
                            <div style={{ marginBottom: 12, maxWidth: 260 }}>
                                <Select value={typedFont} onChange={setTypedFont} style={{ width: '100%' }}>
                                    {FONT_OPTIONS.map(f => (
                                        <Option key={f} value={f}>
                                            {f}
                                        </Option>
                                    ))}
                                </Select>
                            </div>
                            <div
                                ref={styledRef}
                                style={{
                                    fontFamily: `${typedFont}, cursive`,
                                    fontSize: 40,
                                    padding: '10px 20px',
                                    border: '1px dashed #aaa',
                                    background: '#fff',
                                    display: 'inline-block',
                                    minWidth: 260,
                                    borderRadius: 10
                                }}
                            >
                                {typedName || 'Your styled signature'}
                            </div>
                            <div style={{ marginTop: 12 }}>
                                <Button type='primary' onClick={saveTypedSignature} disabled={!typedName.trim()} block={isMobile}>
                                    Save Typed Signature
                                </Button>
                            </div>
                        </div>
                    )}

                    {sigMode === 'drawn' && (
                        <div>
                            <div
                                style={{
                                    border: '1px dashed #aaa',
                                    width: '100%',
                                    maxWidth: 480,
                                    height: 160,
                                    marginBottom: 12,
                                    position: 'relative',
                                    background: '#fff',
                                    borderRadius: 10
                                }}
                            >
                                <SignatureCanvas
                                    ref={canvasRef}
                                    penColor='black'
                                    canvasProps={{
                                        width: Math.min(480, window.innerWidth - 64),
                                        height: 160,
                                        style: { background: 'white', borderRadius: 10 }
                                    }}
                                />
                            </div>
                            <Space wrap>
                                <Button onClick={clearDrawnSignature} block={isMobile}>
                                    Clear
                                </Button>
                                <Button type='primary' onClick={saveDrawnSignature} block={isMobile}>
                                    Save Drawn Signature
                                </Button>
                            </Space>
                        </div>
                    )}

                    {sigMode === 'upload' && (
                        <>
                            <Alert type='info' showIcon message='Upload an image of your signature (PNG/JPG).' style={{ marginBottom: 12 }} />
                            <Dragger {...uploadProps} style={{ maxWidth: 560, borderRadius: 12 }}>
                                <p className='ant-upload-drag-icon'>
                                    <InboxOutlined />
                                </p>
                                <p className='ant-upload-text'>Click or drag a signature image to this area to upload</p>
                                <p className='ant-upload-hint'>
                                    We’ll store it securely and attach it to approvals you make on the platform.
                                </p>
                            </Dragger>
                        </>
                    )}

                    {signatureURL && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 12,
                                background: '#fafafa',
                                borderRadius: 10,
                                border: '1px dashed #d9d9d9',
                                display: 'inline-block'
                            }}
                        >
                            <img src={signatureURL} alt='Your signature' style={{ maxHeight: 80 }} />
                        </div>
                    )}
                </Spin>
            </Card>

            <div style={{ marginTop: 16 }}>
                <Space style={{ width: '100%' }} wrap>
                    <Button onClick={goPrev} block={isMobile}>
                        Back
                    </Button>
                    <Button
                        type='primary'
                        onClick={() => {
                            Modal.confirm({
                                title: 'Finish setup?',
                                content: 'Your signature is saved. You can change it later from your profile.',
                                okText: 'Finish',
                                cancelText: 'Cancel',
                                onOk: finish
                            })
                        }}
                        disabled={!signatureURL}
                        block={isMobile}
                    >
                        Finish
                    </Button>
                </Space>
            </div>
        </>
    )

    const viewMap: Record<string, JSX.Element> = {
        welcome: renderWelcome(),
        password: renderPassword(),
        directorProfile: renderDirectorProfile(),
        systemSettings: renderSystemSettings(),
        signature: renderSignature()
    }

    const allComplete = visibleSteps.every(s => s.isComplete)

    return (
        <>
            {loading ? (
                <LoadingOverlay tip='Getting everything ready...' />
            ) : (
                <div
                    style={{
                        minHeight: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: isMobile ? 16 : 24,
                        background: 'radial-gradient(1200px 600px at 20% 0%, #eaf3ff 0%, #f5f7fa 55%, #f6f2ff 100%)'
                    }}
                >
                    <Card
                        style={{
                            width: '100%',
                            maxWidth: 920,
                            borderRadius: 16,
                            boxShadow: '0 18px 44px rgba(0,0,0,0.12)',
                            margin: 0,
                            border: '1px solid rgba(0,0,0,0.04)'
                        }}
                        bodyStyle={{ padding: isMobile ? 16 : 22 }}
                    >
                        <div style={{ position: 'relative', paddingRight: userRole !== 'unknown' ? 90 : 0 }}>
                            <div style={{ textAlign: 'center' }}>
                                <Title level={3} style={{ marginTop: 0, marginBottom: 2 }}>
                                    Welcome Wizard
                                </Title>
                                <Text type='secondary'>Get the essentials done once — then you’re in.</Text>
                            </div>

                            {userRole !== 'unknown' && (
                                <Tag
                                    color='blue'
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: 2,
                                        borderRadius: 999,
                                        paddingInline: 10
                                    }}
                                >
                                    {userRole.toUpperCase()}
                                </Tag>
                            )}
                        </div>

                        <Divider style={{ margin: '14px 0' }} />

                        {!isMobile ? (
                            <Steps
                                current={Math.min(current, Math.max(visibleSteps.length - 1, 0))}
                                items={visibleSteps.map((s, i) => ({
                                    title: s.title,
                                    icon: s.icon,
                                    status: i < current ? 'finish' : i === current ? 'process' : s.isComplete ? 'finish' : 'wait'
                                }))}
                                style={{ marginBottom: 18 }}
                            />
                        ) : (
                            <div style={{ marginBottom: 12, color: 'rgba(0,0,0,.45)' }}>
                                Step {Math.min(current + 1, visibleSteps.length)} of {visibleSteps.length}:{' '}
                                <b style={{ color: 'rgba(0,0,0,.88)' }}>{visibleSteps[current]?.title ?? 'Completed'}</b>
                            </div>
                        )}

                        <div
                            style={{
                                minHeight: isMobile ? 560 : 520,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {allComplete ? (
                                <Card bordered={false} style={{ borderRadius: 14 }}>
                                    <Alert
                                        type='success'
                                        showIcon
                                        message='Setup complete'
                                        description='Your first-time setup appears to be finished. You can continue to the system now.'
                                        style={{ marginBottom: 12 }}
                                    />
                                    <Button type='primary' onClick={finish}>
                                        Continue to the system
                                    </Button>
                                </Card>
                            ) : (
                                viewMap[currentKey ?? ''] ?? (
                                    <Card bordered={false} style={{ borderRadius: 14 }}>
                                        <Alert type='error' showIcon message='Unknown step' />
                                    </Card>
                                )
                            )}
                        </div>
                    </Card>
                </div>
            )}
        </>
    )
}

export default WelcomeWizard
