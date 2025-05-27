import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Upload,
  Input,
  Button,
  message,
  Progress,
  Form,
  Tag
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '@/firebase'
import { doc, updateDoc, getDoc, addDoc, collection } from 'firebase/firestore'
import { Modal } from 'antd'
import { Helmet } from 'react-helmet'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { SHA256 } from 'crypto-js'

const { Title, Paragraph } = Typography
const { TextArea } = Input

export const InterventionTrack: React.FC = () => {
  const [notes, setNotes] = useState('')
  const [uploaded, setUploaded] = useState(false)
  const [totalTimeSpent, setTotalTimeSpent] = useState(0)
  const [totalProgress, setTotalProgress] = useState(0)
  const [currentHours, setCurrentHours] = useState<number | null>(null)
  const [currentProgress, setCurrentProgress] = useState<number | null>(null)
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [interventionTitle, setInterventionTitle] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return

      try {
        const interventionRef = doc(db, 'assignedInterventions', id)
        const snap = await getDoc(interventionRef)

        if (!snap.exists()) {
          message.error('Assigned Intervention not found')
          return
        }

        const data = snap.data()

        setInterventionTitle(data.interventionTitle || 'Unknown Intervention')
        setTotalTimeSpent(data.timeSpent || 0)
        setTotalProgress(data.progress || 0)
        setNotes(data.notes || '')

        // Fetch participant company name
        if (data.participantId) {
          const participantSnap = await getDoc(
            doc(db, 'participants', data.participantId)
          )
          if (participantSnap.exists()) {
            const pData = participantSnap.data()
            setCompanyName(pData.beneficiaryName || 'Unknown Company')
          } else {
            setCompanyName('Unknown Company')
          }
        }
      } catch (err) {
        console.error('Failed to fetch data', err)
        message.error('Could not load intervention details.')
      }
    }

    fetchDetails()
  }, [id])

  const handleUpload = () => {
    setUploaded(true)
    message.success('File uploaded')
  }

  const handleUpdateProgress = async () => {
    if (currentHours == null || currentProgress == null) {
      message.warning('Please enter both hours and percentage')
      return
    }

    const newTime = totalTimeSpent + currentHours
    const newProgress = Math.min(totalProgress + currentProgress, 100)

    try {
      const interventionRef = doc(db, 'assignedInterventions', id!)
      await updateDoc(interventionRef, {
        timeSpent: newTime,
        progress: newProgress,
        notes
      })

      setTotalTimeSpent(newTime)
      setTotalProgress(newProgress)
      setCurrentHours(null)
      setCurrentProgress(null)

      message.success('Progress updated.')

      // ⏳ Auto-prompt for completion if 100% reached
      if (newProgress === 100) {
        setShowCompletionModal(true)
      } else {
        navigate('/consultant/allocated') // Optional: only navigate if not done
      }
    } catch (error) {
      console.error('Error updating intervention:', error)
      message.error('Failed to update progress.')
    }
  }

  const handleSubmit = async () => {
    if (!id || !uploadFile) return

    try {
      const interventionRef = doc(db, 'assignedInterventions', id)
      const interventionSnap = await getDoc(interventionRef)

      if (!interventionSnap.exists()) {
        message.error('Intervention not found')
        return
      }

      const data = interventionSnap.data()

      // 🔼 Upload to Firebase Storage
      const storage = getStorage()
      const storageRef = ref(storage, `interventions/${id}/${uploadFile.name}`)
      const snapshot = await uploadBytes(storageRef, uploadFile)
      const downloadURL = await getDownloadURL(snapshot.ref)

      // ✅ Update Firestore with completion and POE link
      await updateDoc(interventionRef, {
        consultantCompletionStatus: 'done',
        status: 'pending', // Awaiting confirmation
        notes,
        timeSpent: totalTimeSpent,
        progress: 100,
        resources: [
          {
            type: 'document',
            label: uploadFile.name,
            link: downloadURL
          }
        ]
      })

      // ✅ Save to interventionsDatabase
      // You may want to fetch more data for program, company, participant, etc.
      let participantData = {}
      if (data.participantId) {
        const participantSnap = await getDoc(
          doc(db, 'participants', data.participantId)
        )
        if (participantSnap.exists()) participantData = participantSnap.data()
      }

      await addDoc(collection(db, 'interventionsDatabase'), {
        programId: data.programId || '',
        companyCode: data.companyCode || '',
        interventionId: id,
        interventionTitle: data.interventionTitle || '',
        areaOfSupport: data.areaOfSupport || '',
        participantId: data.participantId,
        beneficiaryName: participantData.beneficiaryName || '',
        hub: participantData.hub || '',
        province: participantData.province || '',
        quarter: 'Q' + (Math.floor(new Date().getMonth() / 3) + 1),
        consultantIds: [data.consultantId],
        timeSpent: totalTimeSpent,
        interventionType: data.interventionType || '',
        targetMetric: data.targetMetric || '',
        targetType: data.targetType || '',
        targetValue: data.targetValue || 0,
        feedback: data.feedback || null,
        confirmedAt: new Date(),
        createdAt: participantData.createdAt || new Date(),
        updatedAt: new Date(),
        interventionKey: SHA256((participantData.email || '') + id)
          .toString()
          .substring(0, 12),
        resources: [
          {
            type: 'document',
            label: uploadFile?.name || 'Evidence Document',
            link: downloadURL
          }
        ]
      })

      // 🔔 Send notification
      await addDoc(collection(db, 'notifications'), {
        type: 'intervention-submitted',
        interventionId: id,
        participantId: data.participantId,
        consultantId: data.consultantId,
        interventionTitle: data.interventionTitle,
        createdAt: new Date(),
        readBy: {},
        recipientRoles: [
          'consultant',
          'incubatee',
          'projectadmin',
          'operations'
        ],
        message: {
          consultant: `You submitted your final work for: ${data.interventionTitle}.`,
          incubatee: `Consultant submitted final work for: ${data.interventionTitle}. Please review.`,
          projectadmin: `Final submission received for intervention: ${data.interventionTitle}.`,
          operations: `Intervention "${data.interventionTitle}" has been marked complete by the consultant.`
        }
      })

      message.success('Intervention submitted and uploaded successfully!')
      setShowCompletionModal(false)
      navigate('/consultant/allocated')
    } catch (err) {
      console.error('Error during final submission:', err)
      message.error('Failed to complete intervention.')
    }
  }

  const handleCancel = () => {
    Modal.confirm({
      title: 'Discard Changes?',
      content:
        'Are you sure you want to cancel and discard all unsaved changes?',
      okText: 'Yes, Cancel',
      cancelText: 'No',
      onOk: () => {
        navigate('/consultant/allocated')
      }
    })
  }

  return (
    <>
      <Helmet>
        <title>Track Intervention Progress | Consultant Workspace</title>
        <meta
          name='description'
          content='Track and update progress on assigned interventions. Submit your final work for review.'
        />
      </Helmet>
      <Card title='Track Intervention Progress'>
        <Title level={5}>Intervention: {interventionTitle}</Title>
        <Paragraph>Company: {companyName}</Paragraph>

        {/* Cumulative display */}
        <Form layout='vertical'>
          <Form.Item label='Total Time Spent'>
            <Input value={`${totalTimeSpent} hours`} disabled />
          </Form.Item>

          <Form.Item label='Overall Progress'>
            <Progress
              percent={totalProgress}
              status={totalProgress === 100 ? 'success' : 'active'}
            />
          </Form.Item>

          {/* Incremental update */}
          <Form.Item label="Today's Time Spent (hours)">
            <Input
              type='number'
              value={currentHours ?? ''}
              onChange={e => setCurrentHours(Number(e.target.value))}
              placeholder='e.g. 4'
              min={0}
            />
          </Form.Item>

          <Form.Item label="Today's Progress (%)">
            <Input
              type='number'
              value={currentProgress ?? ''}
              onChange={e => {
                const val = Number(e.target.value)
                setCurrentProgress(val > 100 ? 100 : val)
              }}
              placeholder='e.g. 25'
              min={0}
              max={100}
            />
          </Form.Item>

          <Form.Item label='Progress Notes / Results'>
            <TextArea
              rows={4}
              placeholder='Add notes or results here...'
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Form.Item>
          <Form.Item>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button onClick={handleCancel}>Cancel</Button>

              <Button type='primary' onClick={handleUpdateProgress}>
                Add Update
              </Button>
            </div>
          </Form.Item>

          {/* Upload only at 100% */}
          {totalProgress === 100 && (
            <Button type='primary' onClick={() => setShowCompletionModal(true)}>
              Submit Completion Evidence
            </Button>
          )}
        </Form>
      </Card>
      <Modal
        open={showCompletionModal}
        onCancel={() => setShowCompletionModal(false)}
        title='Submit Completion Evidence'
        onOk={handleSubmit}
        okButtonProps={{ disabled: !uploadFile }}
      >
        <Paragraph>
          Please upload your POE (proof of execution) such as final
          deliverables, screenshots, or signed documentation.
        </Paragraph>

        <Upload
          beforeUpload={file => {
            setUploadFile(file)
            return false // prevent auto upload
          }}
          fileList={uploadFile ? [uploadFile] : []}
          onRemove={() => setUploadFile(null)}
        >
          <Button icon={<UploadOutlined />}>Upload Completion Document</Button>
        </Upload>
      </Modal>
    </>
  )
}
