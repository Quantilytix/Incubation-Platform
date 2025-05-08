import { Form, Input, Button, message, Card } from 'antd'
import React from 'react'
import { updatePassword } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import { useNavigate } from 'react-router-dom'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'

export const DirectorOnboardingPage: React.FC = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const handleFinish = async (values: any) => {
    try {
      const user = auth.currentUser
      if (!user) throw new Error('No user logged in.')

      // 1. Reauthenticate
      const credential = EmailAuthProvider.credential(
        user.email || '', // user.email should exist
        values.currentPassword // get from form
      )
      await reauthenticateWithCredential(user, credential)

      // 2. Update profile info
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        name: values.fullName,
        company: values.company,
        companyCode: values.companyCode,
        firstLoginComplete: true
      })

      // 3. Update password
      await updatePassword(user, values.newPassword)

      message.success('🎉 Profile updated successfully!')
      navigate('/director') // Redirect to director dashboard
    } catch (error: any) {
      console.error(error)
      if (error.code === 'auth/wrong-password') {
        message.error('The current password you entered is incorrect.')
      } else {
        message.error('Update failed.')
      }
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
        padding: 24
      }}
    >
      <Card
        title='Complete Your Profile'
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}
      >
        <Form form={form} layout='vertical' onFinish={handleFinish}>
          <Form.Item
            name='fullName'
            label='Full Name'
            rules={[{ required: true, message: 'Please enter your full name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name='company'
            label='Company Name'
            rules={[{ required: true, message: 'Please enter company name' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name='companyCode'
            label='Company Code'
            rules={[
              { required: true, message: 'Please enter company short code' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name='currentPassword'
            label='Current Password'
            rules={[
              { required: true, message: 'Please enter your current password' }
            ]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item
            name='newPassword'
            label='New Password'
            rules={[{ required: true, message: 'Please enter a new password' }]}
          >
            <Input.Password />
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Submit
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
