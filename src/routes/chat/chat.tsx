import React, { useState, useEffect, useRef } from 'react'
import {
  Layout,
  Avatar,
  Input,
  Button,
  List,
  Typography,
  Space,
  Spin,
  message as AntdMessage
} from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { useGetIdentity } from '@refinedev/core'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { Header, Content } = Layout
const { Text } = Typography

// --- Typing Indicator (ChatGPT-style) ---
const TypingIndicator: React.FC = () => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '10px 12px',
      borderRadius: 12,
      background: '#fafafa',
      boxShadow: '0 2px 10px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06)'
    }}
    aria-live='polite'
    aria-label='Assistant is typing'
  >
    <Avatar style={{ backgroundColor: '#1890ff' }}>🤖</Avatar>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#999', marginRight: 4 }}>
        Assistant is typing
      </span>
      <span className='dots'>
        <span className='dot' />
        <span className='dot' />
        <span className='dot' />
      </span>
    </div>
    {/* keyframes */}
    <style>
      {`
        .dots { display:inline-flex; gap:4px; }
        .dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #8c8c8c; display:inline-block;
          animation: dotFade 1.2s infinite ease-in-out;
          opacity: 0.4;
        }
        .dot:nth-child(1) { animation-delay: 0s; }
        .dot:nth-child(2) { animation-delay: 0.15s; }
        .dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes dotFade {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}
    </style>
  </div>
)

const Chat = () => {
  const { user } = useFullIdentity()

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

  // one true center width for BOTH chat area and composer
  const trackWidth = 'min(1100px, calc(100% - clamp(20px, 6vw, 120px)))'

  useEffect(() => {
    const fetchMeta = async () => {
      if (!user?.email) return
      try {
        const userDoc = await getDoc(doc(db, 'users', user?.id))
        const role = userDoc.data()?.role?.toLowerCase?.()
        setUserRole(role || null)

        // touch relevant collections (if needed elsewhere)
        if (role === 'incubatee') {
          await getDocs(
            query(
              collection(db, 'participants'),
              where('email', '==', user.email)
            )
          )
        } else if (role === 'operations') {
          await getDocs(
            query(
              collection(db, 'operationStaff'),
              where('email', '==', user.email)
            )
          )
        } else if (role === 'consultant') {
          await getDocs(
            query(
              collection(db, 'consultants'),
              where('email', '==', user.email)
            )
          )
        }
      } catch (err) {
        console.error('Error fetching role info:', err)
      }
    }
    fetchMeta()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendToAI = async (query: string) => {
    if (!user?.companyCode) return '⚠️ No company code found.'
    try {
      const response = await fetch(
        'https://yoursdvniel-smartinc-api.hf.space/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: userRole || 'guest',
            message: query,
            companyCode: user?.companyCode,
            userId: user?.id
          })
        }
      )
      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error:', errorText)
        throw new Error(`Status ${response.status}`)
      }
      const data = await response.json()
      return data.reply || '🤖 No response received.'
    } catch (err) {
      console.error(err)
      AntdMessage.error('AI request failed.')
      return '⚠️ Could not reach AI.'
    }
  }

  const handleSendMessage = async (raw: string) => {
    const content = raw.trim()
    if (!content) return
    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
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

  return (
    <>
      <Helmet>
        <title>Chat Assistant | Incubation Platform</title>
      </Helmet>

      <Layout
        style={{ height: '100vh', overflow: 'hidden', background: '#fff' }}
      >
        <Header
          style={{
            background: '#fff',
            paddingInline: 'clamp(12px, 3vw, 32px)',
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid rgba(0,0,0,0.06)'
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            Assistant
          </Typography.Title>
        </Header>

        <Content
          style={{
            position: 'relative',
            height: '100%',
            overflow: 'hidden',
            background: '#fff'
          }}
        >
          {/* Scrollable conversation area, centered */}
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: 'clamp(12px, 2.5vw, 28px) 0 160px',
              display: 'flex',
              justifyContent: 'center',
              background: '#fff'
            }}
          >
            <div style={{ width: trackWidth }}>
              <List
                dataSource={messages}
                renderItem={msg => (
                  <List
                    dataSource={messages}
                    renderItem={msg => (
                      <List.Item style={{ border: 'none', paddingInline: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            width: '100%',
                            justifyContent:
                              msg.sender === 'user' ? 'flex-end' : 'flex-start'
                          }}
                        >
                          <Space
                            align='start'
                            style={{
                              maxWidth: 'min(78%, 900px)',
                              background:
                                msg.sender === 'user' ? '#e6f7ff' : '#fafafa',
                              padding: '12px 14px',
                              borderRadius: 12,
                              boxShadow:
                                '0 2px 10px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06)'
                            }}
                          >
                            {msg.sender === 'system' && (
                              <Avatar style={{ backgroundColor: '#1890ff' }}>
                                {msg.avatar ?? '🤖'}
                              </Avatar>
                            )}

                            <div style={{ width: '100%' }}>
                              {msg.sender === 'system' ? (
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ node, ...props }) => (
                                      <Text {...props} />
                                    ),
                                    strong: ({ node, ...props }) => (
                                      <Text strong {...props} />
                                    ),
                                    em: ({ node, ...props }) => (
                                      <Text italic {...props} />
                                    ),
                                    a: ({ node, ...props }) => (
                                      <a
                                        {...props}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                      />
                                    ),
                                    ul: ({ node, ...props }) => (
                                      <ul
                                        style={{
                                          paddingLeft: 20,
                                          marginBottom: 8
                                        }}
                                        {...props}
                                      />
                                    ),
                                    ol: ({ node, ...props }) => (
                                      <ol
                                        style={{
                                          paddingLeft: 20,
                                          marginBottom: 8
                                        }}
                                        {...props}
                                      />
                                    ),
                                    li: ({ node, ...props }) => (
                                      <li
                                        style={{ marginBottom: 4 }}
                                        {...props}
                                      />
                                    ),
                                    h1: ({ node, ...props }) => (
                                      <Typography.Title
                                        level={3}
                                        style={{ marginTop: 0 }}
                                        {...props}
                                      />
                                    ),
                                    h2: ({ node, ...props }) => (
                                      <Typography.Title level={4} {...props} />
                                    ),
                                    h3: ({ node, ...props }) => (
                                      <Typography.Title level={5} {...props} />
                                    ),
                                    hr: () => (
                                      <div
                                        style={{
                                          borderBottom:
                                            '1px solid rgba(0,0,0,0.06)',
                                          margin: '8px 0'
                                        }}
                                      />
                                    ),
                                    table: ({ node, ...props }) => (
                                      <div style={{ overflowX: 'auto' }}>
                                        <table
                                          style={{
                                            borderCollapse: 'collapse',
                                            width: '100%',
                                            margin: '8px 0'
                                          }}
                                          {...props}
                                        />
                                      </div>
                                    ),
                                    th: ({ node, ...props }) => (
                                      <th
                                        style={{
                                          textAlign: 'left',
                                          borderBottom: '1px solid #eee',
                                          padding: '6px 8px'
                                        }}
                                        {...props}
                                      />
                                    ),
                                    td: ({ node, ...props }) => (
                                      <td
                                        style={{
                                          borderBottom: '1px solid #f5f5f5',
                                          padding: '6px 8px'
                                        }}
                                        {...props}
                                      />
                                    ),
                                    code: ({ node, inline, ...props }) =>
                                      inline ? (
                                        <code
                                          style={{
                                            background: '#f5f5f5',
                                            padding: '2px 4px',
                                            borderRadius: 4,
                                            fontFamily:
                                              'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace'
                                          }}
                                          {...props}
                                        />
                                      ) : (
                                        <pre
                                          style={{
                                            background: '#f5f5f5',
                                            padding: 10,
                                            borderRadius: 8,
                                            overflowX: 'auto'
                                          }}
                                        >
                                          <code {...props} />
                                        </pre>
                                      )
                                  }}
                                >
                                  {msg.content}
                                </ReactMarkdown>
                              ) : (
                                <Text style={{ whiteSpace: 'pre-wrap' }}>
                                  {msg.content}
                                </Text>
                              )}

                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#999',
                                  marginTop: 6
                                }}
                              >
                                {msg.timestamp}
                              </div>
                            </div>
                          </Space>
                        </div>
                      </List.Item>
                    )}
                  />
                )}
              />

              {/* ChatGPT-style typing indicator */}
              {isTyping && (
                <div style={{ display: 'flex', marginTop: 6 }}>
                  <TypingIndicator />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating, ALWAYS-centered composer */}
          <div
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'clamp(12px, 3vw, 32px)',
              transform: 'translateX(-50%)',
              width: trackWidth,
              zIndex: 10,
              background: '#fff',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(24, 144, 255, 0.12)',
              boxShadow:
                '0 10px 30px rgba(24, 144, 255, 0.12), 0 6px 16px rgba(0,0,0,0.06)',
              borderRadius: 16,
              padding: 'clamp(8px, 1.5vw, 14px)'
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <Input.TextArea
                autoSize={{ minRows: 1, maxRows: 8 }}
                value={input}
                onChange={e => setInput(e.target.value)}
                onPressEnter={e => {
                  if (!e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(input)
                  }
                }}
                placeholder='Type your message… (Shift+Enter for a new line)'
                style={{
                  resize: 'none',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                  paddingInline: '12px'
                }}
              />
              <Button
                type='primary'
                icon={<SendOutlined />}
                onClick={() => handleSendMessage(input)}
                disabled={!input.trim()}
                style={{ paddingInline: 'clamp(10px, 2vw, 16px)' }}
              >
                Send
              </Button>
            </div>
          </div>
        </Content>
      </Layout>
    </>
  )
}

export default Chat
