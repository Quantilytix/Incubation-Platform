import { CloseOutlined, LockOutlined, UploadOutlined } from '@ant-design/icons'
import {
    Avatar,
    Button,
    Card,
    Col,
    Divider,
    Form,
    Input,
    Modal,
    Radio,
    Row,
    Select,
    Skeleton,
    Space,
    Typography,
    Upload,
    message
} from 'antd'
import type { UploadRequestOption as RcCustomRequestOptions } from 'rc-upload/lib/interface'
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
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
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
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [userData, setUserData] = useState<any>(null)

    const [changingPassword, setChangingPassword] = useState(false)

    const [signatureType, setSignatureType] = useState<'typed' | 'drawn' | null>(null)
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
    }, [opened, userId, form])

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

    const handlePhotoUpload = async (options: RcCustomRequestOptions) => {
        const file = options.file as File
        if (!userId) {
            options.onError?.(new Error('Missing user id'))
            return
        }

        if (!file.type.startsWith('image/')) {
            message.error('Please upload an image file.')
            options.onError?.(new Error('Not an image'))
            return
        }

        const maxBytes = 5 * 1024 * 1024
        if (file.size > maxBytes) {
            message.error('Image is too large (max 5MB).')
            options.onError?.(new Error('File too large'))
            return
        }

        try {
            setUploadingPhoto(true)

            const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
            const path = `users/${userId}/avatar_${Date.now()}.${ext}`
            const fileRef = ref(storage, path)

            await uploadBytes(fileRef, file, { contentType: file.type })
            const url = await getDownloadURL(fileRef)

            await updateDoc(doc(db, 'users', userId), {
                photoUrl: url,
                updatedAt: serverTimestamp()
            })

            if (auth.currentUser?.uid === userId) {
                await updateProfile(auth.currentUser, { photoURL: url })
            }

            setUserData((prev: any) => ({ ...(prev || {}), photoUrl: url }))
            message.success('Profile photo updated.')
            options.onSuccess?.({ url }, file)
        } catch (err: any) {
            console.error(err)
            message.error(err?.message || 'Failed to upload photo.')
            options.onError?.(err)
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleSave = async (values: any) => {
        try {
            setSaving(true)
            const user = auth.currentUser
            if (!user) throw new Error('No authenticated user')

            if (changingPassword && values.oldPassword && values.newPassword) {
                const cred = EmailAuthProvider.credential(user.email || '', values.oldPassword)
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
                ...(signatureURL && { signatureURL }),
                updatedAt: serverTimestamp()
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

    const avatarSrc =
        userData?.photoUrl && String(userData.photoUrl).trim() !== ''
            ? userData.photoUrl
            : userData?.photoURL && String(userData.photoURL).trim() !== ''
                ? userData.photoURL
                : undefined

    return (
        <Modal
            open={opened}
            onCancel={closeModal}
            footer={null}
            width={860}
            closeIcon={null}
            destroyOnClose
            styles={{ body: { padding: 0, background: '#f5f5f5' } }}
        >
            {loading ? (
                <Skeleton active avatar paragraph={{ rows: 4 }} style={{ padding: 24 }} />
            ) : (
                <>
                    {/* Profile Header */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 16,
                            backgroundColor: '#fff'
                        }}
                    >
                        <Space align="center" style={{ gap: 14 }}>
                            <Avatar
                                size={72}
                                style={{ backgroundColor: '#1890ff', fontSize: 22 }}
                                src={avatarSrc}
                            >
                                {getNameInitials(userData?.name)}
                            </Avatar>

                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <strong style={{ fontSize: 16 }}>{userData?.name}</strong>

                                    <Upload
                                        accept="image/*"
                                        showUploadList={false}
                                        customRequest={handlePhotoUpload}
                                        disabled={uploadingPhoto}
                                    >
                                        <Button
                                            icon={<UploadOutlined />}
                                            loading={uploadingPhoto}
                                            style={{ borderRadius: 999 }}
                                        >
                                            Change photo
                                        </Button>
                                    </Upload>
                                </div>

                                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                                    {userData?.email}
                                </div>
                            </div>
                        </Space>

                        <Button type="text" icon={<CloseOutlined />} onClick={closeModal} />
                    </div>


                    <Card>
                        <Form form={form} layout="vertical" onFinish={handleSave}>
                            <Row gutter={16}>
                                <Col span={12}>
                                    <Form.Item
                                        label="Name"
                                        name="name"
                                        rules={[{ required: true, message: 'Please enter your name' }]}
                                    >
                                        <Input placeholder="Name" />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        label="Email"
                                        name="email"
                                        rules={[
                                            { required: true, message: 'Please enter your email' },
                                            { type: 'email', message: 'Enter a valid email' }
                                        ]}
                                    >
                                        <Input placeholder="Email" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            {/* Password */}
                            <Divider />
                            {!changingPassword ? (
                                <Button icon={<LockOutlined />} onClick={() => setChangingPassword(true)}>
                                    Change Password
                                </Button>
                            ) : (
                                <>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Form.Item
                                                label="Old Password"
                                                name="oldPassword"
                                                rules={[{ required: true, message: 'Enter current password' }]}
                                            >
                                                <Input.Password />
                                            </Form.Item>
                                        </Col>
                                        <Col span={12}>
                                            <Form.Item
                                                label="New Password"
                                                name="newPassword"
                                                rules={[{ required: true, message: 'Enter new password' }]}
                                            >
                                                <Input.Password />
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                    <Button
                                        type="text"
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

                            {/* Signature */}
                            <Divider />
                            <Title level={5} style={{ marginBottom: 8 }}>
                                Signature
                            </Title>

                            {signatureImage && (
                                <div style={{ marginBottom: 8 }}>
                                    <img
                                        src={signatureImage}
                                        alt="signature"
                                        style={{
                                            maxWidth: 260,
                                            border: '1px solid #ccc',
                                            borderRadius: 8,
                                            background: '#fff'
                                        }}
                                    />
                                </div>
                            )}

                            <Radio.Group
                                onChange={e => setSignatureType(e.target.value)}
                                value={signatureType}
                                style={{ marginBottom: 16 }}
                            >
                                <Radio value="typed">Typed Signature</Radio>
                                <Radio value="drawn">Drawn Signature</Radio>
                            </Radio.Group>

                            {signatureType === 'typed' && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ marginBottom: 12 }}>
                                        <Input
                                            placeholder="Your full name"
                                            value={typedName}
                                            onChange={e => setTypedName(e.target.value)}
                                            style={{ maxWidth: 320 }}
                                        />
                                    </div>

                                    <div style={{ marginBottom: 12 }}>
                                        <Select
                                            value={typedFont}
                                            onChange={val => setTypedFont(val)}
                                            style={{ width: 240 }}
                                        >
                                            {fontOptions.map(f => (
                                                <Option key={f} value={f}>
                                                    {f}
                                                </Option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div
                                        ref={styledRef}
                                        style={{
                                            fontFamily: typedFont,
                                            fontSize: 44,
                                            padding: '10px 20px',
                                            border: '1px dashed #aaa',
                                            background: '#fff',
                                            marginBottom: 12,
                                            display: 'inline-block',
                                            borderRadius: 10
                                        }}
                                    >
                                        {typedName || 'Your styled signature'}
                                    </div>

                                    <Button onClick={saveTypedSignature} type="primary" style={{ display: 'block' }}>
                                        Save Typed Signature
                                    </Button>
                                </div>
                            )}

                            {signatureType === 'drawn' && (
                                <div style={{ marginTop: 12 }}>
                                    <div
                                        style={{
                                            border: '1px dashed #aaa',
                                            width: 460,
                                            height: 170,
                                            marginBottom: 16,
                                            position: 'relative',
                                            background: '#fff',
                                            borderRadius: 10,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: 6,
                                                left: 10,
                                                color: '#999',
                                                fontSize: 12,
                                                zIndex: 1
                                            }}
                                        >
                                            Draw your signature here
                                        </span>
                                        <SignatureCanvas
                                            ref={canvasRef}
                                            penColor="black"
                                            canvasProps={{
                                                width: 460,
                                                height: 170,
                                                style: { background: 'white' }
                                            }}
                                        />
                                    </div>
                                    <Space>
                                        <Button onClick={clearDrawnSignature}>Clear</Button>
                                        <Button type="primary" onClick={saveDrawnSignature}>
                                            Save Drawn Signature
                                        </Button>
                                    </Space>
                                </div>
                            )}

                            <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
                                <Button
                                    type="primary"
                                    htmlType="submit"
                                    loading={saving}
                                    style={{ float: 'right', borderRadius: 999 }}
                                    icon={<UploadOutlined />}
                                >
                                    Save Changes
                                </Button>
                            </Form.Item>

                            <div style={{ clear: 'both' }} />
                        </Form>
                    </Card>
                </>
            )}
        </Modal>
    )
}
