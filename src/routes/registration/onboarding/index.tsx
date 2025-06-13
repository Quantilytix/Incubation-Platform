import React, { useState } from 'react'
import {
  Form,
  Input,
  Select,
  Upload,
  Button,
  DatePicker,
  Space,
  Typography,
  message,
  Card,
  Steps,
  Row,
  Col,
  Checkbox,
  Collapse,
  Spin,
  Divider
} from 'antd'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle
} from 'docx'
import SHA256 from 'crypto-js/sha256'
import { UploadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { auth, db, storage } from '@/firebase'
import {
  collection,
  getDoc,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  addDoc
} from 'firebase/firestore'
import moment from 'moment'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useEffect } from 'react'
import { Helmet } from 'react-helmet'
import { onAuthStateChanged } from 'firebase/auth'
import { useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/firebase' // adjust path as needed

const { Title } = Typography
const { Step } = Steps
const { Option } = Select

const documentTypes = [
  'Certified ID Copy',
  'Proof of Address',
  'B-BBEE Certificate',
  'Tax PIN',
  'CIPC',
  'Management Accounts',
  'Three Months Bank Statements'
]
const documentConfig = [
  { type: 'Certified ID Copy', requiresExpiry: false },
  { type: 'Proof of Address', requiresExpiry: false },
  { type: 'B-BBEE Certificate', requiresExpiry: true },
  { type: 'Tax PIN', requiresExpiry: true },
  { type: 'CIPC', requiresExpiry: true },
  { type: 'Management Accounts', requiresExpiry: true },
  { type: 'Three Months Bank Statements', requiresExpiry: true }
]

const ParticipantRegistrationStepForm = () => {
  const [form] = Form.useForm()
  const [current, setCurrent] = useState(0)
  const [currentUserName, setCurrentUserName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [documentFields, setDocumentFields] = useState(
    documentConfig.map(doc => ({
      ...doc,
      file: null,
      expiryDate: null
    }))
  )
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>(
    []
  )
  const [interventionGroups, setInterventionGroups] = useState<any[]>([])
  const [interventionSelections, setInterventionSelections] = useState<
    Record<string, string[]>
  >({})
  const [participantData, setParticipantData] = useState<any>({})
  const [searchParams] = useSearchParams()
  const companyCode = searchParams.get('code')
  const programId = searchParams.get('id')
  const programName = searchParams.get('program')
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [complianceScore, setComplianceScore] = useState(0)
  const [programQuestions, setProgramQuestions] = useState<any[]>([])

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!programId) return
      const programRef = doc(db, 'programs', programId)
      const snap = await getDoc(programRef)
      if (snap.exists()) {
        setProgramQuestions(snap.data().onboardingQuestions || [])
      }
    }
    fetchQuestions()
  }, [programId])

  const renderQuestionField = (q: any) => {
    // Normalize options to always be an array
    let options: string[] = []
    if (Array.isArray(q.options)) {
      options = q.options
    } else if (typeof q.options === 'string') {
      options = q.options
        .split(',')
        .map(opt => opt.trim())
        .filter(Boolean)
    }

    switch (q.type) {
      case 'text':
        return (
          <Form.Item
            key={q.id}
            name={['profile', q.id]}
            label={q.label}
            rules={[{ required: true, message: `Please provide ${q.label}` }]}
          >
            <Input />
          </Form.Item>
        )
      case 'dropdown':
        return (
          <Form.Item
            key={q.id}
            name={['profile', q.id]}
            label={q.label}
            rules={[{ required: true, message: `Please select ${q.label}` }]}
          >
            <Select>
              {options.map(opt => (
                <Select.Option key={opt} value={opt}>
                  {opt}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        )
      // add other types as needed
      default:
        return null
    }
  }

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser

      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const userData = userSnap.data()
          form.setFieldsValue({
            companyCode,
            participantName: userData.name,
            email: userData.email
          })
          setCurrentUserName(userData.name)

          // 🔽 Fetch intervention groups for that company
          const interventionsSnapshot = await getDocs(
            query(collection(db, 'interventions'))
          )
          console.log(companyCode)
          console.log(interventionGroups)

          const rawInterventions = interventionsSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().interventionTitle,
            area: doc.data().areaOfSupport
          }))

          // Group interventions by area
          const areaMap: Record<string, { id: string; title: string }[]> = {}

          rawInterventions.forEach(intervention => {
            if (!areaMap[intervention.area]) {
              areaMap[intervention.area] = []
            }
            areaMap[intervention.area].push({
              id: intervention.id,
              title: intervention.title
            })
          })

          // Format as grouped list
          const fetchedGroups = Object.entries(areaMap).map(
            ([area, interventions]) => ({
              area,
              interventions
            })
          )

          setInterventionGroups(fetchedGroups)
        }
      }
    }

    fetchUserData()
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (user) {
        // Now it's safe to make uploads
        console.log('Authenticated user:', user.email)
      } else {
        console.warn('No authenticated user')
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const fetchParticipant = async () => {
      const user = auth.currentUser
      if (!user) {
        message.error('Not authenticated. Please log in again.')
        return
      }

      const q = query(
        collection(db, 'participants'),
        where('email', '==', user.email)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        const data = snap.docs[0].data()
        const id = snap.docs[0].id
        setParticipantData(data)
        setParticipantId(id)

        form.setFieldsValue({
          participantName: data.ownerName,
          email: data.email,
          ...data // optional if you're displaying anything else
        })

        // 🔁 Derive & inject age and stage
        if (data.idNumber) {
          const age = getAgeFromID(data.idNumber)
          const stage = deriveStageFromRevenue(data)
          form.setFieldsValue({ age, stage })
        }
      }
    }

    fetchParticipant()
  }, [])

  useEffect(() => {
    const uploadedLikeDocs = documentFields.map(doc => ({
      ...doc,
      status: doc.file ? 'valid' : 'missing',
      expiryDate: doc.expiryDate?.format?.('YYYY-MM-DD') || null
    }))
    setComplianceScore(calculateCompliance(uploadedLikeDocs))
  }, [documentFields])

  const sendApplicationEmail = async (email: string, name: string) => {
    try {
      const sendEmail = httpsCallable(functions, 'sendApplicationReceivedEmail')
      await sendEmail({ email, name })
      console.log('📧 Application email sent successfully')
    } catch (err) {
      console.error('❌ Failed to send application email', err)
    }
  }

  const idNumber = Form.useWatch('idNumber', form)

  const generateGrowthPlanDocBlob = async (data: any) => {
    const safeText = (text: any) =>
      new Paragraph({ children: [new TextRun(text ?? 'N/A')] })

    const createCell = (
      text: string | number | null | undefined,
      isHeader = false
    ) =>
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: (text ?? 'N/A').toString(), bold: isHeader })
            ]
          })
        ],
        shading: isHeader ? { fill: 'D9D9D9' } : undefined,
        width: { size: 25, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }
        }
      })

    const annualTable = new Table({
      rows: [
        new TableRow({
          children: ['Year', 'Perm Emp', 'Temp Emp', 'Revenue'].map(h =>
            createCell(h, true)
          )
        }),
        ...[2023, 2024].map(
          year =>
            new TableRow({
              children: [
                year,
                data[`empPerm${year}`],
                data[`empTemp${year}`],
                `R${data[`revenue${year}`] ?? 0}`
              ].map(val => createCell(val))
            })
        )
      ],
      width: { size: 100, type: WidthType.PERCENTAGE }
    })

    const monthlyTable = new Table({
      rows: [
        new TableRow({
          children: ['Month', 'Perm Emp', 'Temp Emp', 'Revenue'].map(h =>
            createCell(h, true)
          )
        }),
        ...getLast3Months().map(
          month =>
            new TableRow({
              children: [
                month,
                data[`empPerm${month}`],
                data[`empTemp${month}`],
                `R${data[`revenue${month}`] ?? 0}`
              ].map(val => createCell(val))
            })
        )
      ],
      width: { size: 100, type: WidthType.PERCENTAGE }
    })

    const digitalSignature = SHA256(
      `${data.email}|${data.participantName}|${data.dateOfRegistration}`
    )
      .toString()
      .substring(0, 16)

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: `${
                data.beneficiaryName || 'Participant'
              } Diagnostic Assessment`,
              heading: HeadingLevel.TITLE,
              spacing: { after: 300 }
            }),

            new Paragraph({
              text: '1. Business Overview',
              heading: HeadingLevel.HEADING_1
            }),
            ...[
              `Business Name: ${data.beneficiaryName}`,
              `Business Owner: ${data.participantName}`,
              `Sector: ${data.sector}`,
              `Nature of Business: ${data.natureOfBusiness}`,
              `Stage: ${data.stage}`,
              `Province: ${data.province}`,
              `City: ${data.city}`,
              `Location Type: ${data.location}`,
              `Date of Registration: ${data.dateOfRegistration}`,
              `Registration Number: ${data.registrationNumber}`,
              `Years of Trading: ${data.yearsOfTrading}`
            ].map(line => safeText(line)),

            new Paragraph({
              text: '2. Business Summary',
              heading: HeadingLevel.HEADING_1
            }),
            safeText(data.motivation),

            new Paragraph({
              text: 'Challenges',
              heading: HeadingLevel.HEADING_2
            }),
            safeText(data.challenges),

            new Paragraph({
              text: '3. Staffing and Revenue History',
              heading: HeadingLevel.HEADING_1
            }),
            new Paragraph({
              text: 'Annual Overview',
              heading: HeadingLevel.HEADING_2
            }),
            annualTable,
            new Paragraph({
              text: 'Monthly Snapshot',
              heading: HeadingLevel.HEADING_2
            }),
            monthlyTable,

            new Paragraph({
              text: '4. Compliance Summary',
              heading: HeadingLevel.HEADING_1
            }),
            safeText(`Compliance Score: ${data.complianceScore ?? 0}%`),

            new Paragraph({
              text: '5. Selected Interventions',
              heading: HeadingLevel.HEADING_1
            }),
            ...(data.interventions?.required?.length
              ? data.interventions.required.map(i =>
                  safeText(`- ${i.title} (${i.area})`)
                )
              : [safeText('No interventions selected.')]),

            new Paragraph({
              text: 'AI-Recommended Interventions',
              heading: HeadingLevel.HEADING_2
            }),
            safeText(
              data.aiEvaluation?.['Recommended Interventions'] ||
                'No recommendation available'
            ),
            safeText(`AI Score: ${data.aiEvaluation?.['AI Score'] || 'N/A'}`),
            safeText(
              `Recommendation: ${
                data.aiEvaluation?.['AI Recommendation'] || 'N/A'
              }`
            ),
            safeText(
              `Justification: ${data.aiEvaluation?.['Justification'] || 'N/A'}`
            ),

            new Paragraph({
              text: '6. Online Presence',
              heading: HeadingLevel.HEADING_1
            }),
            safeText(`Facebook: ${data.facebook}`),
            safeText(`Instagram: ${data.instagram}`),
            safeText(`LinkedIn: ${data.linkedIn}`),

            new Paragraph({
              text: '7. Prepared Date',
              heading: HeadingLevel.HEADING_1
            }),
            safeText(`Submitted on: ${new Date().toLocaleDateString()}`),

            new Paragraph({
              text: '8. Digital Acknowledgment',
              heading: HeadingLevel.HEADING_1
            }),
            safeText(
              'This document was system-generated based on participant-submitted data.'
            ),
            safeText(`Digital Signature: ${digitalSignature}`)
          ]
        }
      ]
    })
    return await Packer.toBlob(doc)
  }

  const uploadGrowthPlanDoc = async (blob: Blob, participantName: string) => {
    const fileName = `${Date.now()}_${participantName}_growth_plan.docx`
    const fileRef = ref(storage, `growth_plans/${fileName}`)

    await uploadBytes(fileRef, blob)
    const url = await getDownloadURL(fileRef)

    return url
  }

  const evaluateWithAI = async (participantData: any) => {
    try {
      const {
        participantName,
        beneficiaryName,
        sector,
        city,
        province,
        yearsOfTrading,
        motivation,
        natureOfBusiness,
        challenges,
        stage,
        ageGroup,
        developmentType,
        facebook,
        instagram,
        linkedIn,
        complianceDocuments = []
      } = participantData

      const structuredInfo = {
        name: participantName,
        business_name: beneficiaryName,
        sector,
        location: `${city}, ${province}`,
        years_operating: yearsOfTrading,
        description: motivation,
        business_model: natureOfBusiness, // ✅ added field
        challenges,
        stage,
        ageGroup,
        developmentType,
        onlinePresence: {
          facebook,
          instagram,
          linkedIn
        },
        complianceSummary: complianceDocuments.map(doc => ({
          type: doc.type,
          status: doc.status,
          expiryDate: doc.expiryDate || 'N/A',
          hasUrl: !!doc.url
        }))
      }

      const response = await fetch(
        'https://rairo-incu-api.hf.space/api/evaluate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            participantId: `applicant-${Date.now()}`,
            participantInfo: structuredInfo
          })
        }
      )

      if (!response.ok) throw new Error('AI API call failed.')

      const data = await response.json()
      const evaluation = data.raw_response ?? data.evaluation
      return evaluation || null
    } catch (err) {
      console.error('❌ AI evaluation failed:', err)
      return null
    }
  }

  const navigate = useNavigate()

  const getAgeGroup = (age: number): 'Youth' | 'Adult' | 'Senior' => {
    if (age <= 35) return 'Youth'
    if (age <= 59) return 'Adult'
    return 'Senior'
  }

  const getAgeFromID = (id: string): number => {
    const birthYear = parseInt(id.substring(0, 2), 10)
    const birthMonth = parseInt(id.substring(2, 4), 10) - 1
    const birthDay = parseInt(id.substring(4, 6), 10)

    const currentYear = new Date().getFullYear()
    const century = birthYear <= currentYear % 100 ? 2000 : 1900
    const birthDate = new Date(century + birthYear, birthMonth, birthDay)

    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  const getYearFields = () => {
    const currentYear = moment().year()
    return [currentYear - 1, currentYear - 2] // e.g., [2023, 2024]
  }

  const getLast3Months = () => {
    const result = []
    for (let i = 1; i <= 3; i++) {
      result.push(moment().subtract(i, 'months').format('MMMM')) // e.g. ["April", "March", "February"]
    }
    return result.reverse()
  }

  const formatReviewData = (values: any) => {
    return (
      <div>
        <p>
          <strong>Beneficiary Name:</strong> {values.beneficiaryName}
        </p>
        <p>
          <strong>Owner Name:</strong> {values.participantName}
        </p>
        <p>
          <strong>Email:</strong> {values.email}
        </p>
        <p>
          <strong>ID Number:</strong> {values.idNumber}
        </p>
        <p>
          <strong>Sector:</strong> {values.sector}
        </p>
        <p>
          <strong>Nature of Business:</strong> {values.natureOfBusiness}
        </p>
        <p>
          <strong>Stage:</strong> {values.stage}
        </p>
        <p>
          <strong>Gender:</strong> {values.gender}
        </p>
        <p>
          <strong>Age:</strong> {values.age}
        </p>
        <strong>Date of Registration:</strong>{' '}
        {values.dateOfRegistration
          ? dayjs(
              values.dateOfRegistration?.toDate?.() || values.dateOfRegistration
            ).format('YYYY-MM-DD')
          : 'N/A'}
        <p>
          <strong>Registration Number:</strong> {values.registrationNumber}
        </p>
        <p>
          <strong>Years of Trading:</strong> {values.yearsOfTrading}
        </p>
        <p>
          <strong>Business Address:</strong> {values.businessAddress}
        </p>
        <p>
          <strong>Province:</strong> {values.province}
        </p>
        <p>
          <strong>City:</strong> {values.city}
        </p>
        <p>
          <strong>Host Community:</strong> {values.hub}
        </p>
        <p>
          <strong>Postal Code:</strong> {values.postalCode}
        </p>
        <p>
          <strong>Location:</strong> {values.location}
        </p>
        <p>
          <strong>Motivation:</strong> {values.motivation}
        </p>
        <p>
          <strong>Challenges:</strong>
        </p>
        <ul>
          {values.challenges?.split('\n').map((line: string, i: number) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
        <p>
          <strong>Facebook:</strong> {values.facebook}
        </p>
        <p>
          <strong>Instagram:</strong> {values.instagram}
        </p>
        <p>
          <strong>LinkedIn:</strong> {values.linkedIn}
        </p>
      </div>
    )
  }

  const handleDateChange = (
    date: moment.Moment | null,
    field: 'expiryDate',
    index: number
  ): void => {
    const updated = [...documentFields]
    updated[index][field] = date
    setDocumentFields(updated)
  }

  const getExpiredDocuments = () => {
    const today = new Date()
    const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)

    return documentFields.filter(doc => {
      if (!doc.requiresExpiry || !doc.file) return false // ✅ skip if missing file
      if (!doc.expiryDate) return true
      return doc.expiryDate.toDate() <= oneWeekFromNow
    })
  }

  const getMissingDocuments = () => documentFields.filter(doc => !doc.file)

  const next = async () => {
    setCurrent(current + 1)
  }

  const prev = () => setCurrent(current - 1)

  const handleFileUpload = (file: any, index: number) => {
    const updated = [...documentFields]
    updated[index].file = file
    setDocumentFields(updated)
    return false // prevent auto-upload
  }
  const uploadFileAndGetURL = async (
    file: File,
    folder = 'participant_documents'
  ) => {
    try {
      // Use a unique filename to avoid collisions
      const fileName = `${Date.now()}_${file.name}`
      const fileRef = ref(storage, `${folder}/${fileName}`)

      // Upload the file
      await uploadBytes(fileRef, file)

      // Get the public download URL
      const url = await getDownloadURL(fileRef)

      return { url, name: fileName }
    } catch (error) {
      console.error('Upload failed:', error)
      throw error
    }
  }
  const uploadAllDocuments = async () => {
    const uploadedDocs = []

    for (const doc of documentFields) {
      if (!doc.file) {
        uploadedDocs.push({
          type: doc.type,
          url: null,
          fileName: null,
          expiryDate: null,
          status: 'missing'
        })
        continue
      }

      try {
        const { url, name } = await uploadFileAndGetURL(doc.file)

        uploadedDocs.push({
          type: doc.type,
          url,
          fileName: name,
          expiryDate: doc.requiresExpiry
            ? doc.expiryDate?.format('YYYY-MM-DD') || null
            : null,
          status: 'valid'
        })
      } catch (err) {
        message.error(`Failed to upload ${doc.type}`)
      }
    }

    return uploadedDocs
  }

  const calculateCompliance = (docs: any[] = []) => {
    const totalRequired = docs.length
    const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const validDocs = docs.filter(doc => {
      if (doc.status !== 'valid') return false
      if (doc.expiryDate && new Date(doc.expiryDate) <= oneWeekFromNow)
        return false
      return true
    })

    return totalRequired === 0
      ? 0
      : Math.round((validDocs.length / totalRequired) * 100)
  }

  const deriveStageFromRevenue = (values: any): string => {
    const years = getYearFields()
    const revenues = years.map(y => Number(values[`revenue${y}`] || 0))
    const avgRevenue = revenues.reduce((a, b) => a + b, 0) / revenues.length

    if (avgRevenue < 100000) return 'Ideation'
    if (avgRevenue < 500000) return 'Startup'
    if (avgRevenue < 1000000) return 'Early Stage'
    if (avgRevenue < 5000000) return 'Growth'
    return 'Maturity'
  }

  const removeUndefinedDeep = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(removeUndefinedDeep)
    } else if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, removeUndefinedDeep(value)])
      )
    }
    return obj
  }

  const handleSubmit = async () => {
    setUploading(true)
    await form.validateFields()
    const values = form.getFieldsValue(true) // true = get all values, even unmounted
    const uploadedDocs = await uploadAllDocuments()
    const profileAnswers = values.profile // { [questionId]: answer }

    setComplianceScore(calculateCompliance(uploadedDocs))

    if (complianceScore < 10) {
      message.error(
        'Compliance must be 10% or higher to approve this application.'
      )
      return
    }

    const derivedAge = getAgeFromID(values.idNumber)

    try {
      const uploadedDocs = await uploadAllDocuments()

      const participant = {
        ...values,
        dateOfRegistration: values.dateOfRegistration
          ? dayjs(
              values.dateOfRegistration.toDate?.() || values.dateOfRegistration
            )
          : null,
        rating: 0,
        developmentType: '',
        ageGroup: getAgeGroup(derivedAge),
        applicationStatus: 'pending',
        complianceScore,
        complianceDocuments: uploadedDocs,
        interventions: {
          required: Object.values(interventionSelections)
            .flat()
            .map(id => {
              const match = interventionGroups
                .flatMap(group => group.interventions)
                .find(i => i.id === id)
              return {
                id: match?.id,
                title: match?.title,
                area: interventionGroups.find(g =>
                  g.interventions.some(i => i.id === id)
                )?.area
              }
            }),
          assigned: [],
          completed: [],
          participationRate: 0
        },
        stage: deriveStageFromRevenue(values)
      }

      const aiEvaluation = await evaluateWithAI(participant)
      participant.aiEvaluation = aiEvaluation

      const complianceIssues = [
        ...getMissingDocuments().map(doc => `${doc.type} (missing)`),
        ...getExpiredDocuments().map(
          doc => `${doc.type} (expired or near expiry)`
        )
      ]

      if (complianceIssues.length > 0) {
        participant.interventions.required.push({
          id: 'compliance-issues',
          title: `Compliance Support Required: ${complianceIssues.join(', ')}`,
          area: 'Compliance'
        })
      }

      const docBlob = await generateGrowthPlanDocBlob(participant)
      const growthPlanUrl = await uploadGrowthPlanDoc(
        docBlob,
        participant.beneficiaryName
      )
      participant.growthPlanDocUrl = growthPlanUrl

      const removeUndefinedDeep = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(removeUndefinedDeep)
        } else if (typeof obj === 'object' && obj !== null) {
          return Object.fromEntries(
            Object.entries(obj)
              .filter(([, value]) => value !== undefined)
              .map(([key, value]) => [key, removeUndefinedDeep(value)])
          )
        }
        return obj
      }

      await addDoc(
  collection(db, 'applications'),
  removeUndefinedDeep({
    participantId,
    programName: programName,
    programId: programId,
    companyCode: companyCode,
    applicationStatus: 'pending',
    submittedAt: new Date().toISOString(),
    beneficiaryName: values.beneficiaryName,
    gender: values.gender,
    ageGroup: getAgeGroup(derivedAge),
    stage: participant.stage,
    province: values.province,
    hub: values.hub,
    email: values.email,
    motivation: values.motivation,
    challenges: values.challenges,
    facebook: values.facebook,
    instagram: values.instagram,
    linkedIn: values.linkedIn,
    complianceScore,
    complianceDocuments: uploadedDocs,
    interventions: participant.interventions,
    aiEvaluation,
    growthPlanDocUrl: participant.growthPlanDocUrl,
    profile: values.profile 
  })
)


      await sendApplicationEmail(values.email, values.participantName)

      message.success('Participant successfully applied!')

      // ✅ Update user role
      const userEmail = auth.currentUser?.email
      if (userEmail) {
        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('email', '==', userEmail))
        const snapshot = await getDocs(q)

        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0]
          await updateDoc(doc(db, 'users', userDoc.id), {
            role: 'Incubatee'
          })
        }
      }

      // ✅ Redirect to login
      navigate('/incubatee/tracker')

      // Optional: Reset form state
      setCurrent(0)
      form.resetFields()
      setDocumentFields(
        documentTypes.map(type => ({
          type,
          file: null,
          expiryDate: null
        }))
      )
      setSelectedInterventions([])
    } catch (err) {
      console.error(err)
      message.error('Failed to register participant.')
    } finally {
      setUploading(false)
    }
  }

  const steps = [
    {
      title: 'Motivation',
      content: (
        <Card style={{ backgroundColor: '#fff7e6' }}>
          <Form.Item name='stage' hidden>
            <Input />
          </Form.Item>
          <Form.Item name='age' hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name='motivation'
            label='Motivation (min 100 words)'
            rules={[{ required: true }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name='challenges' label='Challenges'>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name='facebook' label='Facebook'>
                <Select placeholder='Do you have a Facebook account?'>
                  <Select.Option value='Yes'>Yes</Select.Option>
                  <Select.Option value='No'>No</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item name='instagram' label='Instagram'>
                <Select placeholder='Do you have an Instagram account?'>
                  <Select.Option value='Yes'>Yes</Select.Option>
                  <Select.Option value='No'>No</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item name='linkedIn' label='LinkedIn'>
                <Select placeholder='Do you have a LinkedIn account?'>
                  <Select.Option value='Yes'>Yes</Select.Option>
                  <Select.Option value='No'>No</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Card>
      )
    },
    {
      title: 'Program Profile',
      content: (
        <Card>
          <Title level={5}>Answer All To Proceed</Title>
          {programQuestions.length === 0 && <Spin />}
          {programQuestions.length > 0 && (
            <>{programQuestions.map(q => renderQuestionField(q))}</>
          )}
        </Card>
      )
    },
    {
      title: 'Documents',
      content: (
        <Space direction='vertical' style={{ width: '100%' }}>
          <Title>Upload Your Documents</Title>
          {documentFields.map((doc, index) => (
            <Row gutter={16} key={index} align='middle'>
              <Col span={4}>
                <strong>{doc.type}</strong>
              </Col>
              <Col span={5}>
                <Upload
                  beforeUpload={file => handleFileUpload(file, index)}
                  fileList={
                    doc.file
                      ? [{ uid: '-1', name: doc.file.name, status: 'done' }]
                      : []
                  }
                  onRemove={() => {
                    const updated = [...documentFields]
                    updated[index].file = null
                    setDocumentFields(updated)
                  }}
                >
                  <Button icon={<UploadOutlined />}>Upload</Button>
                </Upload>
              </Col>
              {doc.requiresExpiry && (
                <Col span={7}>
                  <DatePicker
                    placeholder='Expiry Date'
                    style={{ width: '100%' }}
                    value={doc.expiryDate}
                    onChange={date =>
                      handleDateChange(date, 'expiryDate', index)
                    }
                  />
                </Col>
              )}
            </Row>
          ))}
        </Space>
      )
    },
    {
      title: 'Interventions',
      content: (
        <>
          <Title>Pick Your Required Interventions</Title>
          <Collapse>
            {interventionGroups.map(group => (
              <Collapse.Panel header={group.area} key={group.area}>
                <Checkbox.Group
                  value={interventionSelections[group.area] || []}
                  onChange={val => {
                    const currentSelection = val as string[]

                    const totalSelected = Object.entries(
                      interventionSelections
                    ).reduce((acc, [area, selections]) => {
                      if (area === group.area) return acc // skip current group for now
                      return acc + selections.length
                    }, currentSelection.length)

                    if (totalSelected > 8) {
                      message.warning(
                        'You can select up to 8 interventions only.'
                      )
                      return
                    }

                    setInterventionSelections(prev => ({
                      ...prev,
                      [group.area]: currentSelection
                    }))
                  }}
                >
                  <Space direction='vertical'>
                    {group.interventions.map(i => (
                      <Checkbox key={i.id} value={i.id}>
                        {i.title}
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              </Collapse.Panel>
            ))}
          </Collapse>
        </>
      )
    },
    {
      title: 'Review',
      content: (
        <>
          <Title level={4}>Review Your Details</Title>
          {formatReviewData(form.getFieldsValue(true))}
          {programQuestions.map(q => (
            <div key={q.id}>
              <strong>{q.label}:</strong>{' '}
              {form.getFieldValue(['profile', q.id]) || '-'}
            </div>
          ))}

          <p>
            Compliance Score: <strong>{complianceScore}%</strong>
          </p>

          {getExpiredDocuments().length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text type='danger'>
                ⚠️ Expired or expiring documents:
              </Typography.Text>
              <ul>
                {getExpiredDocuments().map((doc, index) => (
                  <li key={index}>
                    {doc.type} —{' '}
                    <strong>
                      {doc.expiryDate?.format?.('YYYY-MM-DD') || 'Invalid Date'}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {getMissingDocuments().length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Typography.Text type='warning'>
                ⚠️ Missing Documents:
              </Typography.Text>
              <ul>
                {getMissingDocuments().map((doc, index) => (
                  <li key={index}>{doc.type}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )
    }
  ]

  return (
    <>
      <Helmet>
        <title>Participant Registration | Smart Incubation Platform</title>
        <meta
          name='description'
          content='Register as a participant to access tailored business development support through the Smart Incubation Platform.'
        />
      </Helmet>

      <Spin spinning={uploading} tip='Submitting...'>
        <Card style={{ padding: 24 }}>
          <Title level={3}>Program Stepwise Application</Title>
          <Steps current={current} style={{ marginBottom: 24 }}>
            {steps.map(s => (
              <Step key={s.title} title={s.title} />
            ))}
          </Steps>
          <Form layout='vertical' form={form}>
            {steps[current].content}
            <Form.Item>
              <Space style={{ marginTop: 24 }}>
                {current > 0 && <Button onClick={prev}>Back</Button>}
                {current < steps.length - 1 && (
                  <Button type='primary' onClick={next}>
                    Next
                  </Button>
                )}
                {current === steps.length - 1 && (
                  <>
                    {' '}
                    <Button
                      type='primary'
                      onClick={handleSubmit}
                      loading={uploading}
                    >
                      Submit
                    </Button>
                  </>
                )}
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </Spin>
    </>
  )
}

export default ParticipantRegistrationStepForm
