import React from "react";
import { Form, Input, Button, Card, Typography } from "antd";

const { Title } = Typography;

export const AuditTools: React.FC = () => {
  const onFinish = (values: any) => {
    console.log("Audit Log Submitted:", values);
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Audit Tools</Title>
      <Card>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="sme" label="SME Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="findings" label="Audit Findings" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Submit Audit
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
