import React, { useState, useEffect } from 'react';
import { Typography, Card, Spin, Row, Col, Select, Tag, Alert } from 'antd';
import FunderCalendar, { CalendarEvent, EventType } from '@/components/calendar';

const { Title } = Typography;
const { Option } = Select;

// Sample data - in a real application, this would come from an API or database
const sampleEvents: CalendarEvent[] = [
  {
    id: '1',
    title: 'Series A Funding Round',
    date: '2023-11-15',
    time: '9:00 AM',
    description: 'Final presentation and closing of Series A funding round for EcoSolutions.',
    type: EventType.FundingRound
  },
  {
    id: '2',
    title: 'Q3 Financial Report',
    date: '2023-11-10',
    time: '2:00 PM',
    description: 'Quarterly financial report for all portfolio companies.',
    type: EventType.FinancialReport
  },
  {
    id: '3',
    title: 'Meeting with TechStart Founders',
    date: '2023-11-05',
    time: '11:00 AM',
    description: 'Discussion about product roadmap and future growth plans.',
    type: EventType.FounderMeeting
  },
  {
    id: '4',
    title: 'Due Diligence Completion',
    date: '2023-11-20',
    time: '4:00 PM',
    description: 'Completion of due diligence process for AgriTech startup.',
    type: EventType.Other
  },
  {
    id: '5',
    title: 'Annual Financial Review',
    date: '2023-12-15',
    time: '10:00 AM',
    description: 'End of year financial performance review for all investments.',
    type: EventType.FinancialReport
  },
  {
    id: '6',
    title: 'Seed Round - HealthTech',
    date: '2023-12-05',
    time: '3:00 PM',
    description: 'Initial seed funding round for promising HealthTech startup.',
    type: EventType.FundingRound
  },
  // Additional events
  {
    id: '7',
    title: 'Pre-Seed Round - EdTech',
    date: '2023-11-25',
    time: '11:30 AM',
    description: 'Early stage investment opportunity in educational technology startup focusing on rural access.',
    type: EventType.FundingRound
  },
  {
    id: '8',
    title: 'Monthly KPI Review',
    date: '2023-11-30',
    time: '2:30 PM',
    description: 'Monthly review of key performance indicators across portfolio companies.',
    type: EventType.FinancialReport
  },
  {
    id: '9',
    title: 'Series B Planning',
    date: '2023-12-10',
    time: '10:00 AM',
    description: 'Strategic planning meeting for upcoming Series B funding round for TechInnovate.',
    type: EventType.FundingRound
  },
  {
    id: '10',
    title: 'Financial Compliance Workshop',
    date: '2023-12-12',
    time: '9:00 AM',
    description: 'Workshop on South African financial regulations and compliance for startups.',
    type: EventType.FinancialReport
  },
  {
    id: '11',
    title: 'Founder Pitch Day',
    date: '2023-12-18',
    time: '1:00 PM',
    description: 'Five startup founders presenting their companies for potential investment.',
    type: EventType.FounderMeeting
  },
  {
    id: '12',
    title: 'Quarterly Strategy Meeting',
    date: '2024-01-05',
    time: '10:00 AM',
    description: 'First quarter strategy alignment meeting with portfolio company executives.',
    type: EventType.FounderMeeting
  },
  {
    id: '13',
    title: 'Angel Investment Round',
    date: '2024-01-15',
    time: '3:30 PM',
    description: 'Angel investment opportunity in FinTech startup focusing on microfinance solutions.',
    type: EventType.FundingRound
  },
  {
    id: '14',
    title: 'Q4 Financial Reports',
    date: '2024-01-25',
    time: '11:00 AM',
    description: 'Review of Q4 financial performance across all portfolio investments.',
    type: EventType.FinancialReport
  },
  {
    id: '15',
    title: 'Founder Mentorship Session',
    date: '2024-01-30',
    time: '2:00 PM',
    description: 'Mentorship session with CleanTech founders on scaling their business model.',
    type: EventType.FounderMeeting
  },
  {
    id: '16',
    title: 'Exit Strategy Workshop',
    date: '2024-02-08',
    time: '10:30 AM',
    description: 'Workshop on planning successful exit strategies for mature portfolio companies.',
    type: EventType.Other
  },
  {
    id: '17',
    title: 'Series C Due Diligence',
    date: '2024-02-15',
    time: '9:00 AM',
    description: 'Due diligence process begins for major Series C investment in AgriTech scale-up.',
    type: EventType.FundingRound
  },
  {
    id: '18',
    title: 'Tax Planning Session',
    date: '2024-02-20',
    time: '1:00 PM',
    description: 'Tax planning session for investment portfolio optimization.',
    type: EventType.FinancialReport
  },
  {
    id: '19',
    title: 'Founder-Investor Networking',
    date: '2024-02-28',
    time: '6:00 PM',
    description: 'Networking event connecting startup founders with potential investors.',
    type: EventType.FounderMeeting
  },
  {
    id: '20',
    title: 'Impact Investment Round',
    date: '2024-03-10',
    time: '11:00 AM',
    description: 'Funding round focused on social impact startups in South Africa.',
    type: EventType.FundingRound
  },
  {
    id: '21',
    title: 'Q1 2025 Portfolio Review',
    date: '2025-04-02',
    time: '9:00 AM',
    description: 'Comprehensive review of Q1 2025 performance across all portfolio companies.',
    type: EventType.FinancialReport
  },
  {
    id: '22',
    title: 'Seed Round - RenewTech',
    date: '2025-04-05',
    time: '11:30 AM',
    description: 'Seed funding opportunity for renewable energy tech startup with innovative solar solutions.',
    type: EventType.FundingRound
  },
  {
    id: '23',
    title: 'Founder Strategy Session',
    date: '2025-04-08',
    time: '2:00 PM',
    description: 'Strategic alignment session with the founding team of MedTech Solutions.',
    type: EventType.FounderMeeting
  },
  {
    id: '24',
    title: 'Series D Investment Committee',
    date: '2025-04-10',
    time: '10:00 AM',
    description: 'Investment committee meeting to evaluate Series D funding for established e-commerce platform.',
    type: EventType.FundingRound
  },
  {
    id: '25',
    title: 'Financial Forecasting Workshop',
    date: '2025-04-14',
    time: '1:00 PM',
    description: 'Workshop on advanced financial forecasting techniques for high-growth startups.',
    type: EventType.FinancialReport
  },
  {
    id: '26',
    title: 'Multi-founder Networking Lunch',
    date: '2025-04-15',
    time: '12:30 PM',
    description: 'Networking lunch with founders from five portfolio companies to discuss ecosystem challenges.',
    type: EventType.FounderMeeting
  },
  {
    id: '27',
    title: 'Angel Syndicate Round',
    date: '2025-04-18',
    time: '3:00 PM',
    description: 'Syndicated investment opportunity for early-stage fintech addressing financial inclusion.',
    type: EventType.FundingRound
  },
  {
    id: '28',
    title: 'ESG Compliance Meeting',
    date: '2025-04-21',
    time: '9:30 AM',
    description: 'Meeting to review Environmental, Social, and Governance compliance across investment portfolio.',
    type: EventType.FinancialReport
  },
  {
    id: '29',
    title: 'Founder Pitch Competition',
    date: '2025-04-23',
    time: '2:00 PM',
    description: 'Live pitch competition featuring ten pre-screened startups seeking seed funding.',
    type: EventType.FounderMeeting
  },
  {
    id: '30',
    title: 'Pre-IPO Strategy Session',
    date: '2025-04-25',
    time: '10:00 AM',
    description: 'Strategic planning for potential IPO of mature portfolio company in logistics sector.',
    type: EventType.Other
  },
  {
    id: '31',
    title: 'Growth Round - AI Startups',
    date: '2025-04-28',
    time: '11:00 AM',
    description: 'Growth funding round focused on artificial intelligence startups with proven market traction.',
    type: EventType.FundingRound
  },
  {
    id: '32',
    title: 'Q2 Investment Planning',
    date: '2025-04-30',
    time: '2:30 PM',
    description: 'Planning session for Q2 2025 investment strategy and portfolio allocation.',
    type: EventType.FinancialReport
  },
  // March 2025 Events
  {
    id: '33',
    title: 'Venture Capital Forum',
    date: '2025-03-05',
    time: '9:00 AM',
    description: 'Annual forum bringing together VCs and promising startups from across Southern Africa.',
    type: EventType.FundingRound
  },
  {
    id: '34',
    title: 'End of FY Financial Review',
    date: '2025-03-10',
    time: '10:30 AM',
    description: 'Comprehensive review of financial performance for the fiscal year ending February 2025.',
    type: EventType.FinancialReport
  },
  {
    id: '35',
    title: 'Founders Breakfast Series',
    date: '2025-03-12',
    time: '8:00 AM',
    description: 'Exclusive breakfast session with founders of high-performing portfolio companies.',
    type: EventType.FounderMeeting
  },
  {
    id: '36',
    title: 'Series B Extension Round',
    date: '2025-03-17',
    time: '2:00 PM',
    description: 'Extension funding round for LogisticsTech company expanding into neighboring countries.',
    type: EventType.FundingRound
  },
  {
    id: '37',
    title: 'Tax Year Planning',
    date: '2025-03-20',
    time: '1:00 PM',
    description: 'Strategic tax planning session for the new financial year with accounting specialists.',
    type: EventType.FinancialReport
  },
  {
    id: '38',
    title: 'Emerging Founders Meetup',
    date: '2025-03-24',
    time: '4:00 PM',
    description: 'Networking event with first-time founders in the tech ecosystem.',
    type: EventType.FounderMeeting
  },
  {
    id: '39',
    title: 'Blockchain Startup Pitch Day',
    date: '2025-03-27',
    time: '11:00 AM',
    description: 'Special pitch day focused on blockchain and Web3 startups seeking seed funding.',
    type: EventType.FundingRound
  },
  {
    id: '40',
    title: 'Regulatory Compliance Workshop',
    date: '2025-03-31',
    time: '9:30 AM',
    description: 'Workshop on navigating updated financial regulations affecting investment activities.',
    type: EventType.Other
  },
  
  // May 2025 Events
  {
    id: '41',
    title: 'Impact Investment Symposium',
    date: '2025-05-02',
    time: '10:00 AM',
    description: 'Symposium on social impact investing with focus on sustainable development goals.',
    type: EventType.FundingRound
  },
  {
    id: '42',
    title: 'Q1 Earnings Reports Review',
    date: '2025-05-05',
    time: '2:30 PM',
    description: 'Analysis of Q1 2025 earnings reports for all portfolio companies.',
    type: EventType.FinancialReport
  },
  {
    id: '43',
    title: 'Founder Resilience Workshop',
    date: '2025-05-08',
    time: '9:00 AM',
    description: 'Workshop for founders on building resilience and managing stress in high-growth environments.',
    type: EventType.FounderMeeting
  },
  {
    id: '44',
    title: 'Healthcare Startups Funding Round',
    date: '2025-05-12',
    time: '11:30 AM',
    description: 'Specialized funding round for startups in the healthcare and biotech sectors.',
    type: EventType.FundingRound
  },
  {
    id: '45',
    title: 'Investment Committee Meeting',
    date: '2025-05-15',
    time: '10:00 AM',
    description: 'Quarterly investment committee meeting to review pipeline and approve new investments.',
    type: EventType.FinancialReport
  },
  {
    id: '46',
    title: 'Female Founders Summit',
    date: '2025-05-19',
    time: '9:30 AM',
    description: 'Full-day summit featuring female founders from across the African tech ecosystem.',
    type: EventType.FounderMeeting
  },
  {
    id: '47',
    title: 'Late-Stage Growth Round',
    date: '2025-05-22',
    time: '1:00 PM',
    description: 'Major growth funding round for scale-up company preparing for international expansion.',
    type: EventType.FundingRound
  },
  {
    id: '48',
    title: 'Portfolio Diversification Strategy',
    date: '2025-05-26',
    time: '3:00 PM',
    description: 'Strategic session on optimizing investment portfolio diversification across sectors and stages.',
    type: EventType.Other
  },
  {
    id: '49',
    title: 'Monthly Financial Reporting Deadline',
    date: '2025-05-28',
    time: '5:00 PM',
    description: 'Deadline for monthly financial reports from all portfolio companies.',
    type: EventType.FinancialReport
  },
  {
    id: '50',
    title: 'Cross-Portfolio Collaboration Day',
    date: '2025-05-30',
    time: '10:00 AM',
    description: 'Facilitated session to foster collaboration between founders across the investment portfolio.',
    type: EventType.FounderMeeting
  }
];

export const FunderCalendarPage: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>(sampleEvents);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    // In a real application, you would fetch events from an API here
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setEvents(sampleEvents);
      setLoading(false);
    }, 1000);
  }, []);

  // Filter events based on selected type
  const filteredEvents = filterType === 'all' 
    ? events 
    : events.filter(event => event.type === filterType);

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setFilterType(value);
  };

  return (
    <div>
      <Row gutter={[16, 16]} align="middle" justify="space-between">
        <Col>
          <Title level={2}>Calendar</Title>
        </Col>
        <Col>
          <Select 
            defaultValue="all" 
            style={{ width: 200 }} 
            onChange={handleFilterChange}
          >
            <Option value="all">All Events</Option>
            <Option value={EventType.FundingRound}>
              <Tag color="green">Funding Rounds</Tag>
            </Option>
            <Option value={EventType.FinancialReport}>
              <Tag color="orange">Financial Reports</Tag>
            </Option>
            <Option value={EventType.FounderMeeting}>
              <Tag color="blue">Founder Meetings</Tag>
            </Option>
            <Option value={EventType.Other}>
              <Tag>Other Events</Tag>
            </Option>
          </Select>
        </Col>
      </Row>
      
      <Card style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Loading events...</p>
          </div>
        ) : (
          <>
            {filteredEvents.length === 0 ? (
              <Alert 
                message="No events found" 
                description="There are no events matching your selected filter." 
                type="info" 
                showIcon 
              />
            ) : (
              <FunderCalendar events={filteredEvents} />
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default FunderCalendarPage; 