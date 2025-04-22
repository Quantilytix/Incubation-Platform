import React from "react";
import { Card, Typography, Row, Col, Statistic } from "antd";
import {
  LineChartOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";

const { Title } = Typography;

export const FunderAnalytics: React.FC = () => {
  const metrics = [
    {
      icon: <LineChartOutlined style={{ color: "#1890ff" }} />,
      title: "Average Disbursement",
      value: "R75,000",
    },
    {
      icon: <TrophyOutlined style={{ color: "#faad14" }} />,
      title: "Top Performing SME",
      value: "BrightTech",
    },
    {
      icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      title: "Completion Rate",
      value: "92%",
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        Funding & Performance Insights
      </Title>
      <Row gutter={[24, 24]}>
        {metrics.map((metric, index) => (
          <Col xs={24} md={8} key={index}>
            <Card>
              <Statistic
                title={
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {metric.icon}
                    {metric.title}
                  </span>
                }
                value={metric.value}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
