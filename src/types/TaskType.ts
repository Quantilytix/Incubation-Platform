export interface TaskType {
    id: string;
    name: string;
    category: 'predefined' | 'custom';
    proofRequired: boolean;
    proofTypes: ProofType[];
    description?: string;
  }

  export interface ProofType {
    id: string;
    name: string;
    description: string;
    required: boolean;
    fileTypes?: string[];
  }

  export interface Task {
    id: string;
    title: string;
    type: TaskType;
    dueDate: Date;
    priority: 'High' | 'Medium' | 'Low';
    assignedRole: string;
    assignedTo: string;
    status: 'To Do' | 'In Progress' | 'Awaiting Proof' | 'Completed';
    department?: string;
    proofSubmissions?: ProofSubmission[];
    createdAt: Date;
    companyCode: string;
  }

  export interface ProofSubmission {
    id: string;
    proofType: ProofType;
    fileUrl?: string;
    description?: string;
    submittedAt: Date;
    submittedBy: string;
    status: 'pending' | 'approved' | 'rejected';
  }

  export const PREDEFINED_TASK_TYPES: TaskType[] = [
    {
      id: 'document-review',
      name: 'Document Review',
      category: 'predefined',
      proofRequired: true,
      proofTypes: [
        {
          id: 'signed-document',
          name: 'Signed Document',
          description: 'Upload the reviewed and signed document',
          required: true,
          fileTypes: ['pdf', 'doc', 'docx']
        }
      ],
      description: 'Review and approve documents'
    },
    {
      id: 'compliance-check',
      name: 'Compliance Check',
      category: 'predefined',
      proofRequired: true,
      proofTypes: [
        {
          id: 'compliance-report',
          name: 'Compliance Report',
          description: 'Upload compliance verification report',
          required: true,
          fileTypes: ['pdf', 'xlsx']
        },
        {
          id: 'checklist',
          name: 'Completed Checklist',
          description: 'Upload completed compliance checklist',
          required: true,
          fileTypes: ['pdf', 'xlsx']
        }
      ],
      description: 'Verify compliance requirements'
    },
    {
      id: 'participant-outreach',
      name: 'Participant Outreach',
      category: 'predefined',
      proofRequired: true,
      proofTypes: [
        {
          id: 'communication-log',
          name: 'Communication Log',
          description: 'Upload communication records or screenshots',
          required: true,
          fileTypes: ['pdf', 'png', 'jpg', 'xlsx']
        }
      ],
      description: 'Contact and follow up with participants'
    },
    {
      id: 'training-delivery',
      name: 'Training Delivery',
      category: 'predefined',
      proofRequired: true,
      proofTypes: [
        {
          id: 'attendance-sheet',
          name: 'Attendance Sheet',
          description: 'Upload signed attendance sheet',
          required: true,
          fileTypes: ['pdf', 'xlsx']
        },
        {
          id: 'training-materials',
          name: 'Training Materials',
          description: 'Upload training materials used',
          required: false,
          fileTypes: ['pdf', 'ppt', 'pptx']
        }
      ],
      description: 'Conduct training sessions'
    },
    {
      id: 'site-visit',
      name: 'Site Visit',
      category: 'predefined',
      proofRequired: true,
      proofTypes: [
        {
          id: 'visit-report',
          name: 'Visit Report',
          description: 'Upload site visit report with findings',
          required: true,
          fileTypes: ['pdf', 'doc', 'docx']
        },
        {
          id: 'photos',
          name: 'Site Photos',
          description: 'Upload photos from the site visit',
          required: true,
          fileTypes: ['jpg', 'png', 'jpeg']
        }
      ],
      description: 'Conduct on-site visits and assessments'
    }
  ];
