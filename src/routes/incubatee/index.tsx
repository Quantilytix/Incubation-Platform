import React, { useState } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Statistic,
  Tag,
  Button,
  List,
  Modal,
  Input,
  Rate,
} from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  RiseOutlined,
  SmileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  BarChartOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title } = Typography;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];

const revenue = [15000, 18000, 20000, 22000, 21000];
const headPerm = [30, 32, 35, 37, 40];
const headTemp = [10, 12, 15, 14, 13];
const participation = [88, 90, 93, 95, 92];
const productivity = [1.2, 1.3, 1.5, 1.6, 1.7];
const outstandingDocs = [5, 4, 3, 2, 1];
const avgRevenue = [12000, 12500, 13000, 13500, 14000];

// 🔹 Revenue + Workers Mixed Chart
const revenueWorkersChart: Highcharts.Options = {
  chart: { zoomType: 'xy' },
  title: { text: 'Revenue vs Workforce' },
  xAxis: [{ categories: months }],
  yAxis: [
    {
      title: { text: 'Revenue (R)' },
      labels: {
        formatter: function () {
          return 'R' + Number(this.value).toLocaleString();
        },
      },
    },
    {
      title: { text: 'Number of Workers' },
      opposite: true,
    },
  ],
  tooltip: { shared: true },
  series: [
    {
      name: 'Permanent Workers',
      type: 'column',
      data: headPerm,
      yAxis: 1,
    },
    {
      name: 'Temporary Workers',
      type: 'column',
      data: headTemp,
      yAxis: 1,
    },
    {
      name: 'Revenue',
      type: 'spline',
      data: revenue,
      tooltip: { valuePrefix: 'R' },
    },
  ],
};

// 🔹 Total vs Avg Revenue Chart
const totalVsAvgRevenueChart: Highcharts.Options = {
  chart: { type: 'spline' },
  title: { text: 'Total Revenue vs Avg Revenue' },
  xAxis: {
    categories: months,
    title: { text: 'Month' },
  },
  yAxis: {
    title: { text: 'Revenue (R)' },
    labels: {
      formatter: function () {
        return 'R' + Number(this.value).toLocaleString();
      },
    },
  },
  tooltip: { shared: true },
  series: [
    {
      name: 'Total Revenue',
      type: 'spline',
      data: revenue,
      color: '#52c41a',
    },
    {
      name: 'Avg Revenue',
      type: 'spline',
      data: avgRevenue,
      color: '#faad14',
    },
  ],
};

// Sample Notifications Data
const initialNotifications = [
  { id: 1, message: 'New mentoring session added for Smart Incubation.', type: 'info' },
  { id: 2, message: 'Performance benchmark updated for your cohort.', type: 'info' },
  { id: 3, message: 'Intervention completed: Financial Literacy Training.', type: 'action' },
];

// Dummy Pending Interventions Data
const initialPendingInterventions = [
  { id: 1, title: 'Financial Literacy Training', date: '2024-04-01' },
  { id: 2, title: 'Product Development Workshop', date: '2024-04-10' },
  { id: 3, title: 'Market Research Session', date: '2024-04-15' },
];

export const IncubateeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [pendingInterventions, setPendingInterventions] = useState(initialPendingInterventions);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Handlers
  const handleFabClick = () => {
    setIsModalVisible(true);
  };

  const handleNotificationClick = (notification) => {
    if (notification.type === 'action') {
      setSelectedNotification(notification);
    }
  };

  const handleRateAndComment = () => {
    console.log('Rating submitted:', selectedNotification);
    setSelectedNotification(null);
  };

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((note) => (note.id === id ? { ...note, read: true } : note))
    );
  };

  const handleAcceptIntervention = (id) => {
    console.log(`Accepted Intervention ID: ${id}`);
    setPendingInterventions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDeclineIntervention = (id) => {
    console.log(`Declined Intervention ID: ${id}`);
    setPendingInterventions((prev) => prev.filter((item) => item.id !== id));
  };

  const unreadCount = notifications.filter((note) => !note.read).length;

  return (
    <div style={{ padding: 24, position: 'relative' }}>
      <Title level={3}>Incubatee Dashboard</Title>

      {/* KPI Cards */}
      <Row gutter={[24, 24]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Participation Rate"
              value={`${participation[participation.length - 1]}%`}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Outstanding Documents"
              value={outstandingDocs[outstandingDocs.length - 1]}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Productivity Ratio"
              value={productivity[productivity.length - 1]}
              precision={2}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Pending Interventions */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card title="Pending Interventions">
            <List
              itemLayout="horizontal"
              dataSource={pendingInterventions}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      type="primary"
                      key="accept"
                      onClick={() => handleAcceptIntervention(item.id)}
                    >
                      Accept
                    </Button>,
                    <Button
                      danger
                      key="decline"
                      onClick={() => handleDeclineIntervention(item.id)}
                    >
                      Decline
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.title}
                    description={`Scheduled Date: ${item.date}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Notifications Modal */}
        <Modal
          title="Notifications"
          visible={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          footer={null}
        >
          <List
            itemLayout="horizontal"
            dataSource={notifications}
            renderItem={(note) => (
              <List.Item
                onClick={() => handleNotificationClick(note)}
                style={{
                  cursor: 'pointer',
                  backgroundColor: note.read ? '#f0f0f0' : 'white',
                }}
              >
                <List.Item.Meta title={note.message} />
                {!note.read && <Tag color="blue">New</Tag>}
              </List.Item>
            )}
          />
        </Modal>

        {/* Rating and Comment Modal */}
        <Modal
          title="Rate and Comment"
          visible={!!selectedNotification}
          onCancel={() => setSelectedNotification(null)}
          footer={[
            <Button key="submit" type="primary" onClick={handleRateAndComment}>
              Submit
            </Button>,
          ]}
        >
          <p>How would you rate this intervention?</p>
          <Rate />
          <Input.TextArea placeholder="Add a comment..." style={{ marginTop: 16 }} />
        </Modal>
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={revenueWorkersChart} />
          </Card>
        </Col>
        <Col span={24}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={totalVsAvgRevenueChart} />
          </Card>
        </Col>
      </Row>

      {/* Floating Action Button */}
      <Button
        type="primary"
        shape="circle"
        icon={<BellOutlined />}
        size="large"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
        }}
        onClick={handleFabClick}
      >
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              background: 'red',
              borderRadius: '50%',
              color: 'white',
              padding: '2px 6px',
              fontSize: '12px',
            }}
          >
            {unreadCount}
          </span>
        )}
      </Button>
    </div>
  );
};
