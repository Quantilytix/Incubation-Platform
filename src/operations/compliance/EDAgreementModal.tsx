import React, { useState } from 'react';
import { Modal, Form, Select, Input, DatePicker, Button, Space, message } from 'antd';
import EDAgreementTemplate from './EDAgreementTemplate';
import { ComplianceDocument } from './types';
import dayjs from 'dayjs';

const { Option } = Select;

interface EDAgreementModalProps {
  visible: boolean;
  onCancel: () => void;
  participant?: any;
  onSave: (document: ComplianceDocument) => void;
}

const EDAgreementModal: React.FC<EDAgreementModalProps> = ({
  visible,
  onCancel,
  participant,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [previewMode, setPreviewMode] = useState(false);

  const handleSubmit = (values: any) => {
    // Create a new compliance document
    const newDocument: ComplianceDocument = {
      id: `ed-${Date.now()}`,
      participantId: participant?.id || '',
      participantName: participant?.name || '',
      documentType: 'edAgreement',
      documentName: 'Enterprise Development Agreement',
      status: 'valid',
      issueDate: values.issueDate ? values.issueDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      expiryDate: values.expiryDate ? values.expiryDate.format('YYYY-MM-DD') : dayjs().add(1, 'year').format('YYYY-MM-DD'),
      notes: values.notes || 'Standard ED Agreement',
      fileUrl: '#', // This would normally be a URL to the stored PDF
      uploadedBy: 'System',
      uploadedAt: dayjs().format('YYYY-MM-DD'),
      metadata: {
        donorCompany: values.donorCompany,
        donorRegistration: values.donorRegistration,
        donorAddress: values.donorAddress,
        implementerCompany: values.implementerCompany,
        implementerRegistration: values.implementerRegistration, 
        implementerAddress: values.implementerAddress,
        programDuration: values.programDuration,
        supportValue: values.supportValue,
        dateOfSigning: values.dateOfSigning ? values.dateOfSigning.format('DD MMM YYYY') : dayjs().format('DD MMM YYYY'),
      }
    };

    onSave(newDocument);
    message.success('ED Agreement has been created and added to participant documents');
    setPreviewMode(false);
    onCancel();
  };

  const handlePreview = () => {
    form.validateFields()
      .then(values => {
        setPreviewMode(true);
      })
      .catch(info => {
        console.log('Validate Failed:', info);
      });
  };

  const initialValues = {
    donorCompany: 'Rustenburg Chrome Mining',
    donorRegistration: '2001/123456/07',
    donorAddress: '123 Mining Way, Rustenburg, North West',
    beneficiaryCompany: participant?.name || '',
    beneficiaryRegistration: participant?.registrationNumber || '',
    beneficiaryAddress: participant?.address || '',
    implementerCompany: 'Epont',
    implementerRegistration: '2009/876543/07',
    implementerAddress: '789 Main Street, Johannesburg',
    programDuration: '1 year',
    supportValue: 'R70,000 (Seventy thousands rands)',
    dateOfSigning: dayjs(),
    issueDate: dayjs(),
    expiryDate: dayjs().add(1, 'year'),
  };

  return (
    <Modal
      title={previewMode ? "Preview ED Agreement" : "Generate Enterprise Development Agreement"}
      open={visible}
      onCancel={() => {
        setPreviewMode(false);
        onCancel();
      }}
      width={previewMode ? 1000 : 800}
      footer={previewMode ? [
        <Button key="back" onClick={() => setPreviewMode(false)}>
          Back to Form
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          onClick={() => form.submit()}
        >
          Save Agreement
        </Button>
      ] : null}
    >
      {!previewMode ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleSubmit}
        >
          <Form.Item
            name="beneficiaryCompany"
            label="Beneficiary Company"
            rules={[{ required: true, message: 'Please enter beneficiary company name' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="beneficiaryRegistration"
            label="Beneficiary Registration Number"
            rules={[{ required: true, message: 'Please enter beneficiary registration number' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="beneficiaryAddress"
            label="Beneficiary Address"
            rules={[{ required: true, message: 'Please enter beneficiary address' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="donorCompany"
            label="Donor Company"
            rules={[{ required: true, message: 'Please enter donor company name' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="donorRegistration"
            label="Donor Registration Number"
            rules={[{ required: true, message: 'Please enter donor registration number' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="donorAddress"
            label="Donor Address"
            rules={[{ required: true, message: 'Please enter donor address' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="implementerCompany"
            label="Implementer Company"
            rules={[{ required: true, message: 'Please enter implementer company name' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="implementerRegistration"
            label="Implementer Registration Number"
            rules={[{ required: true, message: 'Please enter implementer registration number' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="implementerAddress"
            label="Implementer Address"
            rules={[{ required: true, message: 'Please enter implementer address' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="programDuration"
            label="Program Duration"
            rules={[{ required: true, message: 'Please enter program duration' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="supportValue"
            label="Support Value"
            rules={[{ required: true, message: 'Please enter support value' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item
            name="dateOfSigning"
            label="Date of Signing"
            rules={[{ required: true, message: 'Please select date of signing' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="issueDate"
            label="Issue Date"
            rules={[{ required: true, message: 'Please select issue date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="expiryDate"
            label="Expiry Date"
            rules={[{ required: true, message: 'Please select expiry date' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item
            name="notes"
            label="Notes"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
          
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onCancel}>
                Cancel
              </Button>
              <Button type="primary" onClick={handlePreview}>
                Preview Agreement
              </Button>
            </Space>
          </div>
        </Form>
      ) : (
        <EDAgreementTemplate
          donorCompany={form.getFieldValue('donorCompany')}
          donorRegistration={form.getFieldValue('donorRegistration')}
          donorAddress={form.getFieldValue('donorAddress')}
          beneficiaryCompany={form.getFieldValue('beneficiaryCompany')}
          beneficiaryRegistration={form.getFieldValue('beneficiaryRegistration')}
          beneficiaryAddress={form.getFieldValue('beneficiaryAddress')}
          implementerCompany={form.getFieldValue('implementerCompany')}
          implementerRegistration={form.getFieldValue('implementerRegistration')}
          implementerAddress={form.getFieldValue('implementerAddress')}
          programDuration={form.getFieldValue('programDuration')}
          supportValue={form.getFieldValue('supportValue')}
          dateOfSigning={form.getFieldValue('dateOfSigning')?.format('DD MMM YYYY')}
        />
      )}
    </Modal>
  );
};

export default EDAgreementModal; 