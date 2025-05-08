import React, { useState, useEffect } from "react";
import { 
  Card, 
  Input, 
  Row, 
  Col, 
  Table, 
  Tag, 
  Button, 
  Typography, 
  Select, 
  Space, 
  Tooltip, 
  Badge, 
  Spin,
  Divider,
  Drawer,
  Avatar,
  List,
  Empty,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  message,
  Timeline,
  Tabs
} from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  UserOutlined,
  EnvironmentOutlined,
  TagOutlined,
  TeamOutlined,
  MailOutlined,
  PhoneOutlined,
  StarOutlined,
  StarFilled,
  InfoCircleOutlined,
  DownloadOutlined,
  PlusOutlined,
  CalendarOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  MoneyCollectOutlined,
  ToolOutlined,
  ShopOutlined,
  ClusterOutlined,
  BookOutlined,
  SafetyOutlined,
  EditOutlined,
  DeleteOutlined
} from "@ant-design/icons";
import { collection, getDocs, query, where, addDoc, serverTimestamp, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/firebase";
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Search } = Input;
const { TextArea } = Input;

// Define interface for participants
interface Participant {
  id: string;
  name: string;
  industry: string;
  location: string;
  description?: string;
  foundedYear?: number;
  teamSize?: number;
  stage?: string;
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
  developmentNeeds?: string[];
  status: string;
  logo?: string;
  [key: string]: any;
}

interface SupportProgram {
  id: string;
  participantId: string;
  programName: string;
  programType: string;
  startDate: Timestamp;
  endDate: Timestamp;
  description: string;
  budget?: number;
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  outcomes?: string[];
  createdBy: string;
  createdAt: Timestamp;
}

export const ParticipantDirectory: React.FC = () => {
  console.log("Rendering ParticipantDirectory component");
  
  // State variables
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);
  const [favoriteParticipants, setFavoriteParticipants] = useState<string[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addParticipantForm] = Form.useForm();
  const [addParticipantLoading, setAddParticipantLoading] = useState(false);
  const [supportProgramModalVisible, setSupportProgramModalVisible] = useState(false);
  const [supportProgramForm] = Form.useForm();
  const [supportProgramLoading, setSupportProgramLoading] = useState(false);
  const [participantSupportPrograms, setParticipantSupportPrograms] = useState<SupportProgram[]>([]);
  const [supportProgramsLoading, setSupportProgramsLoading] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState('1');

  // Fetch participants data
  useEffect(() => {
    fetchParticipants();
    loadFavorites();
    addSampleSupportPrograms();
  }, []);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      // Fetch data from Firestore
      const participantsRef = collection(db, "participants");
      const participantsQuery = query(participantsRef, where("status", "!=", "deleted"));
      const participantsSnapshot = await getDocs(participantsQuery);
      
      // Process actual data from Firestore
      const participantsData = participantsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Participant));
      
      console.log("Fetched participants from Firebase:", participantsData.length);
      
      if (participantsData.length === 0) {
        // If no data in Firebase, initialize with sample data
        const sampleData = getSampleParticipants();
        // Add sample data to Firestore for future use
        for (const participant of sampleData) {
          const { id, ...participantWithoutId } = participant;
          await addDoc(collection(db, "participants"), {
            ...participantWithoutId,
            createdAt: serverTimestamp()
          });
        }
        console.log("Added sample data to Firebase");
        
        // Fetch the newly added data
        const updatedSnapshot = await getDocs(participantsQuery);
        const updatedData = updatedSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as Participant));
        
        processParticipantsData(updatedData);
      } else {
        processParticipantsData(participantsData);
      }
    } catch (error) {
      console.error("Error fetching participants:", error);
      message.error("Failed to load participants. Please try again later.");
      // Initialize with empty array instead of sample data
      setParticipants([]);
      setFilteredParticipants([]);
      setIndustries([]);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  // Process participants data
  const processParticipantsData = (data: Participant[]) => {
    setParticipants(data);
    setFilteredParticipants(data);
    
    // Extract unique industries and locations
    const uniqueIndustries = [...new Set(data.map(p => p.industry))];
    const uniqueLocations = [...new Set(data.map(p => p.location))];
    setIndustries(uniqueIndustries);
    setLocations(uniqueLocations);
  };

  // Load favorites from localStorage
  const loadFavorites = () => {
    const storedFavorites = localStorage.getItem('govFavoriteParticipants');
    if (storedFavorites) {
      setFavoriteParticipants(JSON.parse(storedFavorites));
    }
  };

  // Apply filters whenever any filter changes
  useEffect(() => {
    applyFilters();
  }, [searchText, selectedIndustries, selectedLocations, selectedNeeds, participants]);

  // Function to get sample participant data
  const getSampleParticipants = (): Participant[] => {
    return [
      {
        id: "1",
        name: "GreenTech Solutions",
        industry: "Renewable Energy",
        location: "Cape Town",
        description: "Developing affordable solar solutions for rural communities.",
        foundedYear: 2018,
        teamSize: 12,
        stage: "Growth",
        status: "active",
        developmentNeeds: ["Funding", "Technical Support", "Market Access"],
        contact: {
          email: "info@greentechsolutions.co.za",
          phone: "+27 21 555 1234",
          website: "www.greentechsolutions.co.za"
        },
        logo: "https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTR8fHNvbGFyfGVufDB8fDB8fHww"
      },
      {
        id: "2",
        name: "AgriProcess Innovations",
        industry: "Agriculture",
        location: "Stellenbosch",
        description: "Agricultural processing technology for small-scale farmers.",
        foundedYear: 2019,
        teamSize: 8,
        stage: "Early Growth",
        status: "active",
        developmentNeeds: ["Mentorship", "Equipment", "Regulatory Support"],
        contact: {
          email: "contact@agriprocess.co.za",
          phone: "+27 21 882 7700",
          website: "www.agriprocess.co.za"
        },
        logo: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8YWdyaWN1bHR1cmV8ZW58MHx8MHx8fDA%3D"
      },
      {
        id: "3",
        name: "HealthTech Connect",
        industry: "Healthcare",
        location: "Johannesburg",
        description: "Digital health platform connecting patients with healthcare providers.",
        foundedYear: 2020,
        teamSize: 15,
        stage: "Scaling",
        status: "active",
        developmentNeeds: ["Funding", "Partnerships", "Regulatory Compliance"],
        contact: {
          email: "info@healthtechconnect.co.za",
          phone: "+27 11 789 2345",
          website: "www.healthtechconnect.co.za"
        },
        logo: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8aGVhbHRoY2FyZXxlbnwwfHwwfHx8MA%3D%3D"
      },
      {
        id: "4",
        name: "EduAccess",
        industry: "Education",
        location: "Pretoria",
        description: "Making education accessible to underprivileged communities through technology.",
        foundedYear: 2017,
        teamSize: 11,
        stage: "Established",
        status: "active",
        developmentNeeds: ["Partnerships", "Technology Infrastructure", "Content Development"],
        contact: {
          email: "contact@eduaccess.org.za",
          phone: "+27 12 342 5678",
          website: "www.eduaccess.org.za"
        },
        logo: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8ZWR1Y2F0aW9ufGVufDB8fDB8fHww"
      },
      {
        id: "5",
        name: "LogiTech Solutions",
        industry: "Logistics",
        location: "Durban",
        description: "Optimizing supply chain logistics for small to medium businesses.",
        foundedYear: 2016,
        teamSize: 20,
        stage: "Scaling",
        status: "active",
        developmentNeeds: ["Funding", "Technology Infrastructure", "International Market Access"],
        contact: {
          email: "info@logitechsolutions.co.za",
          phone: "+27 31 765 4321",
          website: "www.logitechsolutions.co.za"
        },
        logo: "https://images.unsplash.com/photo-1579618385542-d49d30dde412?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8OXx8bG9naXN0aWNzfGVufDB8fDB8fHww"
      }
    ];
  };

  // Add sample support programs when initializing the app
  const addSampleSupportPrograms = async () => {
    try {
      // Check if support programs already exist
      const programsRef = collection(db, "supportPrograms");
      const programsSnapshot = await getDocs(programsRef);
      
      if (programsSnapshot.empty) {
        console.log("Adding sample support programs...");
        
        // Sample support programs
        const samplePrograms = [
          {
            participantId: "1", // GreenTech Solutions
            programName: "Green Energy Innovation Grant",
            programType: "Grant Funding",
            startDate: Timestamp.fromDate(new Date(2023, 9, 1)), // Oct 1, 2023
            endDate: Timestamp.fromDate(new Date(2024, 2, 31)),  // Mar 31, 2024
            description: "Funding to support research and development of next-generation solar technologies for rural applications.",
            budget: 500000,
            status: 'active',
            outcomes: ["Product Development", "Job Creation", "Technology Transfer"],
            createdBy: "System",
            createdAt: serverTimestamp(),
          },
          {
            participantId: "1", // GreenTech Solutions
            programName: "Market Access Facilitation",
            programType: "Market Access Support",
            startDate: Timestamp.fromDate(new Date(2023, 6, 15)), // Jul 15, 2023
            endDate: Timestamp.fromDate(new Date(2023, 11, 15)),  // Dec 15, 2023
            description: "Supporting access to new markets through trade show participation and business matchmaking.",
            budget: 150000,
            status: 'completed',
            outcomes: ["Market Expansion", "Increased Revenue"],
            createdBy: "System",
            createdAt: serverTimestamp(),
          },
          {
            participantId: "2", // AgriProcess Innovations
            programName: "Agricultural Equipment Subsidy",
            programType: "Infrastructure Access",
            startDate: Timestamp.fromDate(new Date(2023, 8, 1)),  // Sep 1, 2023
            endDate: Timestamp.fromDate(new Date(2024, 7, 31)),   // Aug 31, 2024
            description: "Subsidizing the acquisition of essential agricultural processing equipment for small-scale farmers.",
            budget: 750000,
            status: 'active',
            outcomes: ["Capacity Building", "Job Creation"],
            createdBy: "System",
            createdAt: serverTimestamp(),
          },
          {
            participantId: "3", // HealthTech Connect
            programName: "Healthcare Regulatory Compliance Support",
            programType: "Regulatory Support",
            startDate: Timestamp.fromDate(new Date(2023, 10, 1)), // Nov 1, 2023
            endDate: Timestamp.fromDate(new Date(2024, 3, 30)),   // Apr 30, 2024
            description: "Assistance with navigating healthcare regulations and compliance requirements for digital health platforms.",
            budget: 200000,
            status: 'active',
            outcomes: ["Regulatory Compliance", "Market Access"],
            createdBy: "System",
            createdAt: serverTimestamp(),
          },
          {
            participantId: "4", // EduAccess
            programName: "Educational Content Development Workshop",
            programType: "Training & Skills Development",
            startDate: Timestamp.fromDate(new Date(2024, 1, 15)), // Feb 15, 2024
            endDate: Timestamp.fromDate(new Date(2024, 4, 15)),   // May 15, 2024
            description: "Workshop series for developing high-quality educational content for underprivileged communities.",
            budget: 120000,
            status: 'planned',
            outcomes: ["Capacity Building", "Content Development"],
            createdBy: "System",
            createdAt: serverTimestamp(),
          },
          {
            participantId: "5", // LogiTech Solutions
            programName: "Supply Chain Optimization Mentorship",
            programType: "Mentorship",
            startDate: Timestamp.fromDate(new Date(2023, 7, 1)),  // Aug 1, 2023
            endDate: Timestamp.fromDate(new Date(2023, 9, 30)),   // Oct 30, 2023
            description: "Expert mentorship to optimize supply chain logistics for small to medium businesses.",
            budget: 80000,
            status: 'completed',
            outcomes: ["Capacity Building", "Increased Revenue"],
            createdBy: "System",
            createdAt: serverTimestamp(),
          }
        ];
        
        // Add each sample program to Firestore
        for (const program of samplePrograms) {
          await addDoc(collection(db, "supportPrograms"), program);
        }
        
        console.log("Sample support programs added successfully");
      }
    } catch (error) {
      console.error("Error adding sample support programs:", error);
    }
  };

  // Apply all filters
  const applyFilters = () => {
    if (!participants.length) return;
    
    let filtered = [...participants];
    
    // Apply search filter
    if (searchText) {
      const lowerCaseSearch = searchText.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(lowerCaseSearch) ||
        p.description?.toLowerCase().includes(lowerCaseSearch) ||
        p.industry.toLowerCase().includes(lowerCaseSearch) ||
        p.location.toLowerCase().includes(lowerCaseSearch)
      );
    }
    
    // Apply industry filter
    if (selectedIndustries.length > 0) {
      filtered = filtered.filter(p => selectedIndustries.includes(p.industry));
    }
    
    // Apply location filter
    if (selectedLocations.length > 0) {
      filtered = filtered.filter(p => selectedLocations.includes(p.location));
    }
    
    // Apply needs filter
    if (selectedNeeds.length > 0) {
      filtered = filtered.filter(p => 
        p.developmentNeeds && 
        p.developmentNeeds.some(need => selectedNeeds.includes(need))
      );
    }
    
    setFilteredParticipants(filtered);
  };

  // Toggle favorite status
  const toggleFavorite = (id: string) => {
    let newFavorites;
    if (favoriteParticipants.includes(id)) {
      newFavorites = favoriteParticipants.filter(pid => pid !== id);
    } else {
      newFavorites = [...favoriteParticipants, id];
    }
    setFavoriteParticipants(newFavorites);
    localStorage.setItem('govFavoriteParticipants', JSON.stringify(newFavorites));
  };

  // View participant details - modified to also fetch support programs
  const viewParticipantDetails = (participant: Participant) => {
    setSelectedParticipant(participant);
    setDrawerVisible(true);
    setActiveTabKey('1'); // Reset to details tab
    fetchParticipantSupportPrograms(participant.id);
  };

  // Fetch support programs for a participant
  const fetchParticipantSupportPrograms = async (participantId: string) => {
    setSupportProgramsLoading(true);
    try {
      const programsRef = collection(db, "supportPrograms");
      const programsQuery = query(
        programsRef, 
        where("participantId", "==", participantId),
        orderBy("createdAt", "desc")
      );
      const programsSnapshot = await getDocs(programsQuery);
      
      const programsData = programsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as SupportProgram));
      
      setParticipantSupportPrograms(programsData);
    } catch (error) {
      console.error("Error fetching support programs:", error);
      message.error("Failed to load support programs");
      setParticipantSupportPrograms([]);
    } finally {
      setSupportProgramsLoading(false);
    }
  };

  // Handle creating a new support program
  const handleCreateSupportProgram = (participantId: string) => {
    supportProgramForm.resetFields();
    setSupportProgramModalVisible(true);
  };

  // Submit support program form
  const handleSupportProgramSubmit = async (values: any) => {
    if (!selectedParticipant) return;
    
    setSupportProgramLoading(true);
    try {
      // Format the support program data
      const newProgram = {
        participantId: selectedParticipant.id,
        programName: values.programName,
        programType: values.programType,
        startDate: Timestamp.fromDate(values.dateRange[0].toDate()),
        endDate: Timestamp.fromDate(values.dateRange[1].toDate()),
        description: values.description,
        budget: values.budget,
        status: 'planned',
        outcomes: values.outcomes || [],
        createdBy: "Government User", // In a real app, use the authenticated user
        createdAt: serverTimestamp(),
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, "supportPrograms"), newProgram);
      
      // Add to local state with the generated ID
      const programWithId = {
        ...newProgram,
        id: docRef.id,
        createdAt: Timestamp.now(), // Use current time for immediate display
      } as SupportProgram;
      
      setParticipantSupportPrograms([programWithId, ...participantSupportPrograms]);
      
      message.success("Support program created successfully");
      setSupportProgramModalVisible(false);
      setActiveTabKey('2'); // Switch to support programs tab
    } catch (error) {
      console.error("Error creating support program:", error);
      message.error("Failed to create support program");
    } finally {
      setSupportProgramLoading(false);
    }
  };

  // Render support program status tag
  const renderProgramStatus = (status: string) => {
    const statusColors = {
      planned: 'blue',
      active: 'green',
      completed: 'purple',
      cancelled: 'red'
    };
    
    return (
      <Tag color={statusColors[status as keyof typeof statusColors]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Tag>
    );
  };

  // Get all unique development needs
  const getAllDevelopmentNeeds = () => {
    const allNeeds = participants
      .filter(p => p.developmentNeeds && Array.isArray(p.developmentNeeds))
      .flatMap(p => p.developmentNeeds || []);
    return [...new Set(allNeeds)];
  };

  // Render development needs as tags
  const renderDevelopmentNeeds = (needs: string[] | undefined) => {
    if (!needs || !Array.isArray(needs) || needs.length === 0) {
      return <Text type="secondary">None specified</Text>;
    }
    
    return (
      <Space size={[0, 8]} wrap>
        {needs.map((need, index) => (
          <Tag color="blue" key={index}>{need}</Tag>
        ))}
      </Space>
    );
  };

  // Get full address display
  const getFullAddress = (participant: Participant) => {
    // In a real app, this would use complete address details
    return participant.location;
  };

  // Export participants list
  const exportParticipantsList = () => {
    // In a real app, this would generate a CSV or Excel file
    console.log("Exporting participants list:", filteredParticipants);
    // For now, we'll just log the data to console
  };

  // Add new participant
  const handleAddParticipant = async (values: any) => {
    setAddParticipantLoading(true);
    try {
      // Format the participant data
      const newParticipant = {
        name: values.name,
        industry: values.industry,
        location: values.location,
        description: values.description,
        foundedYear: values.foundedYear,
        teamSize: values.teamSize,
        stage: values.stage,
        status: 'active',
        developmentNeeds: values.developmentNeeds || [],
        contact: {
          email: values.email,
          phone: values.phone,
          website: values.website
        },
        logo: values.logo,
        createdAt: serverTimestamp()
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, "participants"), newParticipant);
      
      // Add to local state with the generated ID
      const participantWithId = {
        ...newParticipant,
        id: docRef.id
      };
      
      setParticipants([participantWithId, ...participants]);
      setFilteredParticipants([participantWithId, ...filteredParticipants]);
      
      // Update industries and locations lists if needed
      if (!industries.includes(values.industry)) {
        setIndustries([...industries, values.industry]);
      }
      if (!locations.includes(values.location)) {
        setLocations([...locations, values.location]);
      }
      
      message.success("Participant added successfully");
      setAddModalVisible(false);
      addParticipantForm.resetFields();
    } catch (error) {
      console.error("Error adding participant:", error);
      message.error("Failed to add participant");
    } finally {
      setAddParticipantLoading(false);
    }
  };

  // Improved support program display in the Timeline
  const renderSupportProgramTimeline = () => {
    if (supportProgramsLoading) {
      return (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
          <div style={{ marginTop: 8 }}>Loading support programs...</div>
        </div>
      );
    }
    
    if (participantSupportPrograms.length === 0) {
      return (
        <Empty 
          description="No support programs yet" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }
    
    // Group programs by status for better organization
    const programsByStatus = {
      active: participantSupportPrograms.filter(p => p.status === 'active'),
      planned: participantSupportPrograms.filter(p => p.status === 'planned'),
      completed: participantSupportPrograms.filter(p => p.status === 'completed'),
      cancelled: participantSupportPrograms.filter(p => p.status === 'cancelled')
    };
    
    return (
      <>
        {programsByStatus.active.length > 0 && (
          <>
            <Divider orientation="left">
              <Badge status="success" text="Active Programs" />
            </Divider>
            <Timeline mode="left">
              {programsByStatus.active.map(renderTimelineItem)}
            </Timeline>
          </>
        )}
        
        {programsByStatus.planned.length > 0 && (
          <>
            <Divider orientation="left">
              <Badge status="processing" text="Planned Programs" />
            </Divider>
            <Timeline mode="left">
              {programsByStatus.planned.map(renderTimelineItem)}
            </Timeline>
          </>
        )}
        
        {programsByStatus.completed.length > 0 && (
          <>
            <Divider orientation="left">
              <Badge status="default" text="Completed Programs" />
            </Divider>
            <Timeline mode="left">
              {programsByStatus.completed.map(renderTimelineItem)}
            </Timeline>
          </>
        )}
        
        {programsByStatus.cancelled.length > 0 && (
          <>
            <Divider orientation="left">
              <Badge status="error" text="Cancelled Programs" />
            </Divider>
            <Timeline mode="left">
              {programsByStatus.cancelled.map(renderTimelineItem)}
            </Timeline>
          </>
        )}
      </>
    );
  };
  
  // Helper function to render a single timeline item
  const renderTimelineItem = (program: SupportProgram) => {
    const statusColors = {
      planned: 'blue',
      active: 'green',
      completed: 'purple',
      cancelled: 'red'
    };
    
    const iconMap = {
      'Grant Funding': <MoneyCollectOutlined style={{ fontSize: '16px' }} />,
      'Technical Assistance': <ToolOutlined style={{ fontSize: '16px' }} />,
      'Mentorship': <UserOutlined style={{ fontSize: '16px' }} />,
      'Market Access Support': <ShopOutlined style={{ fontSize: '16px' }} />,
      'Infrastructure Access': <ClusterOutlined style={{ fontSize: '16px' }} />,
      'Training & Skills Development': <BookOutlined style={{ fontSize: '16px' }} />,
      'Regulatory Support': <SafetyOutlined style={{ fontSize: '16px' }} />
    };
    
    const defaultIcon = <FileTextOutlined style={{ fontSize: '16px' }} />;
    const icon = program.programType && iconMap[program.programType as keyof typeof iconMap] 
      ? iconMap[program.programType as keyof typeof iconMap] 
      : defaultIcon;
    
    return (
      <Timeline.Item 
        key={program.id}
        dot={icon}
        color={statusColors[program.status as keyof typeof statusColors]}
      >
        <Card 
          size="small" 
          style={{ marginBottom: 16 }}
          title={
            <Space align="center">
              <Text strong>{program.programName}</Text>
              {renderProgramStatus(program.status)}
            </Space>
          }
          extra={
            <Space>
              <Button size="small" type="text" icon={<EditOutlined />} onClick={() => console.log('Edit program', program.id)}>
                Edit
              </Button>
              <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => console.log('Delete program', program.id)}>
                Delete
              </Button>
            </Space>
          }
        >
          <Paragraph>{program.description}</Paragraph>
          
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary">
                <CalendarOutlined /> {program.startDate?.toDate().toLocaleDateString()} - {program.endDate?.toDate().toLocaleDateString()}
              </Text>
            </Col>
            <Col span={12}>
              <Space>
                <Tag color="blue">{program.programType}</Tag>
                {program.budget && (
                  <Tag color="green">R{program.budget.toLocaleString()}</Tag>
                )}
              </Space>
            </Col>
          </Row>
          
          {program.outcomes && program.outcomes.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">Expected Outcomes:</Text>
              <div style={{ marginTop: 4 }}>
                {program.outcomes.map((outcome, i) => (
                  <Tag key={i} style={{ marginBottom: 4 }}>{outcome}</Tag>
                ))}
              </div>
            </div>
          )}
        </Card>
      </Timeline.Item>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
        <Col flex="auto">
          <Title level={3}>Participant Directory</Title>
          <Text type="secondary">
            Browse and search for participants to support with your programs and initiatives
          </Text>
        </Col>
        <Col>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setAddModalVisible(true)}
            >
              Add Participant
            </Button>
            <Button 
              type="default" 
              icon={<DownloadOutlined />}
              onClick={exportParticipantsList}
            >
              Export List
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Filters Section */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Search
              placeholder="Search participants..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          
          <Col xs={24} md={5}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Filter by Industry"
              value={selectedIndustries}
              onChange={setSelectedIndustries}
              maxTagCount={2}
            >
              {industries.map(industry => (
                <Option key={industry} value={industry}>{industry}</Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} md={5}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Filter by Location"
              value={selectedLocations}
              onChange={setSelectedLocations}
              maxTagCount={2}
            >
              {locations.map(location => (
                <Option key={location} value={location}>{location}</Option>
              ))}
            </Select>
          </Col>
          
          <Col xs={24} md={6}>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Development Needs"
              value={selectedNeeds}
              onChange={setSelectedNeeds}
              maxTagCount={2}
            >
              {getAllDevelopmentNeeds().map(need => (
                <Option key={need} value={need}>{need}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Results Section */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading participants...</div>
        </div>
      ) : filteredParticipants.length === 0 ? (
        <Empty 
          description="No participants found matching your filters" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {filteredParticipants.map(participant => (
            <Col xs={24} sm={12} md={8} lg={6} key={participant.id}>
              <Card
                hoverable
                cover={
                  <div style={{ height: 160, overflow: 'hidden', position: 'relative' }}>
                    {participant.logo ? (
                      <img 
                        alt={participant.name}
                        src={participant.logo}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        backgroundColor: '#f5f5f5' 
                      }}>
                        <TeamOutlined style={{ fontSize: 40, color: '#d9d9d9' }} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <Button 
                        type="text"
                        icon={favoriteParticipants.includes(participant.id) ? 
                          <StarFilled style={{ color: '#faad14' }} /> : 
                          <StarOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(participant.id);
                        }}
                      />
                    </div>
                  </div>
                }
                onClick={() => viewParticipantDetails(participant)}
              >
                <Card.Meta
                  title={participant.name}
                  description={
                    <>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <TagOutlined />
                          <Text>{participant.industry}</Text>
                        </Space>
                        <Space>
                          <EnvironmentOutlined />
                          <Text>{participant.location}</Text>
                        </Space>
                        <div>
                          <Text type="secondary">Development Needs:</Text>
                          <div style={{ marginTop: 5 }}>
                            {renderDevelopmentNeeds(participant.developmentNeeds)}
                          </div>
                        </div>
                      </Space>
                    </>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Participant Details Drawer - updated to use the new renderSupportProgramTimeline function */}
      <Drawer
        title={selectedParticipant?.name || 'Participant Details'}
        placement="right"
        width={600}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        extra={
          <Button 
            icon={favoriteParticipants.includes(selectedParticipant?.id || '') ? 
              <StarFilled style={{ color: '#faad14' }} /> : 
              <StarOutlined />}
            onClick={() => selectedParticipant && toggleFavorite(selectedParticipant.id)}
          >
            {favoriteParticipants.includes(selectedParticipant?.id || '') ? 'Favorited' : 'Favorite'}
          </Button>
        }
      >
        {selectedParticipant && (
          <>
            <Tabs activeKey={activeTabKey} onChange={setActiveTabKey}>
              <Tabs.TabPane tab="Details" key="1">
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    {selectedParticipant.logo ? (
                      <Avatar src={selectedParticipant.logo} size={100} />
                    ) : (
                      <Avatar icon={<TeamOutlined />} size={100} />
                    )}
                  </div>
                  
                  <Paragraph>{selectedParticipant.description}</Paragraph>
                  
                  <Divider />
                  
                  <List>
                    <List.Item>
                      <Text strong>Industry:</Text>
                      <Tag color="blue">{selectedParticipant.industry}</Tag>
                    </List.Item>
                    <List.Item>
                      <Text strong>Location:</Text>
                      <Text>{getFullAddress(selectedParticipant)}</Text>
                    </List.Item>
                    <List.Item>
                      <Text strong>Stage:</Text>
                      <Text>{selectedParticipant.stage || 'Not specified'}</Text>
                    </List.Item>
                    <List.Item>
                      <Text strong>Founded:</Text>
                      <Text>{selectedParticipant.foundedYear || 'Not specified'}</Text>
                    </List.Item>
                    <List.Item>
                      <Text strong>Team Size:</Text>
                      <Text>{selectedParticipant.teamSize || 'Not specified'}</Text>
                    </List.Item>
                  </List>
                  
                  <Divider orientation="left">Development Needs</Divider>
                  {renderDevelopmentNeeds(selectedParticipant.developmentNeeds)}
                  
                  <Divider orientation="left">Contact Information</Divider>
                  <List>
                    {selectedParticipant.contact?.email && (
                      <List.Item>
                        <Space>
                          <MailOutlined />
                          <a href={`mailto:${selectedParticipant.contact.email}`}>
                            {selectedParticipant.contact.email}
                          </a>
                        </Space>
                      </List.Item>
                    )}
                    {selectedParticipant.contact?.phone && (
                      <List.Item>
                        <Space>
                          <PhoneOutlined />
                          <a href={`tel:${selectedParticipant.contact.phone}`}>
                            {selectedParticipant.contact.phone}
                          </a>
                        </Space>
                      </List.Item>
                    )}
                    {selectedParticipant.contact?.website && (
                      <List.Item>
                        <Space>
                          <InfoCircleOutlined />
                          <a href={`https://${selectedParticipant.contact.website}`} target="_blank" rel="noopener noreferrer">
                            {selectedParticipant.contact.website}
                          </a>
                        </Space>
                      </List.Item>
                    )}
                  </List>
                </div>
              </Tabs.TabPane>
              
              <Tabs.TabPane tab="Support Programs" key="2">
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />} 
                      onClick={() => handleCreateSupportProgram(selectedParticipant.id)}
                    >
                      Create Support Program
                    </Button>
                  </div>

                  {renderSupportProgramTimeline()}
                </div>
              </Tabs.TabPane>
            </Tabs>
            
            <Divider />
            
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Button 
                  type="primary" 
                  block 
                  icon={<PlusOutlined />}
                  onClick={() => {
                    handleCreateSupportProgram(selectedParticipant.id);
                  }}
                >
                  Create Support Program
                </Button>
              </Col>
              <Col span={24}>
                <Button block onClick={() => console.log('Contact this participant', selectedParticipant.id)}>
                  Contact Participant
                </Button>
              </Col>
            </Row>
          </>
        )}
      </Drawer>

      {/* Add Participant Modal */}
      <Modal
        title="Add New Participant"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={addParticipantForm}
          layout="vertical"
          onFinish={handleAddParticipant}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label="Company Name"
                rules={[{ required: true, message: 'Please enter company name' }]}
              >
                <Input placeholder="Enter company name" />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="industry"
                label="Industry"
                rules={[{ required: true, message: 'Please select industry' }]}
              >
                <Select 
                  placeholder="Select industry"
                  showSearch
                  allowClear
                >
                  {industries.map(industry => (
                    <Option key={industry} value={industry}>{industry}</Option>
                  ))}
                  <Option value="custom">+ Add New</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="location"
                label="Location"
                rules={[{ required: true, message: 'Please enter location' }]}
              >
                <Select 
                  placeholder="Select location"
                  showSearch
                  allowClear
                >
                  {locations.map(location => (
                    <Option key={location} value={location}>{location}</Option>
                  ))}
                  <Option value="custom">+ Add New</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item
                name="description"
                label="Description"
              >
                <TextArea rows={4} placeholder="Enter company description" />
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="foundedYear"
                label="Founded Year"
              >
                <InputNumber min={1900} max={2030} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="teamSize"
                label="Team Size"
              >
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="stage"
                label="Stage"
              >
                <Select placeholder="Select stage">
                  <Option value="Ideation">Ideation</Option>
                  <Option value="Validation">Validation</Option>
                  <Option value="Early Growth">Early Growth</Option>
                  <Option value="Growth">Growth</Option>
                  <Option value="Scaling">Scaling</Option>
                  <Option value="Established">Established</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item
                name="developmentNeeds"
                label="Development Needs"
              >
                <Select
                  mode="tags"
                  placeholder="Select or add development needs"
                  style={{ width: '100%' }}
                >
                  <Option value="Funding">Funding</Option>
                  <Option value="Mentorship">Mentorship</Option>
                  <Option value="Technical Support">Technical Support</Option>
                  <Option value="Market Access">Market Access</Option>
                  <Option value="Regulatory Support">Regulatory Support</Option>
                  <Option value="Equipment">Equipment</Option>
                  <Option value="Partnerships">Partnerships</Option>
                  <Option value="Technology Infrastructure">Technology Infrastructure</Option>
                  <Option value="Content Development">Content Development</Option>
                  <Option value="International Market Access">International Market Access</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Divider orientation="left">Contact Information</Divider>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Please enter a valid email' }]}
              >
                <Input placeholder="Email address" />
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="phone"
                label="Phone"
              >
                <Input placeholder="Phone number" />
              </Form.Item>
            </Col>
            
            <Col span={8}>
              <Form.Item
                name="website"
                label="Website"
              >
                <Input placeholder="Website URL (without http://)" />
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item
                name="logo"
                label="Logo URL"
              >
                <Input placeholder="Enter logo image URL" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={addParticipantLoading}>
                Create Participant
              </Button>
              <Button onClick={() => setAddModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Support Program Modal */}
      <Modal
        title="Create Support Program"
        open={supportProgramModalVisible}
        onCancel={() => setSupportProgramModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form
          form={supportProgramForm}
          layout="vertical"
          onFinish={handleSupportProgramSubmit}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="programName"
                label="Program Name"
                rules={[{ required: true, message: 'Please enter program name' }]}
              >
                <Input placeholder="Enter program name" />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="programType"
                label="Program Type"
                rules={[{ required: true, message: 'Please select program type' }]}
              >
                <Select placeholder="Select program type">
                  <Option value="Grant Funding">Grant Funding</Option>
                  <Option value="Technical Assistance">Technical Assistance</Option>
                  <Option value="Mentorship">Mentorship</Option>
                  <Option value="Market Access Support">Market Access Support</Option>
                  <Option value="Infrastructure Access">Infrastructure Access</Option>
                  <Option value="Training & Skills Development">Training & Skills Development</Option>
                  <Option value="Regulatory Support">Regulatory Support</Option>
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="dateRange"
                label="Program Duration"
                rules={[{ required: true, message: 'Please select program duration' }]}
              >
                <DatePicker.RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item
                name="description"
                label="Program Description"
                rules={[{ required: true, message: 'Please enter program description' }]}
              >
                <TextArea rows={4} placeholder="Describe the support program" />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                name="budget"
                label="Budget (ZAR)"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  step={1000}
                  formatter={(value) => value ? `R ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''}
                  parser={(value) => {
                    if (!value) return 0;
                    const parsed = value.replace(/R\s?|(,*)/g, '');
                    return Number(parsed);
                  }}
                />
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item
                name="outcomes"
                label="Expected Outcomes"
              >
                <Select
                  mode="tags"
                  placeholder="Add expected outcomes"
                  style={{ width: '100%' }}
                >
                  <Option value="Increased Revenue">Increased Revenue</Option>
                  <Option value="Job Creation">Job Creation</Option>
                  <Option value="Market Expansion">Market Expansion</Option>
                  <Option value="Product Development">Product Development</Option>
                  <Option value="Capacity Building">Capacity Building</Option>
                  <Option value="Regulatory Compliance">Regulatory Compliance</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={supportProgramLoading}>
                Create Program
              </Button>
              <Button onClick={() => setSupportProgramModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ParticipantDirectory; 