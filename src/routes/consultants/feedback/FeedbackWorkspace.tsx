import React from "react";
import { List, Card, Typography, Tag } from "antd";

const { Title } = Typography;

export const FeedbackWorkspace: React.FC = () => {
  const feedbacks = [
    { id: 1, sme: "BrightTech", comment: "Needs improvement in branding." },
    { id: 2, sme: "Green Farms", comment: "Consider supply chain adjustments." },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Feedback Workspace</Title>
      <List
        dataSource={feedbacks}
        renderItem={(item) => (
          <Card key={item.id} style={{ marginBottom: 16 }}>
            <b>{item.sme}</b>
            <p>{item.comment}</p>
            <Tag color="processing">Submitted</Tag>
          </Card>
        )}
      />
    </div>
  );
};
