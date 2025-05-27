import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GoogleOutlined
} from '@ant-design/icons'
import {
  Button,
  Form,
  Input,
  Select,
  Typography,
  message,
  Spin,
  Modal
} from 'antd'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemedTitleV2 } from '@refinedev/antd'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { auth } from '@/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import '../landing/LandingPage.css' // for .page-bg and blob styles

const { Title } = Typography

// 1. Firebase error translation
function formatFirebaseError (error) {
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
      // Strip the 'auth/' prefix and show a human-friendly fallback
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
  const [loading, setLoading] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [redirecting, setRedirecting] = React.useState(false)
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code') || ''
  const roleFromParams = searchParams.get('role') || ''
  const [selectedRole, setSelectedRole] = React.useState(roleFromParams)
  const [showCompanyModal, setShowCompanyModal] = React.useState(false)
  const [pendingCompany, setPendingCompany] = React.useState<any>(null)

  React.useEffect(() => {
    document.title = 'Register • Incubation Platform'
  }, [])

  const roleOptions = [
    { label: 'SME', value: 'sme' },
    { label: 'Incubate Implementor', value: 'incubate' },
    { label: 'Government', value: 'government' },
    { label: 'Investor', value: 'investor' },
    { label: 'Funder', value: 'funder' }
  ]

  // Standard registration (email/password)
  const handleRegister = async (values: any) => {
    try {
      setLoading(true)
      // Confirm password check (should never fail because of form validation)
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

      // 👇 Set firstLoginComplete: false for directors
      const userDoc: any = {
        uid: user.uid,
        email: user.email,
        name: values.name || '',
        createdAt: new Date().toISOString(),
        companyCode: code,
        role: assignedRole,
        ...(assignedRole === 'director' ? { firstLoginComplete: false } : {})
      }
      await setDoc(doc(db, 'users', user.uid), userDoc)
      message.success('🎉 Registration successful! Redirecting...', 2)
      setRedirecting(true)
      setTimeout(() => {
        if (assignedRole === 'incubatee') {
          navigate('/incubatee/tracker')
        } else if (assignedRole === 'director') {
          navigate('/director/onboarding')
        } else {
          navigate(`/${assignedRole}`)
        }
      }, 2000)
    } catch (error: any) {
      message.error(formatFirebaseError(error)) // 👈 Use friendly error
    } finally {
      setLoading(false)
    }
  }

  // Google Auth handler
  const handleGoogleRegister = async (companyInfo?: any) => {
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
        role: assignedRole || 'guest',
        createdAt: new Date().toISOString(),
        companyCode: code || '',
        ...(assignedRole === 'director' ? { firstLoginComplete: false } : {})
      }
      if (assignedRole === 'director' && companyInfo) {
        userDoc.companyName = companyInfo.companyName
        userDoc.companyCode = companyInfo.companyCode
      }
      await setDoc(doc(db, 'users', user.uid), userDoc, { merge: true })
      message.success('✅ Google sign-up successful! Redirecting...', 2)
      setRedirecting(true)
      setTimeout(() => {
        if (assignedRole === 'incubatee') {
          navigate('/incubatee/tracker')
        } else if (assignedRole === 'director') {
          navigate('/director/onboarding')
        } else {
          navigate(`/${assignedRole || 'dashboard'}`)
        }
      }, 2000)
    } catch (error: any) {
      message.error(formatFirebaseError(error)) // 👈 Use friendly error
    } finally {
      setGoogleLoading(false)
    }
  }

  // When Google button is clicked:
  const handleGoogleButtonClick = () => {
    if (selectedRole === 'incubate') {
      setShowCompanyModal(true)
    } else {
      handleGoogleRegister()
    }
  }

  // Handle company modal submission
  const handleCompanyModalFinish = (values: any) => {
    setShowCompanyModal(false)
    setPendingCompany(values)
    setTimeout(() => {
      handleGoogleRegister(values)
    }, 200)
  }

  // Handle modal close
  const handleModalClose = () => {
    setShowCompanyModal(false)
    setPendingCompany(null)
  }

  // Framer Motion Variants
  const cardVariants = {
    initial: { opacity: 0, y: 50, scale: 0.98 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: 'easeOut' }
    }
  }
  const logoVariants = {
    initial: { opacity: 0, scale: 0.7 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: { duration: 1.2, delay: 0.5, ease: 'easeOut' }
    }
  }

  return (
    <Spin spinning={loading || googleLoading || redirecting} size='large'>
      <div
        style={{
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
          background:
            'linear-gradient(120deg, #aecbfa 0%, #7fa7fa 60%, #cfbcfa 100%)'
        }}
      >
        {/* ...blobs and logo as before... */}

        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {/* Logo + Title */}
          <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <ThemedTitleV2
              collapsed={false}
              text={
                <span
                  style={{
                    color: 'white',
                    fontSize: '32px',
                    fontWeight: '700',
                    letterSpacing: 1
                  }}
                >
                  Smart Incubation
                </span>
              }
            />
          </div>

          {/* Card (Animated) */}
          <motion.div
            initial='initial'
            animate='animate'
            variants={cardVariants}
            style={{
              maxWidth: 500,
              width: '100%',
              padding: '48px 32px',
              borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              background: '#ffffffee',
              backdropFilter: 'blur(5px)',
              position: 'relative',
              zIndex: 1
            }}
          >
            <Form
              layout='vertical'
              form={form}
              onFinish={handleRegister}
              requiredMark={false}
              initialValues={{ role: roleFromParams || undefined }}
            >
              <Title
                level={4}
                style={{ textAlign: 'center', color: '#1677ff' }}
              >
                {selectedRole === 'sme'
                  ? 'Register as a SME'
                  : selectedRole === 'incubate'
                  ? 'Register as an Incubate Implementor'
                  : selectedRole === 'investor'
                  ? 'Register as a Program Investor'
                  : selectedRole === 'government'
                  ? 'Register as a Public Sector'
                  : selectedRole === 'funder'
                  ? 'Register as a Capital Partner'
                  : 'Create your account'}
              </Title>

              {!roleFromParams && (
                <Form.Item
                  name='role'
                  label='Select Role'
                  rules={[
                    { required: true, message: 'Please select your role' }
                  ]}
                >
                  <Select
                    placeholder='Choose your role'
                    options={roleOptions}
                    onChange={val => setSelectedRole(val)}
                  />
                </Form.Item>
              )}

              <Form.Item
                name='name'
                label='Name'
                rules={[
                  { required: true, message: 'Please enter your full name' }
                ]}
              >
                <Input placeholder='Daniel Rumona' />
              </Form.Item>

              <Form.Item
                name='email'
                label='Email'
                rules={[
                  { required: true, message: 'Please enter your email' },
                  { type: 'email', message: 'Enter a valid email' }
                ]}
              >
                <Input placeholder='you@example.com' />
              </Form.Item>

              <Form.Item
                name='password'
                label='Password'
                rules={[
                  { required: true, message: 'Please enter your password' },
                  { min: 6, message: 'Password must be at least 6 characters' }
                ]}
                hasFeedback
              >
                <Input.Password
                  placeholder='Enter your password'
                  iconRender={visible =>
                    visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                  }
                />
              </Form.Item>

              <Form.Item
                name='confirmPassword'
                label='Confirm Password'
                dependencies={['password']}
                hasFeedback
                rules={[
                  { required: true, message: 'Please confirm your password' },
                  // Custom validator for confirm
                  ({ getFieldValue }) => ({
                    validator (_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve()
                      }
                      return Promise.reject(
                        new Error('The two passwords do not match!')
                      )
                    }
                  })
                ]}
              >
                <Input.Password
                  placeholder='Confirm your password'
                  iconRender={visible =>
                    visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                  }
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type='primary'
                  htmlType='submit'
                  block
                  loading={loading}
                >
                  Register
                </Button>
              </Form.Item>

              <Form.Item>
                <Button
                  icon={<GoogleOutlined />}
                  onClick={handleGoogleRegister}
                  style={{ width: '100%' }}
                  loading={googleLoading}
                >
                  Register with Google
                </Button>
              </Form.Item>
            </Form>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
              Already have an account?{' '}
              <a onClick={() => navigate('/login')} style={{ fontWeight: 500 }}>
                Login
              </a>
            </div>
          </motion.div>

          {/* Quantilytix Floating Logo - animated */}
          <motion.img
            initial='initial'
            animate='animate'
            variants={logoVariants}
            src='/assets/images/QuantilytixO.png'
            alt='Quantilytix Logo'
            style={{
              position: 'fixed',
              bottom: 24,
              right: 20,
              height: 48,
              width: 120,
              zIndex: 99
            }}
          />
        </div>
      </div>

      <style>
        {`
                  @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                  }
                  @keyframes fadeInUp {
                    from {
                      opacity: 0;
                      transform: translateY(20px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                  .page-bg {
                    background: linear-gradient(135deg, #f8fafc 70%, #c7d2fe 100%);
                  }
                `}
      </style>
    </Spin>
  )
}
