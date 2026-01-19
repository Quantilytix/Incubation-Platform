export interface ComplianceDocument {
    id: string
    participantId: string
    participantName: string
    documentType: string
    documentName: string
    type: string
    status: 'valid' | 'expiring' | 'expired' | 'missing' | 'invalid';
    issueDate?: string
    expiryDate?: string
    notes?: string
    url?: string
    uploadedBy?: string
    uploadedAt?: string
    verificationStatus?: 'verified' | 'queried' | 'unverified'
    verificationComment?: string
    lastVerifiedBy?: string
    lastVerifiedAt?: string

  }


export interface Participant {
  id: string;
  name: string;
  registrationNumber?: string;
  address?: string;
  email?: string;
  phone?: string;
  industry?: string;
  joinDate?: string;
  status?: 'active' | 'inactive' | 'suspended';
  beeCertificateLevel?: string;
  blackOwnership?: number;
  companySize?: 'micro' | 'small' | 'medium' | 'large';
}

export const documentTypes = [
  { value: 'B-BBEE Certificate', label: 'B-BBEE Certificate' },
  { value: 'Tax Pin', label: 'Tax Pin Certificate' },
  { value: 'Proof of Address', label: 'Proof Of Address' },
  { value: 'Management Accounts', label: 'Management Accounts' },
  { value: 'Certified ID Copy', label: 'Certified ID Copy' },
  { value: 'Three Months Bank Statements', label: 'Three Months Bank Statements' },
  { value: 'edAgreement', label: 'Enterprise Development Agreement' },
  { value: 'CIPC', label: 'CIPC' },
  { value: 'other', label: 'Other Document' },
];


export const documentStatuses = [
  { value: 'valid', label: 'Valid', color: 'green' },
  { value: 'invalid', label: 'Invalid', color: 'crimson' },
  { value: 'expiring', label: 'Expiring Soon', color: 'orange' },
  { value: 'expired', label: 'Expired', color: 'red' },
  { value: 'missing', label: 'Missing', color: 'volcano' },
  { value: 'pending', label: 'Pending Review', color: 'blue' },
];
