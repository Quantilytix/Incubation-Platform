// ProgressReports.tsx
import React from "react";
import { Form, Input, Button } from "antd";

export const ProgressReports = () => {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log("Progress Report:", values);
  };

  return (
    <Form layout="vertical" form={form} onFinish={onFinish}>
      <Form.Item name="milestone" label="Milestone Achieved" rules={[{ required: true }]}> <Input /> </Form.Item>
      <Form.Item name="progress" label="Progress Summary" rules={[{ required: true }]}> <Input.TextArea rows={4} /> </Form.Item>
      <Form.Item> <Button type="primary" htmlType="submit">Submit Report</Button> </Form.Item>
    </Form>
  );
};
