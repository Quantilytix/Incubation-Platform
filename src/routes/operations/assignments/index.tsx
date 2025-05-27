import React, { useState, useEffect } from 'react'
import {
  Card,
  Typography,
  Table,
  Space,
  Tag,
  Button,
  Tooltip,
  Modal,
  Form,
  Input,
  message,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd'
import {
  CheckCircleOutlined,
  HourglassOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  CalendarOutlined,
  CommentOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { useGetIdentity } from '@refinedev/core'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  getDoc,
  setDoc,
  doc,
  Timestamp,
  updateDoc,
  getDocs,
  addDoc,
  query,
  where
} from 'firebase/firestore'
import { db } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
type InterventionType = 'singular' | 'grouped'

interface Assignment {
  id: string
  participantId: string
  beneficiaryName: string
  interventionTitle: string
  type: InterventionType
  consultantId: string
  consultantName: string
  status: 'assigned' | 'in-progress' | 'completed' | 'cancelled'
  consultantStatus: 'pending' | 'accepted' | 'declined'
  userStatus: 'pending' | 'accepted' | 'declined'
  consultantCompletionStatus: 'pending' | 'done'
  userCompletionStatus: 'pending' | 'confirmed'
  createdAt: Timestamp
  updatedAt?: Timestamp
  dueDate?: Timestamp
  notes?: string
  feedback?: {
    rating: number
    comments: string
  }
  timeSpentHours?: number
  targetType?: 'percentage' | 'number'
  targetValue?: number
  targetMetric?: string
}

interface UserIdentity {
  id: string
  name?: string
  email?: string
  role?: string
  avatar?: string
  [key: string]: any
}
interface Participant {
  id: string
  beneficiaryName: string
  requiredInterventions: { id: string; title: string }[]
  completedInterventions: { id: string; title: string }[]
  sector?: string
  stage?: string
  province?: string
  city?: string
  location?: string
  programName?: string
}

interface Intervention {
  id: string
  interventionTitle: string
  areaOfSupport: string
}

export const ConsultantAssignments: React.FC = () => {
  const { user, loading: userLoading } = useFullIdentity()
  const navigate = useNavigate()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [consultants, setConsultants] = useState<
    { id: string; name: string }[]
  >([])
  const [participantInterventionMap, setParticipantInterventionMap] = useState<
    Record<string, string[]>
  >({})

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null)
  const [lockedIntervention, setLockedIntervention] = useState<any>(null)

  const [selectedType, setSelectedType] = useState<'singular' | 'grouped'>(
    'singular'
  )

  const [assignmentParticipant, setAssignmentParticipant] =
    useState<Participant | null>(null)
  const [assignmentModalVisible, setAssignmentModalVisible] = useState(false)
  const [assignmentForm] = Form.useForm()
  const [dataLoaded, setDataLoaded] = useState(false)
  const [newAssignmentId, setNewAssignmentId] = useState<string | null>(null)
  const [manageModalVisible, setManageModalVisible] = useState(false)
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null)
  const [interventionFilter, setInterventionFilter] = useState<
    'all' | 'assigned' | 'unassigned'
  >('all')
  const [searchText, setSearchText] = useState('')
  const [selectedProgram, setSelectedProgram] = useState<string | undefined>()
  const [departments, setDepartments] = useState<any[]>([])
  const [userDepartment, setUserDepartment] = useState<any>(null)

  const fetchDepartments = async (companyCode: string) => {
    const snapshot = await getDocs(
      query(
        collection(db, 'departments'),
        where('companyCode', '==', companyCode)
      )
    )
    setDepartments(
      snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
    )
  }

  const fetchAssignments = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'assignedInterventions'))
      const fetchedAssignments: Assignment[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[]

      const currentParticipantMap = new Map(
        participants.map(p => [p.id, p.beneficiaryName])
      )
      const currentConsultantMap = new Map(consultants.map(c => [c.id, c.name]))

      const enrichedAssignments = fetchedAssignments.map(assignment => {
        const foundParticipant = participants.find(
          p => p.id === assignment.participantId
        )
        const foundIntervention = foundParticipant?.requiredInterventions.find(
          i => i.id === assignment.interventionId
        )

        return {
          ...assignment,
          beneficiaryName:
            currentParticipantMap.get(assignment.participantId) ||
            'Unknown Beneficiary',
          consultantName:
            currentConsultantMap.get(assignment.consultantId) ||
            'Unknown Consultant',
          area: foundIntervention?.area || 'Unknown Area',
          interventionTitle:
            foundIntervention?.title || assignment.interventionTitle
        }
      })

      setAssignments(enrichedAssignments)
      console.log('user.companyCode', user?.companyCode)
    } catch (error) {
      console.error('Error fetching assignments:', error)
      message.error('Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    console.log('🔍 user identity from useGetIdentity:', user)
  }, [user])

  useEffect(() => {
    if (dataLoaded) {
      setLoading(true)
      fetchAssignments()
    }
  }, [dataLoaded, participants, consultants])

  useEffect(() => {
    const fetchParticipantsConsultantsAndInterventions = async () => {
      try {
        const [
          applicationsSnapshot,
          consultantsSnapshot,
          participantsSnapshot
        ] = await Promise.all([
          getDocs(collection(db, 'applications')),
          getDocs(collection(db, 'consultants')),
          getDocs(collection(db, 'participants'))
        ])

        // Map of participantId => participant data
        const participantMap = new Map(
          participantsSnapshot.docs.map(doc => [doc.id, doc.data()])
        )

        // Filter applications based on companyCode match
        const filteredApplications = applicationsSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(
            app =>
              app.companyCode === user?.companyCode &&
              app.applicationStatus === 'accepted' // 👈 Only show accepted
          )

        const fetchedParticipants: Participant[] = filteredApplications.map(
          app => {
            const participantData = participantMap.get(app.participantId) || {}

            return {
              id: app.participantId,
              beneficiaryName: app.beneficiaryName || 'Unknown',
              sector: participantData.sector || '—',
              stage: participantData.stage || '—',
              province: participantData.province || '—',
              city: participantData.city || '—',
              location: participantData.location || '—',
              programName: app.programName,
              requiredInterventions: app.interventions?.required || [],
              completedInterventions: app.interventions?.completed || []
            }
          }
        )

        const participantInterventionMap: Record<string, string[]> = {}
        fetchedParticipants.forEach(p => {
          participantInterventionMap[p.id] = p.requiredInterventions.map(
            i => i.id
          )
        })

        const fetchedConsultants = consultantsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }))

        console.log('Filtered Applications:', filteredApplications)

        console.log(
          'Participants built from Applications:',
          fetchedParticipants
        )
        setParticipants(fetchedParticipants)
        setConsultants(fetchedConsultants)
        setParticipantInterventionMap(participantInterventionMap)
        setDataLoaded(true)
      } catch (error) {
        console.error('❌ Error fetching data:', error)
        message.error('Failed to load participant or application data.')
      }
    }

    if (user) {
      fetchParticipantsConsultantsAndInterventions()
    }
  }, [user])

  // After user and participants are loaded:
  useEffect(() => {
    if (user?.companyCode) {
      fetchDepartments(user.companyCode)
    }
  }, [user])

  useEffect(() => {
    if (user?.departmentId && departments.length) {
      const dep = departments.find(d => d.id === user.departmentId)
      setUserDepartment(dep || null)
    }
  }, [user, departments])

  const handleSaveNotes = async (values: any) => {
    if (!selectedAssignment) return

    try {
      const updatedAssignments = assignments.map(a => {
        if (a.id === selectedAssignment.id) {
          return {
            ...a,
            notes: values.notes
          }
        }
        return a
      })

      setAssignments(updatedAssignments)
      message.success('Notes saved successfully')
    } catch (error) {
      console.error('Error saving notes:', error)
      message.error('Failed to save notes')
    }
  }

  const handleCompleteAssignment = (assignmentId: string) => {
    Modal.confirm({
      title: 'Mark Assignment as Completed',
      content: 'Are you sure you want to mark this assignment as completed?',
      onOk: async () => {
        try {
          const assignmentToComplete = assignments.find(
            a => a.id === assignmentId
          )
          if (!assignmentToComplete) {
            message.error('Assignment not found')
            return
          }

          // 1. Update the assignment status locally
          const updatedAssignments = assignments.map(a =>
            a.id === assignmentId ? { ...a, status: 'completed' } : a
          )
          setAssignments(updatedAssignments)

          // 2. Update Firestore for this assignment
          await setDoc(doc(db, 'assignedInterventions', assignmentId), {
            ...assignmentToComplete,
            status: 'completed'
          })

          // 3. Update Participant's completedInterventions array
          const participantRef = doc(
            db,
            'participants',
            assignmentToComplete.participantId
          )
          const participantSnap = await getDoc(participantRef)

          if (participantSnap.exists()) {
            const participantData = participantSnap.data()
            const currentCompleted: any[] =
              participantData.interventions?.completed || []

            // Add the interventionId if not already added
            const interventionIdToAdd = assignmentToComplete.interventionId
            const interventionTitleToAdd =
              assignmentToComplete.interventionTitle

            if (
              !currentCompleted.some(comp => comp.id === interventionIdToAdd)
            ) {
              const updatedCompleted = [
                ...currentCompleted,
                { id: interventionIdToAdd, title: interventionTitleToAdd }
              ]
              await updateDoc(participantRef, {
                'interventions.completed': updatedCompleted
              })
            }
          }

          // 4. Notify relevant roles that the intervention is completed
          await addDoc(collection(db, 'notifications'), {
            interventionId: assignmentToComplete.id,
            participantId: assignmentToComplete.participantId,
            consultantId: assignmentToComplete.consultantId,
            interventionTitle: assignmentToComplete.interventionTitle,
            type: 'intervention-completed',
            recipientRoles: [
              'projectadmin',
              'consultant',
              'incubatee',
              'operations'
            ],
            message: {
              consultant: `You have completed the intervention: ${assignmentToComplete.interventionTitle}.`,
              projectadmin: `Consultant ${assignmentToComplete.consultantName} completed the intervention for ${assignmentToComplete.beneficiaryName}.`,
              operations: `Consultant ${assignmentToComplete.consultantName} completed the intervention for ${assignmentToComplete.beneficiaryName}.`,
              incubatee: `Consultant ${assignmentToComplete.consultantName} has completed the intervention: ${assignmentToComplete.interventionTitle}. Please confirm if completed as expected.`
            },
            createdAt: new Date(),
            readBy: {}
          })

          message.success(
            'Assignment marked as completed and participant progress updated! 🎯'
          )
        } catch (error) {
          console.error('Error completing assignment:', error)
          message.error('Failed to complete assignment')
        }
      }
    })
  }

  const handleManageParticipant = (participant: Participant) => {
    setSelectedParticipant(participant)
    setManageModalVisible(true)
    setInterventionFilter('all')
  }

  const getFilteredInterventions = () => {
    if (!selectedParticipant) return []

    const requiredIds = participantInterventionMap[selectedParticipant.id] || []
    const assignedForParticipant = assignments.filter(
      a => a.participantId === selectedParticipant.id
    )
    const assignedIds = assignedForParticipant.map(a => a.interventionId)

    if (interventionFilter === 'assigned') {
      return assignedForParticipant
    }

    if (interventionFilter === 'unassigned') {
      return requiredIds
        .filter(id => !assignedIds.includes(id))
        .map(id => {
          const intervention = selectedParticipant.requiredInterventions.find(
            i => i.id === id
          )
          return {
            id,
            interventionTitle:
              intervention?.interventionTitle ||
              intervention?.title ||
              'Unknown',
            consultantName: 'Not Assigned',
            status: 'Not Assigned',
            dueDate: null,
            isUnassigned: true,
            beneficiaryName: selectedParticipant.beneficiaryName,
            sector: selectedParticipant.sector,
            programName: selectedParticipant.programName
            // add any other fields your columns expect here!
          }
        })
    }

    // All = merge assigned + unassigned
    const assignedMap = new Map(
      assignedForParticipant.map(a => [a.interventionId, a])
    )

    return requiredIds.map(id => {
      const assignment = assignedMap.get(id)
      if (assignment) return assignment

      const intervention = selectedParticipant.requiredInterventions.find(
        i => i.id === id
      )

      return {
        id,
        interventionTitle:
          intervention?.interventionTitle || intervention?.title || 'Unknown',
        consultantName: 'Not Assigned',
        status: 'Unassigned',
        dueDate: null,
        isUnassigned: true
      }
    })
  }

  const getCompositeStatus = (assignment: Assignment) => {
    const {
      status,
      consultantStatus,
      userStatus,
      consultantCompletionStatus,
      userCompletionStatus
    } = assignment

    if (status === 'cancelled') return { label: 'Cancelled', color: 'red' }

    if (
      status === 'completed' ||
      (consultantCompletionStatus === 'done' &&
        userCompletionStatus === 'confirmed')
    ) {
      return { label: 'Completed', color: 'green' }
    }

    if (consultantStatus === 'declined' || userStatus === 'declined') {
      return { label: 'Declined', color: 'red' }
    }

    if (userCompletionStatus === 'rejected') {
      return { label: 'Rejected', color: 'volcano' }
    }

    if (
      consultantCompletionStatus === 'done' &&
      userCompletionStatus === 'pending'
    ) {
      return { label: 'Awaiting Confirmation', color: 'purple' }
    }

    if (
      consultantStatus === 'accepted' &&
      userStatus === 'accepted' &&
      consultantCompletionStatus !== 'done'
    ) {
      return { label: 'In Progress', color: 'blue' }
    }

    if (consultantStatus === 'pending' || userStatus === 'pending') {
      return { label: 'Awaiting Acceptance', color: 'orange' }
    }

    return { label: 'Assigned', color: 'gold' }
  }

  const handleQuickAssign = (intervention: any) => {
    if (!selectedParticipant) return

    setAssignmentParticipant(selectedParticipant)
    setLockedIntervention(intervention)
    assignmentForm.setFieldsValue({
      participant: selectedParticipant.id,
      intervention: intervention.id
    })
    setAssignmentModalVisible(true)
  }

  const totalRequired = Object.values(participantInterventionMap).reduce(
    (sum, list) => sum + list.length,
    0
  )

  const participantIds = new Set(participants.map(p => p.id))
  const scopedAssignments = assignments.filter(a =>
    participantIds.has(a.participantId)
  )

  const totalAssigned = scopedAssignments.length
  const totalCompleted = scopedAssignments.filter(a => {
    const { label } = getCompositeStatus(a)
    return label === 'Completed'
  }).length

  const requiredInterventionIds = new Set(
    Object.values(participantInterventionMap).flat()
  )

  const scopedCompleted = scopedAssignments.filter(
    a =>
      requiredInterventionIds.has(a.interventionId) &&
      getCompositeStatus(a).label === 'Completed'
  )

  const completionRate = totalRequired
    ? Math.round((scopedCompleted.length / totalRequired) * 100)
    : 0

  const getRateTag = (rate: number) => {
    if (rate <= 25) return <Tag color='red'>Critical</Tag>
    if (rate <= 60) return <Tag color='orange'>Low</Tag>
    if (rate <= 85) return <Tag color='gold'>Moderate</Tag>
    return <Tag color='green'>Good</Tag>
  }

  const getAssignmentRate = (participantId: string) => {
    const required = participantInterventionMap[participantId] || []
    const assigned = assignments.filter(a => a.participantId === participantId)
    return `${assigned.length} / ${required.length}`
  }

  const getDepartmentName = intervention => {
    const dep = departments.find(d => d.id === intervention.departmentId)
    return dep ? dep.name : 'Unknown'
  }

  const progressMetrics = [
    {
      title: 'Assigned / Required',
      value: `${totalAssigned} / ${totalRequired}`,
      color: '#1890ff',
      icon: <CheckCircleOutlined />
    },
    {
      title: 'Completed / Assigned',
      value: <Space>{`${totalCompleted} / ${totalAssigned}`}</Space>,
      color: '#52c41a',
      icon: <CalendarOutlined />
    },
    {
      title: 'Completion Rate',
      customRender: (
        <Progress
          percent={completionRate}
          strokeColor={
            completionRate > 75
              ? '#52c41a'
              : completionRate > 40
              ? '#faad14'
              : '#f5222d'
          }
        />
      ),
      icon: <CommentOutlined />
    }
  ]

  const columns = [
    {
      title: 'Beneficiary',
      dataIndex: 'beneficiaryName',
      key: 'beneficiaryName'
    },
    {
      title: 'Sector',
      dataIndex: 'sector',
      key: 'sector'
    },
    {
      title: 'Program',
      dataIndex: 'programName',
      key: 'programName'
    },
    {
      title: 'Required Interventions',
      key: 'requiredInterventions',
      render: (_: any, record: Participant) => {
        const required = participantInterventionMap[record.id] || []
        return <Tag>{required.length}</Tag>
      }
    },
    {
      title: 'Assignment Rate',
      key: 'assignmentRate',
      render: (_: any, record: Participant) => {
        const required = participantInterventionMap[record.id] || []
        const assigned = assignments.filter(a => a.participantId === record.id)
        return (
          <Space>
            <Text>{`${assigned.length} / ${required.length}`}</Text>
            {getRateTag((assigned.length / required.length) * 100 || 0)}
          </Space>
        )
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Participant) => (
        <Button type='link' onClick={() => handleManageParticipant(record)}>
          Manage
        </Button>
      )
    }
  ]

  const modalColumns = [
    {
      title: 'Intervention Title',
      dataIndex: 'interventionTitle',
      key: 'interventionTitle'
    },
    {
      title: 'Department',
      key: 'department',
      render: (_: any, record: any) => getDepartmentName(record)
    },
    {
      title: 'Consultant',
      dataIndex: 'consultantName',
      key: 'consultantName'
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => {
        if (record.isUnassigned) {
          return <Tag color='default'>Unassigned</Tag>
        }

        const { label, color } = getCompositeStatus(record)
        return <Tag color={color}>{label}</Tag>
      }
    },
    {
      title: 'Due Date',
      key: 'dueDate',
      render: (_: any, record: any) => {
        if (!record.dueDate) return '—'
        const date =
          typeof record.dueDate === 'string'
            ? new Date(record.dueDate)
            : record.dueDate?.toDate?.() ?? new Date()
        return date.toLocaleDateString()
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => {
        if (record.isUnassigned) {
          return (
            <Button type='link' onClick={() => handleQuickAssign(record)}>
              Assign
            </Button>
          )
        }
        return null
      }
    }
  ]

  let departmentFilteredParticipants = participants
  if (userDepartment && !userDepartment.isMain) {
    departmentFilteredParticipants = participants.filter(participant =>
      (participant.requiredInterventions || []).some(
        intervention => intervention.departmentId === userDepartment.id
      )
    )
  }

  const filteredParticipants = departmentFilteredParticipants.filter(p => {
    const matchesSearch = p.beneficiaryName
      .toLowerCase()
      .includes(searchText.toLowerCase())

    const matchesProgram = selectedProgram
      ? p.programName === selectedProgram
      : true

    return matchesSearch && matchesProgram
  })

  return (
    <div style={{ padding: 24, minHeight: '100vh' }}>
      <Helmet>
        <title>Consultant Assignments | Incubation Platform</title>
      </Helmet>

      {/* 🔘 Header + Button */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 24
        }}
      >
        <Title level={4}>Consultant Assignments</Title>
        <Button
          type='primary'
          icon={<CheckCircleOutlined />}
          onClick={() => setAssignmentModalVisible(true)}
        >
          Assign New Intervention
        </Button>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {progressMetrics.map(({ title, value, icon, customRender, color }) => (
          <Col xs={24} sm={12} md={8} key={title}>
            <Card loading={loading}>
              <Statistic
                title={
                  <Space>
                    <span style={{ color, fontSize: 18 }}>{icon}</span>
                    {title}
                  </Space>
                }
                valueRender={() => customRender ?? <span>{value}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row justify='space-between' style={{ marginBottom: 16 }}>
        <Col>
          <Input.Search
            placeholder='Search beneficiary...'
            allowClear
            onSearch={value => setSearchText(value)}
            style={{ width: 250 }}
          />
        </Col>

        <Col>
          <Select
            placeholder='Filter by program'
            allowClear
            style={{ width: 250 }}
            value={selectedProgram}
            onChange={value => setSelectedProgram(value)}
          >
            {[...new Set(participants.map(p => p.programName))].map(program => (
              <Select.Option key={program} value={program}>
                {program}
              </Select.Option>
            ))}
          </Select>
        </Col>
      </Row>

      {/* 🔁 Assignment Table */}
      <Table
        columns={columns}
        dataSource={filteredParticipants}
        rowKey='id'
        pagination={{ pageSize: 10 }}
        loading={loading}
      />

      {/* 📝 Assignments Modal */}
      <Modal
        title='Assign New Intervention'
        open={assignmentModalVisible}
        onCancel={() => {
          setAssignmentModalVisible(false)
          setLockedIntervention(null)
          setAssignmentParticipant(null)
          assignmentForm.resetFields()
        }}
        footer={null}
      >
        <Form
          form={assignmentForm}
          layout='vertical'
          onFinish={async values => {
            try {
              const selectedParticipant = participants.find(
                p => p.id === values.participant
              )

              console.log(selectedParticipant)
              const selectedConsultant = consultants.find(
                c => c.id === values.consultant
              )
              const selectedIntervention =
                selectedParticipant?.requiredInterventions.find(
                  i => i.id === values.intervention
                )

              if (
                !selectedParticipant ||
                !selectedConsultant ||
                !selectedIntervention
              ) {
                console.warn('DEBUG:', {
                  participant: values.participant,
                  consultant: values.consultant,
                  intervention: values.intervention,
                  selectedParticipant,
                  selectedConsultant,
                  selectedIntervention
                })
                message.error('Invalid data selected. Please retry.')
                return
              }

              const newId = `ai${Date.now()}`

              const newAssignment = {
                id: newId,
                participantId: selectedParticipant.id,
                beneficiaryName: selectedParticipant.beneficiaryName,
                consultantId: selectedConsultant.id,
                consultantName: selectedConsultant.name,
                interventionId: selectedIntervention.id,
                interventionTitle: selectedIntervention.title,
                type: values.type,
                targetType: values.targetType,
                targetValue: values.targetValue,
                targetMetric: values.targetMetric,
                dueDate: values.dueDate
                  ? Timestamp.fromDate(values.dueDate.toDate())
                  : null, // ✅ ADD THIS
                status: 'assigned',
                consultantStatus: 'pending',
                userStatus: 'pending',
                consultantCompletionStatus: 'pending',
                userCompletionStatus: 'pending',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
              }

              await setDoc(
                doc(db, 'assignedInterventions', newId),
                newAssignment
              )

              setNewAssignmentId(newId)

              fetchAssignments()

              message.success('New intervention assigned successfully')
              setAssignmentModalVisible(false)
              assignmentForm.resetFields()
            } catch (error) {
              console.error('❌ Error assigning intervention:', error)
              message.error('Failed to create assignment')
            }
          }}
          onValuesChange={changedValues => {
            if (changedValues.participant) {
              assignmentForm.setFieldsValue({
                intervention: undefined
              })

              const selectedParticipant = participants.find(
                p => p.id === changedValues.participant
              )

              console.log('🛠 Selected Participant:', selectedParticipant)
              console.log(
                '📋 Required Interventions:',
                selectedParticipant?.requiredInterventions
              )
            }
            if (changedValues.targetType) {
              if (changedValues.targetType === 'percentage') {
                assignmentForm.setFieldsValue({ targetMetric: 'Completion' })
              } else {
                assignmentForm.setFieldsValue({ targetMetric: undefined })
              }
            }
          }}
        >
          {/* Participant */}
          <Form.Item
            name='participant'
            label='Select Beneficiary'
            rules={[{ required: true, message: 'Please select a participant' }]}
          >
            <Select
              placeholder='Choose a beneficiary'
              disabled={!!assignmentParticipant}
            >
              {participants.map(p => (
                <Select.Option key={p.id} value={p.id}>
                  {p.beneficiaryName}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Intervention */}
          <Form.Item
            shouldUpdate={(prev, curr) => prev.participant !== curr.participant}
            noStyle
          >
            {({ getFieldValue }) => {
              const participantId = getFieldValue('participant')
              const selected = participants.find(p => p.id === participantId)
              const filtered =
                userDepartment && !userDepartment.isMain
                  ? (selected?.requiredInterventions || []).filter(
                      i => i.departmentId === userDepartment.id
                    )
                  : selected?.requiredInterventions || []

              return (
                <Form.Item
                  name='intervention'
                  label='Select Intervention'
                  rules={[
                    { required: true, message: 'Please select an intervention' }
                  ]}
                >
                  <Select
                    placeholder='Choose an intervention'
                    disabled={!!lockedIntervention || !participantId}
                  >
                    {filtered.map(intervention => (
                      <Select.Option
                        key={intervention.id}
                        value={intervention.id}
                      >
                        {intervention.title} ({intervention.area || 'No Area'})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }}
          </Form.Item>

          {/* Consultant */}
          <Form.Item
            name='consultant'
            label='Select Consultant'
            rules={[{ required: true, message: 'Please select a consultant' }]}
          >
            <Select placeholder='Choose a consultant'>
              {consultants.map(c => (
                <Select.Option key={c.id} value={c.id}>
                  {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Type */}
          <Form.Item
            name='type'
            label='Assignment Type'
            rules={[
              { required: true, message: 'Please select assignment type' }
            ]}
          >
            <Select placeholder='Select type'>
              <Select.Option value='singular'>Singular (1 SME)</Select.Option>
              <Select.Option value='grouped'>
                Grouped (Multiple SMEs)
              </Select.Option>
            </Select>
          </Form.Item>

          {/* Target */}
          <Form.Item
            name='targetType'
            label='Target Type'
            rules={[{ required: true, message: 'Please select target type' }]}
          >
            <Select placeholder='Select target type'>
              <Select.Option value='percentage'>Percentage (%)</Select.Option>
              <Select.Option value='number'>
                Number (Hours, Sessions, etc.)
              </Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            shouldUpdate={(prev, curr) => prev.targetType !== curr.targetType}
            noStyle
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('targetType')

              if (type === 'percentage') {
                return (
                  <>
                    <Form.Item
                      name='targetMetric'
                      label='Percentage Goal Label'
                    >
                      <Input disabled value='Completion' />
                    </Form.Item>
                    <Form.Item
                      name='targetValue'
                      label='Target Completion (%)'
                      rules={[{ required: true, message: 'Enter % target' }]}
                    >
                      <Input type='number' max={100} min={1} suffix='%' />
                    </Form.Item>
                  </>
                )
              }

              if (type === 'number') {
                return (
                  <>
                    <Form.Item
                      name='targetMetric'
                      label='Unit of Measure'
                      rules={[{ required: true, message: 'Choose a metric' }]}
                    >
                      <Select mode='tags' placeholder='e.g. Hours, Sessions'>
                        <Select.Option value='hours'>Hours</Select.Option>
                        <Select.Option value='sessions'>Sessions</Select.Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      name='targetValue'
                      label='Target Value'
                      rules={[
                        { required: true, message: 'Enter numeric goal' }
                      ]}
                    >
                      <Input type='number' placeholder='e.g. 5 or 10' />
                    </Form.Item>
                  </>
                )
              }

              return null
            }}
          </Form.Item>
          <Form.Item
            name='dueDate'
            label='Due Date'
            rules={[{ required: true, message: 'Please select a due date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' block>
              Create Assignment
            </Button>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`Interventions for ${selectedParticipant?.beneficiaryName}`}
        open={manageModalVisible}
        onCancel={() => setManageModalVisible(false)}
        footer={null}
        width={900}
      >
        <Form layout='inline' style={{ marginBottom: 16 }}>
          <Form.Item label='Filter'>
            <Select
              value={interventionFilter}
              onChange={val => setInterventionFilter(val)}
              style={{ width: 200 }}
            >
              <Select.Option value='all'>All Interventions</Select.Option>
              <Select.Option value='assigned'>Assigned</Select.Option>
              <Select.Option value='unassigned'>Unassigned</Select.Option>
            </Select>
          </Form.Item>
        </Form>

        <Table
          columns={modalColumns}
          dataSource={getFilteredInterventions()}
          rowKey='id'
          expandable={{
            expandedRowRender: (record: any) => {
              if (record.isUnassigned) {
                return (
                  <Text type='secondary'>
                    This intervention has not been assigned yet.
                  </Text>
                )
              }

              return (
                <div style={{ padding: 10 }}>
                  <Paragraph>
                    <Text strong>Type:</Text> {record.type || 'N/A'} <br />
                    <Text strong>Target:</Text> {record.targetValue ?? '—'}{' '}
                    {record.targetType ?? ''} ({record.targetMetric || '—'})
                  </Paragraph>

                  <Paragraph>
                    <Text strong>Assigned On:</Text>{' '}
                    {record.createdAt?.toMillis
                      ? new Date(
                          record.createdAt.toMillis()
                        ).toLocaleDateString()
                      : 'N/A'}
                  </Paragraph>

                  {record.dueDate && (
                    <Paragraph>
                      <Text strong>Due Date:</Text>{' '}
                      {typeof record.dueDate === 'string'
                        ? new Date(record.dueDate).toLocaleDateString()
                        : record.dueDate?.toDate?.()?.toLocaleDateString() ??
                          'N/A'}
                    </Paragraph>
                  )}

                  {/* Status Breakdown */}
                  <Paragraph>
                    <Text strong>Status Summary:</Text>
                    <br />
                    <Tag color='blue'>Overall: {record.status}</Tag>
                    <Tag color='purple'>
                      Consultant: {record.consultantStatus}
                    </Tag>
                    <Tag color='gold'>User: {record.userStatus}</Tag>
                    <Tag color='cyan'>
                      Consultant Completion: {record.consultantCompletionStatus}
                    </Tag>
                    <Tag color='lime'>
                      User Confirmation: {record.userCompletionStatus}
                    </Tag>
                  </Paragraph>

                  {/* Feedback (if any) */}
                  {record.feedback && (
                    <Paragraph>
                      <Text strong>Feedback:</Text>
                      <br />
                      <Text italic>"{record.feedback.comments}"</Text>
                      <br />
                      <Tag color='green'>
                        Rating: {record.feedback.rating} / 5
                      </Tag>
                    </Paragraph>
                  )}

                  {/* Notes (if any) */}
                  {record.notes && (
                    <Paragraph>
                      <Text strong>Notes:</Text> {record.notes}
                    </Paragraph>
                  )}

                  {/* Awaiting Actions */}
                  {(() => {
                    const pendingFrom: string[] = []
                    const pendingDetails: string[] = []

                    if (record.consultantStatus === 'pending') {
                      pendingFrom.push('Consultant')
                      pendingDetails.push(
                        'Consultant has not accepted the intervention.'
                      )
                    }

                    if (record.userStatus === 'pending') {
                      pendingFrom.push('Participant')
                      pendingDetails.push(
                        'Participant has not accepted the intervention.'
                      )
                    }

                    if (record.consultantCompletionStatus === 'pending') {
                      if (!pendingFrom.includes('Consultant'))
                        pendingFrom.push('Consultant')
                      pendingDetails.push(
                        'Consultant has not marked the intervention as complete.'
                      )
                    }

                    if (record.userCompletionStatus === 'pending') {
                      if (!pendingFrom.includes('Participant'))
                        pendingFrom.push('Participant')
                      pendingDetails.push(
                        'Participant has not confirmed completion.'
                      )
                    }

                    if (pendingDetails.length === 0) return null

                    return (
                      <div style={{ marginTop: 12 }}>
                        <Paragraph>
                          <Text strong>Awaiting Action From:</Text>
                          <br />
                          {pendingFrom.join(', ')}
                        </Paragraph>
                        <Paragraph>
                          <Text strong>Actions:</Text>
                          <ul style={{ paddingLeft: 20 }}>
                            {pendingDetails.map((msg, idx) => (
                              <li key={idx}>{msg}</li>
                            ))}
                          </ul>
                        </Paragraph>
                      </div>
                    )
                  })()}
                </div>
              )
            }
          }}
        />
      </Modal>

      <style>
        {`
      .highlghted {
        background-color: #e6fffb !important;
        animation: fadeOut 8s forwards;
      }
        0% {background-color: #e6fffb; }
        100% {background-color: white; }
      }
      `}
      </style>
    </div>
  )
}
