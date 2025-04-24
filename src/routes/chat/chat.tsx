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
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  // 🔹 Fetch role from Firebase users/{id}.role
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

  // 🔹 Define structured responses
  const predefinedResponses: Record<string, Record<string, string>> = {
    projectadmin: {
      'top 5 interventions': '📈 Top 5 interventions:\n1. CRM Solutions\n2. Mentoring\n3. Branding\n4. Financial Literacy\n5. Market Linkages',
      'average consultant ratings': '⭐ Ratings by Intervention:\nMarketing: 4.5\nFinance: 4.6\nTechnical: 4.7',
      'filter interventions by category': '💰 Funding vs Training Trends:\nTraining: R80K Income, R60K Expense\nFunding: R150K Income, R120K Expense',
      'top 10 companies': '🏢 Top Companies by Participation:\n1. GreenGrow SA\n2. EduSpark\n3. FinEdge...',
      'lagging analysis': '⏳ Marketing Impact Lag:\nFeb: 60%\nMar: 70%\nApr: 82%',
      'distribution by gender and age': '👩‍💼 55% Female | 35% Youth | 10% Senior'
    },
    admin: {
      'all registered users': '👥 32 Users:\nAdmin(1), Consultants(12), Participants(19)',
      'consultants with 3 assignments': '📋 9 Consultants have ≥3 assignments.',
      'haven\'t submitted performance': '⚠️ Pending SMEs:\nAgroNext, FutureGrow, ByteFusion',
      'interventions per enterprise': '📊 Types:\nSupplier Dev: 12\nEnterprise Dev: 24',
      'created past 60 days': '🕓 Recent Interventions:\n25 Created. Created by: Linda, J. Mokoena'
    },
    participant: {
      'interventions completed': '✅ You’ve completed 6 interventions in 2024.',
      'documents pending': '📄 Pending Documents:\n- Tax Pin\n- Management Accounts'
    }
  }

  const matchResponse = (role: string, query: string) => {
    const roleResponses = predefinedResponses[role]
    if (!roleResponses) return null
    const key = Object.keys(roleResponses).find(k =>
      query.toLowerCase().includes(k)
    )
    return key ? roleResponses[key] : null
  }

  const handleSend = () => {
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
    simulateTyping(input)
  }

  const simulateTyping = (query: string) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      const replyText =
        (userRole && matchResponse(userRole, query)) ||
        '🤖 Sorry, I couldn’t find that information yet.'
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
    }, 1200)
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
