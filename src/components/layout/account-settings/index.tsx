import { CloseOutlined, LockOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Form,
  Input,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
  message
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { getNameInitials } from '@/utilities'
import { auth, db, storage } from '@/firebase'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
  updateProfile
} from 'firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import SignatureCanvas from 'react-signature-canvas'
import html2canvas from 'html2canvas'

const { Title, Text } = Typography
const { Option } = Select

type Props = {
  opened: boolean
  setOpened: (opened: boolean) => void
  userId: string
}

const fontOptions = ['Dancing Script', 'Great Vibes']

export const AccountSettings = ({ opened, setOpened, userId }: Props) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userData, setUserData] = useState<any>(null)

  // ✅ Password Change Toggle
  const [changingPassword, setChangingPassword] = useState(false)

  // ✅ Signature State
  const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | null>(
    null
  )
  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [typedName, setTypedName] = useState('')
  const [typedFont, setTypedFont] = useState(fontOptions[0])
  const canvasRef = useRef<any>()
  const styledRef = useRef<HTMLDivElement>(null)

  const closeModal = () => setOpened(false)

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true)
      try {
        const docRef = doc(db, 'users', userId)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          form.setFieldsValue({ name: data.name, email: data.email })
          setUserData(data)
          setSignatureImage(data.signatureURL || null)
        }
      } catch (error) {
        message.error('Failed to load user profile.')
        console.error('User account error:', error)
      } finally {
        setLoading(false)
      }
    }

    if (opened && userId) fetchUserData()
  }, [opened, userId])

  const saveTypedSignature = async () => {
    if (!styledRef.current) return
    const canvas = await html2canvas(styledRef.current)
    setSignatureImage(canvas.toDataURL('image/png'))
    message.success('Typed signature generated!')
  }

  const saveDrawnSignature = () => {
    const dataURL = canvasRef.current.toDataURL('image/png')
    setSignatureImage(dataURL)
    message.success('Drawn signature saved!')
  }

  const clearDrawnSignature = () => {
    canvasRef.current.clear()
    setSignatureImage(null)
  }

  const uploadSignature = async (): Promise<string | null> => {
    if (!signatureImage) return null
    const blob = await (await fetch(signatureImage)).blob()
    const fileName = `signatures/${userId}_${Date.now()}.png`
    const fileRef = ref(storage, fileName)
    await uploadBytes(fileRef, blob)
    return await getDownloadURL(fileRef)
  }

  const handleSave = async (values: any) => {
    try {
      setSaving(true)
      const user = auth.currentUser
      if (!user) throw new Error('No authenticated user')

      // ✅ Password change only if triggered
      if (changingPassword && values.oldPassword && values.newPassword) {
        const cred = EmailAuthProvider.credential(
          user.email || '',
          values.oldPassword
        )
        await reauthenticateWithCredential(user, cred)
        await updatePassword(user, values.newPassword)
      }

      await updateProfile(user, { displayName: values.name })

      if (user.email !== values.email) {
        await updateEmail(user, values.email)
      }

      const signatureURL = await uploadSignature()

      const docRef = doc(db, 'users', user.uid)
      await updateDoc(docRef, {
        name: values.name,
        email: values.email,
        ...(signatureURL && { signatureURL })
      })

      message.success('Profile updated successfully!')
      setOpened(false)
    } catch (error: any) {
      console.error(error)
      message.error(error.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      onClose={closeModal}
      open={opened}
      width={800}
      styles={{
        body: { background: '#f5f5f5', padding: 0 },
        header: { display: 'none' }
      }}
    >
      {loading ? (
        <Skeleton
          active
          avatar
          paragraph={{ rows: 4 }}
          style={{ padding: 24 }}
        />
      ) : (
        <>
          {/* ✅ Profile Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              backgroundColor: '#fff'
            }}
          >
            <Space align='center'>
              <Avatar
                size={48}
                style={{ backgroundColor: '#1890ff', fontSize: 18 }}
                src={userData?.photoURL || undefined}
              >
                {getNameInitials(userData?.name)}
              </Avatar>
              <div>
                <strong style={{ fontSize: 16 }}>{userData?.name}</strong>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {userData?.email}
                </div>
              </div>
            </Space>
            <Button type='text' icon={<CloseOutlined />} onClick={closeModal} />
          </div>

          <Divider style={{ margin: 0 }} />

          <div style={{ padding: '16px' }}>
            <Card>
              <Form form={form} layout='vertical' onFinish={handleSave}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label='Name'
                      name='name'
                      rules={[
                        { required: true, message: 'Please enter your name' }
                      ]}
                    >
                      <Input placeholder='Name' />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label='Email'
                      name='email'
                      rules={[
                        { required: true, message: 'Please enter your email' },
                        { type: 'email', message: 'Enter a valid email' }
                      ]}
                    >
                      <Input placeholder='Email' />
                    </Form.Item>
                  </Col>
                </Row>

                {/* ✅ Toggle for Password Change */}
                <Divider />
                {!changingPassword ? (
                  <Button
                    icon={<LockOutlined />}
                    onClick={() => setChangingPassword(true)}
                  >
                    Change Password
                  </Button>
                ) : (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label='Old Password'
                          name='oldPassword'
                          rules={[
                            {
                              required: true,
                              message: 'Enter current password'
                            }
                          ]}
                        >
                          <Input.Password />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label='New Password'
                          name='newPassword'
                          rules={[
                            { required: true, message: 'Enter new password' }
                          ]}
                        >
                          <Input.Password />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Button
                      type='text'
                      danger
                      onClick={() => {
                        setChangingPassword(false)
                        form.resetFields(['oldPassword', 'newPassword'])
                      }}
                    >
                      Cancel Password Change
                    </Button>
                  </>
                )}

                {/* ✅ Signature Section */}
                <Divider />
                <Title level={5}>Signature</Title>
                {signatureImage && (
                  <div style={{ marginBottom: 8 }}>
                    <img
                      src={signatureImage}
                      alt='signature'
                      style={{
                        maxWidth: 200,
                        border: '1px solid #ccc',
                        marginBottom: 8
                      }}
                    />
                  </div>
                )}
                <Radio.Group
                  onChange={e => setSignatureType(e.target.value)}
                  value={signatureType}
                  style={{ marginBottom: 16 }}
                >
                  <Radio value='typed'>Typed Signature</Radio>
                  <Radio value='drawn'>Drawn Signature</Radio>
                </Radio.Group>

                {signatureType === 'typed' && (
                  <div style={{ marginTop: 12 }}>
                    {/* Name Input */}
                    <div style={{ marginBottom: 12 }}>
                      <Input
                        placeholder='Your full name'
                        value={typedName}
                        onChange={e => setTypedName(e.target.value)}
                        style={{ maxWidth: 300 }}
                      />
                    </div>

                    {/* Font Selection */}
                    <div style={{ marginBottom: 12 }}>
                      <Select
                        value={typedFont}
                        onChange={val => setTypedFont(val)}
                        style={{ width: 220 }}
                      >
                        {fontOptions.map(f => (
                          <Option key={f} value={f}>
                            {f}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* Preview */}
                    <div
                      ref={styledRef}
                      style={{
                        fontFamily: typedFont,
                        fontSize: 40,
                        padding: '10px 20px',
                        border: '1px dashed #aaa',
                        background: '#fff',
                        marginBottom: 12,
                        display: 'inline-block'
                      }}
                    >
                      {typedName || 'Your styled signature'}
                    </div>

                    {/* Save Button */}
                    <Button
                      onClick={saveTypedSignature}
                      type='primary'
                      style={{ display: 'block' }}
                    >
                      Save Typed Signature
                    </Button>
                  </div>
                )}

                {signatureType === 'drawn' && (
                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        border: '1px dashed #aaa',
                        width: 400,
                        height: 150,
                        marginBottom: 16,
                        position: 'relative',
                        background: '#fff'
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          top: 4,
                          left: 8,
                          color: '#999',
                          fontSize: 12
                        }}
                      >
                        Draw your signature here
                      </span>
                      <SignatureCanvas
                        ref={canvasRef}
                        penColor='black'
                        canvasProps={{
                          width: 400,
                          height: 150,
                          style: { background: 'white' }
                        }}
                      />
                    </div>
                    <Space>
                      <Button onClick={clearDrawnSignature}>Clear</Button>
                      <Button type='primary' onClick={saveDrawnSignature}>
                        Save Drawn Signature
                      </Button>
                    </Space>
                  </div>
                )}

                <Form.Item style={{ marginTop: 16 }}>
                  <Button
                    type='primary'
                    htmlType='submit'
                    loading={saving}
                    style={{ float: 'right' }}
                    icon={<UploadOutlined />}
                  >
                    Save Changes
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </div>
        </>
      )}
    </Drawer>
  )
}
