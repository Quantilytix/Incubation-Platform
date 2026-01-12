// import React, { useState, useEffect } from 'react'
// import {
//   Card,
//   Table,
//   Button,
//   Space,
//   Tag,
//   Input,
//   Modal,
//   Form,
//   Select,
//   DatePicker,
//   Upload,
//   message,
//   Tooltip,
//   Typography,
//   Badge,
//   Tabs,
//   Row,
//   Col,
//   Statistic,
//   Progress,
//   Layout,
//   Alert,
//   Descriptions
// } from 'antd'
// import {
//   SearchOutlined,
//   UploadOutlined,
//   EyeOutlined,
//   CheckCircleOutlined,
//   CloseCircleOutlined,
//   WarningOutlined,
//   SafetyCertificateOutlined,
//   FileTextOutlined,
//   PlusOutlined,
//   DownloadOutlined,
//   FileAddOutlined,
//   FileProtectOutlined,
//   UserOutlined
// } from '@ant-design/icons'
// import { useNavigate } from 'react-router-dom'
// import moment from 'dayjs'
// import type { UploadProps } from 'antd'
// import type { ColumnType } from 'antd/es/table'
// import { db } from '@/firebase'
// import {
//   collection,
//   getDocs,
//   addDoc,
//   updateDoc,
//   doc,
//   query,
//   where
// } from 'firebase/firestore'
// import {
//   getStorage,
//   ref,
//   uploadBytesResumable,
//   getDownloadURL
// } from 'firebase/storage'

// import { ComplianceDocument, documentTypes, documentStatuses } from './types'
// import EDAgreementModal from './EDAgreementModal'
// import { Helmet } from 'react-helmet'

// import { httpsCallable } from 'firebase/functions'
// import { functions } from '@/firebase' // ⬅️ make sure this exports Firebase functions
// import { useFullIdentity } from '@/hooks/src/useFullIdentity'
// import { motion } from 'framer-motion'

// const { Title, Text } = Typography
// const { TabPane } = Tabs
// const { Option } = Select
// const { TextArea } = Input

// const getEffectiveStatus = (doc: ComplianceDocument): string => {
//     const rawStatus = (doc.status || '').toLowerCase()
//     const now = moment()

//     // handle both Timestamp and string
//     const expiryMoment = (doc as any).expiryDate?.toDate
//       ? moment((doc as any).expiryDate.toDate())
//       : doc.expiryDate
//       ? moment(doc.expiryDate)
//       : null

//     // If we have an expiry date and it's before today → expired
//     if (expiryMoment && expiryMoment.isValid()) {
//       if (expiryMoment.isBefore(now, 'day')) {
//         return 'expired'
//       }
//     }

//     // Otherwise fall back to whatever was stored (or pending)
//     return rawStatus || 'pending'
//   }


// const OperationsCompliance: React.FC = () => {
//   const [documents, setDocuments] = useState<ComplianceDocument[]>([])
//   const [verificationModalVisible, setVerificationModalVisible] =
//     useState(false)
//   const [verifyingDocument, setVerifyingDocument] =
//     useState<ComplianceDocument | null>(null)
//   const [verificationComment, setVerificationComment] = useState('')
//   const [formLoading, setFormLoading] = useState(true)
//   const [searchText, setSearchText] = useState('')
//   const [isModalVisible, setIsModalVisible] = useState(false)
//   const [isEDAgreementModalVisible, setIsEDAgreementModalVisible] =
//     useState(false)
//   const [selectedDocument, setSelectedDocument] =
//     useState<ComplianceDocument | null>(null)
//   const storage = getStorage()
//   const [selectedStatusFilter, setSelectedStatusFilter] = useState<
//     string | null
//   >(null)

//   const [selectedParticipant, setSelectedParticipant] = useState<any>(null)
//   const [form] = Form.useForm()
//   const [activeTab, setActiveTab] = useState('1')
//   const navigate = useNavigate()
//   const [uploadingFile, setUploadingFile] = useState<File | null>(null)
//   const [uploadPercent, setUploadPercent] = useState<number>(0)
//   const [isUploading, setIsUploading] = useState<boolean>(false)
//   const [contactInfoMap, setContactInfoMap] = useState<Record<string, any>>({})
//   const { user, loading } = useFullIdentity()
//   const [verifySubmitting, setVerifySubmitting] = useState(false)
//   const [reminderSending, setReminderSending] = useState(false)

//   useEffect(() => {
//     const fetchContactInfo = async () => {
//       if (!user?.companyCode) return

//       const appsSnap = await getDocs(
//         query(
//           collection(db, 'applications'),
//           where('companyCode', '==', user.companyCode)
//         )
//       )

//       const participantsSnap = await getDocs(
//         query(collection(db, 'participants'))
//       )

//       const participantMap = participantsSnap.docs.reduce((acc, doc) => {
//         acc[doc.id] = doc.data()
//         return acc
//       }, {} as Record<string, any>)

//       const contactMap = appsSnap.docs.reduce((acc, doc) => {
//         const data = doc.data()
//         const pId = data.participantId
//         if (participantMap[pId]) {
//           acc[pId] = {
//             name: participantMap[pId].beneficiaryName,
//             email: participantMap[pId].email,
//             phone:
//               participantMap[pId].phone || participantMap[pId].contactNumber
//           }
//         }
//         return acc
//       }, {} as Record<string, any>)

//       setContactInfoMap(contactMap)
//     }

//     fetchContactInfo()
//   }, [user?.companyCode])

//   const uploadProps: UploadProps = {
//     beforeUpload: file => {
//       setUploadingFile(file)
//       return false
//     },
//     showUploadList: true
//   }

//   // Load data
//   useEffect(() => {
//     const fetchDocuments = async () => {
//       if (!user?.companyCode) return

//       setFormLoading(true)
//       try {
//         const appsQuery = query(
//           collection(db, 'applications'),
//           where('companyCode', '==', user.companyCode),
//           where('applicationStatus', '==', 'accepted')
//         )
//         const snapshot = await getDocs(appsQuery)

//         const fetchedDocuments: ComplianceDocument[] = []

//         snapshot.forEach(applicationDoc => {
//           const appData = applicationDoc.data()
//           const complianceDocs = appData.complianceDocuments || []

//           complianceDocs.forEach((doc, index) => {
//             const docStatus = doc.status?.toLowerCase()
//             if (
//               !selectedStatusFilter ||
//               docStatus === selectedStatusFilter.toLowerCase()
//             ) {
//               fetchedDocuments.push({
//                 id: `${applicationDoc.id}-${index}`,
//                 beneficiaryName: appData.beneficiaryName,
//                 participantId: appData.participantId,
//                 verificationStatus: doc.verificationStatus || 'unverified',
//                 verificationComment: doc.verificationComment || '',
//                 lastVerifiedBy: doc.lastVerifiedBy || '',
//                 lastVerifiedAt: doc.lastVerifiedAt || '',
//                 ...doc
//               })
//             }
//           })
//         })

//         setDocuments(fetchedDocuments)
//       } catch (error) {
//         console.error('Error fetching compliance docs:', error)
//         message.error('Failed to load documents.')
//       } finally {
//         setFormLoading(false)
//       }
//     }

//     fetchDocuments()
//   }, [user?.companyCode, selectedStatusFilter]) // 🔁 refetch when filter changes

//   const handleSendReminders = async () => {
//     if (reminderSending) return
//     setReminderSending(true)
//     try {
//       const remindersByUser: Record<string, ComplianceDocument[]> = {}

//       documents.forEach(doc => {
//         const isProblematic = [
//           'missing',
//           'expired',
//           'pending',
//           'invalid'
//         ].includes(
//           // ← added 'invalid'
//           (doc.status || '').toLowerCase()
//         )
//         const email = contactInfoMap[doc.participantId]?.email
//         if (isProblematic && email) {
//           if (!remindersByUser[email]) remindersByUser[email] = []
//           remindersByUser[email].push(doc)
//         }
//       })

//       const sendReminder = httpsCallable(
//         functions,
//         'sendComplianceReminderEmail'
//       )

//       const promises = Object.entries(remindersByUser).map(
//         async ([email, docs]) => {
//           const contact = Object.values(contactInfoMap).find(
//             c => c.email === email
//           ) as any
//           const issues = docs.map(d => `${d.type} (${d.status})`)
//           try {
//             await sendReminder({ email, name: contact?.name || email, issues })
//             message.success(`📧 Reminder sent to ${contact?.name || email}`)
//           } catch (err) {
//             console.error('❌ Email failed:', err)
//             message.error(`Failed to send to ${contact?.name || email}`)
//           }
//         }
//       )

//       await Promise.all(promises)
//     } finally {
//       setReminderSending(false)
//     }
//   }

//   // Show add/edit document modal
//   const showModal = (document?: ComplianceDocument) => {
//     if (document) {
//       setSelectedDocument(document)
//       form.setFieldsValue({
//         participantId: document.participantId,
//         type: document.type,
//         status: document.status,
//         issueDate: document.issueDate ? moment(document.issueDate) : null,
//         expiryDate: document.expiryDate ? moment(document.expiryDate) : null,
//         notes: document.notes
//       })
//     } else {
//       setSelectedDocument(null)
//       form.resetFields()
//     }
//     setIsModalVisible(true)
//   }
//   const calculateComplianceScore = (docs: ComplianceDocument[]): number => {
//     const total = docs.length
//     if (total === 0) return 0

//     const validCount = docs.filter(
//       doc => doc.status === 'valid' || doc.verificationStatus === 'verified'
//     ).length

//     return Math.round((validCount / total) * 100)
//   }

//   const continueSaving = async (url: string) => {
//     try {
//       const appSnap = await getDocs(
//         query(
//           collection(db, 'applications'),
//           where('participantId', '==', form.getFieldValue('participantId')),
//           where('companyCode', '==', user?.companyCode)
//         )
//       )

//       if (appSnap.empty) {
//         message.error('Application not found for this participant.')
//         return
//       }

//       const applicationDoc = appSnap.docs[0]
//       const applicationId = applicationDoc.id
//       const applicationData = applicationDoc.data()

//       const complianceDocuments: ComplianceDocument[] =
//         applicationData.complianceDocuments || []

//       const newDoc: ComplianceDocument = {
//         id: selectedDocument?.id || `d${Date.now()}`,
//         participantId: form.getFieldValue('participantId'),
//         beneficiaryName:
//           contactInfoMap[form.getFieldValue('participantId')]?.name || '',
//         type: form.getFieldValue('type'),
//         documentName: form.getFieldValue('documentName'),
//         status: form.getFieldValue('status'),
//         issueDate: form.getFieldValue('issueDate')?.format('YYYY-MM-DD') || '',
//         expiryDate:
//           form.getFieldValue('expiryDate')?.format('YYYY-MM-DD') || '',
//         notes: form.getFieldValue('notes'),
//         url,
//         uploadedBy: user?.name || 'Unknown',
//         uploadedAt: new Date().toISOString().split('T')[0],
//         lastVerifiedBy: selectedDocument?.lastVerifiedBy,
//         lastVerifiedAt: selectedDocument?.lastVerifiedAt
//       }

//       let updatedDocs

//       if (selectedDocument) {
//         updatedDocs = complianceDocuments.map(doc =>
//           doc.id === selectedDocument.id ? newDoc : doc
//         )
//       } else {
//         updatedDocs = [...complianceDocuments, newDoc]
//       }

//       const updatedScore = calculateComplianceScore(updatedDocs)

//       await updateDoc(doc(db, 'applications', applicationId), {
//         complianceDocuments: updatedDocs,
//         complianceScore: updatedScore // ⬅️ update score here
//       })

//       setDocuments(prev =>
//         selectedDocument
//           ? prev.map(doc => (doc.id === selectedDocument.id ? newDoc : doc))
//           : [...prev, newDoc]
//       )

//       message.success(selectedDocument ? 'Document updated' : 'Document added')
//       setUploadingFile(null)
//       setIsModalVisible(false)
//       form.resetFields()
//     } catch (error) {
//       console.error('Error saving document:', error)
//       message.error('❌ Failed to update application.')
//     }
//   }

//   // Handle form submission
//   const handleSubmit = async (values: any) => {
//     try {
//       let url = selectedDocument?.url || ''

//       if (uploadingFile) {
//         setIsUploading(true)
//         const storageRef = ref(
//           storage,
//           `compliance-documents/${Date.now()}-${uploadingFile.name}`
//         )

//         const uploadTask = uploadBytesResumable(storageRef, uploadingFile)

//         uploadTask.on(
//           'state_changed',
//           snapshot => {
//             const progress =
//               (snapshot.bytesTransferred / snapshot.totalBytes) * 100
//             setUploadPercent(Math.round(progress))
//           },
//           error => {
//             console.error('Upload error:', error)
//             message.error('Upload failed.')
//             setIsUploading(false)
//           },
//           async () => {
//             const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
//             url = downloadURL
//             setIsUploading(false)
//             setUploadPercent(0)
//             await continueSaving(url) // 👇 continue saving after upload
//           }
//         )
//       } else {
//         await continueSaving(url)
//       }
//     } catch (error) {
//       console.error('Error saving document:', error)
//       message.error('Failed to save document.')
//     }
//   }

//   const handleVerification = async (
//     status: 'verified' | 'queried',
//     comment?: string
//   ) => {
//     if (!verifyingDocument || verifySubmitting) return // prevent double fire
//     setVerifySubmitting(true)
//     try {
//       const appSnap = await getDocs(
//         query(
//           collection(db, 'applications'),
//           where('participantId', '==', verifyingDocument.participantId),
//           where('companyCode', '==', user?.companyCode)
//         )
//       )
//       if (appSnap.empty) {
//         message.error('Application not found')
//         return
//       }

//       const docRef = appSnap.docs[0].ref
//       const currentData = appSnap.docs[0].data()
//       const docs = currentData.complianceDocuments || []

//       const updatedDocs = docs.map((doc: ComplianceDocument) => {
//         const sameById =
//           doc.id && verifyingDocument.id && doc.id === verifyingDocument.id

//         const sameByComposite =
//           !doc.id && // old docs that were saved without an id
//           doc.participantId === verifyingDocument.participantId &&
//           (doc.type || '').toLowerCase() ===
//             (verifyingDocument.type || '').toLowerCase() &&
//           (doc.documentName || '').toLowerCase() ===
//             (verifyingDocument.documentName || '').toLowerCase() &&
//           (doc.expiryDate || '') === (verifyingDocument.expiryDate || '')

//         if (sameById || sameByComposite) {
//           return {
//             ...doc,
//             verificationStatus: status,
//             verificationComment: comment || '',
//             lastVerifiedBy: user?.name || 'Unknown',
//             lastVerifiedAt: new Date().toISOString().split('T')[0],
//             status: status === 'queried' ? 'invalid' : doc.status
//           }
//         }

//         return doc
//       })


//       const updatedScore = calculateComplianceScore(updatedDocs)

//       await updateDoc(docRef, {
//         complianceDocuments: updatedDocs,
//         complianceScore: updatedScore
//       })

//       setDocuments(prev =>
//         prev.map(doc =>
//           doc.id === verifyingDocument.id
//             ? {
//                 ...doc,
//                 verificationStatus: status,
//                 verificationComment: comment || '',
//                 lastVerifiedBy: user?.name || 'Unknown',
//                 lastVerifiedAt: new Date().toISOString().split('T')[0],
//                 status: status === 'queried' ? 'invalid' : doc.status
//               }
//             : doc
//         )
//       )

//       message.success(
//         status === 'verified' ? '✅ Document verified' : '❌ Document queried'
//       )
//       setVerificationModalVisible(false)
//     } catch (err) {
//       console.error('❌ Verification failed', err)
//       message.error('Failed to verify document')
//     } finally {
//       setVerifySubmitting(false)
//     }
//   }

//   // Show ED Agreement modal for specific participant
//   const showEDAgreementModal = (participantId: string) => {
//     const participant = {
//       id: participantId,
//       ...contactInfoMap[participantId]
//     }

//     setSelectedParticipant(participant)
//     setIsEDAgreementModalVisible(true)
//   }

//   // Handle saving the new ED Agreement
//   const handleSaveEDAgreement = (document: ComplianceDocument) => {
//     setDocuments([...documents, document])
//   }

//   // Search functionality
//   const filteredDocuments = searchText
//     ? documents.filter(doc => {
//         const docTypeLabel =
//           documentTypes.find(t => t.value === doc.type || t.label === doc.type)
//             ?.label || ''

//         return (
//           doc.beneficiaryName
//             .toLowerCase()
//             .includes(searchText.toLowerCase()) ||
//           doc.type.toLowerCase().includes(searchText.toLowerCase()) ||
//           docTypeLabel.toLowerCase().includes(searchText.toLowerCase())
//         )
//       })
//     : documents

//   // Get compliance statistics
//   const complianceStats = {
//     total: documents.length,
//     valid: documents.filter(doc => getEffectiveStatus(doc) === 'valid').length,
//     expiring: documents.filter(doc => getEffectiveStatus(doc) === 'expiring')
//       .length,
//     expired: documents.filter(doc => getEffectiveStatus(doc) === 'expired')
//       .length,
//     missing: documents.filter(doc => getEffectiveStatus(doc) === 'missing')
//       .length,
//     pending: documents.filter(doc => getEffectiveStatus(doc) === 'pending')
//       .length
//   }


//   // Table columns
//   const columns: ColumnType<ComplianceDocument>[] = [
//     {
//       title: 'Participant',
//       dataIndex: 'beneficiaryName',
//       key: 'beneficiaryName',
//       sorter: (a: ComplianceDocument, b: ComplianceDocument) =>
//         a.beneficiaryName.localeCompare(b.beneficiaryName)
//     },
//     {
//       title: 'Document Type',
//       dataIndex: 'type',
//       key: 'type',
//       render: (value: string) =>
//         documentTypes.find(t => t.value === value || t.label === value)
//           ?.label || value,
//       filters: documentTypes.map(type => ({
//         text: type.label,
//         value: type.value
//       })),
//       onFilter: (value: any, record: ComplianceDocument) =>
//         record.type === value
//     },
//     {
//       title: 'Verification',
//       dataIndex: 'verificationStatus',
//       key: 'verificationStatus',
//       render: (status: string) => {
//         let color = 'default'
//         let label = 'Unverified'

//         if (status === 'verified') {
//           color = 'green'
//           label = 'Verified'
//         } else if (status === 'queried') {
//           color = 'red'
//           label = 'Queried'
//         } else {
//           color = 'orange'
//           label = 'Unverified'
//         }

//         return <Tag color={color}>{label}</Tag>
//       },
//       filters: [
//         { text: 'Verified', value: 'verified' },
//         { text: 'Queried', value: 'queried' },
//         { text: 'Unverified', value: 'unverified' }
//       ],
//       onFilter: (value: any, record: ComplianceDocument) =>
//         record.verificationStatus === value
//     },
//     {
//         title: 'Status',
//         dataIndex: 'status',
//         key: 'status',
//         render: (_: string, record: ComplianceDocument) => {
//           const effectiveStatus = getEffectiveStatus(record)
//           const statusConfig = documentStatuses.find(
//             s => s.value === effectiveStatus
//           )
//           return (
//             <Tag color={statusConfig?.color || 'default'}>
//               {statusConfig?.label || effectiveStatus}
//             </Tag>
//           )
//         },
//         filters: documentStatuses.map(status => ({
//           text: status.label,
//           value: status.value
//         })),
//         onFilter: (value: any, record: ComplianceDocument) =>
//           getEffectiveStatus(record) === value
//       }
//       ,
//     {
//       title: 'Expiry Date',
//       dataIndex: 'expiryDate',
//       key: 'expiryDate',
//       render: (date: any) =>
//         date?.toDate
//           ? moment(date.toDate()).format('DD MMM YYYY')
//           : moment(date).format('DD MMM YYYY'),
//       sorter: (a: ComplianceDocument, b: ComplianceDocument) =>
//         moment(a.expiryDate).unix() - moment(b.expiryDate).unix()
//     },
//     {
//       title: 'Actions',
//       key: 'actions',
//       render: (_: any, record: ComplianceDocument) => {
//         const contact = contactInfoMap[record.participantId]
//         console.log('record.participantId', record.participantId)

//         return (
//           <Space size='middle'>
//             {/* 👁️ View Document */}
//             {record.url && record.status.toLowerCase() !== 'missing' && (
//               <Tooltip title='View Document'>
//                 <Button
//                   icon={<EyeOutlined />}
//                   onClick={() => window.open(record.url, '_blank')}
//                   type='text'
//                 />
//               </Tooltip>
//             )}

//             {/* 📞 Contact Participant */}
//             {(record.status.toLowerCase() === 'missing' ||
//               record.status.toLowerCase() === 'expired' ||
//               record.verificationStatus?.toLowerCase() === 'queried') &&
//               contact && (
//                 <Tooltip title='Contact Participant'>
//                   <Button
//                     icon={<UserOutlined />}
//                     type='text'
//                     onClick={() => {
//                       Modal.info({
//                         title: `Contact ${contact.name}`,
//                         content: (
//                           <div>
//                             <p>
//                               <strong>Email:</strong> {contact.email}
//                             </p>
//                             <p>
//                               <strong>Phone:</strong> {contact.phone || 'N/A'}
//                             </p>
//                           </div>
//                         ),
//                         okText: 'Close'
//                       })
//                     }}
//                   />
//                 </Tooltip>
//               )}

//             {/* ✅ Verify / Query */}
//             {record.url &&
//               record.verificationStatus?.toLowerCase() === 'unverified' && (
//                 <Tooltip title='Verify / Query'>
//                   <Button
//                     icon={<FileProtectOutlined />}
//                     onClick={() => {
//                       setVerifyingDocument(record)
//                       setVerificationComment('')
//                       setVerificationModalVisible(true)
//                     }}
//                     type='text'
//                   />
//                 </Tooltip>
//               )}
//           </Space>
//         )
//       }
//     }
//   ] as const

//   return (
//     <Layout style={{ minHeight: '100vh', background: '#fff' }}>
//       <Helmet>
//         <title>Compliance Management | Smart Incubation</title>
//       </Helmet>

//       <Alert
//         message='Compliance Document Tracking'
//         description='Track and manage compliance documents for participants. You can send reminders to all users or to a specific user to prompt them to upload the required documents.'
//         type='info'
//         showIcon
//         closable
//         style={{ marginBottom: 16 }}
//       />

//       {/* Statistics Cards */}

//       <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
//         {[
//           {
//             title: 'Documents',
//             value: complianceStats.total,
//             color: '#1890ff',
//             icon: <SafetyCertificateOutlined />,
//             bgColor: '#e6f7ff'
//           },
//           {
//             title: 'Valid',
//             value: complianceStats.valid,
//             color: '#52c41a',
//             icon: <CheckCircleOutlined />,
//             bgColor: '#f6ffed'
//           },
//           {
//             title: 'Expiring',
//             value: complianceStats.expiring,
//             color: '#faad14',
//             icon: <WarningOutlined />,
//             bgColor: '#fffbe6'
//           },
//           {
//             title: 'Expired',
//             value: complianceStats.expired,
//             color: '#f5222d',
//             icon: <CloseCircleOutlined />,
//             bgColor: '#fff2f0'
//           },
//           {
//             title: 'Missing',
//             value: complianceStats.missing,
//             color: '#fa541c',
//             icon: <WarningOutlined />,
//             bgColor: '#fff2e8'
//           },
//           {
//             title: 'Pending',
//             value: complianceStats.pending,
//             color: '#1890ff',
//             icon: <FileTextOutlined />,
//             bgColor: '#e6f7ff'
//           }
//         ].map((metric, index) => (
//           <Col xs={24} sm={12} md={8} lg={4} key={metric.title}>
//             <motion.div
//               initial={{ opacity: 0, y: 10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.4, delay: index * 0.1 }}
//             >
//               <Card
//                 loading={loading}
//                 hoverable
//                 style={{
//                   boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
//                   transition: 'all 0.3s ease',
//                   borderRadius: 8,
//                   border: '1px solid #bae7ff',
//                   padding: '12px',
//                   height: '100%',
//                   minHeight: '120px',
//                   display: 'flex',
//                   flexDirection: 'column',
//                   justifyContent: 'space-between'
//                 }}
//               >
//                 <div style={{ display: 'flex', alignItems: 'center' }}>
//                   <div
//                     style={{
//                       background: metric.bgColor,
//                       padding: 8,
//                       borderRadius: '50%',
//                       marginRight: 12,
//                       display: 'flex',
//                       alignItems: 'center',
//                       justifyContent: 'center',
//                       flexShrink: 0
//                     }}
//                   >
//                     {React.cloneElement(metric.icon, {
//                       style: { fontSize: 16, color: metric.color }
//                     })}
//                   </div>
//                   <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap' }}>
//                     {metric.title}
//                   </Text>
//                 </div>
//                 <Title
//                   level={4}
//                   style={{
//                     margin: '8px 0 0 0',
//                     color: metric.color,
//                     textAlign: 'right'
//                   }}
//                 >
//                   {metric.value}
//                 </Title>
//               </Card>
//             </motion.div>
//           </Col>
//         ))}
//       </Row>

//       <motion.div
//         initial={{ opacity: 0, y: 10 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.4 }}
//       >
//         <Card
//           hoverable
//           style={{
//             boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
//             transition: 'all 0.3s ease',
//             borderRadius: 8,
//             border: '1px solid #d6e4ff',
//             marginBottom: 10
//           }}
//         >
//           <Row justify='space-between' align='middle' gutter={[16, 16]}>
//             {/* Left side: Search + Status Filter */}
//             <Col>
//               <Space>
//                 <Input
//                   placeholder='Search documents or participants'
//                   value={searchText}
//                   onChange={e => setSearchText(e.target.value)}
//                   style={{ width: 300 }}
//                   prefix={<SearchOutlined />}
//                 />

//                 <Select
//                   placeholder='Filter by Status'
//                   allowClear
//                   style={{ width: 200 }}
//                   onChange={value => setSelectedStatusFilter(value || null)}
//                 >
//                   {documentStatuses.map(status => (
//                     <Option key={status.value} value={status.value}>
//                       {status.label}
//                     </Option>
//                   ))}
//                 </Select>
//               </Space>
//             </Col>

//             {/* Right side: Buttons */}
//             <Col>
//               <Space>
//                 <Button
//                   type='primary'
//                   icon={<PlusOutlined />}
//                   onClick={() => showModal()}
//                 >
//                   Add New Document
//                 </Button>

//                 <Button
//                   icon={<FileAddOutlined />}
//                   onClick={() => setIsEDAgreementModalVisible(true)}
//                 >
//                   Generate ED Agreement
//                 </Button>

//                 <Button
//                   type='default'
//                   icon={<UserOutlined />}
//                   onClick={handleSendReminders}
//                   loading={reminderSending}
//                   disabled={reminderSending}
//                 >
//                   Send Email Reminders
//                 </Button>
//               </Space>
//             </Col>
//           </Row>
//         </Card>
//       </motion.div>

//       <motion.div
//         initial={{ opacity: 0, y: 10 }}
//         animate={{ opacity: 1, y: 0 }}
//         transition={{ duration: 0.4 }}
//       >
//         <Card
//           hoverable
//           style={{
//             boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
//             transition: 'all 0.3s ease',
//             borderRadius: 8,
//             border: '1px solid #d6e4ff'
//           }}
//           loading={formLoading}
//         >
//           <Table
//             columns={columns}
//             dataSource={filteredDocuments}
//             rowKey='id'
//             loading={formLoading}
//             expandable={{
//               expandedRowRender: record => (
//                 <div style={{ padding: '0 20px' }}>
//                   <p>
//                     <strong>Expiry Date:</strong> {record.expiryDate || 'N/A'}
//                   </p>
//                   {record.notes && (
//                     <p>
//                       <strong>Notes:</strong> {record.notes}
//                     </p>
//                   )}
//                   <p>
//                     <strong>Uploaded By:</strong> {record.uploadedBy} on{' '}
//                     {record.uploadedAt}
//                   </p>
//                   {record.lastVerifiedBy && (
//                     <p>
//                       <strong>Last Verified By:</strong> {record.lastVerifiedBy}{' '}
//                       on {record.lastVerifiedAt}
//                     </p>
//                   )}
//                   <Tag
//                     color={
//                       record.verificationStatus === 'verified'
//                         ? 'green'
//                         : record.verificationStatus === 'queried'
//                         ? 'red'
//                         : 'orange'
//                     }
//                   >
//                     {record.verificationStatus === 'verified'
//                       ? 'Verified'
//                       : record.verificationStatus === 'queried'
//                       ? 'Queried'
//                       : 'Unverified'}
//                   </Tag>
//                 </div>
//               )
//             }}
//           />
//         </Card>
//       </motion.div>

//       {/* Add/Edit Document Modal */}
//       <Modal
//         title={selectedDocument ? 'Edit Document' : 'Add New Document'}
//         open={isModalVisible}
//         onCancel={() => setIsModalVisible(false)}
//         footer={null}
//         width={800}
//       >
//         <Form form={form} layout='vertical' onFinish={handleSubmit}>
//           <Form.Item
//             name='participantId'
//             label='Participant'
//             rules={[{ required: true, message: 'Please select a participant' }]}
//           >
//             <Select placeholder='Select a participant'>
//               {Object.entries(contactInfoMap).map(([id, info]) => (
//                 <Option key={id} value={id}>
//                   {info.name}
//                 </Option>
//               ))}
//             </Select>
//           </Form.Item>

//           <Form.Item
//             name='type'
//             label='Document Type'
//             rules={[
//               { required: true, message: 'Please select a document type' }
//             ]}
//           >
//             <Select placeholder='Select document type'>
//               {documentTypes.map(type => (
//                 <Option key={type.value} value={type.value}>
//                   {type.label}
//                 </Option>
//               ))}
//             </Select>
//           </Form.Item>

//           <Form.Item
//             name='documentName'
//             label='Document Name'
//             rules={[
//               { required: true, message: 'Please enter a document name' }
//             ]}
//           >
//             <Input placeholder='Enter document name' />
//           </Form.Item>

//           <Row gutter={16}>
//             <Col span={12}>
//               <Form.Item name='issueDate' label='Issue Date'>
//                 <DatePicker style={{ width: '100%' }} />
//               </Form.Item>
//             </Col>
//             <Col span={12}>
//               <Form.Item name='expiryDate' label='Expiry Date'>
//                 <DatePicker style={{ width: '100%' }} />
//               </Form.Item>
//             </Col>
//           </Row>

//           <Form.Item
//             name='status'
//             label='Status'
//             rules={[{ required: true, message: 'Please select a status' }]}
//           >
//             <Select placeholder='Select status'>
//               {documentStatuses.map(status => (
//                 <Option key={status.value} value={status.value}>
//                   {status.label}
//                 </Option>
//               ))}
//             </Select>
//           </Form.Item>

//           <Form.Item name='notes' label='Notes'>
//             <TextArea rows={4} placeholder='Enter notes about this document' />
//           </Form.Item>

//           <Form.Item label='Document File'>
//             <Upload {...uploadProps}>
//               <Button icon={<UploadOutlined />}>Upload Document</Button>
//             </Upload>
//             {selectedDocument?.url && (
//               <div style={{ marginTop: '10px' }}>
//                 <Text>Current file: </Text>
//                 <Button
//                   type='link'
//                   icon={<DownloadOutlined />}
//                   onClick={() => window.open(selectedDocument.url, '_blank')}
//                 >
//                   View Document
//                 </Button>
//               </div>
//             )}
//           </Form.Item>

//           {isUploading && (
//             <div style={{ marginBottom: 16 }}>
//               <p>Uploading: {uploadPercent}%</p>
//               <Progress percent={uploadPercent} />
//             </div>
//           )}

//           <div style={{ textAlign: 'right' }}>
//             <Button
//               onClick={() => setIsModalVisible(false)}
//               style={{ marginRight: 8 }}
//             >
//               Cancel
//             </Button>
//             <Button type='primary' htmlType='submit' disabled={isUploading}>
//               {isUploading ? 'Uploading...' : 'Save'}
//             </Button>
//           </div>
//         </Form>
//       </Modal>

//       {/* Verification Modal */}
//       <Modal
//         open={verificationModalVisible}
//         title='Verify Compliance Document'
//         onCancel={() => setVerificationModalVisible(false)}
//         footer={null}
//       >
//         {verifyingDocument && (
//           <>
//             <Alert
//               message='You are reviewing this document for verification.'
//               description={
//                 verificationComment.trim()
//                   ? 'You are preparing to query this document. Please ensure the reason provided is clear and actionable.'
//                   : 'If there is an issue, provide a reason to query. Otherwise, proceed to verify.'
//               }
//               type={verificationComment.trim() ? 'warning' : 'info'}
//               showIcon
//               closable
//               style={{ marginBottom: 16 }}
//             />

//             <Descriptions
//               bordered
//               column={1}
//               size='small'
//               style={{ marginBottom: 16 }}
//             >
//               <Descriptions.Item label='Document Name'>
//                 {verifyingDocument.documentName || 'N/A'}
//               </Descriptions.Item>
//               <Descriptions.Item label='Participant'>
//                 {verifyingDocument.beneficiaryName || 'N/A'}
//               </Descriptions.Item>
//               <Descriptions.Item label='Status'>
//                 <Tag color='blue'>
//                   {verifyingDocument.status === 'valid'
//                     ? 'Valid'
//                     : verifyingDocument.status === 'invalid'
//                     ? 'Invalid'
//                     : verifyingDocument.status === 'expired'
//                     ? 'Expired'
//                     : verifyingDocument.status === 'missing'
//                     ? 'Missing'
//                     : verifyingDocument.status === 'expiring'
//                     ? 'Expiring'
//                     : verifyingDocument.status}
//                 </Tag>
//               </Descriptions.Item>
//             </Descriptions>

//             <Form
//               layout='vertical'
//               onFinish={values => {
//                 handleVerification('queried', values.verificationComment)
//               }}
//             >
//               <Form.Item name='verificationComment' label='Reason for Query'>
//                 <TextArea
//                   rows={4}
//                   placeholder='Enter reason for querying this document'
//                   onChange={e => setVerificationComment(e.target.value)}
//                 />
//               </Form.Item>

//               <Form.Item noStyle shouldUpdate>
//                 {({ getFieldValue }) => {
//                   const reason = getFieldValue('verificationComment')?.trim()
//                   return (
//                     <Row justify='end' gutter={8} style={{ marginTop: 8 }}>
//                       <Col>
//                         <Button
//                           onClick={() => setVerificationModalVisible(false)}
//                           disabled={verifySubmitting}
//                         >
//                           Cancel
//                         </Button>
//                       </Col>
//                       {reason ? (
//                         <Col>
//                           <Button
//                             htmlType='submit'
//                             type='default'
//                             loading={verifySubmitting}
//                             disabled={verifySubmitting}
//                           >
//                             Query
//                           </Button>
//                         </Col>
//                       ) : (
//                         <Col>
//                           <Button
//                             type='primary'
//                             onClick={() => handleVerification('verified')}
//                             loading={verifySubmitting}
//                             disabled={verifySubmitting}
//                           >
//                             Verify
//                           </Button>
//                         </Col>
//                       )}
//                     </Row>
//                   )
//                 }}
//               </Form.Item>
//             </Form>
//           </>
//         )}
//       </Modal>

//       {/* ED Agreement Modal */}
//       <EDAgreementModal
//         visible={isEDAgreementModalVisible}
//         onCancel={() => setIsEDAgreementModalVisible(false)}
//         participant={selectedParticipant}
//         onSave={handleSaveEDAgreement}
//       />
//     </Layout>
//   )
// }

// export default OperationsCompliance
// src/modules/compliance/OperationsCompliance.tsx
import React, { useMemo, useState } from 'react'
import {
    Alert,
    Button,
    Card,
    Col,
    DatePicker,
    Descriptions,
    Divider,
    Drawer,
    Form,
    Input,
    Modal,
    Progress,
    Row,
    Select,
    Space,
    Table,
    Tag,
    Tooltip,
    Typography,
    Upload,
    message
} from 'antd'
import type { UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined,
    FileAddOutlined,
    FileProtectOutlined,
    PlusOutlined,
    SafetyCertificateOutlined,
    SearchOutlined,
    UploadOutlined,
    UserOutlined,
    WarningOutlined
} from '@ant-design/icons'
import { Helmet } from 'react-helmet'
import { motion } from 'framer-motion'
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase'
import { useFullIdentity } from '@/hooks/src/useFullIdentity'
import dayjs from 'dayjs'

import {
    EffectiveDocStatus,
    ParticipantComplianceSummary,
    RawComplianceDoc,
    buildReminderPayloads,
    isProblematic
} from '@/modules/compliance/complianceLogic'
import { useComplianceData } from '@/modules/compliance/useComplianceData'

// If you have these already, reuse them
import { documentTypes, documentStatuses } from './types'
import EDAgreementModal from './EDAgreementModal'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

type ParticipantRow = ParticipantComplianceSummary & { key: string }

const statusColor = (s: EffectiveDocStatus) => {
    if (s === 'valid') return 'green'
    if (s === 'expiring') return 'orange'
    if (s === 'expired') return 'red'
    if (s === 'missing') return 'volcano'
    if (s === 'invalid') return 'magenta'
    return 'blue'
}

const verificationColor = (v: string) => {
    if (v === 'verified') return 'green'
    if (v === 'queried') return 'red'
    return 'orange'
}

const makeStableId = () => `cd_${Date.now()}_${Math.random().toString(16).slice(2)}`

const OperationsCompliance: React.FC = () => {
    const { user, loading: identityLoading } = useFullIdentity()
    const storage = getStorage()

    const { loading, error, participants, globalStats, refetch, updateDocumentInApplication, verifyDocument } =
        useComplianceData(user?.companyCode)

    // UI state
    const [searchText, setSearchText] = useState('')
    const [filterActionNeeded, setFilterActionNeeded] = useState<'all' | 'issues' | 'clean'>('all')

    const [drawerOpen, setDrawerOpen] = useState(false)
    const [activeParticipant, setActiveParticipant] = useState<ParticipantComplianceSummary | null>(null)

    // Add/Edit doc modal
    const [docModalOpen, setDocModalOpen] = useState(false)
    const [editingDoc, setEditingDoc] = useState<RawComplianceDoc | null>(null)
    const [docForm] = Form.useForm()

    // Upload state
    const [uploadingFile, setUploadingFile] = useState<File | null>(null)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [isUploading, setIsUploading] = useState(false)

    // Verify modal
    const [verifyOpen, setVerifyOpen] = useState(false)
    const [verifyDoc, setVerifyDoc] = useState<any>(null)
    const [verifySubmitting, setVerifySubmitting] = useState(false)

    // ED agreement
    const [edOpen, setEdOpen] = useState(false)
    const [edParticipant, setEdParticipant] = useState<any>(null)

    const rows: ParticipantRow[] = useMemo(() => {
        return participants.map(p => ({ ...p, key: p.participantId }))
    }, [participants])

    const filteredRows = useMemo(() => {
        const q = searchText.trim().toLowerCase()
        return rows.filter(r => {
            if (filterActionNeeded === 'issues' && !r.actionNeeded) return false
            if (filterActionNeeded === 'clean' && r.actionNeeded) return false

            if (!q) return true
            return (
                r.beneficiaryName.toLowerCase().includes(q) ||
                (r.email || '').toLowerCase().includes(q) ||
                (r.phone || '').toLowerCase().includes(q)
            )
        })
    }, [rows, searchText, filterActionNeeded])

    const participantColumns: ColumnsType<ParticipantRow> = [
        {
            title: 'Participant',
            dataIndex: 'beneficiaryName',
            key: 'beneficiaryName',
            sorter: (a, b) => a.beneficiaryName.localeCompare(b.beneficiaryName),
            render: (_, r) => (
                <Space direction="vertical" size={0}>
                    <Text strong>{r.beneficiaryName}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.email || 'No email'} {r.phone ? `• ${r.phone}` : ''}</Text>
                </Space>
            )
        },
        {
            title: 'Compliance',
            key: 'complianceScore',
            sorter: (a, b) => a.complianceScore - b.complianceScore,
            render: (_, r) => (
                <Space direction="vertical" style={{ width: 180 }}>
                    <Progress percent={r.complianceScore} size="small" />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.counts.valid}/{r.counts.total} compliant
                    </Text>
                </Space>
            )
        },
        {
            title: 'Issues',
            key: 'issues',
            render: (_, r) => (
                <Space wrap>
                    {r.counts.missing > 0 && <Tag color="volcano">Missing: {r.counts.missing}</Tag>}
                    {r.counts.expired > 0 && <Tag color="red">Expired: {r.counts.expired}</Tag>}
                    {r.counts.invalid > 0 && <Tag color="magenta">Queried: {r.counts.invalid}</Tag>}
                    {r.counts.expiring > 0 && <Tag color="orange">Expiring: {r.counts.expiring}</Tag>}
                    {!r.actionNeeded && <Tag color="green">All good</Tag>}
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, r) => (
                <Space>
                    <Tooltip title="Open participant">
                        <Button
                            type="primary"
                            ghost
                            icon={<SafetyCertificateOutlined />}
                            onClick={() => {
                                setActiveParticipant(r)
                                setDrawerOpen(true)
                            }}
                        >
                            Manage
                        </Button>
                    </Tooltip>

                    <Tooltip title="Contact">
                        <Button
                            icon={<UserOutlined />}
                            onClick={() => {
                                Modal.info({
                                    title: `Contact ${r.beneficiaryName}`,
                                    content: (
                                        <div>
                                            <p><strong>Email:</strong> {r.email || 'N/A'}</p>
                                            <p><strong>Phone:</strong> {r.phone || 'N/A'}</p>
                                        </div>
                                    )
                                })
                            }}
                        />
                    </Tooltip>
                </Space>
            )
        }
    ]

    const uploadProps: UploadProps = {
        beforeUpload: file => {
            setUploadingFile(file as any)
            return false
        },
        showUploadList: true
    }

    const openAddDocModal = (participant?: ParticipantComplianceSummary, doc?: any) => {
        setEditingDoc(doc || null)
        setDocModalOpen(true)

        if (doc) {
            docForm.setFieldsValue({
                participantId: participant?.participantId || doc.participantId,
                type: doc.type,
                documentName: doc.documentName,
                status: doc.statusRaw || doc.status,
                issueDate: doc.issue ? doc.issue : doc.issueDate ? dayjs(doc.issueDate) : null,
                expiryDate: doc.expiry ? doc.expiry : doc.expiryDate ? dayjs(doc.expiryDate) : null,
                notes: doc.notes
            })
        } else {
            docForm.resetFields()
            docForm.setFieldsValue({ participantId: participant?.participantId })
        }
    }

    const saveDoc = async (values: any) => {
        try {
            const participantId = values.participantId
            if (!participantId) throw new Error('Missing participantId')

            const performSave = async (url: string) => {
                await updateDocumentInApplication(participantId, (docs) => {
                    const next: RawComplianceDoc = {
                        id: editingDoc?.id || makeStableId(),
                        participantId,
                        type: values.type,
                        documentName: values.documentName,
                        status: values.status,
                        issueDate: values.issueDate ? values.issueDate.format('YYYY-MM-DD') : '',
                        expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : '',
                        notes: values.notes,
                        url,
                        uploadedBy: user?.name || 'Unknown',
                        uploadedAt: new Date().toISOString().split('T')[0],
                        lastVerifiedBy: editingDoc?.lastVerifiedBy,
                        lastVerifiedAt: editingDoc?.lastVerifiedAt,
                        verificationStatus: editingDoc?.verificationStatus || 'unverified',
                        verificationComment: editingDoc?.verificationComment || ''
                    }

                    if (editingDoc?.id) {
                        return docs.map(d => (d.id === editingDoc.id ? next : d))
                    }

                    return [...docs, next]
                })

                message.success(editingDoc ? 'Document updated' : 'Document added')
                setUploadingFile(null)
                setUploadPercent(0)
                setDocModalOpen(false)
                docForm.resetFields()
            }

            // Upload file if provided
            if (uploadingFile) {
                setIsUploading(true)
                const storageRef = ref(storage, `compliance-documents/${Date.now()}-${uploadingFile.name}`)
                const task = uploadBytesResumable(storageRef, uploadingFile)

                task.on(
                    'state_changed',
                    snap => {
                        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
                        setUploadPercent(pct)
                    },
                    err => {
                        console.error(err)
                        message.error('Upload failed')
                        setIsUploading(false)
                    },
                    async () => {
                        const url = await getDownloadURL(task.snapshot.ref)
                        setIsUploading(false)
                        await performSave(url)
                    }
                )
            } else {
                const url = editingDoc?.url || ''
                await performSave(url)
            }
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to save document')
            setIsUploading(false)
        }
    }

    const openVerify = (docRow: any) => {
        setVerifyDoc(docRow)
        setVerifyOpen(true)
        setVerifySubmitting(false)
    }

    const doVerify = async (status: 'verified' | 'queried', comment?: string) => {
        if (!activeParticipant || !verifyDoc || verifySubmitting) return
        setVerifySubmitting(true)
        try {
            await verifyDocument(
                activeParticipant.participantId,
                verifyDoc.id,
                { type: verifyDoc.type, documentName: verifyDoc.documentName, expiryDate: verifyDoc.expiryDate },
                status,
                comment,
                user?.name
            )
            message.success(status === 'verified' ? '✅ Verified' : '❌ Queried')
            setVerifyOpen(false)
        } catch (e: any) {
            console.error(e)
            message.error(e?.message || 'Failed to update verification')
        } finally {
            setVerifySubmitting(false)
        }
    }

    const sendBulkReminders = async () => {
        try {
            const payloads = buildReminderPayloads(participants)
            if (!payloads.length) {
                message.info('No reminders to send.')
                return
            }

            const sendReminder = httpsCallable(functions, 'sendComplianceReminderEmail')

            // fire in parallel, but still show progress per recipient
            await Promise.all(
                payloads.map(async p => {
                    await sendReminder({
                        email: p.email,
                        name: p.name,
                        issues: p.issues.map(i => `${i.type}${i.documentName ? ` - ${i.documentName}` : ''} (${i.status})`)
                    })
                })
            )

            message.success(`📧 Sent ${payloads.length} reminder(s)`)
        } catch (e) {
            console.error(e)
            message.error('Failed to send reminders')
        }
    }

    const openEDAgreement = (p: ParticipantComplianceSummary) => {
        setEdParticipant({ id: p.participantId, name: p.beneficiaryName, email: p.email, phone: p.phone })
        setEdOpen(true)
    }

    const docColumns: ColumnsType<any> = [
        {
            title: 'Type',
            dataIndex: 'type',
            render: (v: string) =>
                documentTypes.find(t => t.value === v || t.label === v)?.label || v
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, r: any) => (
                <Tag color={statusColor(r.effectiveStatus)}>
                    {r.effectiveStatus.toUpperCase()}
                </Tag>
            ),
            filters: [
                { text: 'Valid', value: 'valid' },
                { text: 'Expiring', value: 'expiring' },
                { text: 'Expired', value: 'expired' },
                { text: 'Missing', value: 'missing' },
                { text: 'Pending', value: 'pending' },
                { text: 'Invalid', value: 'invalid' }
            ],
            onFilter: (value: any, record: any) => record.effectiveStatus === value
        },
        {
            title: 'Verification',
            key: 'verification',
            render: (_: any, r: any) => (
                <Tag color={verificationColor(r.verificationStatusRaw)}>
                    {r.verificationStatusRaw.toUpperCase()}
                </Tag>
            )
        },
        {
            title: 'Expiry',
            dataIndex: 'expiryDate',
            render: (_: any, r: any) => (r.expiry ? r.expiry.format('DD MMM YYYY') : 'N/A'),
            sorter: (a: any, b: any) => (a.expiry?.valueOf?.() || 0) - (b.expiry?.valueOf?.() || 0)
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, r: any) => (
                <Space>
                    {r.url && (
                        <Tooltip title="View">
                            <Button icon={<EyeOutlined />} onClick={() => window.open(r.url, '_blank')} />
                        </Tooltip>
                    )}

                    <Tooltip title="Edit">
                        <Button onClick={() => openAddDocModal(activeParticipant!, r)}>Edit</Button>
                    </Tooltip>

                    {r.url && r.verificationStatusRaw === 'unverified' && (
                        <Tooltip title="Verify / Query">
                            <Button icon={<FileProtectOutlined />} onClick={() => openVerify(r)} />
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ]

    return (
        <div style={{ minHeight: '100vh', padding: 16 }}>
            <Helmet>
                <title>Compliance | Smart Incubation</title>
            </Helmet>

            {error && (
                <Alert
                    message="Failed to load compliance data"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Metric cards (importable globalStats) */}
            <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                {[
                    {
                        title: 'Participants',
                        value: globalStats.totalParticipants,
                        icon: <SafetyCertificateOutlined />,
                        color: '#1890ff',
                        bg: '#e6f7ff'
                    },
                    {
                        title: 'Documents',
                        value: globalStats.totalDocuments,
                        icon: <SafetyCertificateOutlined />,
                        color: '#2f54eb',
                        bg: '#f0f5ff'
                    },
                    {
                        title: 'Action Needed',
                        value: globalStats.participantsActionNeeded,
                        icon: <WarningOutlined />,
                        color: '#faad14',
                        bg: '#fffbe6'
                    },
                    {
                        title: 'Avg Score',
                        value: `${globalStats.avgComplianceScore}%`,
                        icon: <CheckCircleOutlined />,
                        color: '#52c41a',
                        bg: '#f6ffed'
                    },
                    {
                        title: 'Expired',
                        value: globalStats.statusCounts.expired,
                        icon: <CloseCircleOutlined />,
                        color: '#f5222d',
                        bg: '#fff2f0'
                    },
                    {
                        title: 'Missing',
                        value: globalStats.statusCounts.missing,
                        icon: <WarningOutlined />,
                        color: '#fa541c',
                        bg: '#fff2e8'
                    }
                ].map((m, idx) => (
                    <Col xs={24} sm={12} md={8} lg={4} key={m.title}>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: idx * 0.05 }}>
                            <Card
                                loading={loading || identityLoading}
                                style={{
                                    borderRadius: 10,
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
                                }}
                            >
                                <Space>
                                    <div style={{ width: 34, height: 34, borderRadius: 999, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {React.cloneElement(m.icon as any, { style: { color: m.color } })}
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{m.title}</Text>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
                                    </div>
                                </Space>
                            </Card>
                        </motion.div>
                    </Col>
                ))}
            </Row>

            {/* Filters */}
            <Card style={{ borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.08)', marginBottom: 12 }}>
                <Row gutter={[12, 12]} align="middle" justify="space-between">
                    <Col>
                        <Space wrap>
                            <Input
                                style={{ width: 320 }}
                                prefix={<SearchOutlined />}
                                placeholder="Search participant (name/email/phone)"
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                            />

                            <Select value={filterActionNeeded} onChange={setFilterActionNeeded} style={{ width: 220 }}>
                                <Option value="all">All participants</Option>
                                <Option value="issues">Only action needed</Option>
                                <Option value="clean">Only compliant</Option>
                            </Select>

                            <Button onClick={refetch}>Refresh</Button>
                        </Space>
                    </Col>

                    <Col>
                        <Space wrap>
                            <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddDocModal()}>
                                Add Document
                            </Button>
                            <Button icon={<UserOutlined />} onClick={sendBulkReminders}>
                                Send Email Reminders
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Participant table */}
            <Card style={{ borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}>
                <Table
                    columns={participantColumns}
                    dataSource={filteredRows}
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    rowKey="key"
                />
            </Card>

            {/* Participant drawer */}
            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                width={980}
                title={activeParticipant ? `Compliance • ${activeParticipant.beneficiaryName}` : 'Compliance'}
                extra={
                    activeParticipant ? (
                        <Space>
                            <Button type="primary" onClick={() => openAddDocModal(activeParticipant)}>
                                Upload Doc
                            </Button>
                        </Space>
                    ) : null
                }
            >
                {activeParticipant ? (
                    <>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="Participant">{activeParticipant.beneficiaryName}</Descriptions.Item>
                            <Descriptions.Item label="Compliance Score">{activeParticipant.complianceScore}%</Descriptions.Item>
                            <Descriptions.Item label="Email">{activeParticipant.email || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Phone">{activeParticipant.phone || 'N/A'}</Descriptions.Item>
                        </Descriptions>

                        <Divider />

                        <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                            {(['valid', 'expiring', 'expired', 'missing', 'pending', 'invalid'] as EffectiveDocStatus[]).map(s => (
                                <Col key={s}>
                                    <Tag color={statusColor(s)} style={{ padding: '4px 10px', fontSize: 12 }}>
                                        {s.toUpperCase()}: {activeParticipant.counts[s]}
                                    </Tag>
                                </Col>
                            ))}
                        </Row>

                        <Table
                            columns={docColumns}
                            dataSource={activeParticipant.docs}
                            rowKey={(r: any) => r.id || `${r.type}_${r.documentName}_${r.expiryDate}`}
                            pagination={{ pageSize: 8 }}
                        />
                    </>
                ) : (
                    <Text type="secondary">Select a participant to manage compliance.</Text>
                )}
            </Drawer>

            {/* Add/Edit Document Modal */}
            <Modal
                open={docModalOpen}
                onCancel={() => setDocModalOpen(false)}
                title={editingDoc ? 'Edit Document' : 'Add Document'}
                footer={null}
                width={820}
            >
                <Form form={docForm} layout="vertical" onFinish={saveDoc}>
                    <Form.Item name="participantId" label="Participant" rules={[{ required: true }]}>
                        <Select placeholder="Select participant">
                            {participants.map(p => (
                                <Option key={p.participantId} value={p.participantId}>
                                    {p.beneficiaryName}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="type" label="Document Type" rules={[{ required: true }]}>
                        <Select placeholder="Select type">
                            {documentTypes.map(t => (
                                <Option key={t.value} value={t.value}>{t.label}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="documentName" label="Document Name" rules={[{ required: true }]}>
                        <Input placeholder="Enter document name" />
                    </Form.Item>

                    <Row gutter={12}>
                        <Col span={12}>
                            <Form.Item name="issueDate" label="Issue Date">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>

                        <Col span={12}>
                            <Form.Item name="expiryDate" label="Expiry Date">
                                <DatePicker style={{ width: '100%' }} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="status" label="Stored Status" rules={[{ required: true }]}>
                        <Select placeholder="Select status">
                            {documentStatuses.map(s => (
                                <Option key={s.value} value={s.value}>{s.label}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="notes" label="Notes">
                        <TextArea rows={3} placeholder="Optional notes" />
                    </Form.Item>

                    <Form.Item label="Document File">
                        <Upload {...uploadProps}>
                            <Button icon={<UploadOutlined />}>Choose file</Button>
                        </Upload>
                        {isUploading && (
                            <div style={{ marginTop: 8 }}>
                                <Progress percent={uploadPercent} />
                            </div>
                        )}
                    </Form.Item>

                    <Row justify="end" gutter={8}>
                        <Col>
                            <Button onClick={() => setDocModalOpen(false)}>Cancel</Button>
                        </Col>
                        <Col>
                            <Button type="primary" htmlType="submit" disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Save'}
                            </Button>
                        </Col>
                    </Row>
                </Form>
            </Modal>

            {/* Verify modal */}
            <Modal
                open={verifyOpen}
                onCancel={() => setVerifyOpen(false)}
                title="Verify Document"
                footer={null}
            >
                {verifyDoc && (
                    <>
                        <Alert
                            type={verifyDoc.effectiveStatus === 'invalid' ? 'warning' : 'info'}
                            showIcon
                            message="Verification decision"
                            description="Verify if correct. Query if something is wrong (reason required)."
                            style={{ marginBottom: 12 }}
                        />

                        <Descriptions bordered size="small" column={1} style={{ marginBottom: 12 }}>
                            <Descriptions.Item label="Type">{verifyDoc.type}</Descriptions.Item>
                            <Descriptions.Item label="Document">{verifyDoc.documentName || 'N/A'}</Descriptions.Item>
                            <Descriptions.Item label="Effective Status">
                                <Tag color={statusColor(verifyDoc.effectiveStatus)}>{verifyDoc.effectiveStatus}</Tag>
                            </Descriptions.Item>
                        </Descriptions>

                        <Form
                            layout="vertical"
                            onFinish={(v) => doVerify('queried', v.reason)}
                        >
                            <Form.Item name="reason" label="Reason (required to query)">
                                <TextArea rows={3} placeholder="Why is this document being queried?" />
                            </Form.Item>

                            <Row justify="end" gutter={8}>
                                <Col>
                                    <Button onClick={() => setVerifyOpen(false)} disabled={verifySubmitting}>
                                        Cancel
                                    </Button>
                                </Col>
                                <Col>
                                    <Button
                                        type="default"
                                        htmlType="submit"
                                        disabled={verifySubmitting}
                                        loading={verifySubmitting}
                                    >
                                        Query
                                    </Button>
                                </Col>
                                <Col>
                                    <Button
                                        type="primary"
                                        onClick={() => doVerify('verified')}
                                        disabled={verifySubmitting}
                                        loading={verifySubmitting}
                                    >
                                        Verify
                                    </Button>
                                </Col>
                            </Row>
                        </Form>
                    </>
                )}
            </Modal>

            {/* ED Agreement modal */}
            <EDAgreementModal
                visible={edOpen}
                onCancel={() => setEdOpen(false)}
                participant={edParticipant}
                onSave={() => {
                    message.success('ED agreement generated')
                    setEdOpen(false)
                    refetch()
                }}
            />
        </div>
    )
}

export default OperationsCompliance
