export interface ComplianceDocument {
  id: string;
  participantId: string;
  participantName: string;
  documentType: string;
  documentName: string;
  status: 'valid' | 'expiring' | 'expired' | 'missing' | 'pending';
  issueDate: string;
  expiryDate: string;
  notes?: string;
  fileUrl?: string;
  uploadedBy: string;
  uploadedAt: string;
  lastVerifiedBy?: string;
  lastVerifiedAt?: string;
  metadata?: Record<string, any>;
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
  { value: 'beeCertificate', label: 'BEE Certificate' },
  { value: 'taxClearance', label: 'Tax Clearance Certificate' },
  { value: 'letterOfGoodStanding', label: 'Letter of Good Standing' },
  { value: 'companyRegistration', label: 'Company Registration Document' },
  { value: 'directorIdCopies', label: 'Director ID Copies' },
  { value: 'proofOfBanking', label: 'Proof of Banking' },
  { value: 'industryLicense', label: 'Industry-Specific License' },
  { value: 'uifCompliance', label: 'UIF Compliance Certificate' },
  { value: 'edAgreement', label: 'Enterprise Development Agreement' },
  { value: 'contract', label: 'Contract' },
  { value: 'other', label: 'Other Document' },
];

export const documentStatuses = [
  { value: 'valid', label: 'Valid', color: 'green' },
  { value: 'expiring', label: 'Expiring Soon', color: 'orange' },
  { value: 'expired', label: 'Expired', color: 'red' },
  { value: 'missing', label: 'Missing', color: 'volcano' },
  { value: 'pending', label: 'Pending Review', color: 'blue' },
]; 