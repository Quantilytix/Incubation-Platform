import React from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Upload,
  Tag,
  Statistic,
  List,
  Button,
  FloatButton,
} from "antd";
import {
  UploadOutlined,
  BarChartOutlined,
  RiseOutlined,
  SmileOutlined,
  PlusOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
} from "@ant-design/icons";
import { Area } from "@ant-design/plots";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

export const IncubateeDashboard: React.FC = () => {
  const navigate = useNavigate();

  const notifications = [
    { id: 1, message: "New mentoring session added for Lepharo incubation." },
    { id: 2, message: "Performance benchmark updated for your cohort." },
  ];

  const metrics = [
    {
      title: "Monthly Revenue",
      value: 15000,
      prefix: "R",
      icon: <RiseOutlined />,
    },
    {
      title: "Customer Retention",
      value: 89,
      suffix: "%",
      icon: <SmileOutlined />,
    },
  ];

  const pendingInterventions = [
    { id: 1, title: "Financial Literacy Training", date: "2024-04-01" },
    { id: 2, title: "Product Development Workshop", date: "2024-04-10" },
  ];

  const areaConfig = {
    data: [
      { time: "Jan", value: 8000, state: "Your Sales" },
      { time: "Feb", value: 12000, state: "Your Sales" },
      { time: "Mar", value: 15000, state: "Your Sales" },
      { time: "Jan", value: 7000, state: "Average Sales" },
      { time: "Feb", value: 9000, state: "Average Sales" },
      { time: "Mar", value: 12500, state: "Average Sales" },
    ],
    xField: "time",
    yField: "value",
    seriesField: "state",
    smooth: true,
    areaStyle: () => ({ fillOpacity: 0.5 }),
    color: ["#52C41A", "#F5222D"],
    tooltip: {
      formatter: (datum: any) => ({
        name: datum.state,
        value: `R${datum.value}`,
      }),
    },
  };

  return (
    <div style={{ padding: 24, position: "relative" }}>
      <Title level={3}>Lepharo Incubation Participant Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <>
                <BarChartOutlined /> Incubation Performance Analytics
              </>
            }
          >
            <Area {...areaConfig} height={300} />
          </Card>
        </Col>

        {metrics.map((item, idx) => (
          <Col span={12} key={idx}>
            <Card>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={item.prefix}
                suffix={item.suffix}
                valueStyle={{ color: "#3f8600" }}
                style={{ textAlign: "center" }}
              />
            </Card>
          </Col>
        ))}

        <Col span={16}>
          <Card title="Pending Interventions">
            <List
              itemLayout="horizontal"
              dataSource={pendingInterventions}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button type="primary" key="accept">
                      Accept
                    </Button>,
                    <Button danger key="decline">
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

        <Col span={8}>
          <Card title="Lepharo Notifications">
            {notifications.map((note) => (
              <Tag color="blue" key={note.id} style={{ marginBottom: 8 }}>
                {note.message}
              </Tag>
            ))}
          </Card>

          <Card title="Quick Actions" style={{ marginTop: 16 }}>
            <Button
              icon={<FileTextOutlined />}
              block
              onClick={() => navigate("/incubatee/projects")}
              style={{ marginBottom: 8 }}
            >
              Submit Project
            </Button>
            <Button
              icon={<FolderOpenOutlined />}
              block
              onClick={() => navigate("/incubatee/documents")}
              style={{ marginBottom: 8 }}
            >
              Document Hub
            </Button>
            <Button
              icon={<BarChartOutlined />}
              block
              onClick={() => navigate("/incubatee/reports")}
            >
              View Reports
            </Button>
          </Card>
        </Col>
      </Row>

      <FloatButton
        icon={<PlusOutlined />}
        tooltip={<div>Upload Document</div>}
        onClick={() => console.log("Upload FAB clicked")}
        style={{ right: 24, bottom: 24 }}
      />
    </div>
  );
};
