import React, { useEffect, useState } from 'react'
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GoogleOutlined
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Typography,
  Grid,
  Modal,
  Alert,
  message
} from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { Helmet } from 'react-helmet'

const { Title, Text } = Typography
const { useBreakpoint } = Grid

type ErrorContext = 'signin' | 'google' | 'reset'

export function formatFirebaseError (
  error: any,
  ctx: ErrorContext = 'signin'
): string {
  const code = String(error?.code || '').toLowerCase()
  const generic =
    ctx === 'reset'
      ? 'If an account exists for that email, we’ll send a reset link.'
      : 'Something went wrong. Please try again.'
  const M: Record<string, string> = {
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/invalid-login-credentials': 'The email or password is incorrect.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/user-not-found':
      ctx === 'reset'
        ? 'If an account exists for that email, we’ll send a reset link.'
        : 'The email or password is incorrect.',
    'auth/user-disabled':
      'This account has been disabled. Please contact support.',
    'auth/operation-not-allowed':
      'This sign-in method is not enabled. Please contact support.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/too-many-requests':
      'Too many attempts. Try again later or reset your password.',
    'auth/network-request-failed':
      'We couldn’t reach the server. Check your internet connection.',
    unavailable:
      'Service is temporarily unavailable. Please try again shortly.',
    'deadline-exceeded': 'Request took too long. Please try again.',
    'resource-exhausted': 'Temporary limit reached. Please try again shortly.',
    'auth/popup-closed-by-user':
      'The sign-in window was closed before finishing.',
    'auth/cancelled-popup-request':
      'Another sign-in window is already open. Use the latest one.',
    'auth/popup-blocked':
      'Your browser blocked the sign-in window. Allow pop-ups and try again.',
    'auth/unauthorized-domain':
      'This domain is not allowed for sign-in. Please contact support.',
    'auth/account-exists-with-different-credential':
      'An account already exists with this email using a different sign-in method. Sign in with your email and password, then link Google in your profile.',
    'auth/credential-already-in-use':
      'Those sign-in details are already linked to another account.',
    'permission-denied': 'You don’t have access to complete that action.',
    'not-found': 'We couldn’t find what you were looking for.'
  }
  if (M[code]) return M[code]
  const trimmed = code.replace(/^auth\//, '')
  if (M[trimmed]) return M[trimmed]
  const msg = String(error?.message || '').toLowerCase()
  if (msg.includes('network')) return M['auth/network-request-failed']
  if (
    ctx === 'reset' &&
    (code.includes('user-not-found') || msg.includes('user not found'))
  ) {
    return M['auth/user-not-found']
  }
  return generic
}

// --- RESET CONFIG
const RESET_ENDPOINT =
  'https://us-central1-incubation-platform-61610.cloudfunctions.net/sendPasswordReset'
const FALLBACK_RESET_URL =
  'https://incubation-platform.vercel.app/reset-password'

const norm = (v?: string) => (v ?? '').toLowerCase().trim()

async function getAcceptedAppByEmail (email?: string) {
  if (!email) return null
  const appsSnap = await getDocs(
    query(collection(db, 'applications'), where('email', '==', email))
  )
  const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
  return apps.find(a => norm(a.applicationStatus) === 'accepted') || null
}

async function getParticipantByEmail (email?: string) {
  if (!email) return null
  const ps = await getDocs(
    query(collection(db, 'participants'), where('email', '==', email))
  )
  const doc0 = ps.docs[0]
  return doc0 ? { id: doc0.id, ...(doc0.data() as any) } : null
}

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [forgotPasswordVisible, setForgotPasswordVisible] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [searchParams] = useSearchParams()

  const reduceMotion = useReducedMotion()

  const overlayVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.8 } },
    exit: { opacity: 0, transition: { duration: 0.6 } }
  }
  const spinnerVariants = {
    animate: {
      rotate: [0, 180, 360],
      scale: [1, 1.03, 1],
      transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
    }
  }

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setForgotPasswordVisible(true)
    }
  }, [searchParams])

  async function checkUser (user: any) {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      return {
        error: true,
        message: '🚫 User not found in the system. Please contact the admin.'
      }
    }
    const data = userSnap.data() as any
    const normalizeRole = (role: string) =>
      role?.toLowerCase()?.replace(/\s+/g, '') || ''
    const firstLoginDone = Boolean(data.firstLoginComplete === true)
    return { role: normalizeRole(data.role), firstLoginDone }
  }

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      setLoading(true)
      const { user } = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      )
      const {
        error,
        message: errMsg,
        role,
        firstLoginDone
      } = await checkUser(user as any)
      if (error) return message.error(errMsg)

      if (role === 'incubatee') {
        const accepted = await getAcceptedAppByEmail(user.email || undefined)
        if (accepted) {
          const gapDone = norm(accepted.gapAnalysisStatus) === 'completed'
          if (!gapDone) {
            const participant = await getParticipantByEmail(
              user.email || undefined
            )
            navigate('/incubatee/gap-analysis', {
              state: {
                participantId: participant?.id ?? null,
                prefillData: {
                  companyName: participant?.beneficiaryName ?? '',
                  region: participant?.province ?? '',
                  contactDetails: participant?.phone ?? '',
                  email: participant?.email ?? user.email,
                  dateOfEngagement: accepted?.dateAccepted ?? null
                }
              }
            })
            return
          }
          navigate('/incubatee')
          return
        }
        if (!firstLoginDone) return navigate('/welcome')

        const appsSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', user.email)
          )
        )
        const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
        if (apps.length === 0) return navigate('/incubatee/sme')
        const pending = apps.find(a =>
          ['pending', undefined].includes(a.applicationStatus?.toLowerCase?.())
        )
        if (pending) return navigate('/incubatee/tracker')
        return navigate('/incubatee/sme')
      }

      if (!firstLoginDone) return navigate('/welcome')
      navigate(`/${role}`)
    } catch (error: any) {
      message.error(formatFirebaseError(error, 'signin'))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      const result = await signInWithPopup(auth, new GoogleAuthProvider())
      const user = result.user
      const {
        error,
        message: errMsg,
        role,
        firstLoginDone
      } = await checkUser(user as any)
      if (error) return message.error(errMsg)

      if (role === 'incubatee') {
        const accepted = await getAcceptedAppByEmail(user.email || undefined)
        if (accepted) {
          const gapDone = norm(accepted.gapAnalysisStatus) === 'completed'
          if (!gapDone) {
            const participant = await getParticipantByEmail(
              user.email || undefined
            )
            navigate('/incubatee/gap-analysis', {
              state: {
                participantId: participant?.id ?? null,
                prefillData: {
                  companyName: participant?.beneficiaryName ?? '',
                  region: participant?.province ?? '',
                  contactDetails: participant?.phone ?? '',
                  email: participant?.email ?? user.email,
                  dateOfEngagement: accepted?.dateAccepted ?? null
                }
              }
            })
            return
          }
          navigate('/incubatee')
          return
        }
        if (!firstLoginDone) return navigate('/welcome')

        const appsSnap = await getDocs(
          query(
            collection(db, 'applications'),
            where('email', '==', user.email)
          )
        )
        const apps = appsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
        if (apps.length === 0) return navigate('/incubatee/sme')
        const pending = apps.find(a =>
          ['pending', undefined].includes(a.applicationStatus?.toLowerCase?.())
        )
        if (pending) return navigate('/incubatee/tracker')
        return navigate('/incubatee/sme')
      }

      if (!firstLoginDone) return navigate('/welcome')
      setRedirecting(true)
      navigate(`/${role}`)
    } catch (error: any) {
      message.error(formatFirebaseError(error, 'google'))
    } finally {
      setGoogleLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const email = (forgotPasswordEmail || '').trim()
    if (!email) return message.warning('Please enter your email.')

    try {
      setResetLoading(true)

      // Use your Cloud Function to send a branded reset email to your custom page
      const r = await fetch(RESET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, continueUrl: FALLBACK_RESET_URL })
      })

      if (!r.ok) throw new Error('reset_endpoint_failed')

      // Neutral message to prevent user enumeration
      message.success('If an account exists, we’ve sent a reset link.')
      setForgotPasswordVisible(false)
      setForgotPasswordEmail('')
    } catch (err) {
      // Fallback to client SDK (still points to your custom reset page)
      try {
        await sendPasswordResetEmail(auth, email, { url: FALLBACK_RESET_URL })
        message.success('If an account exists, we’ve sent a reset link.')
        setForgotPasswordVisible(false)
        setForgotPasswordEmail('')
      } catch (error: any) {
        message.error(formatFirebaseError(error, 'reset'))
      }
    } finally {
      setResetLoading(false)
    }
  }

  const isSubmitting = googleLoading || redirecting || loading

  return (
    <>
      <Helmet>
        <title>Login | Smart Incubation Platform</title>
      </Helmet>

      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f6f8',
          padding: isMobile ? 16 : 24,
          position: 'relative'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 0,
            width: '100%',
            maxWidth: 1040,
            minHeight: isMobile ? 'auto' : 600,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
          }}
        >
          {/* LEFT: Sign-in form */}
          <div
            style={{
              padding: isMobile ? '28px 20px' : '48px 40px',
              background: '#fff'
            }}
          >
            <Title
              level={3}
              style={{ marginBottom: 6, color: '#0f172a', textAlign: 'center' }}
            >
              Welcome Back!
            </Title>
            <Text style={{ color: '#64748b', textAlign: 'center' }}>
              Sign in to access your dashboard and continue optimizing your
              Smart Incubation process.
            </Text>

            <Form
              layout='vertical'
              form={form}
              onFinish={handleLogin}
              requiredMark={false}
              style={{ marginTop: 24 }}
            >
              <Form.Item
                name='email'
                label={<span style={{ color: '#0f172a' }}>Email</span>}
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Enter a valid email' }
                ]}
              >
                <Input
                  placeholder='Enter your email'
                  size='large'
                  style={{ borderRadius: 12 }}
                />
              </Form.Item>

              <Form.Item
                name='password'
                label={<span style={{ color: '#0f172a' }}>Password</span>}
                rules={[
                  { required: true, message: 'Please enter your password' }
                ]}
              >
                <Input.Password
                  placeholder='Enter your password'
                  size='large'
                  style={{ borderRadius: 12 }}
                  iconRender={visible =>
                    visible ? (
                      <EyeTwoTone twoToneColor='#64748b' />
                    ) : (
                      <EyeInvisibleOutlined />
                    )
                  }
                />
              </Form.Item>

              <div style={{ textAlign: 'right', marginBottom: 12 }}>
                <Button
                  type='link'
                  onClick={() => setForgotPasswordVisible(true)}
                  style={{ padding: 0 }}
                >
                  Forgot password?
                </Button>
              </div>

              <Form.Item>
                <Button
                  type='primary'
                  htmlType='submit'
                  block
                  size='large'
                  style={{
                    borderRadius: 12,
                    fontWeight: 600,
                    background: '#0f766e',
                    borderColor: '#0f766e'
                  }}
                >
                  Sign In
                </Button>
              </Form.Item>

              <div
                style={{
                  textAlign: 'center',
                  margin: '8px 0',
                  color: '#94a3b8'
                }}
              >
                OR
              </div>

              <Button
                icon={<GoogleOutlined />}
                block
                size='large'
                onClick={handleGoogleLogin}
                style={{ borderRadius: 12, fontWeight: 600 }}
              >
                Continue with Google
              </Button>
            </Form>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <Text style={{ color: '#64748b' }}>
                Don&apos;t have an account?{' '}
                <Button
                  type='link'
                  style={{ padding: 0 }}
                  onClick={() => navigate('/registration')}
                >
                  Sign Up
                </Button>
              </Text>
            </div>
          </div>

          {/* RIGHT: Gradient hero with title only */}
          {!isMobile && (
            <div
              style={{
                position: 'relative',
                background:
                  'radial-gradient(120% 120% at 80% 20%, #0ea5a4 0%, #064e3b 45%, #0b3d3a 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px'
              }}
            >
              <div style={{ maxWidth: 540, lineHeight: 1.1 }}>
                <h1
                  style={{
                    fontSize: 34,
                    fontWeight: 800,
                    letterSpacing: -0.6,
                    margin: 0
                  }}
                >
                  Revolutionize Business Incubation
                  <br />
                  with Smarter Automation
                </h1>
              </div>
            </div>
          )}
        </motion.div>

        {/* Bottom-right QuantO logo with dark background */}
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            height: 46,
            width: 110,
            zIndex: 99,
            backgroundColor: 'rgba(0,0,0,0.8)',
            borderRadius: 8,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 6,
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)'
          }}
        >
          <img
            src='/assets/images/QuantilytixO.png' // replace with your QuantO white logo path if different
            alt='QuantO Logo'
            style={{ height: '100%', width: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Reset Password Modal */}
      <Modal
        open={forgotPasswordVisible}
        onCancel={() => setForgotPasswordVisible(false)}
        footer={null}
        centered
        closable={false}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '12px 8px' }}>
          {/* Icon with shaded background */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              margin: '0 auto 16px',
              background: 'rgba(15,118,110,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span role='img' aria-label='key' style={{ fontSize: 26 }}>
              🔑
            </span>
          </div>

          {/* Heading and subtitle */}
          <Typography.Title
            level={4}
            style={{ marginBottom: 4, color: '#0f172a' }}
          >
            Forgot your password?
          </Typography.Title>
          <Typography.Text type='secondary'>
            No problem — enter your registered email below and we’ll send you a
            secure reset link.
          </Typography.Text>

          {/* Email input */}
          <Input
            placeholder='you@example.com'
            type='email'
            value={forgotPasswordEmail}
            onChange={e => setForgotPasswordEmail(e.target.value)}
            size='large'
            style={{ marginTop: 20, borderRadius: 10 }}
            autoFocus
          />

          {/* Action buttons */}
          <div
            style={{
              marginTop: 22,
              display: 'flex',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Button
              onClick={() => setForgotPasswordVisible(false)}
              style={{ borderRadius: 10 }}
            >
              Cancel
            </Button>
            <Button
              type='primary'
              onClick={handleForgotPassword}
              loading={resetLoading}
              style={{
                borderRadius: 10,
                background: '#0f766e',
                borderColor: '#0f766e',
                fontWeight: 600
              }}
            >
              Send Reset Link
            </Button>
          </div>
        </div>
      </Modal>

      {/* Loading overlay */}
      <AnimatePresence>
        {isSubmitting && (
          <motion.div
            key='loading'
            variants={overlayVariants}
            initial='initial'
            animate='animate'
            exit='exit'
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backdropFilter: 'blur(3px)',
              background: 'rgba(255,255,255,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'wait'
            }}
            aria-live='polite'
            role='status'
            aria-busy='true'
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12
              }}
            >
              <motion.div
                variants={spinnerVariants}
                animate={reduceMotion ? { rotate: 0, scale: 1 } : 'animate'}
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  border: '4px solid rgba(15,118,110,0.25)',
                  borderTopColor: '#0f766e',
                  boxShadow: '0 0 0 2px rgba(15,118,110,0.06) inset'
                }}
              />
              <div
                style={{
                  fontWeight: 600,
                  color: '#0f172a',
                  letterSpacing: 0.2
                }}
              >
                {googleLoading
                  ? 'Signing in with Google…'
                  : redirecting
                  ? 'Redirecting…'
                  : 'Signing you in…'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default LoginPage
