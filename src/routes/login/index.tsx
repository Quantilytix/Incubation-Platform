import {
  EyeInvisibleOutlined,
  EyeTwoTone,
  GoogleOutlined
} from '@ant-design/icons'
import { Button, Form, Input, Typography, message, Spin } from 'antd'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ThemedTitleV2 } from '@refinedev/antd'
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'

const { Title } = Typography

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [loading, setLoading] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)
  const [redirecting, setRedirecting] = React.useState(false)

  React.useEffect(() => {
    document.title = 'Login • Incubation Platform'
  }, [])

  const normalizeRole = (role: string): string => {
    return role.toLowerCase().replace(/\s+/g, '')
  }

  const supportedRoles = [
    'admin',
    'funder',
    'consultant',
    'incubatee',
    'operations',
    'director',
    'projectadmin'
  ]

  async function checkUser (user) {
    const userRef = doc(db, 'users', user.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      // Don't auto-create! The user must be pre-registered
      return {
        error: true,
        message: '🚫 User not found in the system. Please contact the admin.'
      }
    }

    const data = userSnap.data()

    return {
      role: normalizeRole(data.role || ''),
      firstLoginComplete: !!data.firstLoginComplete
    }
  }

  const handleLogin = async (values: any) => {
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

      console.log('✅ Role:', role)
      console.log('🧭 firstLoginComplete:', firstLoginComplete)

      if (!supportedRoles.includes(role)) {
        message.error(`🚫 The role "${role}" is not recognized.`)
        return
      }

      message.success('🎉 Login successful! Redirecting...', 1.5)
      setRedirecting(true)

      if (role === 'director' && !firstLoginComplete) {
        navigate('/director/onboarding')
      } else {
        navigate(`/${role}`)
      }
    } catch (error: any) {
      console.error(error)
      message.error('Invalid email or password.')
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

      console.log('✅ Role:', role)
      console.log('🧭 firstLoginComplete:', firstLoginComplete)

      if (!supportedRoles.includes(role)) {
        message.error(`🚫 The role "${role}" is not recognized.`)
        return
      }

      message.success('✅ Google login successful! Redirecting...', 1.5)
      setRedirecting(true)

      if (role === 'director' && !firstLoginComplete) {
        navigate('/director/onboarding')
      } else {
        navigate(`/${role}`)
      }
    } catch (error: any) {
      console.error('Google login failed:', error)
      message.error('Google login failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <Spin spinning={loading || googleLoading || redirecting} size='large'>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          backgroundImage: `url("/assets/images/wave-bg.gif")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          animation: 'fadeIn 0.7s ease-in-out',
          position: 'relative'
        }}
      >
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

        <div
          style={{
            maxWidth: 400,
            width: '100%',
            padding: '48px 32px',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            background: '#ffffffee',
            animation: 'fadeInUp 0.6s ease-out',
            backdropFilter: 'blur(5px)'
          }}
        >
          <Form
            layout='vertical'
            form={form}
            onFinish={handleLogin}
            requiredMark={false}
          >
            <Title
              level={4}
              style={{ textAlign: 'center', marginTop: 16, color: '#1677ff' }}
            >
              Welcome back
            </Title>

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
                { required: true, message: 'Please enter your password' }
              ]}
            >
              <Input.Password
                placeholder='Enter your password'
                iconRender={visible =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item>
              <Button type='primary' htmlType='submit' block loading={loading}>
                Log In
              </Button>
            </Form.Item>

            <Form.Item>
              <Button
                icon={<GoogleOutlined />}
                onClick={handleGoogleLogin}
                style={{ width: '100%' }}
                loading={googleLoading}
              >
                Login with Google
              </Button>
            </Form.Item>
          </Form>

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            Don’t have an account?{' '}
            <a
              onClick={() => navigate('/registration')}
              style={{ fontWeight: 500 }}
            >
              Register
            </a>
          </div>
        </div>

        <img
          src='/assets/images/QuantilytixO.png'
          alt='Quantilytix Logo'
          style={{
            position: 'absolute',
            bottom: 24,
            right: 15,
            height: 50,
            opacity: 0.9
          }}
        />
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
            `}
      </style>
    </Spin>
  )
}
