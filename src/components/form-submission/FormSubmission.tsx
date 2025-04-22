import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  Switch, 
  Typography, 
  Space, 
  Divider, 
  message, 
  Upload,
  DatePicker, 
  Checkbox,
  Radio,
  Alert,
  Steps,
  Result
} from 'antd';
import { 
  UploadOutlined,
  SaveOutlined,
  SendOutlined,
  LoadingOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { doc, getDoc, collection, addDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/firebase';
import { useGetIdentity } from "@refinedev/core";
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { Step } = Steps;
const { TextArea } = Input;

interface FormField {
  id: string;
  type: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  description?: string;
  defaultValue?: any;
}

interface FormTemplate {
  id?: string;
  title: string;
  description: string;
  fields: FormField[];
  status: 'draft' | 'published';
  category: string;
}

interface UserIdentity {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
}

export const FormSubmission: React.FC = () => {
  const [form] = Form.useForm();
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { data: user } = useGetIdentity<UserIdentity>();
  
  const [formTemplate, setFormTemplate] = useState<FormTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fileUploads, setFileUploads] = useState<Record<string, any>>({});
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [formFieldsByStep, setFormFieldsByStep] = useState<FormField[][]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  
  // Fetch form template
  useEffect(() => {
    fetchFormTemplate();
  }, [formId]);

  // Organize fields into steps
  useEffect(() => {
    if (formTemplate) {
      organizeFieldsIntoSteps();
    }
  }, [formTemplate]);

  const fetchFormTemplate = async () => {
    if (!formId) {
      message.error('No form ID provided');
      navigate('/forms');
      return;
    }
    
    try {
      setLoading(true);
      const docRef = doc(db, 'formTemplates', formId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as FormTemplate;
        if (data.status !== 'published') {
          message.error('This form is not available for submission');
          navigate('/forms');
          return;
        }
        
        setFormTemplate({
          ...data,
          id: formId
        });
      } else {
        message.error('Form not found');
        navigate('/forms');
      }
    } catch (error) {
      console.error('Error fetching form template:', error);
      message.error('Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  // Group form fields by headings to create steps
  const organizeFieldsIntoSteps = () => {
    if (!formTemplate) return;
    
    const steps: FormField[][] = [];
    let currentStep: FormField[] = [];
    
    formTemplate.fields.forEach((field, index) => {
      // Start a new step if this is a heading (except for the first field)
      if (field.type === 'heading' && index > 0) {
        // Save the current step if it's not empty
        if (currentStep.length > 0) {
          steps.push([...currentStep]);
          currentStep = [];
        }
      }
      
      // Add field to the current step
      currentStep.push(field);
      
      // If this is the last field, add the current step
      if (index === formTemplate.fields.length - 1 && currentStep.length > 0) {
        steps.push([...currentStep]);
      }
    });
    
    // If no headings or only one section, put all fields in one step
    if (steps.length === 0 && currentStep.length > 0) {
      steps.push(currentStep);
    }
    
    setFormFieldsByStep(steps);
  };

  const handleFileUpload = async (fieldId: string, file: File): Promise<string> => {
    try {
      const storageRef = ref(storage, `form_uploads/${formId}/${fieldId}/${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Failed to upload file');
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      // Validate form
      await form.validateFields();
      
      // Get form values
      const values = form.getFieldsValue();
      
      // Process any file uploads
      const processedValues: Record<string, any> = { ...values };
      
      for (const [fieldId, fileList] of Object.entries(fileUploads)) {
        if (fileList && fileList.fileList && fileList.fileList.length > 0) {
          const file = fileList.fileList[0].originFileObj;
          const downloadURL = await handleFileUpload(fieldId, file);
          processedValues[fieldId] = downloadURL;
        }
      }
      
      // Create submission document
      const submissionData = {
        formId: formId,
        formTitle: formTemplate?.title,
        submittedBy: {
          id: user?.id,
          name: user?.name,
          email: user?.email
        },
        submittedAt: new Date().toISOString(),
        responses: processedValues,
        status: 'pending'
      };
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'formResponses'), submissionData);
      
      // Save submission ID
      setSubmissionId(docRef.id);
      
      // Show success message
      message.success('Form submitted successfully');
      
      // Reset form
      form.resetFields();
      setFileUploads({});
      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting form:', error);
      message.error('Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (fieldId: string, info: any) => {
    setFileUploads({
      ...fileUploads,
      [fieldId]: info
    });
  };

  const renderField = (field: FormField) => {
    const formItemProps = {
      label: field.label,
      name: field.id,
      key: field.id,
      required: field.required,
      help: field.description,
      tooltip: field.description,
    };
  
    switch (field.type) {
      case 'text':
        return (
          <Form.Item {...formItemProps}>
            <Input 
              placeholder={field.placeholder} 
            />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item {...formItemProps}>
            <TextArea 
              placeholder={field.placeholder} 
              rows={4} 
            />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item {...formItemProps}>
            <Input 
              type="number" 
              placeholder={field.placeholder} 
            />
          </Form.Item>
        );
      case 'email':
        return (
          <Form.Item 
            {...formItemProps}
            rules={[
              { 
                type: 'email', 
                message: 'Please enter a valid email address' 
              }
            ]}
          >
            <Input 
              type="email" 
              placeholder={field.placeholder} 
            />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item {...formItemProps}>
            <Select placeholder={field.placeholder}>
              {field.options?.map((option, idx) => (
                <Option key={idx} value={option}>{option}</Option>
              ))}
            </Select>
          </Form.Item>
        );
      case 'checkbox':
        return (
          <Form.Item {...formItemProps} valuePropName="checked">
            <Checkbox.Group>
              {field.options?.map((option, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Checkbox value={option}>{option}</Checkbox>
                </div>
              ))}
            </Checkbox.Group>
          </Form.Item>
        );
      case 'radio':
        return (
          <Form.Item {...formItemProps}>
            <Radio.Group>
              {field.options?.map((option, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <Radio value={option}>{option}</Radio>
                </div>
              ))}
            </Radio.Group>
          </Form.Item>
        );
      case 'date':
        return (
          <Form.Item {...formItemProps}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'file':
        return (
          <Form.Item {...formItemProps}>
            <Upload 
              listType="text" 
              maxCount={1}
              onChange={(info) => handleFileChange(field.id, info)}
              beforeUpload={() => false} // Prevent auto upload
            >
              <Button icon={<UploadOutlined />}>Upload File</Button>
            </Upload>
          </Form.Item>
        );
      case 'heading':
        return (
          <div style={{ margin: '24px 0' }}>
            <Title level={4}>{field.label}</Title>
            {field.description && (
              <Paragraph type="secondary">{field.description}</Paragraph>
            )}
            <Divider />
          </div>
        );
      default:
        return null;
    }
  };

  const next = () => {
    // Validate current step fields before moving to next
    form
      .validateFields(formFieldsByStep[current].map(field => field.id))
      .then(() => {
        setCurrent(current + 1);
        window.scrollTo(0, 0);
      })
      .catch(errorInfo => {
        console.log('Validation failed:', errorInfo);
      });
  };

  const prev = () => {
    setCurrent(current - 1);
    window.scrollTo(0, 0);
  };

  const renderStepContent = () => {
    if (formFieldsByStep.length === 0 || !formFieldsByStep[current]) {
      return <div>No fields available</div>;
    }
    
    return (
      <div>
        {formFieldsByStep[current].map((field) => renderField(field))}
      </div>
    );
  };

  const steps = formFieldsByStep.map((stepFields, index) => {
    // Find the first heading in each step to use as the title
    const heading = stepFields.find(field => field.type === 'heading');
    return {
      title: heading?.label || `Step ${index + 1}`
    };
  });

  if (loading) {
    return (
      <Card style={{ textAlign: 'center', padding: 48 }}>
        <Space direction="vertical" align="center">
          <LoadingOutlined style={{ fontSize: 32 }} />
          <Text>Loading form...</Text>
        </Space>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card>
        <Result
          status="success"
          title="Form Submitted Successfully!"
          subTitle={
            <div>
              <p>Your submission has been received and is now being processed.</p>
              <p>Submission ID: {submissionId}</p>
            </div>
          }
          extra={[
            <Button 
              type="primary" 
              key="dashboard" 
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>,
            <Button 
              key="another" 
              onClick={() => {
                setSubmitted(false);
                setCurrent(0);
              }}
            >
              Submit Another Response
            </Button>,
          ]}
        />
      </Card>
    );
  }

  if (!formTemplate) {
    return (
      <Card>
        <Alert 
          type="error" 
          message="Error" 
          description="Could not load the requested form. It may have been removed or you don't have permission to access it." 
          showIcon 
        />
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>{formTemplate.title}</Title>
        <Paragraph>{formTemplate.description}</Paragraph>
      </div>
      
      <Steps current={current} style={{ marginBottom: 32 }}>
        {steps.map(item => (
          <Step key={item.title} title={item.title} />
        ))}
      </Steps>
      
      <Form
        form={form}
        layout="vertical"
        requiredMark={true}
      >
        {renderStepContent()}
        
        <Divider />
        
        <Form.Item>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {current > 0 && (
              <Button onClick={prev}>
                Previous
              </Button>
            )}
            <div style={{ marginLeft: 'auto' }}>
              {current < steps.length - 1 && (
                <Button type="primary" onClick={next}>
                  Next
                </Button>
              )}
              {current === steps.length - 1 && (
                <Button 
                  type="primary" 
                  onClick={handleSubmit} 
                  loading={submitting}
                  icon={<SendOutlined />}
                >
                  Submit
                </Button>
              )}
            </div>
          </div>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default FormSubmission; 
