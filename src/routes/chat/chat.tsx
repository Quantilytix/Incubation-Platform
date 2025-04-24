// 👇 This is the Chat.tsx component updated with full role logic including operations and admin access scope
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

  // 🎯 Smart reply mappings
  const predefinedResponses: Record<string, Record<string, string>> = {
    projectadmin: {
      'top 5 interventions': '📈 Top 5: CRM, Mentorship, Marketing, Branding, Linkages',
      'average consultant ratings': '⭐ Ratings: Finance 4.6, Marketing 4.5, Ops 4.7',
      'filter interventions by category': '📊 Income vs Expense by Category: R120k vs R85k',
      'top 10 companies': '🏢 Top Companies: AgriX, EduPro, BioLife...',
      'lagging analysis': '📉 Lag effect: March Marketing: 40%, April: 65%, May: 82%',
      'distribution by gender and age': '👥 Gender: 58% Female | Youth: 42%, Adults: 50%'
    },
    admin: {
      'registered users': '🔐 Users: 58 total (Admins: 2, Consultants: 24, Participants: 32)',
      'active consultants': '📋 11 Consultants have ≥3 active assignments.',
      'haven\'t submitted monthly performance': '⏱️ SMEs: FinNext, BlueWave, CodeMakers',
      'summary of interventions per enterprise': '📊 Supplier Dev: 18, Enterprise Dev: 42',
      'interventions created in past 60': '📅 34 Interventions created by J. Mokoena & Team'
    },
    participant: {
      'completed this year': '✅ You’ve completed 6 interventions so far this year.',
      'documents pending': '📄 Pending: Management Accounts, Tax Pin'
    },
    operations: {
      'intervention assignments by sector': '📌 Manufacturing: 10, ICT: 8, Agri: 12',
      'consultants with most active': '🏆 Consultant Leaders:\n- L. Dlamini: 8\n- T. Nkosi: 7',
      'smes not uploaded compliance': '📂 6 SMEs missing compliance docs.',
      'assigned last month': '📦 Grouped Interventions:\nGreenGrow: 3\nTechSpark: 2',
      'cancelled interventions in q1': '❌ Cancelled: 5 (Jan: 1, Feb: 2, Mar: 2)',
      'missing bee or taxpin': '⚠️ Missing: NeoFarms, SmartMobility'
    }
  }

// 🔄 Normalize function (removes punctuation, lowercases, trims)
const normalize = (str: string) =>
  str.toLowerCase().replace(/[^\w\s]/gi, '').trim()

// 🎯 Updated matcher
const matchResponse = (role: string, query: string) => {
  const roleData = predefinedResponses[role]
  if (!roleData) return null

  const normalizedQuery = normalize(query)

  const key = Object.keys(roleData).find(rawKey => {
    const normalizedKey = normalize(rawKey)
    return (
      normalizedQuery.includes(normalizedKey) ||
      normalizedKey.includes(normalizedQuery)
    )
  })

  return key ? roleData[key] : null
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
