// DocumentHub.tsx
import React from "react";
import { Form, Upload, Button, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";

export const DocumentHub = () => {
  const [form] = Form.useForm();

  const onFinish = (values: any) => {
    console.log("Document Upload:", values);
    message.success("Document uploaded successfully");
  };

  return (
    <Form layout="vertical" form={form} onFinish={onFinish}>
      <Form.Item name="document" label="Upload Document" valuePropName="fileList" getValueFromEvent={(e) => e.fileList} rules={[{ required: true, message: 'Please upload a document' }]}> <Upload beforeUpload={() => false} multiple={false}> <Button icon={<UploadOutlined />}>Select File</Button> </Upload> </Form.Item>
      <Form.Item> <Button type="primary" htmlType="submit">Upload</Button> </Form.Item>
    </Form>
  );
};
