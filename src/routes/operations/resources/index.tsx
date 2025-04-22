import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Input, 
  Modal, 
  Form, 
  Select, 
  InputNumber, 
  Divider,
  Tabs,
  Typography,
  Progress,
  DatePicker,
  notification,
  Tooltip,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  SearchOutlined,
  ApartmentOutlined,
  CalendarOutlined,
  TeamOutlined,
  DashboardOutlined,
  AuditOutlined,
  FileSearchOutlined
} from '@ant-design/icons';
import { collection, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

// Define types
interface ResourceItem {
  id: string;
  name: string;
  type: string;
  capacity: number;
  available: number;
  status: string;
  allocations: Allocation[];
  description: string;
  location?: string;
  maintainer?: string;
}

interface Allocation {
  id: string;
  resourceId: string;
  allocatedTo: string;
  purpose: string;
  startTime: any;
  endTime: any;
  quantity: number;
  status: string;
}

const OperationsResourceManagement: React.FC = () => {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [isResourceModalVisible, setIsResourceModalVisible] = useState(false);
  const [isAllocationModalVisible, setIsAllocationModalVisible] = useState(false);
  const [currentResource, setCurrentResource] = useState<ResourceItem | null>(null);
  const [currentAllocation, setCurrentAllocation] = useState<Allocation | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  const [resourceForm] = Form.useForm();
  const [allocationForm] = Form.useForm();

  // Sample resource categories
  const resourceTypes = [
    { value: 'space', label: 'Space' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'mentorship', label: 'Mentorship' },
    { value: 'funding', label: 'Funding' },
    { value: 'software', label: 'Software' },
    { value: 'service', label: 'Service' },
  ];

  // Resource statuses
  const resourceStatuses = [
    { value: 'available', label: 'Available', color: 'green' },
    { value: 'limited', label: 'Limited Availability', color: 'orange' },
    { value: 'unavailable', label: 'Unavailable', color: 'red' },
    { value: 'maintenance', label: 'Under Maintenance', color: 'grey' },
  ];

  // Allocation statuses
  const allocationStatuses = [
    { value: 'scheduled', label: 'Scheduled', color: 'blue' },
    { value: 'active', label: 'Active', color: 'green' },
    { value: 'completed', label: 'Completed', color: 'grey' },
    { value: 'cancelled', label: 'Cancelled', color: 'red' },
  ];

  useEffect(() => {
    fetchResources();
    fetchAllocations();
  }, []);

  // Fetch resources
  const fetchResources = async () => {
    setLoading(true);
    try {
      // Sample data for demonstration
      const sampleResources: ResourceItem[] = [
        {
          id: '1',
          name: 'Conference Room A',
          type: 'space',
          capacity: 30,
          available: 25,
          status: 'available',
          description: 'Large conference room with projector and whiteboard',
          location: 'Building 2, Floor 3',
          maintainer: 'Facilities Team',
          allocations: []
        },
        {
          id: '2',
          name: 'Workshop Space',
          type: 'space',
          capacity: 50,
          available: 20,
          status: 'limited',
          description: 'Open floor workshop area with tables and equipment storage',
          location: 'Building 1, Floor 1',
          maintainer: 'Facilities Team',
          allocations: []
        },
        {
          id: '3',
          name: 'Mentorship Hours',
          type: 'mentorship',
          capacity: 100,
          available: 45,
          status: 'available',
          description: 'Expert mentors available for consultation',
          allocations: []
        },
        {
          id: '4',
          name: '3D Printers',
          type: 'equipment',
          capacity: 5,
          available: 2,
          status: 'limited',
          description: 'Industrial grade 3D printers for prototyping',
          location: 'Building 1, Makerspace',
          maintainer: 'Tech Team',
          allocations: []
        },
        {
          id: '5',
          name: 'Cloud Computing Credits',
          type: 'software',
          capacity: 10000,
          available: 6000,
          status: 'available',
          description: 'AWS credits for incubatee projects',
          allocations: []
        },
      ];
      
      setResources(sampleResources);
    } catch (error) {
      console.error('Error fetching resources:', error);
      notification.error({
        message: 'Error',
        description: 'Failed to fetch resources. Please try again later.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch allocations
  const fetchAllocations = async () => {
    try {
      // Sample data for allocations
      const sampleAllocations: Allocation[] = [
        {
          id: '1',
          resourceId: '1',
          allocatedTo: 'TechSolutions Inc.',
          purpose: 'Weekly Team Meeting',
          startTime: Timestamp.fromDate(new Date('2023-11-05T14:00:00')),
          endTime: Timestamp.fromDate(new Date('2023-11-05T16:00:00')),
          quantity: 10,
          status: 'scheduled',
        },
        {
          id: '2',
          resourceId: '2',
          allocatedTo: 'Startup Cohort 5',
          purpose: 'Prototyping Workshop',
          startTime: Timestamp.fromDate(new Date('2023-11-10T09:00:00')),
          endTime: Timestamp.fromDate(new Date('2023-11-10T17:00:00')),
          quantity: 30,
          status: 'scheduled',
        },
        {
          id: '3',
          resourceId: '3',
          allocatedTo: 'HealthTech Innovations',
          purpose: 'Business Strategy Mentoring',
          startTime: Timestamp.fromDate(new Date('2023-11-07T10:00:00')),
          endTime: Timestamp.fromDate(new Date('2023-11-07T12:00:00')),
          quantity: 2,
          status: 'scheduled',
        },
        {
          id: '4',
          resourceId: '4',
          allocatedTo: 'GreenEnergy Startup',
          purpose: 'Product Prototype Development',
          startTime: Timestamp.fromDate(new Date('2023-11-01T09:00:00')),
          endTime: Timestamp.fromDate(new Date('2023-11-15T17:00:00')),
          quantity: 1,
          status: 'active',
        },
        {
          id: '5',
          resourceId: '5',
          allocatedTo: 'EdTech Solutions',
          purpose: 'Platform Development',
          startTime: Timestamp.fromDate(new Date('2023-10-15T00:00:00')),
          endTime: Timestamp.fromDate(new Date('2023-12-15T23:59:59')),
          quantity: 2000,
          status: 'active',
        },
      ];
      
      setAllocations(sampleAllocations);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
  };

  // Handle search
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  // Resource modal functions
  const showResourceModal = (record?: ResourceItem) => {
    if (record) {
      setCurrentResource(record);
      resourceForm.setFieldsValue({
        name: record.name,
        type: record.type,
        capacity: record.capacity,
        status: record.status,
        description: record.description,
        location: record.location,
        maintainer: record.maintainer,
      });
    } else {
      setCurrentResource(null);
      resourceForm.resetFields();
    }
    setIsResourceModalVisible(true);
  };

  const handleResourceCancel = () => {
    setIsResourceModalVisible(false);
    resourceForm.resetFields();
  };

  const handleResourceSubmit = () => {
    resourceForm.validateFields().then(async (values) => {
      try {
        // In a real implementation, this would save to Firestore
        notification.success({
          message: 'Success',
          description: currentResource ? 'Resource updated successfully' : 'Resource created successfully',
        });
        
        setIsResourceModalVisible(false);
        resourceForm.resetFields();
        fetchResources(); // Refresh the resources list
      } catch (error) {
        console.error('Error saving resource:', error);
        notification.error({
          message: 'Error',
          description: 'Failed to save resource. Please try again later.',
        });
      }
    });
  };

  // Allocation modal functions
  const showAllocationModal = (resourceId?: string, allocation?: Allocation) => {
    if (allocation) {
      setCurrentAllocation(allocation);
      allocationForm.setFieldsValue({
        resourceId: allocation.resourceId,
        allocatedTo: allocation.allocatedTo,
        purpose: allocation.purpose,
        dateRange: [dayjs(allocation.startTime.seconds * 1000), dayjs(allocation.endTime.seconds * 1000)],
        quantity: allocation.quantity,
        status: allocation.status,
      });
    } else {
      setCurrentAllocation(null);
      allocationForm.resetFields();
      if (resourceId) {
        allocationForm.setFieldsValue({
          resourceId: resourceId,
        });
      }
    }
    setIsAllocationModalVisible(true);
  };

  const handleAllocationCancel = () => {
    setIsAllocationModalVisible(false);
    allocationForm.resetFields();
  };

  const handleAllocationSubmit = () => {
    allocationForm.validateFields().then(async (values) => {
      try {
        // In a real implementation, this would save to Firestore
        notification.success({
          message: 'Success',
          description: currentAllocation ? 'Allocation updated successfully' : 'Allocation created successfully',
        });
        
        setIsAllocationModalVisible(false);
        allocationForm.resetFields();
        fetchAllocations(); // Refresh the allocations list
      } catch (error) {
        console.error('Error saving allocation:', error);
        notification.error({
          message: 'Error',
          description: 'Failed to save allocation. Please try again later.',
        });
      }
    });
  };

  // Handle delete resource
  const handleDeleteResource = (record: ResourceItem) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this resource?',
      content: 'This action cannot be undone. All allocations for this resource will also be deleted.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // In a real implementation, this would delete from Firestore
          notification.success({
            message: 'Success',
            description: 'Resource deleted successfully',
          });
          fetchResources(); // Refresh the resources list
        } catch (error) {
          console.error('Error deleting resource:', error);
          notification.error({
            message: 'Error',
            description: 'Failed to delete resource. Please try again later.',
          });
        }
      },
    });
  };

  // Handle delete allocation
  const handleDeleteAllocation = (record: Allocation) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this allocation?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // In a real implementation, this would delete from Firestore
          notification.success({
            message: 'Success',
            description: 'Allocation deleted successfully',
          });
          fetchAllocations(); // Refresh the allocations list
        } catch (error) {
          console.error('Error deleting allocation:', error);
          notification.error({
            message: 'Error',
            description: 'Failed to delete allocation. Please try again later.',
          });
        }
      },
    });
  };

  // Filter resources based on search
  const getFilteredResources = () => {
    if (!searchText) return resources;
    
    return resources.filter(
      resource => 
        resource.name.toLowerCase().includes(searchText.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchText.toLowerCase()) ||
        resource.type.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  // Filter allocations
  const getFilteredAllocations = () => {
    if (!searchText) return allocations;
    
    return allocations.filter(
      allocation => 
        allocation.allocatedTo.toLowerCase().includes(searchText.toLowerCase()) ||
        allocation.purpose.toLowerCase().includes(searchText.toLowerCase()) ||
        resources.find(r => r.id === allocation.resourceId)?.name.toLowerCase().includes(searchText.toLowerCase())
    );
  };

  // Resource columns
  const resourceColumns = [
    {
      title: 'Resource Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ResourceItem) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {resourceTypes.find(type => type.value === record.type)?.label}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Capacity',
      dataIndex: 'capacity',
      key: 'capacity',
    },
    {
      title: 'Availability',
      key: 'availability',
      render: (text: string, record: ResourceItem) => (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Progress 
            percent={Math.round((record.available / record.capacity) * 100)} 
            size="small" 
            status={record.available / record.capacity < 0.2 ? 'exception' : 'normal'}
            format={() => `${record.available}/${record.capacity}`}
          />
        </Space>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = resourceStatuses.find(s => s.value === status);
        return (
          <Tag color={statusInfo?.color || 'default'}>
            {statusInfo?.label || status}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: ResourceItem) => (
        <Space size="small">
          <Tooltip title="Edit Resource">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => showResourceModal(record)} 
            />
          </Tooltip>
          <Tooltip title="Allocate">
            <Button 
              type="text" 
              icon={<TeamOutlined />} 
              onClick={() => showAllocationModal(record.id)} 
              disabled={record.status === 'unavailable' || record.status === 'maintenance'}
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button 
              type="text" 
              danger
              icon={<DeleteOutlined />} 
              onClick={() => handleDeleteResource(record)} 
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Allocation columns
  const allocationColumns = [
    {
      title: 'Resource',
      key: 'resource',
      render: (_: any, record: Allocation) => {
        const resource = resources.find(r => r.id === record.resourceId);
        return resource ? resource.name : 'Unknown';
      },
    },
    {
      title: 'Allocated To',
      dataIndex: 'allocatedTo',
      key: 'allocatedTo',
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      ellipsis: true,
    },
    {
      title: 'Date/Time',
      key: 'datetime',
      render: (_: any, record: Allocation) => {
        const startDate = new Date(record.startTime.seconds * 1000);
        const endDate = new Date(record.endTime.seconds * 1000);
        
        const formatDate = (date: Date) => {
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        };
        
        return (
          <Space direction="vertical" size={0}>
            <Text>Start: {formatDate(startDate)}</Text>
            <Text>End: {formatDate(endDate)}</Text>
          </Space>
        );
      },
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusInfo = allocationStatuses.find(s => s.value === status);
        return (
          <Tag color={statusInfo?.color || 'default'}>
            {statusInfo?.label || status}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Allocation) => (
        <Space size="small">
          <Tooltip title="Edit Allocation">
            <Button 
              type="text" 
              icon={<EditOutlined />} 
              onClick={() => showAllocationModal(undefined, record)} 
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button 
              type="text" 
              danger
              icon={<DeleteOutlined />} 
              onClick={() => handleDeleteAllocation(record)} 
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Stats for dashboard
  const getTotalCapacity = () => {
    return resources.reduce((sum, resource) => sum + resource.capacity, 0);
  };

  const getTotalAvailable = () => {
    return resources.reduce((sum, resource) => sum + resource.available, 0);
  };

  const getUtilizationPercentage = () => {
    const total = getTotalCapacity();
    const available = getTotalAvailable();
    return total > 0 ? Math.round(((total - available) / total) * 100) : 0;
  };

  const getUpcomingAllocations = () => {
    const now = new Date();
    return allocations.filter(
      allocation => new Date(allocation.startTime.seconds * 1000) > now && allocation.status === 'scheduled'
    ).length;
  };

  return (
    <div style={{ padding: '20px' }}>
      <Title level={2}>
        <ApartmentOutlined /> Resource Management
      </Title>
      <Text type="secondary">
        Manage and allocate resources for incubation program operations
      </Text>
      
      <Divider />

      {/* Resource Overview Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Resource Types" 
              value={resources.reduce((acc, curr) => {
                if (!acc.includes(curr.type)) acc.push(curr.type);
                return acc;
              }, [] as string[]).length} 
              prefix={<DashboardOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Overall Utilization" 
              value={getUtilizationPercentage()} 
              suffix="%" 
              prefix={<AuditOutlined />}
              valueStyle={{ color: getUtilizationPercentage() > 80 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Active Allocations" 
              value={allocations.filter(a => a.status === 'active').length} 
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic 
              title="Upcoming Allocations" 
              value={getUpcomingAllocations()} 
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane 
            tab={
              <span>
                <ApartmentOutlined />
                Resources
              </span>
            }
            key="1"
          >
            <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Input
                placeholder="Search resources..."
                prefix={<SearchOutlined />}
                allowClear
                onChange={e => handleSearch(e.target.value)}
                style={{ width: 250 }}
              />
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => showResourceModal()}
              >
                Add Resource
              </Button>
            </Space>
            
            <Table
              dataSource={getFilteredResources()}
              columns={resourceColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              expandable={{
                expandedRowRender: record => (
                  <p style={{ margin: 0 }}>
                    <strong>Description:</strong> {record.description}
                    {record.location && <><br /><strong>Location:</strong> {record.location}</>}
                    {record.maintainer && <><br /><strong>Maintainer:</strong> {record.maintainer}</>}
                  </p>
                ),
              }}
            />
          </TabPane>
          
          <TabPane 
            tab={
              <span>
                <CalendarOutlined />
                Allocations
              </span>
            }
            key="2"
          >
            <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <Input
                placeholder="Search allocations..."
                prefix={<SearchOutlined />}
                allowClear
                onChange={e => handleSearch(e.target.value)}
                style={{ width: 250 }}
              />
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={() => showAllocationModal()}
              >
                Create Allocation
              </Button>
            </Space>
            
            <Table
              dataSource={getFilteredAllocations()}
              columns={allocationColumns}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      </Card>
      
      {/* Resource Modal */}
      <Modal
        title={currentResource ? "Edit Resource" : "Add New Resource"}
        open={isResourceModalVisible}
        onCancel={handleResourceCancel}
        onOk={handleResourceSubmit}
        width={600}
      >
        <Form form={resourceForm} layout="vertical">
          <Form.Item
            name="name"
            label="Resource Name"
            rules={[{ required: true, message: 'Please enter a resource name' }]}
          >
            <Input placeholder="Enter resource name" />
          </Form.Item>
          
          <Form.Item
            name="type"
            label="Resource Type"
            rules={[{ required: true, message: 'Please select a resource type' }]}
          >
            <Select placeholder="Select resource type">
              {resourceTypes.map(type => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="capacity"
            label="Total Capacity"
            rules={[{ required: true, message: 'Please enter the total capacity' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter total capacity" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please enter a description' }]}
          >
            <Input.TextArea rows={3} placeholder="Enter resource description" />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
            initialValue="available"
          >
            <Select placeholder="Select status">
              {resourceStatuses.map(status => (
                <Option key={status.value} value={status.value}>{status.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="location" label="Location">
            <Input placeholder="Enter location (optional)" />
          </Form.Item>
          
          <Form.Item name="maintainer" label="Maintainer">
            <Input placeholder="Enter maintainer (optional)" />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* Allocation Modal */}
      <Modal
        title={currentAllocation ? "Edit Allocation" : "Create New Allocation"}
        open={isAllocationModalVisible}
        onCancel={handleAllocationCancel}
        onOk={handleAllocationSubmit}
        width={600}
      >
        <Form form={allocationForm} layout="vertical">
          <Form.Item
            name="resourceId"
            label="Resource"
            rules={[{ required: true, message: 'Please select a resource' }]}
          >
            <Select placeholder="Select resource">
              {resources.map(resource => (
                <Option key={resource.id} value={resource.id}>{resource.name}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="allocatedTo"
            label="Allocated To"
            rules={[{ required: true, message: 'Please enter who this resource is allocated to' }]}
          >
            <Input placeholder="Enter recipient (company, team, etc.)" />
          </Form.Item>
          
          <Form.Item
            name="purpose"
            label="Purpose"
            rules={[{ required: true, message: 'Please enter the purpose of this allocation' }]}
          >
            <Input.TextArea rows={2} placeholder="Enter purpose of allocation" />
          </Form.Item>
          
          <Form.Item
            name="dateRange"
            label="Date & Time Range"
            rules={[{ required: true, message: 'Please select the date and time range' }]}
          >
            <RangePicker 
              showTime 
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }} 
            />
          </Form.Item>
          
          <Form.Item
            name="quantity"
            label="Quantity"
            rules={[{ required: true, message: 'Please enter the quantity to allocate' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Enter quantity" />
          </Form.Item>
          
          <Form.Item
            name="status"
            label="Status"
            rules={[{ required: true, message: 'Please select a status' }]}
            initialValue="scheduled"
          >
            <Select placeholder="Select status">
              {allocationStatuses.map(status => (
                <Option key={status.value} value={status.value}>{status.label}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OperationsResourceManagement; 
