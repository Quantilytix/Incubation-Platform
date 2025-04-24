import React, { useState, useEffect, useRef } from 'react'
import {
  Avatar,
  Input,
  Button,
  List,
  Typography,
  Space,
  Card,
  Spin
} from 'antd'
import { SendOutlined } from '@ant-design/icons'

const { Text } = Typography

const initialMessages = [
  {
    id: 1,
    sender: 'system',
    avatar: '🤖',
    content: 'Hi there! How can I assist you today?',
    timestamp: '10:00 AM'
  },
  {
    id: 2,
    sender: 'user',
    avatar: null,
    content: 'I need help with submitting my form.',
    timestamp: '10:02 AM'
  },
  {
    id: 3,
    sender: 'system',
    avatar: '🤖',
    content:
      'Sure! Just head over to the "Forms" section and click on "Submit".',
    timestamp: '10:03 AM'
  }
]

export const Chat = () => {
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const handleSend = () => {
    if (!input.trim()) return

    const newMessage = {
      id: messages.length + 1,
      sender: 'user',
      content: input,
      avatar: null,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    setMessages([...messages, newMessage])
    setInput('')
    simulateTypingResponse()
  }

  const simulateTypingResponse = () => {
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)

      const reply = {
        id: messages.length + 2,
        sender: 'system',
        avatar: '🤖',
        content: "Got it! We'll follow up shortly.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      }

      setMessages(prev => [...prev, reply])
    }, 1500)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <Card
      title='Quant Chat'
      style={{ maxWidth: 900, margin: '0 auto' }}
      headStyle={{
        background: '#fafafa',
        fontSize: 16,
        fontWeight: 'bold'
      }}
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
                  <Text>{msg.content}</Text>
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

        {/* Typing animation */}
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
