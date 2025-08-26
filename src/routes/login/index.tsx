import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GoogleOutlined
} from '@ant-design/icons'
import { Button, Form, Input, Typography, message, Spin } from 'antd'
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
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
import { motion } from 'framer-motion'

const { Title } = Typography

function formatFirebaseError (error) {
  if (!error || !error.code)
    return error?.message || 'An unexpected error occurred.'
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
    default:
      if (typeof error.code === 'string') {
        return error.code
          .replace('auth/', '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
      }
      return error.message || 'Login failed. Please try again.'
  }
}

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  // Framer Motion Variants
  const blobVariants = {
    initial: { opacity: 0, scale: 0.95, y: 20 },
    animate: {
      opacity: 0.7,
      scale: 1,
      y: 0,
      transition: { duration: 1.2, ease: 'easeOut' }
    }
  }
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

async function checkUser (user) {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      return {
        error: true,
        message: '🚫 User not found in the system. Please contact the admin.'
      }
    }
    const data = userSnap.data()
    const normalizeRole = role => role?.toLowerCase()?.replace(/\s+/g, '') || ''
    return {
      role: normalizeRole(data.role),
      firstLoginComplete: !!data.firstLoginComplete
    }
  }

  // EXTRACTED DUPLICATED LOGIC INTO REUSABLE FUNCTION
  const handleIncubateeRouting = async (userEmail, role) => {
    try {
      const appsSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', userEmail)
        )
      )
      const apps = appsSnap.docs.map(doc => doc.data())

      if (apps.length === 0) {
        navigate('/incubatee/sme')
        return
      }
      
      const pending = apps.find(
        app =>
          app.applicationStatus?.toLowerCase?.() === 'pending' ||
          !app.applicationStatus
      )
      const accepted = apps.find(
        app => app.applicationStatus?.toLowerCase?.() === 'accepted'
      )

      if (pending) {
        navigate('/incubatee/tracker')
        return
      }
      if (accepted) {
        navigate(`/${role}`)
        return
      }
      navigate('/incubatee/sme')
    } catch (error) {
      console.error('Error fetching applications:', error)
      message.error('Failed to check application status. Please try again.')
      // Fallback to role-based routing if application check fails
      navigate(`/${role}`)
    }
  }

  const handleLogin = async values => {
    try {
      setLoading(true)
      const userCred = await signInWithEmailAndPassword(
        auth,
        values.email,
        values.password
      )
      const user = userCred.user

      const result = await checkUser(user)
      if (result.error) {
        message.error(result.message)
        return
      }

      const { role, firstLoginComplete } = result

      if (role === 'incubatee') {
        await handleIncubateeRouting(user.email, role)
        return
      }
      
      if (role === 'director' && !firstLoginComplete) {
        navigate('/director/onboarding')
      } else {
        navigate(`/${role}`)
      }
    } catch (error) {
      console.error(error)
      message.error(formatFirebaseError(error))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true)
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const userData = await checkUser(user)
      if (userData.error) {
        message.error(userData.message)
        return
      }

      const { role, firstLoginComplete } = userData
      if (!supportedRoles.includes(role)) {
        message.error(`🚫 The role "${role}" is not recognized.`)
        return
      }
      message.success('✅ Google login successful! Redirecting...', 1.5)
      setRedirecting(true)

      if (role === 'incubatee') {
        await handleIncubateeRouting(user.email, role)
        return
      }

      if (role === 'director' && !firstLoginComplete) {
        navigate('/director/onboarding')
      } else {
        navigate(`/${role}`)
      }
    } catch (error) {
      console.error('Google login failed:', error)
      message.error(formatFirebaseError(error))
    } finally {
      setGoogleLoading(false)
      setRedirecting(false) // Ensure redirecting state is reset
    }
  }

  return (
    <Spin spinning={loading || googleLoading || redirecting} size='large'>
      <Helmet>
        <title>Login | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Log in to your Smart Incubation account to access tailored tools and resources for entrepreneurs, consultants, and administrators.'
        />
      </Helmet>
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
            width: 700,
            minWidth: 300,
            minHeight: 310, // shorter height
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
              minWidth: 210,
              background: 'linear-gradient(135deg, #24b6d7 60%, #18d19a 100%)',
              borderTopLeftRadius: 16,
              borderBottomLeftRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '24px 14px'
            }}
          >
            <div style={{ width: '100%', maxWidth: 220 }}>
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
                To gain access, kindly create an account below.
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
                onClick={() => navigate('/registration')}
              >
                SIGN UP
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
              padding: '40px 32px'
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
                Login to your account
              </Title>

              <Form
                layout='vertical'
                form={form}
                onFinish={handleLogin}
                requiredMark={false}
                style={{ marginTop: 15 }}
              >
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
                    { required: true, message: 'Please enter your password' }
                  ]}
                  style={{ marginBottom: 10 }}
                >
                  <Input.Password
                    placeholder='Enter your password'
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
                    LOGIN
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
                  or use your Google Account for access:
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
                      background: '#fff'
                    }}
                    onClick={handleGoogleLogin}
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
