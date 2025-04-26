import React, { useState } from 'react'
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
import { doc, updateDoc } from 'firebase/firestore'
import { Modal } from 'antd'

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
  const { interventionId } = useParams<{ interventionId: string }>()

  const handleUpload = () => {
    setUploaded(true)
    message.success('File uploaded')
  }

  const handleUpdateProgress = async () => {
    if (currentHours && currentProgress) {
      const newTime = totalTimeSpent + currentHours
      const newProgress = Math.min(totalProgress + currentProgress, 100)

      try {
        if (!interventionId) {
          message.error('No intervention ID found')
          return
        }

        const interventionRef = doc(db, 'assignedInterventions', interventionId)
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
      if (!interventionId) {
        message.error('No intervention ID found')
        return
      }

      const interventionRef = doc(db, 'assignedInterventions', interventionId)
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
    <Card title='Track Intervention Progress'>
      <Title level={5}>Intervention: Website Development</Title>
      <Paragraph>Company: BrightTech</Paragraph>

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
  )
}
