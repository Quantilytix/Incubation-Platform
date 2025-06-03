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
  Card
} from 'antd'
import React from 'react'
import { useNavigate } from 'react-router-dom'
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

const { Title } = Typography

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
      message.error(formatFirebaseError(error))
    } finally {
      setGoogleLoading(false)
    }
  }

  // Card animation (short)
  const cardVariants = {
    initial: { opacity: 0, scale: 0.94, y: 30 },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: 0.7, ease: 'easeOut' }
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

  // -- BLOB VARIANTS (blobs behind the card) --
  const blobVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: {
      opacity: 0.7,
      scale: 1,
      y: 0,
      transition: { duration: 1.2, ease: 'easeOut' }
    }
  }

  return (
    <Spin spinning={loading || googleLoading || redirecting} size='large'>
      <div
        style={{
          minHeight: '100vh',
          width: '100vw',
          background:
            'linear-gradient(120deg, #aecbfa 0%, #7fa7fa 60%, #cfbcfa 100%)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        {/* BLOBS */}
        <motion.svg
          className='animated-blob blob-bottom-left'
          viewBox='0 0 400 400'
          style={{
            position: 'absolute',
            left: '-130px',
            bottom: '-90px',
            width: 320,
            height: 310,
            zIndex: 0,
            pointerEvents: 'none'
          }}
          initial='initial'
          animate='animate'
          variants={blobVariants}
        >
          <defs>
            <linearGradient id='blob1' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#38bdf8' />
              <stop offset='100%' stopColor='#818cf8' />
            </linearGradient>
          </defs>
          <path
            fill='url(#blob1)'
            d='M326.9,309Q298,378,218.5,374.5Q139,371,81,312.5Q23,254,56.5,172Q90,90,180.5,63.5Q271,37,322.5,118.5Q374,200,326.9,309Z'
          />
        </motion.svg>
        <motion.svg
          className='animated-blob blob-top-right'
          viewBox='0 0 400 400'
          style={{
            position: 'absolute',
            right: '-110px',
            top: '-70px',
            width: 280,
            height: 260,
            zIndex: 0,
            pointerEvents: 'none'
          }}
          initial='initial'
          animate='animate'
          variants={blobVariants}
        >
          <defs>
            <linearGradient id='blob2' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0%' stopColor='#fbc2eb' />
              <stop offset='100%' stopColor='#a6c1ee' />
            </linearGradient>
          </defs>
          <path
            fill='url(#blob2)'
            d='M343,294.5Q302,389,199.5,371Q97,353,71.5,226.5Q46,100,154,72.5Q262,45,315,122.5Q368,200,343,294.5Z'
          />
        </motion.svg>

        {/* CARD */}
        <motion.div
          initial='initial'
          animate='animate'
          variants={cardVariants}
          style={{
            width: 720,
            minWidth: 300,
            minHeight: 310, // shorter
            display: 'flex',
            borderRadius: 16,
            background: '#fff',
            boxShadow: '0 8px 44px #5ec3fa24, 0 1.5px 10px #91bfff08',
            zIndex: 1
          }}
        >
          {/* Left Panel */}
          <div
            style={{
              flex: 1,
              minWidth: 230,
              background: 'linear-gradient(135deg, #24b6d7 60%, #18d19a 100%)',
              borderTopLeftRadius: 16,
              borderBottomLeftRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '28px 18px'
            }}
          >
            <div style={{ width: '100%', maxWidth: 230 }}>
              <Title
                level={4}
                style={{
                  color: '#fff',
                  marginBottom: 2,
                  marginTop: 0,
                  textAlign: 'center'
                }}
              >
                Smart Incubation
              </Title>
              <div
                style={{
                  fontSize: 14,
                  opacity: 0.95,
                  marginBottom: 18,
                  color: '#fff'
                }}
              >
                To keep connected, please login with your personal info.
              </div>
              <Button
                size='middle'
                shape='round'
                style={{
                  background: 'transparent',
                  color: '#fff',
                  border: '1.8px solid #fff',
                  fontWeight: 600,
                  width: '100%',
                  fontSize: 14,
                  marginTop: 2
                }}
                onClick={() => navigate('/login')}
              >
                SIGN IN
              </Button>
            </div>
          </div>

          {/* Right Panel: Form */}
          <div
            style={{
              flex: 1.2,
              minWidth: 260,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '28px 20px'
            }}
          >
            <div style={{ width: '100%', maxWidth: 290 }}>
              <Title
                level={4}
                style={{
                  color: '#16b8e0',
                  textAlign: 'center',
                  fontWeight: 700,
                  margin: 0
                }}
              >
                Create Account
              </Title>

              <Form
                layout='vertical'
                form={form}
                onFinish={handleRegister}
                requiredMark={false}
                initialValues={{ role: roleFromParams || undefined }}
                style={{ margin: 0 }}
              >
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
                  style={{ marginBottom: 10 }}
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
                  style={{ marginBottom: 10 }}
                >
                  <Input placeholder='you@example.com' />
                </Form.Item>
                <Form.Item
                  name='password'
                  label='Password'
                  rules={[
                    { required: true, message: 'Please enter your password' },
                    {
                      min: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  ]}
                  hasFeedback
                  style={{ marginBottom: 10 }}
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
                  style={{ marginBottom: 12 }}
                >
                  <Input.Password
                    placeholder='Confirm your password'
                    iconRender={visible =>
                      visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                    }
                  />
                </Form.Item>
                <Form.Item style={{ marginBottom: 7 }}>
                  <Button
                    type='primary'
                    htmlType='submit'
                    block
                    loading={loading}
                  >
                    SIGN UP
                  </Button>
                </Form.Item>
                <div
                  style={{
                    color: '#000',
                    textAlign: 'center',
                    fontSize: 13,
                    marginBottom: 5
                  }}
                >
                  or use your Google Account for registration:
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '13px 0 2px'
                  }}
                >
                  <Button
                    icon={<GoogleOutlined style={{ color: '#ea4335' }} />}
                    shape='circle'
                    style={{
                      margin: '0 8px',
                      border: '1px solid #eee',
                      background: '#fff',
                      height: '32px'
                    }}
                    onClick={handleGoogleRegister}
                    loading={googleLoading}
                  />
                </div>
              </Form>
            </div>
          </div>
        </motion.div>

        {/* Bottom-right logo */}
        <motion.img
          initial='initial'
          animate='animate'
          variants={logoVariants}
          src='/assets/images/QuantilytixO.png'
          alt='Quantilytix Logo'
          style={{
            position: 'fixed',
            bottom: 22,
            right: 20,
            height: 46,
            width: 110,
            zIndex: 99
          }}
        />
      </div>
    </Spin>
  )
}
