import React, { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, Typography, message, Spin, Modal, Alert } from 'antd'
import { EyeInvisibleOutlined, EyeTwoTone, GoogleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import { auth, db } from '@/firebase'
import {
  browserLocalPersistence,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  getRedirectResult,
  GoogleAuthProvider,
  linkWithCredential,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendEmailVerification,
} from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'

const { Title } = Typography

function formatFirebaseError (error: any) {
  if (!error || !error.code) return error?.message || 'An unexpected error occurred.'
  switch (error.code) {
    case 'auth/wrong-password':
      return 'The password you entered is incorrect.'
    case 'auth/user-not-found':
      return 'No user found with this email address.'
    case 'auth/invalid-email':
      return 'The email address is not valid.'
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a few minutes or reset your password.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.'
    case 'auth/popup-closed-by-user':
      return 'Login window was closed before completing sign in.'
    case 'auth/popup-blocked':
      return 'Popup was blocked by the browser.'
    case 'auth/user-disabled':
      return 'Your account has been disabled. Please contact support.'
    case 'auth/account-exists-with-different-credential':
      return 'This email already has an account with a different sign-in method.'
    default:
      if (typeof error.code === 'string') {
        return error.code.replace('auth/','').replace(/-/g,' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      }
      return error.message || 'Login failed. Please try again.'
  }
}

const supportedRoles = [
  'admin',
  'funder',
  'consultant',
  'incubatee',
  'operations',
  'director',
  'projectadmin',
  'investor',
  'government'
]

const normalizeRole = (role?: string) => role?.toLowerCase()?.replace(/\s+/g, '') || ''

async function checkUser (user: any) {
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) {
    return { error: true, message: '🚫 User not found in the system. Please contact the admin.' }
  }
  const data = userSnap.data() || {}
  if (data?.disabled === true) {
    return { error: true, message: '🚫 Your account has been disabled in the system. Please contact support.' }
  }
  return { role: normalizeRole(data.role), firstLoginComplete: !!data.firstLoginComplete }
}

async function handleIncubateeRouting (navigate: any, userEmail: string, role: string) {
  try {
    const appsSnap = await getDocs(query(collection(db, 'applications'), where('email', '==', userEmail)))
    const apps = appsSnap.docs.map(d => d.data() as any)
    if (apps.length === 0) { navigate('/incubatee/sme'); return }
    const pending = apps.find((app: any) => app.applicationStatus?.toLowerCase?.() === 'pending' || !app.applicationStatus)
    const accepted = apps.find((app: any) => app.applicationStatus?.toLowerCase?.() === 'accepted')
    if (pending) { navigate('/incubatee/tracker'); return }
    if (accepted) { navigate(`/${role}`); return }
    navigate('/incubatee/sme')
  } catch (error) {
    console.error('Error fetching applications:', error)
    message.error('Failed to check application status. Please try again.')
    navigate(`/${role}`)
  }
}

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Provider linking state
  const [linkModalOpen, setLinkModalOpen] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkEmail, setLinkEmail] = useState<string | null>(null)
  const [pendingOAuthCredential, setPendingOAuthCredential] = useState<any>(null)
  const [linkForm] = Form.useForm()

  // Soft verify modal (now PAUSES navigation)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [verifySending, setVerifySending] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)

  // Store "what to do next" so we can run it after the user acts in the modal
  const nextNavRef = useRef<null | (() => Promise<void>)>(null)

  // Framer Motion variants
  const blobVariants = { initial: { opacity: 0, scale: 0.95, y: 20 }, animate: { opacity: 0.7, scale: 1, y: 0, transition: { duration: 1.2, ease: 'easeOut' } } }
  const cardVariants = { initial: { opacity: 0, scale: 0.94, y: 30 }, animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } } }
  const logoVariants = { initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1, transition: { duration: 1.2, delay: 0.5, ease: 'easeOut' } } }

  // Centralized post-auth routing & checks
  const postAuth = async (user: any) => {
    const usedPassword = user?.providerData?.some((p: any) => p?.providerId === 'password')

    const result = await checkUser(user)
    if (result.error) throw new Error(result.message)

    const { role, firstLoginComplete } = result
    if (!supportedRoles.includes(role)) {
      throw new Error(`🚫 The role "${role}" is not recognized.`)
    }

    // compute next navigation once
    nextNavRef.current = async () => {
      if (role === 'incubatee') {
        await handleIncubateeRouting(navigate, user.email, role)
        return
      }
      if (role === 'director' && !firstLoginComplete) {
        navigate('/director/onboarding')
      } else {
        navigate(`/${role}`)
      }
    }

    // If password user & unverified: SHOW modal and STOP navigation until user clicks Continue
    if (usedPassword && !user.emailVerified) {
      setUnverifiedEmail(user.email ?? null)
      setVerifyModalOpen(true)
      return
    }

    // otherwise navigate immediately
    await nextNavRef.current?.()
  }

  // Handle redirect results (Google fallback / explicit redirect)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const result = await getRedirectResult(auth)
        if (!mounted || !result?.user) return
        message.success('Google login successful! Redirecting...', 1.5)
        setRedirecting(true)
        await postAuth(result.user)
      } catch (err: any) {
        if (err?.code === 'auth/account-exists-with-different-credential') {
          const email = err?.customData?.email
          const pendingCred = GoogleAuthProvider.credentialFromError(err)
          if (email && pendingCred) {
            const methods = await fetchSignInMethodsForEmail(auth, email)
            if (methods.includes(EmailAuthProvider.PROVIDER_ID)) {
              setLinkEmail(email)
              setPendingOAuthCredential(pendingCred)
              setLinkModalOpen(true)
              message.info('This email already has an account. Enter your password to link Google.')
              return
            }
            message.error(`Account exists with a different sign-in method: ${methods.join(', ')}. Use that method first, then link Google from your profile.`)
            return
          }
        }
        message.error(formatFirebaseError(err))
      } finally {
        setRedirecting(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Email/password login
  const handleLogin = async (values: any) => {
    try {
      setLoading(true)
      await setPersistence(auth, browserLocalPersistence)
      const cred = await signInWithEmailAndPassword(auth, values.email, values.password)
      await postAuth(cred.user)

      // Link pending Google cred if present (from earlier attempt)
      if (pendingOAuthCredential) {
        try {
          await linkWithCredential(auth.currentUser!, pendingOAuthCredential)
          message.success('Your Google account has been linked successfully.')
          setPendingOAuthCredential(null)
          setLinkEmail(null)
        } catch (linkErr: any) {
          console.error('Linking failed:', linkErr)
          message.error(formatFirebaseError(linkErr))
        }
      }
    } catch (error: any) {
      message.error(formatFirebaseError(error))
    } finally {
      setLoading(false)
    }
  }

  // Google OAuth
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })

    try {
      setGoogleLoading(true)
      await setPersistence(auth, browserLocalPersistence)

      try {
        const res = await signInWithPopup(auth, provider)
        message.success('Google login successful! Redirecting...', 1.5)
        setRedirecting(true)
        await postAuth(res.user)
        return
      } catch (e: any) {
        if (e?.code === 'auth/popup-blocked') {
          message.info('Popup was blocked. Redirecting you to Google login…')
          await signInWithRedirect(auth, provider)
          return
        }
        if (e?.code === 'auth/popup-closed-by-user') {
          message.info('Popup closed. Redirecting you to Google login…')
          await signInWithRedirect(auth, provider)
          return
        }
        if (e?.code === 'auth/account-exists-with-different-credential') {
          const email = e?.customData?.email
          const pendingCred = GoogleAuthProvider.credentialFromError(e)
          if (email && pendingCred) {
            const methods = await fetchSignInMethodsForEmail(auth, email)
            if (methods.includes(EmailAuthProvider.PROVIDER_ID)) {
              setLinkEmail(email)
              setPendingOAuthCredential(pendingCred)
              setLinkModalOpen(true)
              message.info('This email already has an account. Enter your password to link Google.')
              return
            }
            message.error(`Account exists with a different sign-in method: ${methods.join(', ')}. Use that method first, then link Google from your profile.`)
            return
          }
        }
        throw e
      }
    } catch (error: any) {
      message.error(formatFirebaseError(error))
    } finally {
      setGoogleLoading(false)
      setRedirecting(false)
    }
  }

  // Link Providers Modal submit
  const handleLinkSubmit = async () => {
    try {
      setLinking(true)
      const { password } = await linkForm.validateFields()
      if (!linkEmail || !pendingOAuthCredential) {
        throw new Error('Linking context lost. Please try Google sign-in again.')
      }
      const passwordCred = await signInWithEmailAndPassword(auth, linkEmail, password)
      await linkWithCredential(passwordCred.user, pendingOAuthCredential)

      setPendingOAuthCredential(null)
      setLinkEmail(null)
      setLinkModalOpen(false)
      linkForm.resetFields()

      message.success('Accounts linked. Redirecting…')
      await postAuth(passwordCred.user)
    } catch (err: any) {
      message.error(formatFirebaseError(err))
    } finally {
      setLinking(false)
    }
  }

  // Send verification email (from modal)
  const sendVerify = async () => {
    try {
      setVerifySending(true)
      if (!auth.currentUser) {
        message.info('Login first, then resend verification from your profile.')
        return
      }
      await sendEmailVerification(auth.currentUser)
      message.success('Verification email sent.')
    } catch (err: any) {
      message.error(formatFirebaseError(err))
    } finally {
      setVerifySending(false)
    }
  }

  // Continue after modal
  const continueAfterVerifyPrompt = async () => {
    setVerifyModalOpen(false)
    await nextNavRef.current?.()
  }

  return (
    <Spin spinning={loading || googleLoading || redirecting} size='large'>
      <Helmet>
        <title>Login | Smart Incubation Platform</title>
        <meta name='description' content='Log in to your Smart Incubation account to access tailored tools and resources for entrepreneurs, consultants, and administrators.' />
      </Helmet>

      {/* Link Providers Modal */}
      <Modal
        title='Link your Google account'
        open={linkModalOpen}
        onCancel={() => !linking && setLinkModalOpen(false)}
        onOk={handleLinkSubmit}
        okText='Link & Continue'
        confirmLoading={linking}
        destroyOnClose
      >
        <Typography.Paragraph>
          We found an existing account for <b>{linkEmail}</b>. Enter your password to link your Google sign-in to this account.
        </Typography.Paragraph>
        <Form form={linkForm} layout='vertical' preserve={false}>
          <Form.Item name='password' label='Password' rules={[{ required: true, message: 'Please enter your password' }]}>
            <Input.Password placeholder='Enter your password' iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Verification prompt (PAUSES navigation) */}
      <Modal
        title='Verify your email'
        open={verifyModalOpen}
        onCancel={() => setVerifyModalOpen(false)}
        footer={[
          <Button key='later' onClick={continueAfterVerifyPrompt}>
            Continue
          </Button>,
          <Button key='send' type='primary' loading={verifySending} onClick={sendVerify}>
            Send verification email
          </Button>,
        ]}
      >
        <Alert
          type='warning'
          showIcon
          message='Your email is not verified'
          description={`We recommend verifying ${unverifiedEmail ?? 'your email'} to secure your account and enable all features.`}
        />
      </Modal>

      <div
        style={{
          minHeight: '100vh',
          width: '100vw',
          background: 'linear-gradient(120deg, #aecbfa 0%, #7fa7fa 60%, #cfbcfa 100%)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {/* BLOBS */}
        <motion.svg className='animated-blob blob-bottom-left' viewBox='0 0 400 400' style={{ position: 'absolute', left: '-130px', bottom: '-90px', width: 320, height: 310, zIndex: 0, pointerEvents: 'none' }} initial='initial' animate='animate' variants={blobVariants}>
          <defs><linearGradient id='blob1' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stopColor='#38bdf8' /><stop offset='100%' stopColor='#818cf8' /></linearGradient></defs>
          <path fill='url(#blob1)' d='M326.9,309Q298,378,218.5,374.5Q139,371,81,312.5Q23,254,56.5,172Q90,90,180.5,63.5Q271,37,322.5,118.5Q374,200,326.9,309Z' />
        </motion.svg>
        <motion.svg className='animated-blob blob-top-right' viewBox='0 0 400 400' style={{ position: 'absolute', right: '-110px', top: '-70px', width: 280, height: 260, zIndex: 0, pointerEvents: 'none' }} initial='initial' animate='animate' variants={blobVariants}>
          <defs><linearGradient id='blob2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stopColor='#fbc2eb' /><stop offset='100%' stopColor='#a6c1ee' /></linearGradient></defs>
          <path fill='url(#blob2)' d='M343,294.5Q302,389,199.5,371Q97,353,71.5,226.5Q46,100,154,72.5Q262,45,315,122.5Q368,200,343,294.5Z' />
        </motion.svg>

        {/* CARD */}
        <motion.div initial='initial' animate='animate' variants={cardVariants} style={{ width: 700, minWidth: 300, minHeight: 310, display: 'flex', borderRadius: 16, background: '#fff', boxShadow: '0 8px 44px #5ec3fa24, 0 1.5px 10px #91bfff08', zIndex: 1 }}>
          {/* Left Panel */}
          <div style={{ flex: 1, minWidth: 210, background: 'linear-gradient(135deg, #24b6d7 60%, #18d19a 100%)', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '24px 14px' }}>
            <div style={{ width: '100%', maxWidth: 220 }}>
              <Title level={4} style={{ color: '#fff', marginBottom: 2, marginTop: 0, textAlign: 'center' }}>Smart Incubation</Title>
              <div style={{ fontSize: 14, opacity: 0.95, marginBottom: 18, color: '#fff' }}>To gain access, kindly create an account below.</div>
              <Button size='middle' shape='round' style={{ background: 'transparent', color: '#fff', border: '1.8px solid #fff', fontWeight: 600, width: '100%', fontSize: 14, marginTop: 2 }} onClick={() => navigate('/registration')}>SIGN UP</Button>
            </div>
          </div>

          {/* Right Panel: Form */}
          <div style={{ flex: 1.2, minWidth: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 32px' }}>
            <div style={{ width: '100%', maxWidth: 290 }}>
              <Title level={4} style={{ color: '#16b8e0', textAlign: 'center', fontWeight: 700, margin: 0 }}>Login to your account</Title>
              <Form layout='vertical' form={form} onFinish={handleLogin} requiredMark={false} style={{ marginTop: 15 }}>
                <Form.Item name='email' label='Email' rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Enter a valid email' }]} style={{ marginBottom: 10 }}>
                  <Input placeholder='you@example.com' />
                </Form.Item>
                <Form.Item name='password' label='Password' rules={[{ required: true, message: 'Please enter your password' }]} style={{ marginBottom: 10 }}>
                  <Input.Password placeholder='Enter your password' iconRender={(v) => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)} />
                </Form.Item>
                <Form.Item style={{ marginBottom: 7 }}>
                  <Button type='primary' htmlType='submit' block loading={loading}>LOGIN</Button>
                </Form.Item>

                <div style={{ color: '#000', textAlign: 'center', fontSize: 13, marginBottom: 5 }}>
                  or use your Google Account for access:
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '13px 0 2px' }}>
                  <Button
                    icon={<GoogleOutlined style={{ color: '#ea4335' }} />}
                    shape='circle'
                    style={{ margin: '0 8px', border: '1px solid #eee', background: '#fff' }}
                    onClick={handleGoogleLogin}
                    loading={googleLoading}
                  />
                </div>
              </Form>
            </div>
          </div>
        </motion.div>

        {/* Bottom-right logo */}
        <motion.img initial='initial' animate='animate' variants={logoVariants} src='/assets/images/QuantilytixO.png' alt='Quantilytix Logo' style={{ position: 'fixed', bottom: 22, right: 20, height: 46, width: 110, zIndex: 99 }} />
      </div>
    </Spin>
  )
}
