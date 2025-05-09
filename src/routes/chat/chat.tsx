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
import { SendOutlined } from '@ant-design/icons'
import { useGetIdentity } from '@refinedev/core'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'

const { Text } = Typography

export const Chat = () => {
  const { data: identity } = useGetIdentity()
  const [userRole, setUserRole] = useState<string | null>(null)
  const [messages, setMessages] = useState([
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

  useEffect(() => {
    const fetchUserRole = async () => {
      if (identity?.id) {
        const userRef = doc(db, 'users', identity.id)
        const snap = await getDoc(userRef)
        const role = snap.data()?.role?.toLowerCase?.()
        setUserRole(role || null)
      }
    }
    fetchUserRole()
  }, [identity])

  const sendToAI = async (query: string) => {
    try {
      console.log(identity?.id)
      const response = await fetch('https://rairo-incu-api.hf.space/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: identity?.id || 'unknown',
          role: userRole || 'guest',
          user_query: query
        })
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`)
      }

      const data = await response.json()
      return data.reply || '🤖 No meaningful response received.'
    } catch (error) {
      console.error('Error communicating with AI:', error)
      AntdMessage.error('AI service error: ' + String(error))
      return '⚠️ Failed to fetch AI response.'
    }
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = {
      id: messages.length + 1,
      sender: 'user',
      content: input,
      avatar: null,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    await respondToUser(input)
  }

  const respondToUser = async (query: string) => {
    const replyText = await sendToAI(query) // 🔄 Wait for the real AI response
    setMessages(prev => [
      ...prev,
      {
        id: prev.length + 1,
        sender: 'system',
        avatar: '🤖',
        content: replyText,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }
    ])
    setIsTyping(false)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <Card
      title='Quant Chat'
      style={{ maxWidth: 900, margin: '0 auto' }}
      headStyle={{ background: '#fafafa', fontSize: 16, fontWeight: 'bold' }}
      bodyStyle={{ padding: 0 }}
    >
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
      <div
        style={{
          display: 'flex',
          padding: 16,
          borderTop: '1px solid #f0f0f0',
          background: '#fff'
        }}
      >
        <Input
          placeholder='Type a message...'
          value={input}
          onChange={e => setInput(e.target.value)}
          onPressEnter={handleSend}
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button type='primary' icon={<SendOutlined />} onClick={handleSend} />
      </div>
    </Card>
  )
}

export default Chat
