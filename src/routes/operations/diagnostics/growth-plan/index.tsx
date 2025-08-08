import React, { useEffect, useState } from 'react'
import {
  Card,
  Typography,
  Spin,
  Table,
  Divider,
  message,
  Button,
  Modal,
  Form,
  Input,
  Select
} from 'antd'
import {
  doc,
  getDocs,
  getDoc,
  query,
  collection,
  where,
  updateDoc
} from 'firebase/firestore'
import { db } from '@/firebase'
import dayjs from 'dayjs'
import { CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const GrowthPlanPage = ({ participant }: { participant: any }) => {
  const [loading, setLoading] = useState(true)
  const [applicationData, setApplicationData] = useState<any>(null)
  const [interventions, setInterventions] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([])
  const [availableInterventions, setAvailableInterventions] = useState<any[]>(
    []
  )
  const [searchArea, setSearchArea] = useState('')
  const [searchTitle, setSearchTitle] = useState('')

  const confirmByOperations = async () => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (appSnap.empty) return

      const appDoc = appSnap.docs[0]
      const appRef = appDoc.ref
      const appData = appDoc.data()
      const companyCode = appData.companyCode || 'RCM'
      const existingRequired = appData?.interventions?.required || []
      const aiRecs = appData?.aiEvaluation?.['Recommended Interventions'] || {}

      // Flatten AI interventions
      const aiTitlesToConfirm = Object.entries(aiRecs).flatMap(
        ([area, titles]) =>
          titles.map(title => ({
            title,
            area
          }))
      )

      // Fetch actual interventions from the database
      const intvSnap = await getDocs(
        query(
          collection(db, 'interventions'),
          where('companyCode', '==', companyCode)
        )
      )
      const allIntvs = intvSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      const confirmedInterventions = aiTitlesToConfirm
        .map(ai => {
          const matched = allIntvs.find(
            intv =>
              intv.interventionTitle === ai.title &&
              intv.areaOfSupport === ai.area
          )
          return matched
            ? {
                id: matched.id,
                title: matched.interventionTitle,
                area: matched.areaOfSupport
              }
            : null
        })
        .filter(Boolean)

      const updatedRequired = [...existingRequired, ...confirmedInterventions]

      await updateDoc(appRef, {
        'interventions.required': updatedRequired,
        'interventions.confirmedBy.operations': true,
        confirmedAt: new Date().toISOString(),
        'aiEvaluation.Recommended Interventions': {}
      })

      message.success('Growth plan confirmed and AI interventions added!')

      setApplicationData(prev => ({
        ...prev,
        interventions: {
          ...prev.interventions,
          required: updatedRequired,
          confirmedBy: {
            ...(prev.interventions?.confirmedBy || {}),
            operations: true
          }
        },
        confirmedAt: new Date(),
        aiEvaluation: {
          ...(prev.aiEvaluation || {}),
          'Recommended Interventions': {}
        }
      }))

      await fetchData()
    } catch (error) {
      console.error('❌ Failed to confirm growth plan:', error)
      message.error('Error during confirmation')
    }
  }

  const handleConfirmIntervention = async (record: any) => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (appSnap.empty) return

      const appRef = appSnap.docs[0].ref
      const appData = appSnap.docs[0].data()
      const companyCode = appData?.companyCode || 'RCM'

      const existingRequired = appData?.interventions?.required || []
      const aiEvaluation = appData?.aiEvaluation || {}

      // Prevent duplicate adds
      const alreadyExists = existingRequired.some(
        (i: any) =>
          i.title === record.interventionTitle &&
          i.area === record.areaOfSupport
      )
      if (alreadyExists) {
        message.info('Already confirmed.')
        return
      }

      // 🔍 Get real ID from interventions collection
      const intvSnap = await getDocs(
        query(
          collection(db, 'interventions'),
          where('companyCode', '==', companyCode),
          where('interventionTitle', '==', record.interventionTitle),
          where('areaOfSupport', '==', record.areaOfSupport)
        )
      )

      if (intvSnap.empty) {
        message.error('No matching intervention found in master list.')
        return
      }

      const matched = intvSnap.docs[0]
      const matchedId = matched.id
      const matchedData = matched.data()

      // ✅ Add to required
      const updatedRequired = [
        ...existingRequired,
        {
          id: matchedId,
          title: matchedData.interventionTitle,
          area: matchedData.areaOfSupport
        }
      ]

      // 🧹 Remove from AI Evaluation
      const recs = aiEvaluation['Recommended Interventions'] || {}
      const area = record.areaOfSupport
      if (recs[area]) {
        const updatedAreaList = recs[area].filter(
          (title: string) => title !== record.interventionTitle
        )

        if (updatedAreaList.length === 0) {
          delete recs[area]
        } else {
          recs[area] = updatedAreaList
        }
      }

      // 💾 Update Firestore
      await updateDoc(appRef, {
        'interventions.required': updatedRequired,
        'aiEvaluation.Recommended Interventions': recs
      })

      // 🖼️ Update UI
      setInterventions(prev =>
        prev.map(item =>
          item.id === record.id ? { ...item, confirmed: true } : item
        )
      )

      message.success('AI Intervention confirmed and saved.')
      await fetchData()
    } catch (err) {
      console.error('Error confirming AI intervention:', err)
      message.error('Could not confirm intervention.')
    }
  }

  const handleDeleteIntervention = async (record: any) => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (appSnap.empty) return

      const appRef = appSnap.docs[0].ref
      const appData = appSnap.docs[0].data()
      const existingRequired = appData?.interventions?.required || []
      const aiEvaluation = appData?.aiEvaluation || {}

      // Handle SME intervention deletion
      if (record.source === 'SME') {
        const updatedRequired = existingRequired.filter(
          (i: any) => i.id !== record.id
        )
        await updateDoc(appRef, {
          'interventions.required': updatedRequired
        })
        message.success('SME Intervention removed from required.')
      }

      // Handle AI intervention deletion (even unconfirmed ones)
      if (record.source === 'AI') {
        const recs = aiEvaluation['Recommended Interventions'] || {}
        const area = record.areaOfSupport

        if (recs[area]) {
          const updatedAreaList = recs[area].filter(
            (title: string) => title !== record.interventionTitle
          )

          // If the list is now empty, remove the key entirely
          if (updatedAreaList.length === 0) {
            delete recs[area]
          } else {
            recs[area] = updatedAreaList
          }

          await updateDoc(appRef, {
            'aiEvaluation.Recommended Interventions': recs
          })

          message.success('AI Intervention removed from evaluation.')
        }
      }

      // Always remove from UI
      setInterventions(prev => prev.filter(i => i.id !== record.id))
      await fetchData()
    } catch (err) {
      console.error('Error deleting intervention:', err)
      message.error('Could not delete intervention.')
    }
  }

  const handleAddMultiple = async () => {
    try {
      const selected = availableInterventions.filter(i =>
        selectedRowKeys.includes(i.id)
      )

      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )
      if (appSnap.empty) return message.error('Application not found.')

      const appRef = appSnap.docs[0].ref
      const appData = appSnap.docs[0].data()
      const existingRequired = appData?.interventions?.required || []

      const additions = selected.map(item => ({
        id: item.id,
        title: item.interventionTitle,
        area: item.areaOfSupport
      }))

      await updateDoc(appRef, {
        'interventions.required': [...existingRequired, ...additions]
      })

      setInterventions(prev => [
        ...prev,
        ...selected.map(i => ({
          id: i.id,
          interventionTitle: i.interventionTitle,
          areaOfSupport: i.areaOfSupport,
          source: 'System', // ✅ correct
          confirmedAt: null
        }))
      ])

      await fetchData()

      message.success(`${additions.length} interventions added.`)
      setIsModalOpen(false)
      setSelectedRowKeys([])
      form.resetFields()
    } catch (err) {
      console.error(err)
      message.error('Error adding interventions.')
    }
  }

  const fetchData = async () => {
    try {
      const appSnap = await getDocs(
        query(
          collection(db, 'applications'),
          where('email', '==', participant.email),
          where('applicationStatus', 'in', ['accepted', 'Accepted'])
        )
      )

      if (appSnap.empty) return

      const appDoc = appSnap.docs[0]
      const app = appDoc.data()
      const appRef = appDoc.ref

      const confirmedAt = app?.confirmedAt || null
      const digitalSignature = app?.digitalSignature || null

      // Store these for use
      setApplicationData({
        ...app,
        confirmedAt,
        digitalSignature
      })

      // 🔄 Also fetch user signature from `users` collection
      const userSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', participant.email))
      )
      if (!userSnap.empty) {
        const userData = userSnap.docs[0].data()
        setApplicationData(prev => ({
          ...prev,
          userSignatureURL: userData.signatureURL || null
        }))
      }

      const allRequired: any[] = []
      const normalizedRequired: any[] = []

      for (const entry of app?.interventions?.required || []) {
        if (typeof entry === 'string') {
          // If entry is just an ID string, fetch full doc
          const intvSnap = await getDoc(doc(db, 'interventions', entry))
          if (intvSnap.exists()) {
            const intvData = intvSnap.data()
            const norm = {
              id: entry,
              title: intvData.interventionTitle || '',
              area: intvData.areaOfSupport || ''
            }
            allRequired.push({
              id: entry,
              interventionTitle: norm.title,
              areaOfSupport: norm.area,
              source: 'SME',
              confirmedAt: null
            })
            normalizedRequired.push(norm)
          }
        } else {
          allRequired.push({
            id: entry.id,
            interventionTitle: entry.title || '',
            areaOfSupport: entry.area || '',
            source: 'SME',
            confirmedAt: null
          })
          normalizedRequired.push(entry)
        }
      }

      // Patch Firestore if needed
      if (normalizedRequired.length > 0) {
        await updateDoc(appRef, {
          'interventions.required': normalizedRequired
        })
      }

      let aiRecommended: any[] = []
      if (
        typeof app?.aiEvaluation?.['Recommended Interventions'] === 'object'
      ) {
        const recs = app.aiEvaluation['Recommended Interventions']
        aiRecommended = Object.entries(recs).flatMap(([area, items]) =>
          items.map((title: string, i: number) => ({
            id: `ai-${area}-${i}`,
            interventionTitle: title,
            areaOfSupport: area,
            source: 'AI',
            confirmedAt: null
          }))
        )
      }

      setInterventions([...allRequired, ...aiRecommended])

      // Fetch all available interventions
      const intvSnap = await getDocs(
        query(
          collection(db, 'interventions'),
          where('companyCode', '==', app?.companyCode || 'RCM')
        )
      )
      const allInterventions = intvSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))

      const requiredIds = new Set(allRequired.map(i => i.id))
      const aiTitles = new Set(aiRecommended.map(i => i.interventionTitle))

      // ❌ Exclude required + AI
      const available = allInterventions.filter(
        (intv: any) =>
          !requiredIds.has(intv.id) && !aiTitles.has(intv.interventionTitle)
      )

      setAvailableInterventions(available)
    } catch (err) {
      console.error('Error fetching growth plan data', err)
      message.error('Failed to fetch participant data.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    fetchData()
  }, [participant])

  const filteredInterventions = availableInterventions.filter(
    i =>
      i.areaOfSupport.toLowerCase().includes(searchArea.toLowerCase()) &&
      i.interventionTitle.toLowerCase().includes(searchTitle.toLowerCase())
  )

  if (loading)
    return (
      <Spin style={{ marginTop: 48 }} tip='Loading participant details...' />
    )
  if (!applicationData)
    return <Paragraph>No application found for this participant.</Paragraph>

  return (
    <Card bordered={false} style={{ padding: 24, marginTop: 10 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          marginBottom: 24,
          justifyContent: 'space-between'
        }}
      >
        {/* Box with logo, name, and Growth Plan label */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center', // vertically align image and text
            justifyContent: 'center', // center the whole box
            border: '1px solid #d9d9d9',
            borderRadius: 8,
            padding: 24,
            marginBottom: 24,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Logo box */}
          <div
            style={{
              width: 200,
              height: 100,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 24
            }}
          >
            <img
              src='/assets/images/RCM.jpg'
              alt='Logo'
              style={{ maxWidth: '90%', maxHeight: '90%' }}
            />
          </div>

          {/* Text section */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Text style={{ fontSize: 18, fontWeight: 500 }}>
              {participant.beneficiaryName || 'Participant'}
            </Text>
            <Text style={{ fontSize: 36, fontWeight: 700, color: '#222' }}>
              Growth Plan
            </Text>
          </div>
        </div>
      </div>
      <Divider>Business Overview</Divider>
      <Text strong>Business Owner:</Text> {participant.participantName || 'N/A'}
      <br />
      <Text strong>Sector:</Text> {participant.sector}
      <br />
      <Text strong>Province:</Text> {participant.province}
      <br />
      <Text strong>City:</Text> {participant.city}
      <br />
      <Text strong>Years Trading:</Text> {participant.yearsOfTrading || 'N/A'}
      <br />
      <Text strong>Date of Registration:</Text>{' '}
      {participant.dateOfRegistration?.toDate
        ? dayjs(participant.dateOfRegistration.toDate()).format('YYYY-MM-DD')
        : participant.dateOfRegistration || 'N/A'}
      <br />
      <Divider>Application Summary</Divider>
      <Text strong>Motivation:</Text> {applicationData.motivation}
      <br />
      <Text strong>Challenges:</Text> {applicationData.challenges}
      <br />
      <Text strong>Stage:</Text> {applicationData.stage}
      <br />
      <Text strong>Compliance Score:</Text> {applicationData.complianceScore}%
      <br />
      <Divider>Interventions</Divider>
      <div style={{ textAlign: 'right', marginBottom: 12 }}>
        <Button type='primary' onClick={() => setIsModalOpen(true)}>
          + Add New Intervention
        </Button>
      </div>
      <Table
        size='small'
        bordered
        dataSource={interventions}
        columns={[
          { title: 'Title', dataIndex: 'interventionTitle' },
          { title: 'Area', dataIndex: 'areaOfSupport' },
          { title: 'Source', dataIndex: 'source' },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <div style={{ display: 'flex', gap: 12 }}>
                <div
                  style={{
                    transition: 'transform 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e =>
                    (e.currentTarget.style.transform = 'scale(1.2)')
                  }
                  onMouseLeave={e =>
                    (e.currentTarget.style.transform = 'scale(1)')
                  }
                  title='Delete'
                  onClick={() => handleDeleteIntervention(record)}
                >
                  <DeleteOutlined style={{ color: 'red', fontSize: 18 }} />
                </div>
              </div>
            )
          }
        ]}
        rowKey={record => record.id || record.interventionTitle}
        pagination={false}
      />
      {applicationData.interventions?.confirmedBy?.incubatee && (
        <>
          {applicationData.digitalSignature && (
            <>
              <Divider>Participant Signature</Divider>
              <Text strong>Cryptographic Signature:</Text>
              <br />
              <Text copyable>{applicationData.digitalSignature}</Text>
              <br />
              {applicationData.userSignatureURL && (
                <>
                  <Text strong>Digital Signature:</Text>
                  <br />
                  <img
                    src={applicationData.userSignatureURL}
                    alt='Participant Signature'
                    style={{
                      maxWidth: 200,
                      border: '1px solid #ccc',
                      marginTop: 8
                    }}
                  />
                </>
              )}
            </>
          )}
          <Divider>Confirmation Details</Divider>
          <Text strong>Confirmed At:</Text>{' '}
          {applicationData.confirmedAt?.toDate
            ? dayjs(applicationData.confirmedAt.toDate()).format('YYYY-MM-DD')
            : 'N/A'}
          <br />
        </>
      )}
      <Divider />
      {applicationData.interventions?.confirmedBy?.operations &&
      applicationData.interventions?.confirmedBy?.incubatee ? (
        <Button type='primary'>Download Growth Plan</Button>
      ) : applicationData.interventions?.confirmedBy?.operations ? (
        <Text type='secondary'>Waiting for Incubatee to confirm</Text>
      ) : (
        <Button type='primary' onClick={confirmByOperations}>
          Confirm Growth Plan
        </Button>
      )}
      <Modal
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false)
          setSelectedRowKeys([])
          form.resetFields()
        }}
        footer={null}
        title='Add New Interventions'
      >
        <Form layout='vertical' form={form} onFinish={handleAddMultiple}>
          {/* Filters */}
          <Form.Item label='Filter by Area of Support'>
            <Input
              placeholder='e.g. Marketing'
              value={searchArea}
              onChange={e => setSearchArea(e.target.value)}
              allowClear
            />
          </Form.Item>

          <Form.Item label='Filter by Title'>
            <Input
              placeholder='e.g. Website Development'
              value={searchTitle}
              onChange={e => setSearchTitle(e.target.value)}
              allowClear
            />
          </Form.Item>

          {/* Table */}
          <Table
            dataSource={filteredInterventions}
            rowKey='id'
            rowSelection={{
              selectedRowKeys,
              onChange: keys => setSelectedRowKeys(keys as string[])
            }}
            columns={[
              {
                title: 'Title',
                dataIndex: 'interventionTitle'
              },
              {
                title: 'Area',
                dataIndex: 'areaOfSupport'
              }
            ]}
            pagination={{ pageSize: 5 }}
            size='small'
          />

          <Form.Item>
            <Button
              type='primary'
              htmlType='submit'
              disabled={selectedRowKeys.length === 0}
            >
              Add Selected Interventions
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}

export default GrowthPlanPage
