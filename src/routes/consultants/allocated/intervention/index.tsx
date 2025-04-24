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

const { Title, Paragraph } = Typography
const { TextArea } = Input

export const InterventionTrack: React.FC = () => {
  const [notes, setNotes] = useState('')
  const [uploaded, setUploaded] = useState(false)
  const [totalTimeSpent, setTotalTimeSpent] = useState(0)
  const [totalProgress, setTotalProgress] = useState(0)
  const [currentHours, setCurrentHours] = useState<number | null>(null)
  const [currentProgress, setCurrentProgress] = useState<number | null>(null)

  const handleUpload = () => {
    setUploaded(true)
    message.success('File uploaded')
  }

  const handleUpdateProgress = () => {
    if (currentHours && currentProgress) {
      const newTime = totalTimeSpent + currentHours
      const newProgress = Math.min(totalProgress + currentProgress, 100)

      setTotalTimeSpent(newTime)
      setTotalProgress(newProgress)
      setCurrentHours(null)
      setCurrentProgress(null)
      message.success('Progress updated successfully')
    } else {
      message.warning('Please enter both hours and percentage')
    }
  }

  const handleSubmit = () => {
    message.success('Intervention marked as complete')
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

        <Button
          type='primary'
          onClick={handleUpdateProgress}
          style={{ marginBottom: 24 }}
        >
          Add Update
        </Button>

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
