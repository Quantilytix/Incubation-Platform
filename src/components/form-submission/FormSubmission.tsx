import React, { useState, useEffect } from 'react'
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Typography,
  Space,
  Divider,
  App,
  Upload,
  DatePicker,
  Checkbox,
  Radio,
  Alert,
  Result,
  Rate
} from 'antd'
import {
  ArrowLeftOutlined,
  UploadOutlined,
  SendOutlined,
  LoadingOutlined,
  SaveOutlined
} from '@ant-design/icons'
import {
  doc,
  getDoc,
  collection,
  updateDoc,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/firebase'
import { useGetIdentity } from '@refinedev/core'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

// ---------- Types ----------
interface FormField {
  id: string
  type: string
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
  description?: string
  defaultValue?: any
  name?: string
}

interface FormTemplate {
  id?: string
  title: string
  description: string
  fields: FormField[]
  status: 'draft' | 'published'
  category: string
}

interface FormAssignment {
  id?: string
  templateId: string
  applicationId: string
  recipientEmail?: string
  status: 'pending' | 'in_progress' | 'submitted'
  deliveryMethod: 'in_app' | 'email'
  linkToken?: string
  createdAt: string
  templateSnapshot?: FormTemplate
  draftAnswers?: Record<string, any>
}

interface UserIdentity {
  id?: string
  name?: string
  email?: string
  applicationId?: string
}

const isHeading = (f: FormField) => f.type === 'heading'

// Deterministic response id => guarantees one response per assignment OR per (template,user)
const responseIdFor = (args: {
  assignmentId?: string | null
  templateId?: string | null
  userId?: string | null
}) => {
  if (args.assignmentId) return `as:${args.assignmentId}`
  return `tpl:${args.templateId || 'unknown'}:user:${args.userId || 'anon'}`
}

// ---------- Component ----------
export default function FormSubmission () {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const { id } = useParams<{ id?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: user } = useGetIdentity<UserIdentity>()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [fileUploads, setFileUploads] = useState<Record<string, any>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submissionId, setSubmissionId] = useState<string | null>(null)

  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [assignment, setAssignment] = useState<FormAssignment | null>(null)

  const [backingOut, setBackingOut] = useState(false)

  const handleBackToDashboard = async () => {
    try {
      setBackingOut(true)
      // Save draft only if this is an assignment-based submission
      if (assignment?.id) {
        await saveDraft()
      }
    } catch (e) {
      // We still allow navigation so user isn't trapped; they already saw a toast from saveDraft
      console.error(
        'Back to dashboard: draft save failed (continuing to navigate).',
        e
      )
    } finally {
      setBackingOut(false)
      navigate('/incubatee')
    }
  }

  // simple session lock key to avoid super-quick double-submits in same tab
  const lockKey = id ? `form-submit-lock:${id}` : null

  // ---------- Load (assignment-first, fallback to formId) ----------
  const token = searchParams.get('token') || undefined
  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true)

        if (!id) {
          throw new Error('No form reference provided.')
        }

        // Try to load as an ASSIGNMENT first
        const asRef = doc(db, 'formAssignments', id)
        const asSnap = await getDoc(asRef)

        if (asSnap.exists()) {
          const asData = { id: asSnap.id, ...(asSnap.data() as FormAssignment) }
          setAssignment(asData)

          // Optional: access check
          if (
            user?.applicationId &&
            user.applicationId !== asData.applicationId
          ) {
            throw new Error('You do not have access to this assignment.')
          }

          // If this was an email delivery, verify token
          const emailToken = searchParams.get('token')
          if (
            asData.deliveryMethod === 'email' &&
            asData.linkToken &&
            emailToken !== asData.linkToken
          ) {
            throw new Error('This email link is invalid or has expired.')
          }

          // Resolve template (snapshot if present)
          if (asData.templateSnapshot) {
            setTemplate({
              ...asData.templateSnapshot,
              id: asData.templateSnapshot.id || asData.templateId
            })
          } else {
            const tSnap = await getDoc(
              doc(db, 'formTemplates', asData.templateId)
            )
            if (!tSnap.exists()) throw new Error('Form template not found')
            setTemplate({ id: tSnap.id, ...(tSnap.data() as FormTemplate) })
          }

          // Prefill draft answers
          if (asData.draftAnswers) {
            form.setFieldsValue(asData.draftAnswers)
          }
        } else {
          // Not an assignment — treat id as TEMPLATE id
          const tSnap = await getDoc(doc(db, 'formTemplates', id))
          if (!tSnap.exists()) throw new Error('Form not found')
          const tData = { id: tSnap.id, ...(tSnap.data() as FormTemplate) }
          if (tData.status !== 'published') {
            throw new Error('This form is not available for submission.')
          }
          setTemplate(tData)
        }
      } catch (e: any) {
        console.error(e)
        message.error(e.message || 'Failed to load survey.')
        navigate('/incubatee')
      } finally {
        setLoading(false)
      }
    }

    boot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.applicationId, token])

  // ---------- Helpers ----------
  const fieldRules = (f: FormField) => {
    const rules: any[] = []
    if (f.required && !isHeading(f))
      rules.push({ required: true, message: `${f.label} is required` })
    if (f.type === 'email')
      rules.push({ type: 'email', message: 'Please enter a valid email' })
    return rules
  }

  const normalizeValue = (val: any) => {
    if (dayjs.isDayjs(val)) return (val as Dayjs).toISOString()
    return val
  }

  const handleFileChange = (fieldId: string, info: any) => {
    setFileUploads(prev => ({ ...prev, [fieldId]: info }))
  }

  const uploadOne = async (fieldId: string, file: File) => {
    const key = assignment?.id || template?.id || 'form'
    const storageRef = ref(
      storage,
      `form_uploads/${key}/${fieldId}/${file.name}`
    )
    const snap = await uploadBytes(storageRef, file)
    return await getDownloadURL(snap.ref)
  }

  const collectValues = async (): Promise<Record<string, any>> => {
    const raw = form.getFieldsValue(true)
    const out: Record<string, any> = {}

    for (const [k, v] of Object.entries(raw)) {
      out[k] = normalizeValue(v)
    }

    // process file uploads
    for (const [fieldId, info] of Object.entries(fileUploads)) {
      if (info?.fileList?.length) {
        const file = info.fileList[0].originFileObj as File
        if (file) {
          const url = await uploadOne(fieldId, file)
          out[fieldId] = url
        }
      }
    }

    return out
  }

  // ---------- Draft (assignment only) ----------
  const saveDraft = async () => {
    if (!assignment?.id) return

    try {
      setSavingDraft(true)
      const draft = await collectValues()
      await updateDoc(doc(db, 'formAssignments', assignment.id), {
        draftAnswers: draft,
        status: 'in_progress',
        updatedAt: new Date().toISOString()
      })
      message.success('Progress saved')
    } catch (e) {
      console.error(e)
      message.error('Failed to save draft')
    } finally {
      setSavingDraft(false)
    }
  }

  // ---------- Submit (idempotent via transaction) ----------
  const handleSubmit = async () => {
    try {
      // session lock to stop ultra-fast double clicks in same tab
      if (lockKey && sessionStorage.getItem(lockKey)) {
        message.warning('Submission already in progress…')
        return
      }
      if (lockKey) sessionStorage.setItem(lockKey, '1')

      setSubmitting(true)

      const answers = await collectValues()

      const assignmentId = assignment?.id || null
      const templateId = assignment?.templateId || template?.id || null
      const respId = responseIdFor({
        assignmentId,
        templateId,
        userId: user?.id || null
      })

      const respRef = doc(db, 'formResponses', respId)
      const asRef = assignmentId
        ? doc(db, 'formAssignments', assignmentId)
        : null

      await runTransaction(db, async tx => {
        if (asRef) {
          const asSnap = await tx.get(asRef)
          if (!asSnap.exists()) throw new Error('Assignment not found.')
          const as = asSnap.data() as FormAssignment
          if (as.status === 'submitted' || (as as any).responseId) {
            throw new Error('This form was already submitted.')
          }
        }

        const respSnap = await tx.get(respRef)
        if (respSnap.exists()) {
          throw new Error(
            'Duplicate submission detected (response already exists).'
          )
        }

        tx.set(respRef, {
          assignmentId,
          templateId,
          formTitle: template?.title || '',
          submittedBy: {
            id: user?.id || null,
            name: user?.name || null,
            email: user?.email || null
          },
          answers,
          submittedAt: serverTimestamp(),
          status: 'submitted'
        })

        if (asRef) {
          tx.update(asRef, {
            status: 'submitted',
            responseId: respId,
            submittedAt: serverTimestamp()
          })
        }
      })

      setSubmissionId(respId)
      setSubmitted(true)
      form.resetFields()
      setFileUploads({})
    } catch (e: any) {
      console.error(e)
      const msg =
        e?.message?.includes('already') || e?.message?.includes('Duplicate')
          ? 'This form has already been submitted.'
          : e.message || 'Failed to submit form'
      message.error(msg)
    } finally {
      setSubmitting(false)
      if (lockKey) sessionStorage.removeItem(lockKey)
    }
  }

  // ---------- Render controls ----------
  const renderField = (f: FormField) => {
    if (isHeading(f)) {
      return (
        <div key={f.id} style={{ margin: '24px 0' }}>
          <Title level={4} style={{ marginBottom: 4 }}>
            {f.label}
          </Title>
          {f.description ? (
            <Paragraph type='secondary' style={{ marginBottom: 0 }}>
              {f.description}
            </Paragraph>
          ) : null}
          <Divider style={{ margin: '12px 0 0' }} />
        </div>
      )
    }

    const itemProps = {
      label: f.label,
      name: f.id,
      key: f.id,
      tooltip: f.description,
      rules: fieldRules(f)
    } as const

    switch (f.type) {
      case 'text':
        return (
          <Form.Item {...itemProps}>
            <Input placeholder={f.placeholder} />
          </Form.Item>
        )
      case 'textarea':
        return (
          <Form.Item {...itemProps}>
            <TextArea rows={4} placeholder={f.placeholder} />
          </Form.Item>
        )
      case 'number':
        return (
          <Form.Item {...itemProps}>
            <Input type='number' placeholder={f.placeholder} />
          </Form.Item>
        )
      case 'email':
        return (
          <Form.Item {...itemProps}>
            <Input type='email' placeholder={f.placeholder} />
          </Form.Item>
        )
      case 'select':
        return (
          <Form.Item {...itemProps}>
            <Select placeholder={f.placeholder}>
              {(f.options || []).map((opt, i) => (
                <Option key={i} value={opt}>
                  {opt}
                </Option>
              ))}
            </Select>
          </Form.Item>
        )
      case 'checkbox':
        return (
          <Form.Item {...itemProps} valuePropName='value'>
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction='vertical'>
                {(f.options || []).map((opt, i) => (
                  <Checkbox key={i} value={opt}>
                    {opt}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        )
      case 'radio':
        return (
          <Form.Item {...itemProps}>
            <Radio.Group>
              <Space direction='vertical'>
                {(f.options || []).map((opt, i) => (
                  <Radio key={i} value={opt}>
                    {opt}
                  </Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>
        )
      case 'date':
        return (
          <Form.Item {...itemProps}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        )
      case 'file':
        return (
          <Form.Item
            {...itemProps}
            valuePropName='fileList'
            getValueFromEvent={e => e?.fileList}
          >
            <Upload
              listType='text'
              maxCount={1}
              beforeUpload={() => false}
              onChange={info => handleFileChange(f.id, info)}
            >
              <Button icon={<UploadOutlined />}>Upload File</Button>
            </Upload>
          </Form.Item>
        )
      case 'rating':
        return (
          <Form.Item {...itemProps}>
            <Rate />
          </Form.Item>
        )
      default:
        return null
    }
  }

  // ---------- UI ----------
  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 48, minHeight: '100vh' }}>
        <Space direction='vertical' align='center'>
          <LoadingOutlined style={{ fontSize: 32 }} />
          <Text>Loading form…</Text>
        </Space>
      </Card>
    )
  }

  if (submitted) {
    return (
      <Card style={{ minHeight: '100vh' }}>
        <Result
          status='success'
          title='Form Submitted Successfully!'
          subTitle={
            <div>
              <p>Your submission has been received.</p>
              {submissionId ? <p>Submission ID: {submissionId}</p> : null}
            </div>
          }
          extra={[
            <Button
              type='primary'
              key='dashboard'
              onClick={() => navigate('/incubatee')}
            >
              Back to Dashboard
            </Button>
          ]}
        />
      </Card>
    )
  }

  if (!template) {
    return (
      <Card>
        <Alert
          type='error'
          message='Error'
          description='Could not load the requested form.'
          showIcon
        />
      </Card>
    )
  }

  return (
    <Card style={{ minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToDashboard}
          loading={backingOut || savingDraft}
          disabled={submitting}
        >
          Back to Dashboard (Save Draft)
        </Button>
      </div>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ marginBottom: 8 }}>
          {template.title}
        </Title>
        <Paragraph>{template.description}</Paragraph>
      </div>

      <Form form={form} layout='vertical' requiredMark>
        {template.fields?.length ? (
          template.fields.map(renderField)
        ) : (
          <Text type='secondary'>No fields available</Text>
        )}

        <Divider />

        <div
          style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}
        >
          <Space>
            {assignment?.id && (
              <Button
                icon={<SaveOutlined />}
                onClick={saveDraft}
                loading={savingDraft}
                disabled={submitting}
              >
                Save progress
              </Button>
            )}
          </Space>
          <Space>
            <Button
              type='primary'
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting}
              icon={<SendOutlined />}
            >
              Submit
            </Button>
          </Space>
        </div>
      </Form>
    </Card>
  )
}
