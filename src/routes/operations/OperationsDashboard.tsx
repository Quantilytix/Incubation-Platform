// import React, { useEffect, useState } from 'react'
// import {
//   Card,
//   Row,
//   Col,
//   Statistic,
//   Typography,
//   List,
//   Tag,
//   Space,
//   Divider,
//   Progress,
//   Button,
//   Timeline,
//   Badge,
//   Modal,
//   Form,
//   message,
//   Layout,
//   Alert,
//   Descriptions
// } from 'antd'
// import {
//   CalendarOutlined,
//   CheckCircleOutlined,
//   ExclamationCircleOutlined,
//   FileSearchOutlined,
//   ClockCircleOutlined,
//   ScheduleOutlined,
//   FileTextOutlined,
//   FormOutlined,
//   ApartmentOutlined,
//   TeamOutlined,
//   BarsOutlined,
//   BellOutlined,
//   DeleteOutlined,
//   UploadOutlined,
//   BarChartOutlined,
//   ArrowRightOutlined
// } from '@ant-design/icons'
// import { useNavigate } from 'react-router-dom'
// import { Helmet } from 'react-helmet'
// import { db } from '@/firebase'
// import {
//   collection,
//   getDocs,
//   setDoc,
//   doc,
//   Timestamp,
//   getDoc,
//   updateDoc,
//   where,
//   query
// } from 'firebase/firestore'
// import FullCalendar from '@fullcalendar/react'
// import dayGridPlugin from '@fullcalendar/daygrid'
// import dayjs from 'dayjs'
// import { useFullIdentity } from '@/hooks/src/useFullIdentity'
// import { TaskModal } from '@/components/op-dashboard/TaskModal'
// import { EventModal } from '@/components/op-dashboard/EventModal'
// import { PREDEFINED_TASK_TYPES } from '@/types/TaskType'
// import Highcharts from 'highcharts'
// import HighchartsReact from 'highcharts-react-official'
// import HighchartsMore from 'highcharts/highcharts-more'
// import HighchartsAccessibility from 'highcharts/modules/accessibility'
// import { motion } from 'framer-motion'

// // Initialize additional modules
// if (typeof HighchartsMore === 'function') {
//   HighchartsMore(Highcharts)
// }
// if (typeof HighchartsAccessibility === 'function') {
//   HighchartsAccessibility(Highcharts)
// }

// const { Text } = Typography

// export const OperationsDashboard: React.FC = () => {
//   const navigate = useNavigate()
//   const [participants, setParticipants] = useState<any[]>([])
//   const [interventions, setInterventions] = useState<any[]>([])
//   const [appointments, setAppointments] = useState<any[]>([])
//   const [appointmentsLoading, setAppointmentsLoading] = useState(true)
//   const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
//   const [tasks, setTasks] = useState<any[]>([])
//   const [events, setEvents] = useState<any[]>([])
//   const [eventModalOpen, setEventModalOpen] = useState(false)
//   const [calendarModalOpen, setCalendarModalOpen] = useState(false)
//   const [eventForm] = Form.useForm()
//   const [selectedEvent, setSelectedEvent] = useState<any>(null)
//   const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
//   const [notifications, setNotifications] = useState<any[]>([])
//   const [notificationModalOpen, setNotificationModalOpen] = useState(false)
//   const [filterType, setFilterType] = useState<string | null>(null)
//   const [userRole, setUserRole] = useState<'operations'>()
//   const [declineModalOpen, setDeclineModalOpen] = useState(false)
//   const [declineReason, setDeclineReason] = useState('')
//   const [declining, setDeclining] = useState(false)
//   const [directCosts, setDirectCosts] = useState([
//     { description: '', amount: '' }
//   ])
//   const [departments, setDepartments] = useState<any[]>([])
//   const [userDepartment, setUserDepartment] = useState<any>(null)
//   const [consultants, setConsultants] = useState<any[]>([])
//   const [projectAdmins, setProjectAdmins] = useState<any[]>([])
//   const [operationsUsers, setOperationsUsers] = useState<any[]>([])
//   const { user } = useFullIdentity()
//   const [consultantDocIds, setConsultantDocIds] = useState<
//     Record<string, string>
//   >({})
//   const [operationsDocIds, setOperationsDocIds] = useState<
//     Record<string, string>
//   >({})
//   const [proofModalOpen, setProofModalOpen] = useState(false)
//   const [selectedTask, setSelectedTask] = useState<any>(null)

//   useEffect(() => {
//     const fetchNotifications = async () => {
//       if (!user?.companyCode) return
//       try {
//         const snapshot = await getDocs(
//           query(
//             collection(db, 'notifications'),
//             where('companyCode', '==', user?.companyCode)
//           )
//         )
//         const all = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         })) as any[]
//         const filtered = all.filter(n =>
//           n.recipientRoles?.includes('operations')
//         )

//         setNotifications(filtered)
//       } catch (err) {
//         console.error('Error loading notifications:', err)
//       }
//     }
//     fetchNotifications()
//   }, [])

//   // Fetch appointments
//   useEffect(() => {
//     const fetchAppointments = async () => {
//       setAppointmentsLoading(true)
//       try {
//         const q = query(
//           collection(db, 'appointments'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)
//         const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
//         setAppointments(items)
//       } catch (err) {
//         console.error('Error fetching appointments:', err)
//       } finally {
//         setAppointmentsLoading(false)
//       }
//     }
//     if (user?.companyCode) fetchAppointments()
//   }, [user?.companyCode])

//   //   Fetch Assigned Interventions
//   const fetchAssignments = async () => {
//     if (!user?.companyCode) return
//     try {
//       const q = query(
//         collection(db, 'assignedInterventions'),
//         where('companyCode', '==', user?.companyCode)
//       )
//       const snapshot = await getDocs(q)

//       const fetchedAssignments = snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       }))

//       const currentParticipantMap = new Map(
//         participants.map(p => [p.id, p.beneficiaryName])
//       )
//       const currentConsultantMap = new Map(consultants.map(c => [c.id, c.name]))

//       const enrichedAssignments = fetchedAssignments.map(assignment => {
//         const foundParticipant = participants.find(
//           p => p.id === assignment.participantId
//         )
//         const foundIntervention = foundParticipant?.requiredInterventions.find(
//           i => i.id === assignment.interventionId
//         )

//         return {
//           ...assignment,
//           beneficiaryName:
//             currentParticipantMap.get(assignment.participantId) ||
//             'Unknown Beneficiary',
//           consultantName:
//             currentConsultantMap.get(assignment.consultantId) ||
//             'Unknown Consultant',
//           area: foundIntervention?.area || 'Unknown Area',
//           interventionTitle:
//             foundIntervention?.title || assignment.interventionTitle
//         }
//       })

//       setInterventions(enrichedAssignments)
//     } catch (error) {
//       console.error('Error fetching assignments:', error)
//       message.error('Failed to load assignments')
//     } finally {
//       //   setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchAssignments()
//   }, [user])

//   useEffect(() => {
//     if (!user?.companyCode) return

//     const fetchTasks = async () => {
//       try {
//         const q = query(
//           collection(db, 'tasks'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)
//         const taskList = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))
//         setTasks(taskList)
//       } catch (error) {
//         console.error('Error fetching tasks:', error)
//       }
//     }
//     const fetchAllOtherData = async () => {
//       try {
//         const q = query(
//           collection(db, 'applications'),
//           where('status', '==', 'accepted'),
//           where('companyCode', '==', user?.companyCode)
//         )

//         const snapshot = await getDocs(q)
//         const applications = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))

//         setParticipants(applications)
//       } catch (error) {
//         console.error('Error fetching applications:', error)
//       }
//     }
//     const fetchComplianceDocuments = async () => {
//       try {
//         const q = query(
//           collection(db, 'complianceDocuments'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)

//         const documents = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))
//         setComplianceDocuments(documents)
//       } catch (error) {
//         console.error('Error fetching compliance documents:', error)
//       }
//     }

//     fetchComplianceDocuments()
//     fetchTasks()
//     fetchAllOtherData()
//   }, [user?.companyCode])

//   useEffect(() => {
//     if (!user?.companyCode) return

//     const fetchEvents = async () => {
//       try {
//         const q = query(
//           collection(db, 'events'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)
//         const eventList = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))
//         setEvents(eventList)
//       } catch (error) {
//         console.error('Error fetching events:', error)
//       }
//     }
//     fetchEvents()
//   }, [user?.companyCode])

//   const handleEventClick = (event: any) => {
//     const eventData = events.find(e => e.id === event.id)
//     setSelectedEvent(eventData)
//     setEventDetailModalOpen(true)
//   }

//   const handleAddEvent = async (values: any) => {
//     const eventDate = dayjs(values.date).format('YYYY-MM-DD')

//     const start = dayjs(values.startTime)
//     const end = dayjs(values.endTime)

//     if (!start.isValid() || !end.isValid()) {
//       return message.error('Please select a valid start and end time.')
//     }

//     const startHour = start.hour()
//     const endHour = end.hour()

//     if (startHour < 6 || endHour > 18 || end.isBefore(start)) {
//       return message.error(
//         'Event time must be between 06:00 and 18:00, and end must be after start.'
//       )
//     }

//     const clash = events.some(
//       e =>
//         e.date === eventDate &&
//         dayjs(e.startTime).format('HH:mm') === start.format('HH:mm')
//     )
//     if (clash) {
//       return message.error('Another event is already scheduled for this time.')
//     }

//     try {
//       const newId = `event-${Date.now()}`

//       const newEvent = {
//         id: newId,
//         title: values.title,
//         date: eventDate,
//         startTime: Timestamp.fromDate(start.toDate()),
//         endTime: Timestamp.fromDate(end.toDate()),
//         type: values.eventType,
//         format: values.format,
//         location: values.location || '',
//         link: values.link || '',
//         description: values.description || '',
//         participants: values.participants || [],
//         createdAt: Timestamp.now(),
//         companyCode: user?.companyCode
//       }

//       await setDoc(doc(db, 'events', newId), newEvent)
//       setEvents(prev => [...prev, newEvent])
//       message.success('Event added successfully')
//       setEventModalOpen(false)
//       eventForm.resetFields()
//     } catch (error) {
//       console.error('Error adding event:', error)
//       message.error('Failed to add event')
//     }
//   }

//   const getEventIcon = (type: string) => {
//     switch (type) {
//       case 'meeting':
//         return <ClockCircleOutlined style={{ color: '#1890ff' }} />
//       case 'deadline':
//         return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
//       case 'event':
//         return <CalendarOutlined style={{ color: '#52c41a' }} />
//       case 'workshop':
//         return <FileTextOutlined style={{ color: '#722ed1' }} />
//       default:
//         return <CalendarOutlined style={{ color: '#1890ff' }} />
//     }
//   }

//   // Charts Logic
//   const upToDate = complianceDocuments.filter(
//     doc => doc.status === 'valid'
//   ).length
//   const needsReview = complianceDocuments.filter(
//     doc => doc.status === 'expiring'
//   ).length
//   const overdue = complianceDocuments.filter(
//     doc =>
//       doc.status === 'expired' ||
//       doc.status === 'missing' ||
//       doc.status === 'pending'
//   ).length
//   const total = complianceDocuments.length

//   const complianceChartOptions = {
//     colors: ['#52c41a', '#faad14', '#ff4d4f'], // Valid, Expiring, Overdue
//     chart: {
//       type: 'column',
//       inverted: true,
//       polar: true,
//       height: 320
//     },
//     title: {
//       text: 'Compliance Status Overview'
//     },
//     credits: {
//       enabled: false
//     },
//     tooltip: {
//       outside: true,
//       shared: true
//     },
//     pane: {
//       size: '85%',
//       innerSize: '20%',
//       endAngle: 270
//     },
//     xAxis: {
//       tickInterval: 1,
//       labels: {
//         align: 'right',
//         allowOverlap: true,
//         step: 1,
//         y: 3,
//         style: {
//           fontSize: '13px'
//         }
//       },
//       lineWidth: 0,
//       gridLineWidth: 0,
//       categories: [
//         'Valid <span class="f16"><span class="dot valid"></span></span>',
//         'Expiring <span class="f16"><span class="dot expiring"></span></span>',
//         'Overdue <span class="f16"><span class="dot overdue"></span></span>'
//       ],
//       useHTML: true
//     },
//     yAxis: {
//       lineWidth: 0,
//       tickInterval: 1,
//       reversedStacks: false,
//       endOnTick: true,
//       showLastLabel: true,
//       gridLineWidth: 1,
//       labels: {
//         enabled: false // 🔥 hides "Ongoing", "Completed", etc.
//       }
//     },
//     plotOptions: {
//       column: {
//         stacking: 'normal',
//         borderWidth: 0,
//         pointPadding: 0,
//         groupPadding: 0.15,
//         borderRadius: '50%',
//         dataLabels: {
//           enabled: true,
//           format: '{point.y}',
//           style: {
//             fontWeight: 'bold',
//             color: '#000'
//           }
//         }
//       }
//     },
//     legend: {
//       align: 'center',
//       verticalAlign: 'bottom',
//       itemStyle: {
//         fontWeight: 'normal'
//       }
//     },
//     series: [
//       {
//         name: 'Valid',
//         data: [upToDate, 0, 0]
//       },
//       {
//         name: 'Expiring',
//         data: [0, needsReview, 0]
//       },
//       {
//         name: 'Overdue',
//         data: [0, 0, overdue]
//       }
//     ]
//   }

//   const tasksPending = tasks.filter(
//     t => t.status !== 'Completed' && !isOverdue(t)
//   ).length
//   const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
//   const tasksOverdue = tasks.filter(t => isOverdue(t)).length

//   const interventionsPending = interventions.filter(
//     i => i.status !== 'Completed' && !isOverdue(i)
//   ).length
//   const interventionsCompleted = interventions.filter(
//     i => i.status === 'Completed'
//   ).length
//   const interventionsOverdue = interventions.filter(i => isOverdue(i)).length

//   const totalInterventions =
//     interventionsCompleted + interventionsPending + interventionsOverdue

//   const completionRate = totalInterventions
//     ? Math.round((interventionsCompleted / totalInterventions) * 100)
//     : 0

//   // helper
//   function isOverdue (item) {
//     const due = item.dueDate?.toDate
//       ? item.dueDate.toDate()
//       : new Date(item.dueDate)
//     return item.status !== 'Completed' && dayjs(due).isBefore(dayjs())
//   }

//   const tasksVsInterventionsChart = {
//     colors: ['#faad14', '#52c41a', '#ff4d4f'], // Pending, Completed, Overdue
//     chart: {
//       type: 'column',
//       inverted: true,
//       polar: true,
//       height: 320
//     },
//     title: {
//       text: 'Tasks vs Interventions'
//     },
//     credits: {
//       enabled: false
//     },
//     tooltip: {
//       outside: true,
//       shared: true,
//       formatter: function () {
//         return `<b>${this.series.name}</b><br/>${this.key}: ${this.y}`
//       }
//     },
//     pane: {
//       size: '70%',
//       innerSize: '20%',
//       endAngle: 270
//     },
//     xAxis: {
//       categories: ['Tasks', 'Interventions'],
//       tickInterval: 1,
//       labels: {
//         align: 'right',
//         allowOverlap: true,
//         step: 1,
//         y: 3,
//         style: {
//           fontSize: '12px'
//         }
//       },
//       lineWidth: 0,
//       gridLineWidth: 0
//     },
//     yAxis: {
//       lineWidth: 0,
//       tickInterval: 1,
//       endOnTick: true,
//       showLastLabel: true,
//       gridLineWidth: 0
//     },
//     plotOptions: {
//       column: {
//         stacking: 'normal',
//         borderWidth: 0,
//         pointPadding: 0,
//         groupPadding: 0.15,
//         borderRadius: '50%',
//         dataLabels: {
//           enabled: true,
//           format: '{point.y}',
//           style: {
//             fontWeight: 'bold',
//             color: '#000',
//             fontSize: '11px'
//           }
//         }
//       }
//     },
//     legend: {
//       align: 'center',
//       verticalAlign: 'bottom'
//     },
//     series: [
//       {
//         name: 'Pending',
//         data: [tasksPending, interventionsPending]
//       },
//       {
//         name: 'Completed',
//         data: [tasksCompleted, interventionsCompleted]
//       },
//       {
//         name: 'Overdue',
//         data: [tasksOverdue, interventionsOverdue]
//       }
//     ]
//   }

//   return (
//     <Layout style={{ minHeight: '100vh', background: '#fff' }}>
//       <Helmet>
//         <title>Operations Dashboard</title>
//         <meta
//           name='description'
//           content='Manage daily operations and track incubatee progress'
//         />
//       </Helmet>

//       <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
//         {/** PENDING TASKS */}
//         <Col xs={24} sm={12} md={8} lg={8}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               hoverable
//               style={{
//                 boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
//                 minHeight: 150,
//                 position: 'relative'
//               }}
//             >
//               <Statistic
//                 title='Pending Tasks'
//                 value={tasks.filter(t => t.status !== 'Completed').length}
//                 prefix={<CheckCircleOutlined />}
//                 valueStyle={{ color: '#1890ff' }}
//               />
//               <Button
//                 type='link'
//                 ghost
//                 style={{
//                   border: '1px solid #d9d9d9',
//                   position: 'absolute',
//                   bottom: 16,
//                   right: 16
//                 }}
//                 onClick={() => navigate('/operations/tasks')}
//               >
//                 View All <ArrowRightOutlined />
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>

//         {/** INTERVENTIONS PROGRESS */}
//         <Col xs={24} sm={12} md={8} lg={8}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               hoverable
//               style={{
//                 boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
//                 minHeight: 150,
//                 position: 'relative'
//               }}
//             >
//               <Statistic
//                 title='Interventions Progress'
//                 valueRender={() => (
//                   <div style={{ display: 'flex', justifyContent: 'center' }}>
//                     <Progress
//                       type='dashboard'
//                       gapDegree={100}
//                       percent={completionRate}
//                       width={80}
//                       strokeColor={
//                         completionRate >= 90
//                           ? '#ff4d4f'
//                           : completionRate >= 50
//                           ? '#faad14'
//                           : '#52c41a'
//                       }
//                       format={() => `${completionRate}%`}
//                     />
//                   </div>
//                 )}
//               />
//               <Button
//                 type='link'
//                 ghost
//                 style={{
//                   border: '1px solid #d9d9d9',
//                   position: 'absolute',
//                   bottom: 16,
//                   right: 16
//                 }}
//                 onClick={() => navigate('/interventions')}
//               >
//                 View All <ArrowRightOutlined />
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>

//         {/** ACTIVE PARTICIPANTS */}
//         <Col xs={24} sm={12} md={8} lg={8}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               hoverable
//               style={{
//                 boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
//                 minHeight: 150,
//                 position: 'relative'
//               }}
//             >
//               <Statistic
//                 title='Active Participants'
//                 value={participants.length}
//                 prefix={<TeamOutlined />}
//                 valueStyle={{ color: '#722ed1' }}
//               />
//               <Button
//                 type='link'
//                 ghost
//                 style={{
//                   border: '1px solid #d9d9d9',
//                   position: 'absolute',
//                   bottom: 16,
//                   right: 16
//                 }}
//                 onClick={() => navigate('/operations/participants')}
//               >
//                 View All <ArrowRightOutlined />
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>
//       </Row>
//       <Row gutter={[16, 16]} style={{ marginBottom: 10 }}>
//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title={
//                 <Space>
//                   <ScheduleOutlined />
//                   <span>Consultant Appointments</span>
//                 </Space>
//               }
//               hoverable
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//             >
//               <List
//                 size='small'
//                 loading={appointmentsLoading}
//                 dataSource={[...appointments].sort((a, b) =>
//                   dayjs(a.date + ' ' + a.time).diff(
//                     dayjs(b.date + ' ' + b.time)
//                   )
//                 )}
//                 renderItem={appt => (
//                   <List.Item>
//                     <List.Item.Meta
//                       title={
//                         <Space>
//                           <Text>{appt.participantName}</Text>
//                           <Tag color='blue'>{appt.consultantName}</Tag>
//                         </Space>
//                       }
//                       description={
//                         <>
//                           Date/Time:{' '}
//                           {dayjs(
//                             `${appt.date} ${dayjs(appt.time).format('HH:mm')}`
//                           ).format('YYYY-MM-DD HH:mm')}
//                           <br />
//                           Location: {appt.location || appt.meetingLink}
//                         </>
//                       }
//                     />
//                     <Badge
//                       status={
//                         appt.status === 'completed' ? 'success' : 'processing'
//                       }
//                       text={appt.status}
//                     />
//                   </List.Item>
//                 )}
//               />
//             </Card>
//           </motion.div>
//         </Col>

//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title={
//                 <Space>
//                   <ScheduleOutlined />
//                   <span>Upcoming Events</span>
//                 </Space>
//               }
//               hoverable
//               extra={
//                 <Button
//                   type='primary'
//                   size='small'
//                   onClick={() => setEventModalOpen(true)}
//                 >
//                   Add Event
//                 </Button>
//               }
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//             >
//               <Timeline mode='left'>
//                 {events.map((event, index) => (
//                   <Timeline.Item key={index} dot={getEventIcon(event.type)}>
//                     <Text strong>
//                       {event.date} - {event.title}
//                     </Text>
//                     <br />
//                     <Space wrap>
//                       <Text type='secondary'>
//                         Time: {dayjs(event.time).format('HH:mm')}
//                       </Text>
//                       <Tag color='blue'>{event.format}</Tag>
//                       <Tag color='green'>{event.type}</Tag>
//                     </Space>
//                     {event.participants?.length > 0 && (
//                       <>
//                         <br />
//                         <Text type='secondary'>
//                           Participants: {event.participants.length}
//                         </Text>
//                       </>
//                     )}
//                   </Timeline.Item>
//                 ))}
//               </Timeline>
//               <Button
//                 type='link'
//                 style={{ padding: 0 }}
//                 onClick={() => setCalendarModalOpen(true)}
//               >
//                 View Full Calendar
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>
//       </Row>
//       <Row gutter={[16, 16]}>
//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title='Tasks vs Interventions Breakdown'
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//               extra={
//                 <>
//                   <Button
//                     type='primary'
//                     size='small'
//                     onClick={() => navigate('/operations/tasks')}
//                     style={{ margin: 10 }}
//                   >
//                     View All Tasks
//                   </Button>
//                   <Button
//                     type='primary'
//                     size='small'
//                     onClick={() => navigate('/interventions')}
//                     style={{ margin: 10 }}
//                   >
//                     View All Interventions
//                   </Button>
//                 </>
//               }
//               hoverable
//             >
//               <HighchartsReact
//                 highcharts={Highcharts}
//                 options={tasksVsInterventionsChart}
//               />
//             </Card>
//           </motion.div>
//         </Col>

//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title='Compliance Status Breakdown'
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//               extra={
//                 <Button
//                   type='primary'
//                   size='small'
//                   onClick={() => navigate('/operations/compliance')}
//                   style={{ margin: 10 }}
//                 >
//                   View All
//                 </Button>
//               }
//               hoverable
//             >
//               <HighchartsReact
//                 highcharts={Highcharts}
//                 options={complianceChartOptions}
//               />
//             </Card>
//           </motion.div>
//         </Col>
//       </Row>
//       <EventModal
//         open={eventModalOpen}
//         onCancel={() => setEventModalOpen(false)}
//         onSubmit={handleAddEvent}
//         form={eventForm}
//         consultants={consultants}
//         projectAdmins={projectAdmins}
//         operationsUsers={operationsUsers}
//         participants={participants}
//       />
//       <Modal
//         title='Full Calendar View'
//         open={calendarModalOpen}
//         onCancel={() => setCalendarModalOpen(false)}
//         footer={null}
//         width={900}
//       >
//         <FullCalendar
//           plugins={[dayGridPlugin]}
//           initialView='dayGridMonth'
//           events={events.map(event => ({
//             id: event.id,
//             title: event.title,
//             date: event.date
//           }))}
//           eventClick={info => handleEventClick(info.event)}
//           height={600}
//         />
//       </Modal>
//       <Modal
//         title='Event Details'
//         open={eventDetailModalOpen}
//         onCancel={() => setEventDetailModalOpen(false)}
//         footer={null}
//         width={600}
//       >
//         {selectedEvent && (
//           <>
//             <Alert
//               message='This is a scheduled event. Please ensure all participants are informed.'
//               type='info'
//               showIcon
//               style={{ marginBottom: 16 }}
//             />

//             <Descriptions
//               bordered
//               column={1}
//               size='middle'
//               labelStyle={{ width: '40%' }}
//             >
//               <Descriptions.Item label='Title'>
//                 {selectedEvent.title}
//               </Descriptions.Item>

//               <Descriptions.Item label='Date'>
//                 {selectedEvent.date}
//               </Descriptions.Item>

//               <Descriptions.Item label='Time'>
//                 {selectedEvent.startTime?.toDate &&
//                 selectedEvent.endTime?.toDate
//                   ? `${dayjs(selectedEvent.startTime.toDate()).format(
//                       'HH:mm'
//                     )} - ${dayjs(selectedEvent.endTime.toDate()).format(
//                       'HH:mm'
//                     )}`
//                   : 'N/A'}
//               </Descriptions.Item>

//               <Descriptions.Item label='Type'>
//                 <Tag color='blue'>
//                   {selectedEvent.type?.charAt(0).toUpperCase() +
//                     selectedEvent.type?.slice(1)}
//                 </Tag>
//               </Descriptions.Item>

//               <Descriptions.Item label='Format'>
//                 <Tag color='green'>
//                   {selectedEvent.format?.charAt(0).toUpperCase() +
//                     selectedEvent.format?.slice(1)}
//                 </Tag>
//               </Descriptions.Item>

//               {selectedEvent.location && (
//                 <Descriptions.Item label='Location'>
//                   {selectedEvent.location}
//                 </Descriptions.Item>
//               )}

//               {selectedEvent.link && (
//                 <Descriptions.Item label='Link'>
//                   <a
//                     href={selectedEvent.link}
//                     target='_blank'
//                     rel='noopener noreferrer'
//                   >
//                     {selectedEvent.link}
//                   </a>
//                 </Descriptions.Item>
//               )}

//               {selectedEvent.description && (
//                 <Descriptions.Item label='Description'>
//                   {selectedEvent.description}
//                 </Descriptions.Item>
//               )}

//               {selectedEvent.participants?.length > 0 && (
//                 <Descriptions.Item label='Participants'>
//                   <ul style={{ paddingLeft: 20, margin: 0 }}>
//                     {selectedEvent.participants.map(
//                       (participant: any, index: number) => (
//                         <li key={index}>{participant.name || participant}</li>
//                       )
//                     )}
//                   </ul>
//                 </Descriptions.Item>
//               )}
//             </Descriptions>
//           </>
//         )}
//       </Modal>

//       <Button
//         type='primary'
//         shape='circle'
//         icon={
//           <Badge
//             count={notifications.filter(n => !n.readBy?.operations).length}
//           >
//             <BellOutlined />
//           </Badge>
//         }
//         style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
//         onClick={() => setNotificationModalOpen(true)}
//       />
//     </Layout>
//   )
// }

// export default OperationsDashboard

// import React, { useEffect, useState } from 'react'
// import {
//   Card,
//   Row,
//   Col,
//   Statistic,
//   Typography,
//   List,
//   Tag,
//   Space,
//   Divider,
//   Progress,
//   Button,
//   Timeline,
//   Badge,
//   Modal,
//   Form,
//   message,
//   Layout,
//   Alert,
//   Descriptions
// } from 'antd'
// import {
//   CalendarOutlined,
//   CheckCircleOutlined,
//   ExclamationCircleOutlined,
//   FileSearchOutlined,
//   ClockCircleOutlined,
//   ScheduleOutlined,
//   FileTextOutlined,
//   FormOutlined,
//   ApartmentOutlined,
//   TeamOutlined,
//   BarsOutlined,
//   BellOutlined,
//   DeleteOutlined,
//   UploadOutlined,
//   BarChartOutlined,
//   ArrowRightOutlined
// } from '@ant-design/icons'
// import { useNavigate } from 'react-router-dom'
// import { Helmet } from 'react-helmet'
// import { db } from '@/firebase'
// import {
//   collection,
//   getDocs,
//   setDoc,
//   doc,
//   Timestamp,
//   getDoc,
//   updateDoc,
//   where,
//   query
// } from 'firebase/firestore'
// import FullCalendar from '@fullcalendar/react'
// import dayGridPlugin from '@fullcalendar/daygrid'
// import dayjs from 'dayjs'
// import { useFullIdentity } from '@/hooks/src/useFullIdentity'
// import { TaskModal } from '@/components/op-dashboard/TaskModal'
// import { EventModal } from '@/components/op-dashboard/EventModal'
// import { PREDEFINED_TASK_TYPES } from '@/types/TaskType'
// import Highcharts from 'highcharts'
// import HighchartsReact from 'highcharts-react-official'
// import HighchartsMore from 'highcharts/highcharts-more'
// import HighchartsAccessibility from 'highcharts/modules/accessibility'
// import { motion } from 'framer-motion'

// // Initialize additional modules
// if (typeof HighchartsMore === 'function') {
//   HighchartsMore(Highcharts)
// }
// if (typeof HighchartsAccessibility === 'function') {
//   HighchartsAccessibility(Highcharts)
// }

// const { Text } = Typography

// export const OperationsDashboard: React.FC = () => {
//   const navigate = useNavigate()
//   const [participants, setParticipants] = useState<any[]>([])
//   const [interventions, setInterventions] = useState<any[]>([])
//   const [appointments, setAppointments] = useState<any[]>([])
//   const [appointmentsLoading, setAppointmentsLoading] = useState(true)
//   const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
//   const [tasks, setTasks] = useState<any[]>([])
//   const [events, setEvents] = useState<any[]>([])
//   const [eventModalOpen, setEventModalOpen] = useState(false)
//   const [calendarModalOpen, setCalendarModalOpen] = useState(false)
//   const [eventForm] = Form.useForm()
//   const [selectedEvent, setSelectedEvent] = useState<any>(null)
//   const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
//   const [notifications, setNotifications] = useState<any[]>([])
//   const [notificationModalOpen, setNotificationModalOpen] = useState(false)
//   const [filterType, setFilterType] = useState<string | null>(null)
//   const [userRole, setUserRole] = useState<'operations'>()
//   const [declineModalOpen, setDeclineModalOpen] = useState(false)
//   const [declineReason, setDeclineReason] = useState('')
//   const [declining, setDeclining] = useState(false)
//   const [directCosts, setDirectCosts] = useState([
//     { description: '', amount: '' }
//   ])
//   const [departments, setDepartments] = useState<any[]>([])
//   const [userDepartment, setUserDepartment] = useState<any>(null)
//   const [consultants, setConsultants] = useState<any[]>([])
//   const [projectAdmins, setProjectAdmins] = useState<any[]>([])
//   const [operationsUsers, setOperationsUsers] = useState<any[]>([])
//   const { user } = useFullIdentity()
//   const [consultantDocIds, setConsultantDocIds] = useState<
//     Record<string, string>
//   >({})
//   const [operationsDocIds, setOperationsDocIds] = useState<
//     Record<string, string>
//   >({})
//   const [proofModalOpen, setProofModalOpen] = useState(false)
//   const [selectedTask, setSelectedTask] = useState<any>(null)

//   useEffect(() => {
//     const fetchNotifications = async () => {
//       if (!user?.companyCode) return
//       try {
//         const snapshot = await getDocs(
//           query(
//             collection(db, 'notifications'),
//             where('companyCode', '==', user?.companyCode)
//           )
//         )
//         const all = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         })) as any[]
//         const filtered = all.filter(n =>
//           n.recipientRoles?.includes('operations')
//         )

//         setNotifications(filtered)
//       } catch (err) {
//         console.error('Error loading notifications:', err)
//       }
//     }
//     fetchNotifications()
//   }, [])

//   // Fetch appointments
//   useEffect(() => {
//     const fetchAppointments = async () => {
//       setAppointmentsLoading(true)
//       try {
//         const q = query(
//           collection(db, 'appointments'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)
//         const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
//         setAppointments(items)
//       } catch (err) {
//         console.error('Error fetching appointments:', err)
//       } finally {
//         setAppointmentsLoading(false)
//       }
//     }
//     if (user?.companyCode) fetchAppointments()
//   }, [user?.companyCode])

//   //   Fetch Assigned Interventions
//   const fetchAssignments = async () => {
//     if (!user?.companyCode) return
//     try {
//       const q = query(
//         collection(db, 'assignedInterventions'),
//         where('companyCode', '==', user?.companyCode)
//       )
//       const snapshot = await getDocs(q)

//       const fetchedAssignments = snapshot.docs.map(doc => ({
//         id: doc.id,
//         ...doc.data()
//       }))

//       const currentParticipantMap = new Map(
//         participants.map(p => [p.id, p.beneficiaryName])
//       )
//       const currentConsultantMap = new Map(consultants.map(c => [c.id, c.name]))

//       const enrichedAssignments = fetchedAssignments.map(assignment => {
//         const foundParticipant = participants.find(
//           p => p.id === assignment.participantId
//         )
//         const foundIntervention = foundParticipant?.requiredInterventions.find(
//           i => i.id === assignment.interventionId
//         )

//         return {
//           ...assignment,
//           beneficiaryName:
//             currentParticipantMap.get(assignment.participantId) ||
//             'Unknown Beneficiary',
//           consultantName:
//             currentConsultantMap.get(assignment.consultantId) ||
//             'Unknown Consultant',
//           area: foundIntervention?.area || 'Unknown Area',
//           interventionTitle:
//             foundIntervention?.title || assignment.interventionTitle
//         }
//       })

//       setInterventions(enrichedAssignments)
//     } catch (error) {
//       console.error('Error fetching assignments:', error)
//       message.error('Failed to load assignments')
//     } finally {
//       //   setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchAssignments()
//   }, [user])

//   useEffect(() => {
//     if (!user?.companyCode) return

//     const fetchTasks = async () => {
//       try {
//         const q = query(
//           collection(db, 'tasks'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)
//         const taskList = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))
//         setTasks(taskList)
//       } catch (error) {
//         console.error('Error fetching tasks:', error)
//       }
//     }
//     const fetchAllOtherData = async () => {
//       try {
//         const q = query(
//           collection(db, 'applications'),
//           where('status', '==', 'accepted'),
//           where('companyCode', '==', user?.companyCode)
//         )

//         const snapshot = await getDocs(q)
//         const applications = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))

//         setParticipants(applications)
//       } catch (error) {
//         console.error('Error fetching applications:', error)
//       }
//     }
//     const fetchComplianceDocuments = async () => {
//       try {
//         const q = query(
//           collection(db, 'complianceDocuments'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)

//         const documents = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))
//         setComplianceDocuments(documents)
//       } catch (error) {
//         console.error('Error fetching compliance documents:', error)
//       }
//     }

//     fetchComplianceDocuments()
//     fetchTasks()
//     fetchAllOtherData()
//   }, [user?.companyCode])

//   useEffect(() => {
//     if (!user?.companyCode) return

//     const fetchEvents = async () => {
//       try {
//         const q = query(
//           collection(db, 'events'),
//           where('companyCode', '==', user?.companyCode)
//         )
//         const snapshot = await getDocs(q)
//         const eventList = snapshot.docs.map(doc => ({
//           id: doc.id,
//           ...doc.data()
//         }))
//         setEvents(eventList)
//       } catch (error) {
//         console.error('Error fetching events:', error)
//       }
//     }
//     fetchEvents()
//   }, [user?.companyCode])

//   const handleEventClick = (event: any) => {
//     const eventData = events.find(e => e.id === event.id)
//     setSelectedEvent(eventData)
//     setEventDetailModalOpen(true)
//   }

//   const handleAddEvent = async (values: any) => {
//     const eventDate = dayjs(values.date).format('YYYY-MM-DD')

//     const start = dayjs(values.startTime)
//     const end = dayjs(values.endTime)

//     if (!start.isValid() || !end.isValid()) {
//       return message.error('Please select a valid start and end time.')
//     }

//     const startHour = start.hour()
//     const endHour = end.hour()

//     if (startHour < 6 || endHour > 18 || end.isBefore(start)) {
//       return message.error(
//         'Event time must be between 06:00 and 18:00, and end must be after start.'
//       )
//     }

//     const clash = events.some(
//       e =>
//         e.date === eventDate &&
//         dayjs(e.startTime).format('HH:mm') === start.format('HH:mm')
//     )
//     if (clash) {
//       return message.error('Another event is already scheduled for this time.')
//     }

//     try {
//       const newId = `event-${Date.now()}`

//       const newEvent = {
//         id: newId,
//         title: values.title,
//         date: eventDate,
//         startTime: Timestamp.fromDate(start.toDate()),
//         endTime: Timestamp.fromDate(end.toDate()),
//         type: values.eventType,
//         format: values.format,
//         location: values.location || '',
//         link: values.link || '',
//         description: values.description || '',
//         participants: values.participants || [],
//         createdAt: Timestamp.now(),
//         companyCode: user?.companyCode
//       }

//       await setDoc(doc(db, 'events', newId), newEvent)
//       setEvents(prev => [...prev, newEvent])
//       message.success('Event added successfully')
//       setEventModalOpen(false)
//       eventForm.resetFields()
//     } catch (error) {
//       console.error('Error adding event:', error)
//       message.error('Failed to add event')
//     }
//   }

//   const getEventIcon = (type: string) => {
//     switch (type) {
//       case 'meeting':
//         return <ClockCircleOutlined style={{ color: '#1890ff' }} />
//       case 'deadline':
//         return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
//       case 'event':
//         return <CalendarOutlined style={{ color: '#52c41a' }} />
//       case 'workshop':
//         return <FileTextOutlined style={{ color: '#722ed1' }} />
//       default:
//         return <CalendarOutlined style={{ color: '#1890ff' }} />
//     }
//   }

//   // Charts Logic
//   const upToDate = complianceDocuments.filter(
//     doc => doc.status === 'valid'
//   ).length
//   const needsReview = complianceDocuments.filter(
//     doc => doc.status === 'expiring'
//   ).length
//   const overdue = complianceDocuments.filter(
//     doc =>
//       doc.status === 'expired' ||
//       doc.status === 'missing' ||
//       doc.status === 'pending'
//   ).length
//   const total = complianceDocuments.length

//   const complianceChartOptions = {
//     colors: ['#52c41a', '#faad14', '#ff4d4f'], // Valid, Expiring, Overdue
//     chart: {
//       type: 'column',
//       inverted: true,
//       polar: true,
//       height: 320
//     },
//     title: {
//       text: 'Compliance Status Overview'
//     },
//     credits: {
//       enabled: false
//     },
//     tooltip: {
//       outside: true,
//       shared: true
//     },
//     pane: {
//       size: '85%',
//       innerSize: '20%',
//       endAngle: 270
//     },
//     xAxis: {
//       tickInterval: 1,
//       labels: {
//         align: 'right',
//         allowOverlap: true,
//         step: 1,
//         y: 3,
//         style: {
//           fontSize: '13px'
//         }
//       },
//       lineWidth: 0,
//       gridLineWidth: 0,
//       categories: [
//         'Valid <span class="f16"><span class="dot valid"></span></span>',
//         'Expiring <span class="f16"><span class="dot expiring"></span></span>',
//         'Overdue <span class="f16"><span class="dot overdue"></span></span>'
//       ],
//       useHTML: true
//     },
//     yAxis: {
//       lineWidth: 0,
//       tickInterval: 1,
//       reversedStacks: false,
//       endOnTick: true,
//       showLastLabel: true,
//       gridLineWidth: 1,
//       labels: {
//         enabled: false // 🔥 hides "Ongoing", "Completed", etc.
//       }
//     },
//     plotOptions: {
//       column: {
//         stacking: 'normal',
//         borderWidth: 0,
//         pointPadding: 0,
//         groupPadding: 0.15,
//         borderRadius: '50%',
//         dataLabels: {
//           enabled: true,
//           format: '{point.y}',
//           style: {
//             fontWeight: 'bold',
//             color: '#000'
//           }
//         }
//       }
//     },
//     legend: {
//       align: 'center',
//       verticalAlign: 'bottom',
//       itemStyle: {
//         fontWeight: 'normal'
//       }
//     },
//     series: [
//       {
//         name: 'Valid',
//         data: [upToDate, 0, 0]
//       },
//       {
//         name: 'Expiring',
//         data: [0, needsReview, 0]
//       },
//       {
//         name: 'Overdue',
//         data: [0, 0, overdue]
//       }
//     ]
//   }

//   const tasksPending = tasks.filter(
//     t => t.status !== 'Completed' && !isOverdue(t)
//   ).length
//   const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
//   const tasksOverdue = tasks.filter(t => isOverdue(t)).length

//   const interventionsPending = interventions.filter(
//     i => i.status !== 'Completed' && !isOverdue(i)
//   ).length
//   const interventionsCompleted = interventions.filter(
//     i => i.status === 'Completed'
//   ).length
//   const interventionsOverdue = interventions.filter(i => isOverdue(i)).length

//   const totalInterventions =
//     interventionsCompleted + interventionsPending + interventionsOverdue

//   const completionRate = totalInterventions
//     ? Math.round((interventionsCompleted / totalInterventions) * 100)
//     : 0

//   // helper
//   function isOverdue (item) {
//     const due = item.dueDate?.toDate
//       ? item.dueDate.toDate()
//       : new Date(item.dueDate)
//     return item.status !== 'Completed' && dayjs(due).isBefore(dayjs())
//   }

//   const tasksVsInterventionsChart = {
//     colors: ['#faad14', '#52c41a', '#ff4d4f'], // Pending, Completed, Overdue
//     chart: {
//       type: 'column',
//       inverted: true,
//       polar: true,
//       height: 320
//     },
//     title: {
//       text: 'Tasks vs Interventions'
//     },
//     credits: {
//       enabled: false
//     },
//     tooltip: {
//       outside: true,
//       shared: true,
//       formatter: function () {
//         return `<b>${this.series.name}</b><br/>${this.key}: ${this.y}`
//       }
//     },
//     pane: {
//       size: '70%',
//       innerSize: '20%',
//       endAngle: 270
//     },
//     xAxis: {
//       categories: ['Tasks', 'Interventions'],
//       tickInterval: 1,
//       labels: {
//         align: 'right',
//         allowOverlap: true,
//         step: 1,
//         y: 3,
//         style: {
//           fontSize: '12px'
//         }
//       },
//       lineWidth: 0,
//       gridLineWidth: 0
//     },
//     yAxis: {
//       lineWidth: 0,
//       tickInterval: 1,
//       endOnTick: true,
//       showLastLabel: true,
//       gridLineWidth: 0
//     },
//     plotOptions: {
//       column: {
//         stacking: 'normal',
//         borderWidth: 0,
//         pointPadding: 0,
//         groupPadding: 0.15,
//         borderRadius: '50%',
//         dataLabels: {
//           enabled: true,
//           format: '{point.y}',
//           style: {
//             fontWeight: 'bold',
//             color: '#000',
//             fontSize: '11px'
//           }
//         }
//       }
//     },
//     legend: {
//       align: 'center',
//       verticalAlign: 'bottom'
//     },
//     series: [
//       {
//         name: 'Pending',
//         data: [tasksPending, interventionsPending]
//       },
//       {
//         name: 'Completed',
//         data: [tasksCompleted, interventionsCompleted]
//       },
//       {
//         name: 'Overdue',
//         data: [tasksOverdue, interventionsOverdue]
//       }
//     ]
//   }

//   return (
//     <Layout style={{ minHeight: '100vh', background: '#fff' }}>
//       <Helmet>
//         <title>Operations Dashboard</title>
//         <meta
//           name='description'
//           content='Manage daily operations and track incubatee progress'
//         />
//       </Helmet>

//       <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
//         {/** PENDING TASKS */}
//         <Col xs={24} sm={12} md={8} lg={8}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               hoverable
//               style={{
//                 boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
//                 minHeight: 150,
//                 position: 'relative'
//               }}
//             >
//               <Statistic
//                 title='Pending Tasks'
//                 value={tasks.filter(t => t.status !== 'Completed').length}
//                 prefix={<CheckCircleOutlined />}
//                 valueStyle={{ color: '#1890ff' }}
//               />
//               <Button
//                 type='link'
//                 ghost
//                 style={{
//                   border: '1px solid #d9d9d9',
//                   position: 'absolute',
//                   bottom: 16,
//                   right: 16
//                 }}
//                 onClick={() => navigate('/operations/tasks')}
//               >
//                 View All <ArrowRightOutlined />
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>

//         {/** INTERVENTIONS PROGRESS */}
//         <Col xs={24} sm={12} md={8} lg={8}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               hoverable
//               style={{
//                 boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
//                 minHeight: 150,
//                 position: 'relative'
//               }}
//             >
//               <Statistic
//                 title='Interventions Progress'
//                 valueRender={() => (
//                   <div style={{ display: 'flex', justifyContent: 'center' }}>
//                     <Progress
//                       type='dashboard'
//                       gapDegree={100}
//                       percent={completionRate}
//                       width={80}
//                       strokeColor={
//                         completionRate >= 90
//                           ? '#ff4d4f'
//                           : completionRate >= 50
//                           ? '#faad14'
//                           : '#52c41a'
//                       }
//                       format={() => `${completionRate}%`}
//                     />
//                   </div>
//                 )}
//               />
//               <Button
//                 type='link'
//                 ghost
//                 style={{
//                   border: '1px solid #d9d9d9',
//                   position: 'absolute',
//                   bottom: 16,
//                   right: 16
//                 }}
//                 onClick={() => navigate('/interventions')}
//               >
//                 View All <ArrowRightOutlined />
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>

//         {/** ACTIVE PARTICIPANTS */}
//         <Col xs={24} sm={12} md={8} lg={8}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               hoverable
//               style={{
//                 boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
//                 minHeight: 150,
//                 position: 'relative'
//               }}
//             >
//               <Statistic
//                 title='Active Participants'
//                 value={participants.length}
//                 prefix={<TeamOutlined />}
//                 valueStyle={{ color: '#722ed1' }}
//               />
//               <Button
//                 type='link'
//                 ghost
//                 style={{
//                   border: '1px solid #d9d9d9',
//                   position: 'absolute',
//                   bottom: 16,
//                   right: 16
//                 }}
//                 onClick={() => navigate('/operations/participants')}
//               >
//                 View All <ArrowRightOutlined />
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>
//       </Row>
//       <Row gutter={[16, 16]} style={{ marginBottom: 10 }}>
//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title={
//                 <Space>
//                   <ScheduleOutlined />
//                   <span>Consultant Appointments</span>
//                 </Space>
//               }
//               hoverable
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//             >
//               <List
//                 size='small'
//                 loading={appointmentsLoading}
//                 dataSource={[...appointments].sort((a, b) =>
//                   dayjs(a.date + ' ' + a.time).diff(
//                     dayjs(b.date + ' ' + b.time)
//                   )
//                 )}
//                 renderItem={appt => (
//                   <List.Item>
//                     <List.Item.Meta
//                       title={
//                         <Space>
//                           <Text>{appt.participantName}</Text>
//                           <Tag color='blue'>{appt.consultantName}</Tag>
//                         </Space>
//                       }
//                       description={
//                         <>
//                           Date/Time:{' '}
//                           {dayjs(
//                             `${appt.date} ${dayjs(appt.time).format('HH:mm')}`
//                           ).format('YYYY-MM-DD HH:mm')}
//                           <br />
//                           Location: {appt.location || appt.meetingLink}
//                         </>
//                       }
//                     />
//                     <Badge
//                       status={
//                         appt.status === 'completed' ? 'success' : 'processing'
//                       }
//                       text={appt.status}
//                     />
//                   </List.Item>
//                 )}
//               />
//             </Card>
//           </motion.div>
//         </Col>

//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title={
//                 <Space>
//                   <ScheduleOutlined />
//                   <span>Upcoming Events</span>
//                 </Space>
//               }
//               hoverable
//               extra={
//                 <Button
//                   type='primary'
//                   size='small'
//                   onClick={() => setEventModalOpen(true)}
//                 >
//                   Add Event
//                 </Button>
//               }
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//             >
//               <Timeline mode='left'>
//                 {events.map((event, index) => (
//                   <Timeline.Item key={index} dot={getEventIcon(event.type)}>
//                     <Text strong>
//                       {event.date} - {event.title}
//                     </Text>
//                     <br />
//                     <Space wrap>
//                       <Text type='secondary'>
//                         Time: {dayjs(event.time).format('HH:mm')}
//                       </Text>
//                       <Tag color='blue'>{event.format}</Tag>
//                       <Tag color='green'>{event.type}</Tag>
//                     </Space>
//                     {event.participants?.length > 0 && (
//                       <>
//                         <br />
//                         <Text type='secondary'>
//                           Participants: {event.participants.length}
//                         </Text>
//                       </>
//                     )}
//                   </Timeline.Item>
//                 ))}
//               </Timeline>
//               <Button
//                 type='link'
//                 style={{ padding: 0 }}
//                 onClick={() => setCalendarModalOpen(true)}
//               >
//                 View Full Calendar
//               </Button>
//             </Card>
//           </motion.div>
//         </Col>
//       </Row>
//       <Row gutter={[16, 16]}>
//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title='Tasks vs Interventions Breakdown'
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//               extra={
//                 <>
//                   <Button
//                     type='primary'
//                     size='small'
//                     onClick={() => navigate('/operations/tasks')}
//                     style={{ margin: 10 }}
//                   >
//                     View All Tasks
//                   </Button>
//                   <Button
//                     type='primary'
//                     size='small'
//                     onClick={() => navigate('/interventions')}
//                     style={{ margin: 10 }}
//                   >
//                     View All Interventions
//                   </Button>
//                 </>
//               }
//               hoverable
//             >
//               <HighchartsReact
//                 highcharts={Highcharts}
//                 options={tasksVsInterventionsChart}
//               />
//             </Card>
//           </motion.div>
//         </Col>

//         <Col xs={24} lg={12}>
//           <motion.div
//             initial={{ opacity: 0, y: 20 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{
//               duration: 0.4,
//               delay: 0.1,
//               ease: 'easeOut'
//             }}
//             whileHover={{
//               y: -3,
//               boxShadow: '0 6px 16px 0 rgba(0,0,0,0.12)',
//               transition: { duration: 0.2 }
//             }}
//           >
//             <Card
//               title='Compliance Status Breakdown'
//               style={{ boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)' }}
//               extra={
//                 <Button
//                   type='primary'
//                   size='small'
//                   onClick={() => navigate('/operations/compliance')}
//                   style={{ margin: 10 }}
//                 >
//                   View All
//                 </Button>
//               }
//               hoverable
//             >
//               <HighchartsReact
//                 highcharts={Highcharts}
//                 options={complianceChartOptions}
//               />
//             </Card>
//           </motion.div>
//         </Col>
//       </Row>
//       <EventModal
//         open={eventModalOpen}
//         onCancel={() => setEventModalOpen(false)}
//         onSubmit={handleAddEvent}
//         form={eventForm}
//         consultants={consultants}
//         projectAdmins={projectAdmins}
//         operationsUsers={operationsUsers}
//         participants={participants}
//       />
//       <Modal
//         title='Full Calendar View'
//         open={calendarModalOpen}
//         onCancel={() => setCalendarModalOpen(false)}
//         footer={null}
//         width={900}
//       >
//         <FullCalendar
//           plugins={[dayGridPlugin]}
//           initialView='dayGridMonth'
//           events={events.map(event => ({
//             id: event.id,
//             title: event.title,
//             date: event.date
//           }))}
//           eventClick={info => handleEventClick(info.event)}
//           height={600}
//         />
//       </Modal>
//       <Modal
//         title='Event Details'
//         open={eventDetailModalOpen}
//         onCancel={() => setEventDetailModalOpen(false)}
//         footer={null}
//         width={600}
//       >
//         {selectedEvent && (
//           <>
//             <Alert
//               message='This is a scheduled event. Please ensure all participants are informed.'
//               type='info'
//               showIcon
//               style={{ marginBottom: 16 }}
//             />

//             <Descriptions
//               bordered
//               column={1}
//               size='middle'
//               labelStyle={{ width: '40%' }}
//             >
//               <Descriptions.Item label='Title'>
//                 {selectedEvent.title}
//               </Descriptions.Item>

//               <Descriptions.Item label='Date'>
//                 {selectedEvent.date}
//               </Descriptions.Item>

//               <Descriptions.Item label='Time'>
//                 {selectedEvent.startTime?.toDate &&
//                 selectedEvent.endTime?.toDate
//                   ? `${dayjs(selectedEvent.startTime.toDate()).format(
//                       'HH:mm'
//                     )} - ${dayjs(selectedEvent.endTime.toDate()).format(
//                       'HH:mm'
//                     )}`
//                   : 'N/A'}
//               </Descriptions.Item>

//               <Descriptions.Item label='Type'>
//                 <Tag color='blue'>
//                   {selectedEvent.type?.charAt(0).toUpperCase() +
//                     selectedEvent.type?.slice(1)}
//                 </Tag>
//               </Descriptions.Item>

//               <Descriptions.Item label='Format'>
//                 <Tag color='green'>
//                   {selectedEvent.format?.charAt(0).toUpperCase() +
//                     selectedEvent.format?.slice(1)}
//                 </Tag>
//               </Descriptions.Item>

//               {selectedEvent.location && (
//                 <Descriptions.Item label='Location'>
//                   {selectedEvent.location}
//                 </Descriptions.Item>
//               )}

//               {selectedEvent.link && (
//                 <Descriptions.Item label='Link'>
//                   <a
//                     href={selectedEvent.link}
//                     target='_blank'
//                     rel='noopener noreferrer'
//                   >
//                     {selectedEvent.link}
//                   </a>
//                 </Descriptions.Item>
//               )}

//               {selectedEvent.description && (
//                 <Descriptions.Item label='Description'>
//                   {selectedEvent.description}
//                 </Descriptions.Item>
//               )}

//               {selectedEvent.participants?.length > 0 && (
//                 <Descriptions.Item label='Participants'>
//                   <ul style={{ paddingLeft: 20, margin: 0 }}>
//                     {selectedEvent.participants.map(
//                       (participant: any, index: number) => (
//                         <li key={index}>{participant.name || participant}</li>
//                       )
//                     )}
//                   </ul>
//                 </Descriptions.Item>
//               )}
//             </Descriptions>
//           </>
//         )}
//       </Modal>

//       <Button
//         type='primary'
//         shape='circle'
//         icon={
//           <Badge
//             count={notifications.filter(n => !n.readBy?.operations).length}
//           >
//             <BellOutlined />
//           </Badge>
//         }
//         style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
//         onClick={() => setNotificationModalOpen(true)}
//       />
//     </Layout>
//   )
// }

// export default OperationsDashboard
import React, { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  List,
  Tag,
  Space,
  Progress,
  Button,
  Timeline,
  Badge,
  Modal,
  Form,
  message,
  Layout,
  Alert,
  Descriptions
} from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ScheduleOutlined,
  FileTextOutlined,
  TeamOutlined,
  BellOutlined,
  ArrowRightOutlined,
  FullscreenOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet'
import { db } from '@/firebase'
import {
  collection,
  getDocs,
  setDoc,
  doc,
  Timestamp,
  where,
  query
} from 'firebase/firestore'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import dayjs from 'dayjs'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import { EventModal } from '@/components/op-dashboard/EventModal'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'
import HighchartsAccessibility from 'highcharts/modules/accessibility'
import { motion } from 'framer-motion'

if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts)
if (typeof HighchartsAccessibility === 'function')
  HighchartsAccessibility(Highcharts)

const { Text, Title } = Typography

/** ---------- Unified card style + motion wrapper ---------- */
const cardStyle: React.CSSProperties = {
  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
  transition: 'all 0.3s ease',
  borderRadius: 8,
  border: '1px solid #d6e4ff'
}

const MotionCard: React.FC<React.ComponentProps<typeof Card>> = ({
  children,
  style,
  ...rest
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Card {...rest} style={{ ...cardStyle, ...(style || {}) }}>
      {children}
    </Card>
  </motion.div>
)

/** ---------- Dummy fallbacks (used when companyCode === 'QTX' or on errors) ---------- */
const D_PARTICIPANTS = [
  { id: 'p1', beneficiaryName: 'Lebo Dlamini' },
  { id: 'p2', beneficiaryName: 'John Mokoena' },
  { id: 'p3', beneficiaryName: 'Sarah Nkosi' }
]

const D_TASKS = [
  {
    id: 't1',
    title: 'Collect bank statements',
    status: 'To Do',
    dueDate: dayjs().add(3, 'day').toISOString()
  },
  {
    id: 't2',
    title: 'Upload ID documents',
    status: 'In Progress',
    dueDate: dayjs().add(1, 'day').toISOString()
  },
  {
    id: 't3',
    title: 'KYC verification',
    status: 'Completed',
    dueDate: dayjs().subtract(2, 'day').toISOString()
  },
  {
    id: 't4',
    title: 'Sign SLA',
    status: 'To Do',
    dueDate: dayjs().subtract(1, 'day').toISOString()
  }
]

const D_ASSIGNED_INTERVENTIONS = [
  {
    id: 'as1',
    status: 'In Progress',
    dueDate: dayjs().add(4, 'day').toISOString()
  },
  { id: 'as2', status: 'To Do', dueDate: dayjs().add(2, 'day').toISOString() },
  {
    id: 'as3',
    status: 'Completed',
    dueDate: dayjs().subtract(5, 'day').toISOString()
  }
]

const D_COMPLIANCE = [
  { id: 'cd1', name: 'Company Registration', status: 'valid' },
  { id: 'cd2', name: 'Tax Clearance', status: 'expiring' },
  { id: 'cd3', name: 'BEE Certificate', status: 'expired' },
  { id: 'cd4', name: 'Directors IDs', status: 'valid' },
  { id: 'cd5', name: 'Proof of Address', status: 'pending' }
]

const D_APPOINTMENTS = [
  {
    id: 'a1',
    participantName: 'Lebo Dlamini',
    consultantName: 'Thandi Mthembu',
    date: dayjs().add(1, 'day').format('YYYY-MM-DD'),
    time: '10:00',
    location: 'Boardroom A',
    status: 'scheduled'
  },
  {
    id: 'a2',
    participantName: 'John Mokoena',
    consultantName: 'Sipho Ndlovu',
    date: dayjs().add(2, 'day').format('YYYY-MM-DD'),
    time: '14:00',
    meetingLink: 'https://meet.example.com/xyz',
    status: 'scheduled'
  }
]

const D_EVENTS = [
  {
    id: 'e1',
    title: 'Onboarding Workshop',
    date: dayjs().add(3, 'day').format('YYYY-MM-DD'),
    time: '09:00',
    startTime: Timestamp.fromDate(dayjs().add(3, 'day').hour(9).toDate()),
    endTime: Timestamp.fromDate(dayjs().add(3, 'day').hour(11).toDate()),
    type: 'workshop',
    format: 'in-person',
    location: 'Training Room',
    participants: ['Lebo Dlamini', 'John Mokoena']
  },
  {
    id: 'e2',
    title: 'Quarterly Review',
    date: dayjs().add(10, 'day').format('YYYY-MM-DD'),
    time: '13:00',
    startTime: Timestamp.fromDate(dayjs().add(10, 'day').hour(13).toDate()),
    endTime: Timestamp.fromDate(dayjs().add(10, 'day').hour(14).toDate()),
    type: 'meeting',
    format: 'virtual',
    link: 'https://meet.example.com/review'
  }
]

const D_NOTIFICATIONS = [
  {
    id: 'n1',
    title: 'Document Expiring',
    message: 'Tax Clearance expires in 7 days.',
    recipientRoles: ['operations'],
    readBy: { operations: false },
    createdAt: Timestamp.now()
  }
]

/** ---------- Helpers ---------- */
function isOverdue (item: any) {
  const due = item.dueDate?.toDate
    ? item.dueDate.toDate()
    : new Date(item.dueDate)
  return item.status !== 'Completed' && dayjs(due).isBefore(dayjs())
}

/** ---------- helpers for months ---------- */
const lastMonths = (n: number) => {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--)
    out.push(dayjs().subtract(i, 'month').format('MMM'))
  return out
}

/** compact spark w/ month categories visible */
const spark = (data: number[], categories: string[]): Highcharts.Options => ({
  chart: {
    type: 'areaspline',
    height: 80,
    backgroundColor: 'transparent',
    margin: [4, 0, 8, 0]
  },
  title: { text: undefined },
  xAxis: {
    categories,
    tickLength: 0,
    lineWidth: 0,
    labels: { style: { fontSize: '10px', color: '#86909c' } }
  },
  yAxis: { visible: false },
  legend: { enabled: false },
  tooltip: {
    pointFormat: '<b>{point.y}</b>',
    headerFormat: '<span>{point.key}</span><br/>'
  },
  credits: { enabled: false },
  plotOptions: {
    areaspline: { marker: { enabled: false }, fillOpacity: 0.2, lineWidth: 2 }
  },
  series: [{ type: 'areaspline', data }]
})

export const OperationsDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useFullIdentity()

  // core data
  const [participants, setParticipants] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [interventions, setInterventions] = useState<any[]>([])
  const [complianceDocuments, setComplianceDocuments] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [events, setEvents] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])

  // modals / forms
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [calendarModalOpen, setCalendarModalOpen] = useState(false)
  const [eventDetailModalOpen, setEventDetailModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [expandOpen, setExpandOpen] = useState<{
    open: boolean
    which?: 'workload' | 'compliance' | 'tasks'
  }>({ open: false })
  const [eventForm] = Form.useForm()

  /** --- QTX fallback immediately (also used if fetch returns empty) --- */
  useEffect(() => {
    const useDummy = !user?.companyCode || user.companyCode === 'QTX'
    if (useDummy) {
      setParticipants(D_PARTICIPANTS)
      setTasks(D_TASKS)
      setInterventions(D_ASSIGNED_INTERVENTIONS)
      setComplianceDocuments(D_COMPLIANCE)
      setAppointments(D_APPOINTMENTS)
      setEvents(D_EVENTS)
      setNotifications(D_NOTIFICATIONS)
      setAppointmentsLoading(false)
    }
  }, [user?.companyCode])

  /** --- Live fetch (only when not QTX) --- */
  useEffect(() => {
    const cc = user?.companyCode
    if (!cc || cc === 'QTX') return

    const fetchAll = async () => {
      try {
        setAppointmentsLoading(true)
        const [appsSnap, tasksSnap, intsSnap, compSnap, apptSnap, notifSnap] =
          await Promise.all([
            getDocs(
              query(
                collection(db, 'applications'),
                where('status', '==', 'accepted'),
                where('companyCode', '==', cc)
              )
            ),
            getDocs(
              query(collection(db, 'tasks'), where('companyCode', '==', cc))
            ),
            getDocs(
              query(
                collection(db, 'assignedInterventions'),
                where('companyCode', '==', cc)
              )
            ),
            getDocs(
              query(
                collection(db, 'complianceDocuments'),
                where('companyCode', '==', cc)
              )
            ),
            getDocs(
              query(
                collection(db, 'appointments'),
                where('companyCode', '==', cc)
              )
            ),
            getDocs(
              query(
                collection(db, 'notifications'),
                where('companyCode', '==', cc)
              )
            )
          ])

        const toArr = (snap: any) =>
          snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        const p = toArr(appsSnap)
        setParticipants(p.length ? p : D_PARTICIPANTS)
        const t = toArr(tasksSnap)
        setTasks(t.length ? t : D_TASKS)
        const i = toArr(intsSnap)
        setInterventions(i.length ? i : D_ASSIGNED_INTERVENTIONS)
        const c = toArr(compSnap)
        setComplianceDocuments(c.length ? c : D_COMPLIANCE)
        const a = toArr(apptSnap)
        setAppointments(a.length ? a : D_APPOINTMENTS)
        const n = toArr(notifSnap)
        setNotifications(n.length ? n : D_NOTIFICATIONS)
      } catch (e) {
        // graceful fallback
        setParticipants(D_PARTICIPANTS)
        setTasks(D_TASKS)
        setInterventions(D_ASSIGNED_INTERVENTIONS)
        setComplianceDocuments(D_COMPLIANCE)
        setAppointments(D_APPOINTMENTS)
        setEvents(D_EVENTS)
        setNotifications(D_NOTIFICATIONS)
      } finally {
        setAppointmentsLoading(false)
      }
    }
    fetchAll()
  }, [user?.companyCode])

  /** ---------- KPIs & charts ---------- */
  const tasksPending = tasks.filter(
    t => t.status !== 'Completed' && !isOverdue(t)
  ).length
  const tasksCompleted = tasks.filter(t => t.status === 'Completed').length
  const tasksOverdue = tasks.filter(t => isOverdue(t)).length

  const intsPending = interventions.filter(
    i => i.status !== 'Completed' && !isOverdue(i)
  ).length
  const intsCompleted = interventions.filter(
    i => i.status === 'Completed'
  ).length
  const intsOverdue = interventions.filter(i => isOverdue(i)).length

  const totalInterventions = intsPending + intsCompleted + intsOverdue
  const completionRate = totalInterventions
    ? Math.round((intsCompleted / totalInterventions) * 100)
    : 0

  const upToDate = complianceDocuments.filter(d => d.status === 'valid').length
  const needsReview = complianceDocuments.filter(
    d => d.status === 'expiring'
  ).length
  const overdueDocs = complianceDocuments.filter(d =>
    ['expired', 'missing', 'pending'].includes(d.status)
  ).length

  // lightweight trend for sparklines (fake but stable)
  const MONTH_CATS_8 = useMemo(() => lastMonths(8), [])

  // KPI sparklines with month labels
  const sparkTasks = useMemo(
    () => spark([7, 9, 6, 11, 10, 8, 12, 9], MONTH_CATS_8),
    [MONTH_CATS_8]
  )
  const sparkParticipants = useMemo(
    () => spark([2, 3, 3, 4, 3, 5, 4, 6], MONTH_CATS_8),
    [MONTH_CATS_8]
  )
  const sparkOverdue = useMemo(
    () => spark([1, 2, 1, 3, 2, 4, 3, 2], MONTH_CATS_8),
    [MONTH_CATS_8]
  )
  const sparkCompletion = useMemo(
    () => spark([45, 48, 52, 55, 58, 62, 64, completionRate], MONTH_CATS_8),
    [MONTH_CATS_8, completionRate]
  )

  // taller card height target so both left/right match
  const CARD_TALL = 420
  const CHART_HEIGHT = 320

  const tasksVsInterventionsChart: Highcharts.Options = {
    colors: ['#faad14', '#52c41a', '#ff4d4f'],
    chart: {
      type: 'column',
      height: CHART_HEIGHT,
      backgroundColor: 'transparent'
    },
    title: { text: 'Tasks vs Interventions' },
    credits: { enabled: false },
    xAxis: { categories: ['Tasks', 'Interventions'] },
    yAxis: { title: { text: 'Count' }, gridLineWidth: 0 },
    plotOptions: {
      column: {
        stacking: 'normal',
        borderWidth: 0,
        borderRadius: 6,
        dataLabels: { enabled: true, format: '{point.y}' }
      }
    },
    series: [
      { name: 'Pending', type: 'column', data: [tasksPending, intsPending] },
      {
        name: 'Completed',
        type: 'column',
        data: [tasksCompleted, intsCompleted]
      },
      { name: 'Overdue', type: 'column', data: [tasksOverdue, intsOverdue] }
    ]
  }

  // ✨ clearer donut labels + legend
  const complianceDonut: Highcharts.Options = {
    chart: {
      type: 'pie',
      height: CHART_HEIGHT,
      backgroundColor: 'transparent'
    },
    title: { text: 'Compliance Overview' },
    credits: { enabled: false },
    legend: { enabled: true, align: 'center', verticalAlign: 'bottom' },
    tooltip: { pointFormat: '<b>{point.y}</b>' },
    plotOptions: {
      pie: {
        innerSize: '60%',
        dataLabels: {
          enabled: true,
          distance: 20,
          style: {
            fontSize: '12px',
            textOutline: 'none',
            color: '#1f2937',
            fontWeight: 500
          },
          formatter: function () {
            return `${this.point.name}: ${this.y}`
          }
        }
      }
    },
    series: [
      {
        type: 'pie',
        data: [
          { name: 'Valid', y: upToDate, color: '#52c41a' },
          { name: 'Expiring', y: needsReview, color: '#faad14' },
          { name: 'Overdue', y: overdueDocs, color: '#ff4d4f' }
        ]
      }
    ]
  }

  const workloadTrend: Highcharts.Options = {
    chart: {
      type: 'areaspline',
      height: CHART_HEIGHT,
      backgroundColor: 'transparent'
    },
    title: { text: 'Workload Trend (last 8 months)' },
    credits: { enabled: false },
    xAxis: { categories: MONTH_CATS_8 },
    yAxis: { title: { text: 'Open Items' } },
    tooltip: { shared: true },
    plotOptions: {
      areaspline: { marker: { enabled: false }, fillOpacity: 0.2 }
    },
    series: [
      {
        name: 'Tasks (open)',
        type: 'areaspline',
        data: [9, 8, 10, 7, 11, 12, 10, tasksPending]
      },
      {
        name: 'Interventions (open)',
        type: 'areaspline',
        data: [6, 7, 7, 6, 8, 9, 8, intsPending]
      }
    ]
  }

  /** ---------- Events ---------- */
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />
      case 'deadline':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      case 'event':
        return <CalendarOutlined style={{ color: '#52c41a' }} />
      case 'workshop':
        return <FileTextOutlined style={{ color: '#722ed1' }} />
      default:
        return <CalendarOutlined style={{ color: '#1890ff' }} />
    }
  }
  const handleEventClick = (event: any) => {
    const eventData = events.find(e => e.id === event.id)
    setSelectedEvent(eventData)
    setEventDetailModalOpen(true)
  }

  const handleAddEvent = async (values: any) => {
    const eventDate = dayjs(values.date).format('YYYY-MM-DD')
    const start = dayjs(values.startTime)
    const end = dayjs(values.endTime)
    if (!start.isValid() || !end.isValid())
      return message.error('Please select a valid start and end time.')
    if (start.hour() < 6 || end.hour() > 18 || end.isBefore(start))
      return message.error(
        'Event time must be between 06:00 and 18:00, and end after start.'
      )

    const newId = `event-${Date.now()}`
    const newEvent = {
      id: newId,
      title: values.title,
      date: eventDate,
      startTime: Timestamp.fromDate(start.toDate()),
      endTime: Timestamp.fromDate(end.toDate()),
      type: values.eventType,
      format: values.format,
      location: values.location || '',
      link: values.link || '',
      description: values.description || '',
      participants: values.participants || [],
      createdAt: Timestamp.now(),
      companyCode: user?.companyCode
    }

    try {
      if (user?.companyCode && user.companyCode !== 'QTX') {
        await setDoc(doc(db, 'events', newId), newEvent)
      }
      setEvents(prev => [...prev, newEvent])
      message.success('Event added successfully')
      setEventModalOpen(false)
      eventForm.resetFields()
    } catch {
      message.error('Failed to add event')
    }
  }

  /** ---------- Render ---------- */
  return (
    <Layout style={{ minHeight: '100vh', background: '#f7faff' }}>
      <Helmet>
        <title>Operations Dashboard</title>
        <meta
          name='description'
          content='Manage daily operations and track incubatee progress'
        />
      </Helmet>

      {/* Hero */}
      <div style={{ padding: 24, paddingBottom: 0 }}>
        <MotionCard
          style={{ background: 'linear-gradient(90deg,#eef4ff, #f9fbff)' }}
        >
          <Row align='middle' justify='space-between'>
            <Col>
              <Title level={4} style={{ marginBottom: 0 }}>
                Operations Overview
              </Title>
              <Text type='secondary'>
                Stay on top of tasks, interventions, compliance and events.
              </Text>
            </Col>
            <Col>
              <Space>
                <Button
                  type='primary'
                  icon={<CalendarOutlined />}
                  onClick={() => setEventModalOpen(true)}
                >
                  Add Event
                </Button>
                <Button onClick={() => setCalendarModalOpen(true)}>
                  Open Calendar
                </Button>
              </Space>
            </Col>
          </Row>
        </MotionCard>
      </div>

      <div style={{ padding: 24 }}>
        {/* KPI row with sparklines */}
        <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Pending Tasks'
                  value={tasksPending}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <HighchartsReact highcharts={Highcharts} options={sparkTasks} />
              </Space>
            </MotionCard>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Active Participants'
                  value={participants.length}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
                <HighchartsReact
                  highcharts={Highcharts}
                  options={sparkParticipants}
                />
              </Space>
            </MotionCard>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Overdue Items'
                  value={tasksOverdue + intsOverdue}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <HighchartsReact
                  highcharts={Highcharts}
                  options={sparkOverdue}
                />
              </Space>
            </MotionCard>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <MotionCard>
              <Space direction='vertical' style={{ width: '100%' }}>
                <Statistic
                  title='Completion Rate'
                  value={completionRate}
                  suffix='%'
                  valueStyle={{ color: '#52c41a' }}
                />
                <HighchartsReact
                  highcharts={Highcharts}
                  options={sparkCompletion}
                />
              </Space>
            </MotionCard>
          </Col>
        </Row>

        {/* Visual row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 8 }}>
          <Col xs={24} lg={14}>
            <MotionCard
              title='Workload Trend'
              extra={
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() =>
                    setExpandOpen({ open: true, which: 'workload' })
                  }
                >
                  Expand
                </Button>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={workloadTrend}
              />
            </MotionCard>
          </Col>
          <Col xs={24} lg={10}>
            <MotionCard
              title='Compliance'
              extra={
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() =>
                    setExpandOpen({ open: true, which: 'compliance' })
                  }
                >
                  Expand
                </Button>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={complianceDonut}
              />
            </MotionCard>
          </Col>
        </Row>

        {/* Lists & stacked chart */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <MotionCard
              title={
                <Space>
                  <ScheduleOutlined />
                  <span>Consultant Appointments</span>
                </Space>
              }
            >
              <List
                size='small'
                loading={appointmentsLoading}
                dataSource={[...appointments].sort((a, b) =>
                  dayjs(a.date + ' ' + (a.time || '')).diff(
                    dayjs(b.date + ' ' + (b.time || ''))
                  )
                )}
                renderItem={(appt: any) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text>{appt.participantName}</Text>
                          <Tag color='blue'>{appt.consultantName}</Tag>
                        </Space>
                      }
                      description={
                        <>
                          Date/Time:{' '}
                          {dayjs(
                            `${appt.date} ${dayjs(appt.time).format('HH:mm')}`
                          ).format('YYYY-MM-DD HH:mm')}
                          <br />
                          Location: {appt.location || appt.meetingLink}
                        </>
                      }
                    />
                    <Badge
                      status={
                        appt.status === 'completed' ? 'success' : 'processing'
                      }
                      text={appt.status}
                    />
                  </List.Item>
                )}
              />
            </MotionCard>
          </Col>

          <Col xs={24} lg={12}>
            <MotionCard
              title='Tasks vs Interventions'
              extra={
                <Button
                  icon={<FullscreenOutlined />}
                  onClick={() => setExpandOpen({ open: true, which: 'tasks' })}
                >
                  Expand
                </Button>
              }
            >
              <HighchartsReact
                highcharts={Highcharts}
                options={tasksVsInterventionsChart}
              />
            </MotionCard>
          </Col>
        </Row>
      </div>

      {/* Add Event */}
      <EventModal
        open={eventModalOpen}
        onCancel={() => setEventModalOpen(false)}
        onSubmit={handleAddEvent}
        form={eventForm}
        consultants={[]}
        projectAdmins={[]}
        operationsUsers={[]}
        participants={participants}
      />

      {/* Calendar Modal */}
      <Modal
        title='Full Calendar View'
        open={calendarModalOpen}
        onCancel={() => setCalendarModalOpen(false)}
        footer={null}
        width={900}
      >
        <FullCalendar
          plugins={[dayGridPlugin]}
          initialView='dayGridMonth'
          events={events.map(e => ({ id: e.id, title: e.title, date: e.date }))}
          eventClick={info => handleEventClick(info.event)}
          height={600}
        />
      </Modal>

      {/* Event Details */}
      <Modal
        title='Event Details'
        open={eventDetailModalOpen}
        onCancel={() => setEventDetailModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedEvent && (
          <>
            <Alert
              message='This is a scheduled event. Please ensure all participants are informed.'
              type='info'
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions
              bordered
              column={1}
              size='middle'
              labelStyle={{ width: '40%' }}
            >
              <Descriptions.Item label='Title'>
                {selectedEvent.title}
              </Descriptions.Item>
              <Descriptions.Item label='Date'>
                {selectedEvent.date}
              </Descriptions.Item>
              <Descriptions.Item label='Time'>
                {selectedEvent.startTime?.toDate &&
                selectedEvent.endTime?.toDate
                  ? `${dayjs(selectedEvent.startTime.toDate()).format(
                      'HH:mm'
                    )} - ${dayjs(selectedEvent.endTime.toDate()).format(
                      'HH:mm'
                    )}`
                  : selectedEvent.time || 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label='Type'>
                <Tag color='blue'>{selectedEvent.type}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label='Format'>
                <Tag color='green'>{selectedEvent.format}</Tag>
              </Descriptions.Item>
              {selectedEvent.location && (
                <Descriptions.Item label='Location'>
                  {selectedEvent.location}
                </Descriptions.Item>
              )}
              {selectedEvent.link && (
                <Descriptions.Item label='Link'>
                  <a
                    href={selectedEvent.link}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {selectedEvent.link}
                  </a>
                </Descriptions.Item>
              )}
              {selectedEvent.description && (
                <Descriptions.Item label='Description'>
                  {selectedEvent.description}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

      {/* Expand charts modal */}
      <Modal
        title={
          expandOpen.which === 'workload'
            ? 'Workload Trend'
            : expandOpen.which === 'compliance'
            ? 'Compliance Overview'
            : 'Tasks vs Interventions'
        }
        open={expandOpen.open}
        onCancel={() => setExpandOpen({ open: false })}
        footer={null}
        width={900}
      >
        {expandOpen.which === 'workload' && (
          <HighchartsReact highcharts={Highcharts} options={workloadTrend} />
        )}
        {expandOpen.which === 'compliance' && (
          <HighchartsReact highcharts={Highcharts} options={complianceDonut} />
        )}
        {expandOpen.which === 'tasks' && (
          <HighchartsReact
            highcharts={Highcharts}
            options={tasksVsInterventionsChart}
          />
        )}
      </Modal>

      {/* Floating notifications button */}
      <Button
        type='primary'
        shape='circle'
        icon={
          <Badge
            count={notifications.filter(n => !n.readBy?.operations).length}
          >
            <BellOutlined />
          </Badge>
        }
        style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
        onClick={() => message.info('Notifications panel coming soon')}
      />
    </Layout>
  )
}

export default OperationsDashboard

