// types.ts
export interface Project {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  fundingAmount?: number;
  incubateeId: string;
  consultantFeedback?: string;
}

export interface Incubatee {
  id: string;
  name: string;
  projects: Project[];
}

export interface Consultant {
  id: string;
  name: string;
  assignedProjects: Project[];
}

export interface Funder {
  id: string;
  name: string;
  approvedProjects: Project[];
  budget: number;
}

// Branch Management Types
export interface Branch {
  id: string;
  name: string;
  code: string;
  companyCode: string;
  location: {
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  status: 'active' | 'inactive' | 'pending';
  capacity?: {
    maxIncubatees: number;
    currentIncubatees: number;
  };
  isActive?: boolean; // For soft delete functionality
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface BranchPermissions {
  canViewAllInquiries: boolean;
  canCreateInquiries: boolean;
  canEditInquiries: boolean;
  canViewAnalytics: boolean;
}

export interface BranchAssignmentHistory {
  branchId: string;
  assignedAt: Date;
  assignedBy: string;
  unassignedAt?: Date;
  reason?: string;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'director' | 'operations' | 'consultant' | 'incubatee' | 'funder' | 'government' | 'projectadmin' | 'receptionist';
  companyCode: string;
  
  // DEPARTMENT SCOPING: ONLY for operations users
  department?: string | null; // Required for 'operations' role, null for all others
  
  // BRANCH SCOPING: ONLY for receptionist and projectadmin (center coordinator)
  assignedBranch?: string | null; // Required for 'receptionist' and 'projectadmin', null for all others
  branchAssignmentHistory?: BranchAssignmentHistory[]; // Only for branch-scoped roles
  branchPermissions?: BranchPermissions; // Only for branch-scoped roles
  
  createdAt: Date;
  firstLoginComplete?: boolean;
}

// Role scoping type guards for compile-time safety
export type BranchScopedRole = 'receptionist' | 'projectadmin';
export type DepartmentScopedRole = 'operations';
export type CompanyScopedRole = 'admin' | 'director';
export type GlobalScopedRole = 'consultant' | 'incubatee' | 'funder' | 'government';

export interface BranchScopedUser extends User {
  role: BranchScopedRole;
  assignedBranch: string; // Required for branch-scoped users
  department: null; // Must be null for branch-scoped users
  branchAssignmentHistory: BranchAssignmentHistory[];
  branchPermissions: BranchPermissions;
}

export interface DepartmentScopedUser extends User {
  role: DepartmentScopedRole;
  department: string; // Required for department-scoped users
  assignedBranch: null; // Must be null for department-scoped users
}

export interface BranchAssignmentAudit {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  branchId?: string;
  branchName?: string;
  previousBranchId?: string;
  action: 'assigned' | 'unassigned' | 'reassigned';
  performedBy: string;
  performedByEmail: string;
  reason?: string;
  companyCode: string;
  timestamp: Date;
  metadata?: {
    source: 'manual' | 'bulk_import' | 'migration' | 'automated';
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  };
  permissions?: BranchPermissions;
}

// Simplified branch form data for creating/editing branches
export interface BranchFormData {
  name: string;
  location: string;
  contactEmail: string;
  contactPhone: string;
  companyCode: string;
}

// Department Management Types
export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  companyCode: string;
  manager: string;
  contactEmail: string;
  isActive?: boolean; // For soft delete functionality
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Simplified department form data for creating/editing departments
export interface DepartmentFormData {
  name: string;
  description: string;
  manager?: string;
  contactEmail: string;
  companyCode: string;
}

// Re-export inquiry types for convenience
export * from './inquiry';

// Re-export MOV types for convenience
export * from './mov';
