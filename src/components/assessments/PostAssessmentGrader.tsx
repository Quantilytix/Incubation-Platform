// =============================================
// components/assessments/PostAssessmentGrader.tsx
// (optional viewer that auto‑grades incoming responses and writes score)
// =============================================
import React, { useEffect, useState } from 'react'
import { Card, Table, Tag, message } from 'antd'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import { autoGrade } from './AutoGrade'

export function PostAssessmentGrader ({ templateId }: { templateId: string }) {
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    const run = async () => {
      try {
        const tSnap = await getDoc(doc(db, 'formTemplates', templateId))
        if (!tSnap.exists()) return message.error('Template not found')
        const tpl = tSnap.data() as any

        const rSnap = await getDocs(
          query(
            collection(db, 'formResponses'),
            where('templateId', '==', templateId)
          )
        )
        const result: any[] = []
        for (const d of rSnap.docs) {
          const r = d.data() as any
          const answers = r.answers || r.responses || {}
          const ag = tpl.assessmentMeta?.autoGrade
            ? autoGrade(tpl.fields || [], answers)
            : null
          if (ag && (r.grade == null || r.grade?.auto == null)) {
            await updateDoc(doc(db, 'formResponses', d.id), {
              grade: {
                auto: {
                  score: ag.earnedPoints,
                  total: ag.totalPoints,
                  byQuestion: ag.byQuestion
                },
                gradedAt: new Date()
              }
            })
          }
          result.push({
            id: d.id,
            submitter: r.submittedBy?.name || r.submittedBy?.email || '—',
            submittedAt: r.submittedAt,
            score: ag
              ? `${ag.earnedPoints} / ${ag.totalPoints}`
              : r.grade?.auto
              ? `${r.grade.auto.score} / ${r.grade.auto.total}`
              : '—',
            status: r.status || 'submitted'
          })
        }
        setRows(result)
      } catch (e) {
        console.error(e)
        message.error('Failed to auto‑grade responses')
      }
    }
    run()
  }, [templateId])

  return (
    <Card title='Auto‑graded Submissions'>
      <Table
        rowKey='id'
        dataSource={rows}
        columns={[
          { title: 'Submitter', dataIndex: 'submitter' },
          {
            title: 'Submitted At',
            dataIndex: 'submittedAt',
            render: (v: any) =>
              v?.toDate?.() ? v.toDate().toLocaleString() : String(v || '')
          },
          { title: 'Score', dataIndex: 'score' },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (s: string) => <Tag color='blue'>{s}</Tag>
          }
        ]}
      />
    </Card>
  )
}
