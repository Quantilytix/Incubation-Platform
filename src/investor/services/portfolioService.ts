import { collection, getDocs } from 'firebase/firestore';
import { db } from "@/firebase";

// Interface for portfolio investments
export interface PortfolioInvestment {
  id: string;
  companyName: string;
  companyLogo?: string;
  industry: string;
  investedAmount: number;
  equityPercentage: number;
  currentValuation: number;
  investmentDate: string;
  performanceMetric: number;
  status: string;
  roi: number;
}

// Sample portfolio data - in a real app, this would come from Firebase
const PORTFOLIO_DATA: PortfolioInvestment[] = [
  {
    id: 'p1',
    companyName: 'AgriTech Pioneers',
    companyLogo: 'https://placehold.co/300x200/16a34a/ffffff?text=AgriTech&font=open-sans',
    industry: 'Agriculture',
    investedAmount: 100000,
    equityPercentage: 5,
    currentValuation: 130000,
    investmentDate: '2023-01-15',
    performanceMetric: 30,
    status: 'Performing',
    roi: 30
  },
  {
    id: 'p2',
    companyName: 'EdTech Solutions',
    companyLogo: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=600&auto=format&fit=crop&q=60',
    industry: 'Education',
    investedAmount: 75000,
    equityPercentage: 3.5,
    currentValuation: 85000,
    investmentDate: '2023-02-20',
    performanceMetric: 13,
    status: 'Underperforming',
    roi: 13
  },
  {
    id: 'p3',
    companyName: 'FinTech Revolution',
    companyLogo: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&auto=format&fit=crop&q=60',
    industry: 'Finance',
    investedAmount: 150000,
    equityPercentage: 4,
    currentValuation: 210000,
    investmentDate: '2023-04-10',
    performanceMetric: 40,
    status: 'Performing',
    roi: 40
  },
  {
    id: 'p4',
    companyName: 'TechSolutions Inc.',
    companyLogo: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&auto=format&fit=crop&q=60',
    industry: 'Software',
    investedAmount: 200000,
    equityPercentage: 8,
    currentValuation: 240000,
    investmentDate: '2023-03-05',
    performanceMetric: 20,
    status: 'Performing',
    roi: 20
  }
];

// Calculate metrics from portfolio data
export const calculatePortfolioMetrics = (portfolio: PortfolioInvestment[]) => {
  const totalInvested = portfolio.reduce((sum, investment) => sum + investment.investedAmount, 0);
  const totalCurrentValue = portfolio.reduce((sum, investment) => sum + investment.currentValuation, 0);
  const totalROI = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;
  const averageROI = portfolio.length > 0 ? portfolio.reduce((sum, inv) => sum + inv.roi, 0) / portfolio.length : 0;

  return {
    totalInvested,
    totalCurrentValue,
    totalROI,
    averageROI,
    investmentCount: portfolio.length
  };
};

// Fetch portfolio data
export const getPortfolioData = async (): Promise<PortfolioInvestment[]> => {
  try {
    // In a real application, this would fetch from Firebase
    // const portfolioSnapshot = await getDocs(collection(db, "portfolio"));
    // const portfolioData = portfolioSnapshot.docs.map(doc => ({
    //   id: doc.id,
    //   ...doc.data()
    // })) as PortfolioInvestment[];
    
    // For now, return the sample data
    return PORTFOLIO_DATA;
  } catch (error) {
    console.error("Error fetching portfolio data:", error);
    return [];
  }
};

// Add a new investment to portfolio
export const addInvestment = async (investment: Omit<PortfolioInvestment, 'id'>): Promise<boolean> => {
  try {
    // In a real application, this would add to Firebase
    // await addDoc(collection(db, "portfolio"), investment);
    console.log('Investment would be added to portfolio:', investment);
    return true;
  } catch (error) {
    console.error("Error adding investment:", error);
    return false;
  }
}; 