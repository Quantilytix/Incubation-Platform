import React from 'react'
import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GoogleOutlined
} from '@ant-design/icons'
import { Button, Form, Input, Select, Typography, message } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { auth, db } from '@/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const { Title, Text } = Typography

function formatFirebaseError (error: any) {
  if (!error || !error.code)
    return error?.message || 'An unexpected error occurred.'
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already in use. Please login or use a different email.'
    case 'auth/invalid-email':
      return 'The email address is not valid.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.'
    default:
      if (typeof error.code === 'string') {
        return error.code
          .replace('auth/', '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
      }
      return error.message || 'Registration failed. Please try again.'
  }
}

export const RegisterPage: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const roleFromParams = searchParams.get('role') || ''
  const [selectedRole, setSelectedRole] = React.useState(roleFromParams)

  const [loading, setLoading] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [redirecting, setRedirecting] = React.useState(false)
  const isSubmitting = loading || googleLoading || redirecting

  const reduceMotion = useReducedMotion()

  React.useEffect(() => {
    document.title = 'Register • Smart Incubation'
  }, [])

  const roleOptions = [
    { label: 'SME', value: 'sme' },
    { label: 'Incubate Implementor', value: 'incubate' },
    { label: 'Government', value: 'government' },
    { label: 'Investor', value: 'investor' },
    { label: 'Funder', value: 'funder' }
  ]

  const handleRegister = async (values: any) => {
    try {
      setLoading(true)
      if (values.password !== values.confirmPassword) {
        message.error('Passwords do not match.')
        return
      }
      const userCred = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      )
      const user = userCred.user

      const assignedRole =
        selectedRole === 'sme'
          ? 'incubatee'
          : selectedRole === 'incubate'
          ? 'director'
          : selectedRole

      const userDoc: any = {
        uid: user.uid,
        email: user.email,
        name: values.name || '',
        createdAt: new Date().toISOString(),
        companyCode: code,
        role: assignedRole || 'incubatee',
        ...(assignedRole === 'director' ? { firstLoginComplete: false } : {})
      }
      await setDoc(doc(db, 'users', user.uid), userDoc)
      message.success('🎉 Registration successful! Redirecting...', 1.4)
      setRedirecting(true)
      setTimeout(() => {
        if (assignedRole === 'incubatee') navigate('/incubatee/tracker')
        else if (assignedRole === 'director') navigate('/director/onboarding')
        else navigate(`/${assignedRole}`)
      }, 1200)
    } catch (error: any) {
      message.error(formatFirebaseError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    try {
      setGoogleLoading(true)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const assignedRole =
        selectedRole === 'sme'
          ? 'incubatee'
          : selectedRole === 'incubate'
          ? 'director'
          : selectedRole

      const userDoc: any = {
        uid: user.uid,
        name: user.displayName || '',
        email: user.email,
        role: assignedRole || 'incubatee',
        createdAt: new Date().toISOString(),
        companyCode: code || '',
        ...(assignedRole === 'director' ? { firstLoginComplete: false } : {})
      }
      await setDoc(doc(db, 'users', user.uid), userDoc, { merge: true })
      message.success('✅ Google sign-up successful! Redirecting...', 1.4)
      setRedirecting(true)
      setTimeout(() => {
        if (assignedRole === 'incubatee') navigate('/incubatee/tracker')
        else if (assignedRole === 'director') navigate('/director/onboarding')
        else navigate(`/${assignedRole || 'dashboard'}`)
      }, 1200)
    } catch (error: any) {
      message.error(formatFirebaseError(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  // overlay + spinner animations (same feel as login)
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

  return (
    <>
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f4f6f8',
          padding: 24,
          position: 'relative'
        }}
      >
        {/* CARD: hero left, form right */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            width: '100%',
            maxWidth: 980, // narrower card
            borderRadius: 14,
            overflow: 'hidden',
            background: '#fff',
            boxShadow: '0 6px 24px rgba(0,0,0,0.08)'
          }}
        >
          {/* LEFT: Gradient hero (compact) */}
          <div
            style={{
              background:
                'radial-gradient(120% 120% at 80% 20%, #0ea5a4 0%, #064e3b 45%, #0b3d3a 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20 // tighter
            }}
          >
            <div style={{ maxWidth: 460, lineHeight: 1.06 }}>
              <h1
                style={{
                  fontSize: 26, // smaller title
                  fontWeight: 800,
                  letterSpacing: -0.4,
                  margin: 0
                }}
              >
                Revolutionize Incubation
                <br />
                with Smarter Automation
              </h1>
            </div>
          </div>

          {/* RIGHT: Registration form (compact) */}
          <div
            style={{
              padding: '20px 22px', // tighter
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <Title
              level={4}
              style={{
                marginBottom: 4,
                color: '#0f172a',
                fontWeight: 700,
                textAlign: 'center'
              }}
            >
              Create Account
            </Title>
            <Text
              style={{ color: '#64748b', fontSize: 13, textAlign: 'center' }}
            >
              Join the platform and streamline your incubation workflow.
            </Text>

            <Form
              layout='vertical'
              form={form}
              onFinish={handleRegister}
              requiredMark={false}
              initialValues={{ role: roleFromParams || undefined }}
              style={{ marginTop: 12, maxWidth: 420 }}
            >
              {!roleFromParams && (
                <Form.Item
                  name='role'
                  label={<span style={{ fontSize: 12 }}>Select Role</span>}
                  rules={[
                    { required: true, message: 'Please select your role' }
                  ]}
                  style={{ marginBottom: 8 }}
                >
                  <Select
                    placeholder='Choose your role'
                    options={[
                      { label: 'SME', value: 'sme' },
                      { label: 'Incubate Implementor', value: 'incubate' },
                      { label: 'Government', value: 'government' },
                      { label: 'Investor', value: 'investor' },
                      { label: 'Funder', value: 'funder' }
                    ]}
                    onChange={val => setSelectedRole(val)}
                    size='middle'
                  />
                </Form.Item>
              )}

              {/* Compact grid for fields to save vertical space */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8
                }}
              >
                <div>
                  <Form.Item
                    name='name'
                    label={<span style={{ fontSize: 12 }}>Name</span>}
                    rules={[
                      { required: true, message: 'Please enter your full name' }
                    ]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input
                      placeholder='Daniel Rumona'
                      size='middle'
                      style={{ borderRadius: 10 }}
                    />
                  </Form.Item>
                </div>
                <div>
                  <Form.Item
                    name='email'
                    label={<span style={{ fontSize: 12 }}>Email</span>}
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Enter a valid email' }
                    ]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input
                      placeholder='you@example.com'
                      size='middle'
                      style={{ borderRadius: 10 }}
                    />
                  </Form.Item>
                </div>
                <div>
                  <Form.Item
                    name='password'
                    label={<span style={{ fontSize: 12 }}>Password</span>}
                    rules={[
                      { required: true, message: 'Please enter your password' },
                      { min: 6, message: 'At least 6 characters' }
                    ]}
                    hasFeedback
                    style={{ marginBottom: 8 }}
                  >
                    <Input.Password
                      placeholder='Password'
                      size='middle'
                      style={{ borderRadius: 10 }}
                      iconRender={v =>
                        v ? (
                          <EyeTwoTone twoToneColor='#64748b' />
                        ) : (
                          <EyeInvisibleOutlined />
                        )
                      }
                    />
                  </Form.Item>
                </div>
                <div>
                  <Form.Item
                    name='confirmPassword'
                    label={<span style={{ fontSize: 12 }}>Confirm</span>}
                    dependencies={['password']}
                    hasFeedback
                    rules={[
                      {
                        required: true,
                        message: 'Please confirm your password'
                      },
                      ({ getFieldValue }) => ({
                        validator (_, value) {
                          if (!value || getFieldValue('password') === value)
                            return Promise.resolve()
                          return Promise.reject(
                            new Error('Passwords do not match')
                          )
                        }
                      })
                    ]}
                    style={{ marginBottom: 8 }}
                  >
                    <Input.Password
                      placeholder='Confirm password'
                      size='middle'
                      style={{ borderRadius: 10 }}
                      iconRender={v =>
                        v ? (
                          <EyeTwoTone twoToneColor='#64748b' />
                        ) : (
                          <EyeInvisibleOutlined />
                        )
                      }
                    />
                  </Form.Item>
                </div>
              </div>

              <Form.Item style={{ marginBottom: 8 }}>
                <Button
                  type='primary'
                  htmlType='submit'
                  block
                  size='middle' // shorter button
                  style={{
                    borderRadius: 10,
                    fontWeight: 600,
                    background: '#0f766e',
                    borderColor: '#0f766e'
                  }}
                  loading={loading}
                >
                  Sign Up
                </Button>
              </Form.Item>

              <div
                style={{
                  textAlign: 'center',
                  margin: '6px 0',
                  color: '#94a3b8',
                  fontSize: 12
                }}
              >
                OR
              </div>

              <Button
                icon={<GoogleOutlined />}
                block
                size='middle'
                onClick={handleGoogleRegister}
                style={{ borderRadius: 10, fontWeight: 600 }}
                loading={googleLoading}
              >
                Continue with Google
              </Button>
            </Form>

            {/* Sign-in switch */}
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                Already have an account?{' '}
                <Button
                  type='link'
                  style={{ padding: 0, color: '#0f766e', fontWeight: 600 }}
                  onClick={() => navigate('/login')}
                >
                  Sign In
                </Button>
              </Text>
            </div>
          </div>
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
            src='/assets/images/QuantilytixO.png'
            alt='QuantO Logo'
            style={{ height: '100%', width: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Animated loading overlay (shows when switching/submitting) */}
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
                  ? 'Creating with Google…'
                  : redirecting
                  ? 'Redirecting…'
                  : 'Creating your account…'}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default RegisterPage
