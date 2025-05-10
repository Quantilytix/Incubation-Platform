import React, { useState, useEffect, useRef } from 'react'
import {
  Avatar,
  Input,
  Button,
  List,
  Typography,
  Space,
  Card,
  Spin,
  message as AntdMessage
} from 'antd'
import {
  AudioOutlined,
  PauseOutlined,
  SendOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import { useGetIdentity } from '@refinedev/core'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const { Text } = Typography

const Chat = () => {
  const { data: identity } = useGetIdentity()
  const [userRole, setUserRole] = useState<string | null>(null)

  const [messages, setMessages] = useState<any[]>([
    {
      id: 1,
      sender: 'system',
      avatar: '🤖',
      content: 'Hi there! How can I assist you today?',
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // Audio states
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    if (identity?.id) {
      const fetchRole = async () => {
        const ref = doc(db, 'users', identity.id)
        const snap = await getDoc(ref)
        const role = snap.data()?.role?.toLowerCase?.()
        setUserRole(role || null)
      }
      fetchRole()
    }
  }, [identity])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendToAI = async (query: string) => {
    try {
      const response = await fetch('https://rairo-incu-api.hf.space/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: identity?.id || 'unknown',
          role: userRole || 'guest',
          user_query: query
        })
      })

      if (!response.ok) throw new Error(`Status ${response.status}`)

      const data = await response.json()
      return data.reply || '🤖 No response received.'
    } catch (err) {
      AntdMessage.error('AI request failed.')
      return '⚠️ Could not reach AI.'
    }
  }

  const handleSendMessage = async (content: string) => {
    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      avatar: null,
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)
    setInput('')

    const aiReply = await sendToAI(content)

    setMessages(prev => [
      ...prev,
      {
        id: prev.length + 2,
        sender: 'system',
        avatar: '🤖',
        content: aiReply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    ])
    setIsTyping(false)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
        // Optionally, transcription here
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (err) {
      AntdMessage.error('Microphone permission denied.')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const discardAudio = () => {
    setAudioUrl(null)
    setTranscript('')
  }

  return (
    <Card title='Quant Chat' style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ padding: 16, maxHeight: 550, overflowY: 'auto' }}>
        <List
          dataSource={messages}
          renderItem={msg => (
            <List.Item
              style={{
                justifyContent:
                  msg.sender === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <Space
                direction='horizontal'
                style={{
                  maxWidth: '70%',
                  background: msg.sender === 'user' ? '#e6f7ff' : '#fafafa',
                  padding: '12px',
                  borderRadius: 10
                }}
              >
                {msg.sender === 'system' && (
                  <Avatar style={{ backgroundColor: '#1890ff' }}>
                    {msg.avatar}
                  </Avatar>
                )}
                <div>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</Text>
                  <div
                    style={{ fontSize: '0.75rem', color: '#999', marginTop: 4 }}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </Space>
            </List.Item>
          )}
        />
        {isTyping && (
          <div style={{ display: 'flex', marginTop: 12 }}>
            <Spin style={{ marginRight: 8 }} />
            <Text type='secondary'>Quant is typing...</Text>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Row */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          borderTop: '1px solid #f0f0f0'
        }}
      >
        <Space>
          <div style={{ display: 'flex', gap: 8 }}>
            <Input
              placeholder='Type a message...'
              value={input}
              onChange={e => setInput(e.target.value)}
              onPressEnter={() => handleSendMessage(input)}
              style={{ flex: 1 }}
            />
            <Button
              type='primary'
              icon={<SendOutlined />}
              onClick={() => handleSendMessage(input)}
            />
          </div>
        </Space>

        {/* Audio Controls */}
        <div style={{ marginTop: 12 }}>
          <Space>
            {!recording ? (
              <Button icon={<AudioOutlined />} onClick={startRecording}>
                Record
              </Button>
            ) : (
              <Button icon={<PauseOutlined />} onClick={stopRecording} danger>
                Stop
              </Button>
            )}

            {audioUrl && (
              <>
                <audio controls src={audioUrl} />
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={() => new Audio(audioUrl).play()}
                >
                  Replay
                </Button>
                <Button
                  type='primary'
                  icon={<SendOutlined />}
                  onClick={() =>
                    handleSendMessage(transcript || '[Audio sent]')
                  }
                >
                  Send to AI
                </Button>
                <Button onClick={discardAudio}>Discard</Button>
              </>
            )}
          </Space>
        </div>
      </div>
    </Card>
  )
}

export default Chat
