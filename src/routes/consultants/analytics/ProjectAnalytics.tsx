import React from "react";
import { Table, Typography } from "antd";

const { Title } = Typography;

export const ProjectAnalytics: React.FC = () => {
  const data = [
    { key: 1, project: "BrightTech CRM", status: "On Track", risk: "Low" },
    { key: 2, project: "Green Farms Expansion", status: "Delayed", risk: "Medium" },
  ];

  const columns = [
    { title: "Project", dataIndex: "project", key: "project" },
    { title: "Status", dataIndex: "status", key: "status" },
    { title: "Risk Level", dataIndex: "risk", key: "risk" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Project Analytics</Title>
      <Table dataSource={data} columns={columns} pagination={false} />
    </div>
  );
};
