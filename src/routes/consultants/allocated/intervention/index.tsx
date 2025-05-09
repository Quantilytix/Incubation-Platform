import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Upload,
  Input,
  Button,
  message,
  Progress,
  Form
} from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '@/firebase'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { Modal } from 'antd'
import { Helmet } from 'react-helmet'

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

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) {
        console.warn('No id found in URL params')
        return
      }

      try {
        console.log('Fetching assignedIntervention with ID:', id)

        // 1. Fetch the assigned intervention document
        const interventionRef = doc(db, 'assignedInterventions', id)
        const interventionSnap = await getDoc(interventionRef)

        if (!interventionSnap.exists()) {
          console.error('Assigned Intervention not found for ID:', id)
          message.error('Assigned Intervention not found')
          return
        }

        const interventionData = interventionSnap.data()
        console.log('Fetched assignedIntervention data:', interventionData)

        setInterventionTitle(
          interventionData.interventionTitle || 'Unknown Intervention'
        )
        console.log(
          'Set interventionTitle to:',
          interventionData.interventionTitle || 'Unknown Intervention'
        )

        const participantId = interventionData.participantId
        console.log('participantId from assignedIntervention:', participantId)

        if (participantId) {
          // 2. Fetch the participant document
          const participantRef = doc(db, 'participants', participantId)
          const participantSnap = await getDoc(participantRef)

          if (!participantSnap.exists()) {
            console.error(
              'Participant not found for participantId:',
              participantId
            )
            setCompanyName('Unknown Company')
          } else {
            const participantData = participantSnap.data()
            console.log('Fetched participant data:', participantData)

            setCompanyName(participantData.beneficiaryName || 'Unknown Company')
            console.log(
              'Set companyName to:',
              participantData.beneficiaryName || 'Unknown Company'
            )
          }
        } else {
          console.warn('No participantId found in assignedIntervention')
          setCompanyName('Unknown Company')
        }
      } catch (error) {
        console.error(
          'Error fetching intervention or participant details:',
          error
        )
        message.error('Failed to load intervention/participant details')
      }
    }

    fetchDetails()
  }, [id])

  const handleUpload = () => {
    setUploaded(true)
    message.success('File uploaded')
  }

  const handleUpdateProgress = async () => {
    if (currentHours && currentProgress) {
      const newTime = totalTimeSpent + currentHours
      const newProgress = Math.min(totalProgress + currentProgress, 100)

      try {
        if (!id) {
          message.error('No intervention ID found')
          return
        }

        const interventionRef = doc(db, 'assignedInterventions', id)
        await updateDoc(interventionRef, {
          timeSpent: newTime,
          progress: newProgress,
          notes: notes
        })

        setTotalTimeSpent(newTime)
        setTotalProgress(newProgress)
        setCurrentHours(null)
        setCurrentProgress(null)

        message.success('Progress updated and saved!')

        // Navigate back
        navigate('/consultant/allocated')
      } catch (error) {
        console.error('Error updating intervention:', error)
        message.error('Failed to update progress.')
      }
    } else {
      message.warning('Please enter both hours and percentage')
    }
  }

  const handleSubmit = async () => {
    try {
      if (!id) {
        message.error('No intervention ID found')
        return
      }

      const interventionRef = doc(db, 'assignedInterventions', id)
      await updateDoc(interventionRef, {
        status: 'completed',
        notes: notes,
        timeSpent: totalTimeSpent,
        progress: totalProgress
      })

      message.success('Intervention marked as completed and sent for review!')

      // Navigate back
      navigate('/consultant/allocated')
    } catch (error) {
      console.error('Error completing intervention:', error)
      message.error('Failed to send intervention for review.')
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
            <>
              <Title level={5}>Upload Completion Document</Title>
              <Upload beforeUpload={() => false} onChange={handleUpload}>
                <Button icon={<UploadOutlined />}>Upload File</Button>
              </Upload>

              <Button
                type='primary'
                onClick={handleSubmit}
                disabled={!uploaded}
                style={{ marginTop: 16 }}
              >
                Send For Review
              </Button>
            </>
          )}
        </Form>
      </Card>
    </>
  )
}
