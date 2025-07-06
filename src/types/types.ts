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
