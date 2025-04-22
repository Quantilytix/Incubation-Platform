// ProjectSubmission.tsx
import React from "react";
import { Form, Input, Button } from "antd";

export const ProjectSubmission = () => {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log("Project Submitted:", values);
  };

  return (
    <Form layout="vertical" form={form} onFinish={onFinish}>
      <Form.Item name="title" label="Project Title" rules={[{ required: true }]}> <Input /> </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: true }]}> <Input.TextArea rows={4} /> </Form.Item>
      <Form.Item> <Button type="primary" htmlType="submit">Submit Project</Button> </Form.Item>
    </Form>
  );
};
