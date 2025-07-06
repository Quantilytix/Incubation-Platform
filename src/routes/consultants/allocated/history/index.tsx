import React, { useEffect, useState } from 'react'
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Typography,
  Row,
  Col,
  Card,
  Statistic
} from 'antd'
import {
  UploadOutlined,
  CheckCircleOutlined,
  PaperClipOutlined,
  AppstoreAddOutlined
} from '@ant-design/icons'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc
} from 'firebase/firestore'
import { db, storage, auth } from '@/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

const { Title } = Typography

const AllocatedHistory = () => {
  const [interventions, setInterventions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [form] = Form.useForm()

  useEffect(() => {
    const fetchCompleted = async () => {
      setLoading(true)
      const user = auth.currentUser
      if (!user?.email) return

      const consultantSnap = await getDocs(
        query(collection(db, 'consultants'), where('email', '==', user.email))
      )

      if (consultantSnap.empty) {
        message.error('Consultant profile not found.')
        return
      }

      const consultantId = consultantSnap.docs[0].id

      const snap = await getDocs(
        query(
          collection(db, 'interventionsDatabase'),
          where('consultantId', '==', consultantId)
        )
      )

      const interventionsData = await Promise.all(
        snap.docs.map(async docSnap => {
          const data = docSnap.data()
          const interventionId = data.interventionId

          let area = data.areaOfSupport || 'Unknown'

          if (interventionId) {
            try {
              const intSnap = await getDocs(
                query(
                  collection(db, 'interventions'),
                  where('id', '==', interventionId)
                )
              )
              if (!intSnap.empty) {
                const intDoc = intSnap.docs[0].data()
                area = intDoc.areaOfSupport || area
              } else {
                console.warn(
                  `⚠️ No matching intervention found for id: ${interventionId}`
                )
              }
            } catch (err) {
              console.error(
                `❌ Error fetching intervention with id: ${interventionId}`,
                err
              )
            }
          }

          return {
            id: data.interventionId, // the one from assignedInterventions
            ...data,
            areaOfSupport: area
          }
        })
      )

      setInterventions(interventionsData)
      setLoading(false)
    }

    fetchCompleted()
  }, [])

  const handleUpload = async (values: any) => {
    if (!selected) return
    try {
      setUploading(true)

      let poeUrl = selected.resources?.[0]?.link || null
      let label = selected.resources?.[0]?.label || 'POE Document'

      if (values.poe?.file) {
        const file = values.poe.file.originFileObj
        const path = `poes/${Date.now()}_${file.name}`
        const fileRef = ref(storage, path)
        await uploadBytes(fileRef, file)
        poeUrl = await getDownloadURL(fileRef)
        label = file.name
      }

      const docRef = doc(db, 'interventionsDatabase', selected.id)
      await updateDoc(docRef, {
        consultantNotes: values.notes,
        updatedAt: new Date(),
        resources: [
          ...(selected.resources || []),
          ...(poeUrl
            ? [
                {
                  type: 'document',
                  label,
                  link: poeUrl
                }
              ]
            : [])
        ]
      })

      message.success('Notes and POE updated!')
      setModalOpen(false)
    } catch (err) {
      console.error(err)
      message.error('Failed to update intervention.')
    } finally {
      setUploading(false)
    }
  }

  const columns = [
    {
      title: 'Participant',
      dataIndex: 'beneficiaryName'
    },
    {
      title: 'Intervention',
      dataIndex: 'interventionTitle'
    },
    {
      title: 'Area',
      dataIndex: 'areaOfSupport'
    },
    {
      title: 'POE',
      render: (_, row) =>
        row.resources?.[0]?.link ? (
          <a href={row.resources[0].link} target='_blank' rel='noreferrer'>
            View POE
          </a>
        ) : (
          <Tag color='orange'>Missing</Tag>
        )
    },
    {
      title: 'Actions',
      render: (_, row) => (
        <Button
          type='link'
          onClick={() => {
            setSelected(row)
            form.setFieldsValue({
              notes: row.consultantNotes || '',
              poe: null
            })
            setModalOpen(true)
          }}
        >
          Edit / Upload POE
        </Button>
      )
    }
  ]

  const totalCompleted = interventions.length
  const withPOE = interventions.filter(i => i.resources?.[0]?.link).length
  const topArea = (() => {
    const areaCount: Record<string, number> = {}
    interventions.forEach(i => {
      const area = i.areaOfSupport || 'Unspecified'
      areaCount[area] = (areaCount[area] || 0) + 1
    })
    return Object.entries(areaCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
  })()

  return (
    <div style={{ minHeight: '100vh' }}>
      <Title level={3}>Completed Interventions</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Total Completed'
              value={totalCompleted}
              valueStyle={{ color: '#1890ff' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='With POE'
              value={withPOE}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PaperClipOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title='Most Common Area'
              value={topArea}
              valueStyle={{ color: '#faad14' }}
              prefix={<AppstoreAddOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Table
        rowKey='id'
        columns={columns}
        dataSource={interventions}
        loading={loading}
      />

      <Modal
        open={modalOpen}
        title='Update Notes & Manage POEs'
        onCancel={() => setModalOpen(false)}
        onOk={form.submit}
        confirmLoading={uploading}
      >
        <Form form={form} layout='vertical' onFinish={handleUpload}>
          <Form.Item
            name='notes'
            label='Consultant Notes'
            rules={[{ required: true, message: 'Please input notes' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          {/* Display current POEs */}
          {selected?.resources?.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong>Current POEs:</Typography.Text>
              <ul style={{ paddingLeft: 16 }}>
                {selected.resources.map((res: any, index: number) => (
                  <li key={index} style={{ marginBottom: 8 }}>
                    <a href={res.link} target='_blank' rel='noreferrer'>
                      📎 {res.label}
                    </a>
                    <Button
                      size='small'
                      danger
                      type='text'
                      onClick={() => {
                        const updatedResources = [...selected.resources]
                        updatedResources.splice(index, 1)
                        setSelected(prev => ({
                          ...prev,
                          resources: updatedResources
                        }))
                      }}
                      style={{ marginLeft: 8 }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Form.Item name='poe' label='Upload New POE (PDF or Image)'>
            <Upload beforeUpload={() => false} maxCount={1}>
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AllocatedHistory
