import React, { useState, useEffect, useRef } from 'react'
import {
  Layout,
  Menu,
  Avatar,
  Input,
  Button,
  List,
  Typography,
  Space,
  Spin,
  message as AntdMessage
} from 'antd'
import {
  SendOutlined,
  AudioOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  MessageOutlined,
  FileTextOutlined,
  ProjectOutlined,
  SolutionOutlined,
  BellOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { useGetIdentity } from '@refinedev/core'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const GPT_OPTIONS = [
  'Chat',
  'Report',
  'Marketing Plan',
  'Business Plan',
  'Notifications'
]

const Chat = () => {
  const { data: identity } = useGetIdentity()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [selectedGPT, setSelectedGPT] = useState('Chat')

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
  const [userActualId, setUserActualId] = useState<string>('unknown')
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    const fetchRoleAndParticipantId = async () => {
      if (!identity?.email) return

      try {
        const userDoc = await getDoc(doc(db, 'users', identity.id))
        const role = userDoc.data()?.role?.toLowerCase?.()
        setUserRole(role || null)

        let actualId = 'unknown'

        if (role === 'incubatee') {
          const snap = await getDocs(
            query(
              collection(db, 'participants'),
              where('email', '==', identity.email)
            )
          )
          if (!snap.empty) {
            actualId = snap.docs[0].data().participantId || 'unknown'
          }
        } else if (role === 'operations') {
          const snap = await getDocs(
            query(
              collection(db, 'operationStaff'),
              where('email', '==', identity.email)
            )
          )
          if (!snap.empty) {
            actualId = snap.docs[0].id
          }
        } else if (role === 'consultant') {
          const snap = await getDocs(
            query(
              collection(db, 'consultants'),
              where('email', '==', identity.email)
            )
          )
          if (!snap.empty) {
            actualId = snap.docs[0].data().id || 'unknown'
          }
        } else if (role === 'director') {
          actualId = identity.id
        }

        setUserActualId(actualId) // 👈 Add this state
      } catch (err) {
        console.error('Error fetching role-specific ID:', err)
      }
    }

    fetchRoleAndParticipantId()
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
          user_id: userActualId,
          role: userRole || 'guest',
          user_query: query,
          context: messages.map(m => ({
            role: m.sender === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error:', errorText)
        throw new Error(`Status ${response.status}`)
      }

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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)

        const formData = new FormData()
        formData.append('file', blob, 'audio.webm')
        formData.append('model', 'whisper-1')

        try {
          const res = await fetch(
            'https://api.openai.com/v1/audio/transcriptions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer f5907e035ada4f3db45711f7e75fac72`
              },
              body: formData
            }
          )

          const data = await res.json()
          setTranscript(data.text || '')
        } catch (err) {
          AntdMessage.error('Transcription failed')
          setTranscript('')
        }
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

  const gptIconMap: Record<string, React.ReactNode> = {
    Chat: <MessageOutlined />,
    Report: <FileTextOutlined />,
    'Marketing Plan': <ProjectOutlined />,
    'Business Plan': <SolutionOutlined />,
    Notifications: <BellOutlined />
  }

  return (
    <>
      <Helmet>
        <title>Chat Assistant | Incubation Platform</title>
      </Helmet>

      <Layout style={{ height: '100vh' }}>
        <Sider width={220} style={{ backgroundColor: '#fff' }}>
          <Menu
            mode='vertical'
            selectedKeys={[selectedGPT]}
            onClick={({ key }) => setSelectedGPT(key)}
          >
            {GPT_OPTIONS.map(opt => (
              <Menu.Item key={opt} icon={gptIconMap[opt]}>
                {opt}
              </Menu.Item>
            ))}
          </Menu>
        </Sider>

        <Layout>
          <Header style={{ backgroundColor: '#fff', paddingLeft: 24 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {selectedGPT} Assistant
            </Typography.Title>
          </Header>

          <Content
            style={{
              padding: 0,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#fff'
            }}
          >
            {/* Chat Area */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
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
                        background:
                          msg.sender === 'user' ? '#e6f7ff' : '#fafafa',
                        padding: 12,
                        borderRadius: 10
                      }}
                    >
                      {msg.sender === 'system' && (
                        <Avatar style={{ backgroundColor: '#1890ff' }}>
                          {msg.avatar}
                        </Avatar>
                      )}
                      <div>
                        <Text style={{ whiteSpace: 'pre-wrap' }}>
                          {msg.content}
                        </Text>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: '#999',
                            marginTop: 4
                          }}
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

            {/* Input Section */}
            <div style={{ padding: 16, borderTop: '1px solid #eee' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input.TextArea
                  rows={2}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onPressEnter={e => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(input)
                    }
                  }}
                  placeholder='Type a message...'
                  style={{ resize: 'none', flex: 1 }}
                />
                <Button
                  type='primary'
                  icon={<SendOutlined />}
                  onClick={() => handleSendMessage(input)}
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <Space>
                  {!recording ? (
                    <Button icon={<AudioOutlined />} onClick={startRecording}>
                      Record
                    </Button>
                  ) : (
                    <Button
                      icon={<PauseOutlined />}
                      onClick={stopRecording}
                      danger
                    >
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
                        onClick={() => handleSendMessage('[Audio Sent]')}
                      >
                        Send to AI
                      </Button>
                      <Button onClick={discardAudio}>Discard</Button>
                    </>
                  )}
                </Space>
              </div>
            </div>
          </Content>
        </Layout>
      </Layout>
    </>
  )
}

export default Chat
