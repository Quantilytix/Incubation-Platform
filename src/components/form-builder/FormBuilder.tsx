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
  Collapse,
  Tooltip,
  Modal,
  Tabs,
  List,
  Tag
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined,
  SaveOutlined,
  FormOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { doc, collection, addDoc, updateDoc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

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
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Field' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Group' },
  { value: 'date', label: 'Date Picker' },
  { value: 'file', label: 'File Upload' },
  { value: 'heading', label: 'Section Heading' }
];

const FORM_CATEGORIES = [
  'Application Form',
  'Compliance Checklist',
  'Progress Report',
  'Feedback Form',
  'Evaluation Form',
  'Due Diligence',
  'Mentorship Request',
  'Resource Request',
  'Other'
];

const generateId = () => Math.random().toString(36).substring(2, 9);

export const FormBuilder: React.FC = () => {
  const [form] = Form.useForm();
  const [previewForm] = Form.useForm();
  const [formData, setFormData] = useState<FormTemplate>({
    title: '',
    description: '',
    fields: [],
    status: 'draft',
    category: 'Application Form',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  
  const [currentFieldId, setCurrentFieldId] = useState<string | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeKey, setActiveKey] = useState<string | string[]>([]);
  const [templateList, setTemplateList] = useState<FormTemplate[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('builder');

  // Add a new field to the form
  const addField = () => {
    const newField: FormField = {
      id: generateId(),
      type: 'text',
      label: 'New Field',
      placeholder: 'Enter text here',
      required: false
    };
    
    setFormData({
      ...formData,
      fields: [...formData.fields, newField]
    });
    
    setCurrentFieldId(newField.id);
    setActiveKey([newField.id]);
  };

  // Update a field in the form
  const updateField = (id: string, updates: Partial<FormField>) => {
    setFormData({
      ...formData,
      fields: formData.fields.map(field => 
        field.id === id ? { ...field, ...updates } : field
      )
    });
  };

  // Remove a field from the form
  const removeField = (id: string) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter(field => field.id !== id)
    });
    
    if (currentFieldId === id) {
      setCurrentFieldId(null);
    }
  };

  // Handle form field type change
  const handleFieldTypeChange = (id: string, type: string) => {
    const updates: Partial<FormField> = { type };
    
    // Add default options if the field type requires them
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      updates.options = ['Option 1', 'Option 2', 'Option 3'];
    }
    
    updateField(id, updates);
  };

  // Move a field up or down in the form
  const moveField = (id: string, direction: 'up' | 'down') => {
    const fields = [...formData.fields];
    const index = fields.findIndex(field => field.id === id);
    
    if (direction === 'up' && index > 0) {
      [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
    } else if (direction === 'down' && index < fields.length - 1) {
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
    }
    
    setFormData({
      ...formData,
      fields
    });
  };

  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const fields = [...formData.fields];
    const [removed] = fields.splice(result.source.index, 1);
    fields.splice(result.destination.index, 0, removed);
    
    setFormData({
      ...formData,
      fields
    });
  };

  // Save the form template
  const saveTemplate = async () => {
    try {
      setSavingTemplate(true);
      
      if (!formData.title.trim()) {
        message.error('Please give your form a title');
        setSavingTemplate(false);
        return;
      }
      
      if (formData.fields.length === 0) {
        message.error('Your form must have at least one field');
        setSavingTemplate(false);
        return;
      }
      
      const updatedFormData = {
        ...formData,
        updatedAt: new Date().toISOString()
      };
      
      // If we're editing an existing template
      if (editingTemplateId) {
        await updateDoc(doc(db, 'formTemplates', editingTemplateId), updatedFormData);
        message.success('Form template updated successfully');
      } else {
        // Creating a new template
        const docRef = await addDoc(collection(db, 'formTemplates'), updatedFormData);
        setEditingTemplateId(docRef.id);
        message.success('Form template saved successfully');
      }
      
      // Refresh template list
      fetchTemplates();
    } catch (error) {
      console.error('Error saving form template:', error);
      message.error('Failed to save form template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Publish the form
  const publishForm = async () => {
    try {
      setSavingTemplate(true);
      
      if (!formData.title.trim()) {
        message.error('Please give your form a title before publishing');
        setSavingTemplate(false);
        return;
      }
      
      if (formData.fields.length === 0) {
        message.error('Your form must have at least one field');
        setSavingTemplate(false);
        return;
      }
      
      const updatedFormData: FormTemplate = {
        ...formData,
        status: 'published',
        updatedAt: new Date().toISOString()
      };
      
      if (editingTemplateId) {
        await updateDoc(doc(db, 'formTemplates', editingTemplateId), updatedFormData);
      } else {
        const docRef = await addDoc(collection(db, 'formTemplates'), updatedFormData);
        setEditingTemplateId(docRef.id);
      }
      
      setFormData(updatedFormData);
      message.success('Form published successfully');
      
      // Refresh template list
      fetchTemplates();
    } catch (error) {
      console.error('Error publishing form:', error);
      message.error('Failed to publish form');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Fetch templates from Firestore
  const fetchTemplates = async () => {
    try {
      setTemplateLoading(true);
      const templatesCollection = collection(db, 'formTemplates');
      const querySnapshot = await getDocs(templatesCollection);
      const templates: FormTemplate[] = [];
      
      querySnapshot.forEach((docSnap) => {
        templates.push({
          id: docSnap.id,
          ...docSnap.data() as FormTemplate
        });
      });
      
      setTemplateList(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      message.error('Failed to load form templates');
    } finally {
      setTemplateLoading(false);
    }
  };

  // Load a template for editing
  const loadTemplate = async (templateId: string) => {
    try {
      setTemplateLoading(true);
      const docRef = doc(db, 'formTemplates', templateId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const templateData = docSnap.data() as FormTemplate;
        setFormData({
          ...templateData,
          id: templateId
        });
        setEditingTemplateId(templateId);
        setActiveTab('builder');
      } else {
        message.error('Template not found');
      }
    } catch (error) {
      console.error('Error loading template:', error);
      message.error('Failed to load template');
    } finally {
      setTemplateLoading(false);
    }
  };

  // Create a new form
  const createNewForm = () => {
    setFormData({
      title: '',
      description: '',
      fields: [],
      status: 'draft',
      category: 'Application Form',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    setEditingTemplateId(null);
    setCurrentFieldId(null);
    setActiveKey([]);
    setActiveTab('builder');
  };

  // Render field configuration panel
  const renderFieldConfig = (field: FormField) => {
    return (
      <div style={{ padding: '16px' }}>
        <Form layout="vertical">
          <Form.Item label="Field Type">
            <Select
              value={field.type}
              onChange={(value) => handleFieldTypeChange(field.id, value)}
            >
              {FIELD_TYPES.map((type) => (
                <Option key={type.value} value={type.value}>{type.label}</Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item label="Label">
            <Input
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
            />
          </Form.Item>
          
          {field.type !== 'heading' && (
            <Form.Item label="Required">
              <Switch
                checked={field.required}
                onChange={(checked) => updateField(field.id, { required: checked })}
              />
            </Form.Item>
          )}
          
          {field.type !== 'heading' && field.type !== 'checkbox' && (
            <Form.Item label="Placeholder Text">
              <Input
                value={field.placeholder}
                onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
              />
            </Form.Item>
          )}
          
          <Form.Item label="Description / Help Text">
            <Input.TextArea
              value={field.description}
              onChange={(e) => updateField(field.id, { description: e.target.value })}
              rows={2}
            />
          </Form.Item>
          
          {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
            <Form.Item label="Options">
              {field.options?.map((option, index) => (
                <div key={index} style={{ display: 'flex', marginBottom: 8 }}>
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...(field.options || [])];
                      newOptions[index] = e.target.value;
                      updateField(field.id, { options: newOptions });
                    }}
                    style={{ marginRight: 8 }}
                  />
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      const newOptions = [...(field.options || [])];
                      newOptions.splice(index, 1);
                      updateField(field.id, { options: newOptions });
                    }}
                  />
                </div>
              ))}
              <Button
                type="dashed"
                onClick={() => {
                  const newOptions = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
                  updateField(field.id, { options: newOptions });
                }}
                block
                icon={<PlusOutlined />}
              >
                Add Option
              </Button>
            </Form.Item>
          )}
        </Form>
      </div>
    );
  };

  // Preview a rendered field
  const renderFieldPreview = (field: FormField) => {
    switch (field.type) {
      case 'text':
        return (
          <Input 
            placeholder={field.placeholder} 
            disabled={isPreviewVisible} 
          />
        );
      case 'textarea':
        return (
          <Input.TextArea 
            placeholder={field.placeholder} 
            rows={4} 
            disabled={isPreviewVisible} 
          />
        );
      case 'number':
        return (
          <Input 
            type="number" 
            placeholder={field.placeholder} 
            disabled={isPreviewVisible} 
          />
        );
      case 'email':
        return (
          <Input 
            type="email" 
            placeholder={field.placeholder} 
            disabled={isPreviewVisible} 
          />
        );
      case 'select':
        return (
          <Select 
            placeholder={field.placeholder} 
            style={{ width: '100%' }} 
            disabled={isPreviewVisible}
          >
            {field.options?.map((option, idx) => (
              <Option key={idx} value={option}>{option}</Option>
            ))}
          </Select>
        );
      case 'checkbox':
        return (
          <div>
            {field.options?.map((option, idx) => (
              <div key={idx}>
                <Switch disabled={isPreviewVisible} /> <span>{option}</span>
              </div>
            ))}
          </div>
        );
      case 'radio':
        return (
          <Select 
            placeholder={field.placeholder} 
            style={{ width: '100%' }} 
            disabled={isPreviewVisible}
          >
            {field.options?.map((option, idx) => (
              <Option key={idx} value={option}>{option}</Option>
            ))}
          </Select>
        );
      case 'date':
        return (
          <Input 
            type="date" 
            disabled={isPreviewVisible} 
          />
        );
      case 'file':
        return (
          <Button disabled={isPreviewVisible} icon={<CopyOutlined />}>
            Upload File
          </Button>
        );
      case 'heading':
        return (
          <Title level={4}>{field.label}</Title>
        );
      default:
        return null;
    }
  };

  // Render the form builder
  const renderBuilder = () => {
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Form layout="vertical">
            <Form.Item label="Form Title" required>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter form title"
              />
            </Form.Item>
            
            <Form.Item label="Description">
              <Input.TextArea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter form description"
                rows={3}
              />
            </Form.Item>
            
            <Form.Item label="Category">
              <Select
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
              >
                {FORM_CATEGORIES.map((category) => (
                  <Option key={category} value={category}>{category}</Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Card>
        
        <Title level={4}>Form Fields</Title>
        <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
          Drag and drop to reorder fields
        </Text>
        
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="form-fields">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
              >
                {formData.fields.length === 0 ? (
                  <Card style={{ textAlign: 'center', padding: 24, marginBottom: 16 }}>
                    <Text type="secondary">No fields added yet. Click "Add Field" to start building your form.</Text>
                  </Card>
                ) : (
                  <Collapse 
                    activeKey={activeKey} 
                    onChange={setActiveKey}
                  >
                    {formData.fields.map((field, index) => (
                      <Draggable key={field.id} draggableId={field.id} index={index}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <Panel
                              key={field.id}
                              header={
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                  <span>
                                    <Text strong>{field.label}</Text>
                                    <Text type="secondary" style={{ marginLeft: 8 }}>
                                      ({FIELD_TYPES.find(t => t.value === field.type)?.label})
                                    </Text>
                                    {field.required && (
                                      <Text type="danger" style={{ marginLeft: 8 }}>*</Text>
                                    )}
                                  </span>
                                  <Space>
                                    <Tooltip title="Move Up">
                                      <Button 
                                        icon={<ArrowUpOutlined />} 
                                        size="small"
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          moveField(field.id, 'up');
                                        }}
                                        disabled={index === 0}
                                      />
                                    </Tooltip>
                                    <Tooltip title="Move Down">
                                      <Button 
                                        icon={<ArrowDownOutlined />} 
                                        size="small"
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          moveField(field.id, 'down');
                                        }}
                                        disabled={index === formData.fields.length - 1}
                                      />
                                    </Tooltip>
                                    <Tooltip title="Delete Field">
                                      <Button 
                                        icon={<DeleteOutlined />} 
                                        danger 
                                        size="small"
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          removeField(field.id);
                                        }}
                                      />
                                    </Tooltip>
                                  </Space>
                                </div>
                              }
                            >
                              <div style={{ display: 'flex', flexDirection: 'row' }}>
                                <div style={{ flex: 1, marginRight: 16 }}>
                                  <Form.Item
                                    label={field.label}
                                    required={field.required}
                                    help={field.description}
                                  >
                                    {renderFieldPreview(field)}
                                  </Form.Item>
                                </div>
                                <div style={{ width: 300 }}>
                                  {renderFieldConfig(field)}
                                </div>
                              </div>
                            </Panel>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </Collapse>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        
        <div style={{ marginTop: 16, marginBottom: 24 }}>
          <Button 
            type="dashed" 
            onClick={addField} 
            block 
            icon={<PlusOutlined />}
          >
            Add Field
          </Button>
        </div>
        
        <Divider />
        
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button 
              onClick={() => setIsPreviewVisible(true)}
              icon={<EyeOutlined />}
            >
              Preview Form
            </Button>
          </Space>
          
          <Space>
            <Button 
              type="primary" 
              onClick={saveTemplate}
              loading={savingTemplate}
              icon={<SaveOutlined />}
            >
              Save as Draft
            </Button>
            <Button 
              type="primary" 
              onClick={publishForm}
              loading={savingTemplate}
            >
              Publish Form
            </Button>
          </Space>
        </div>
        
        <Modal
          title="Form Preview"
          open={isPreviewVisible}
          onCancel={() => setIsPreviewVisible(false)}
          width={800}
          footer={[
            <Button key="back" onClick={() => setIsPreviewVisible(false)}>
              Close
            </Button>,
          ]}
        >
          <Title level={3}>{formData.title}</Title>
          <Text>{formData.description}</Text>
          <Divider />
          
          <Form layout="vertical">
            {formData.fields.map((field) => (
              <Form.Item
                key={field.id}
                label={field.label}
                required={field.required}
                help={field.description}
              >
                {renderFieldPreview(field)}
              </Form.Item>
            ))}
            
            <Form.Item>
              <Button type="primary">Submit</Button>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  };

  // Render the template library
  const renderTemplateLibrary = () => {
    return (
      <div>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4}>Form Templates</Title>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={createNewForm}
          >
            Create New Form
          </Button>
        </div>
        
        <List
          loading={templateLoading}
          itemLayout="horizontal"
          dataSource={templateList}
          renderItem={(template) => (
            <List.Item
              actions={[
                <Button 
                  key="edit" 
                  icon={<EditOutlined />}
                  onClick={() => loadTemplate(template.id!)}
                >
                  Edit
                </Button>,
                <Button 
                  key="preview" 
                  icon={<EyeOutlined />}
                >
                  Preview
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {template.title}
                    <Tag color={template.status === 'published' ? 'green' : 'orange'}>
                      {template.status === 'published' ? 'Published' : 'Draft'}
                    </Tag>
                  </Space>
                }
                description={
                  <div>
                    <div>{template.description}</div>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">Category: {template.category} • Fields: {template.fields.length} • Last updated: {new Date(template.updatedAt).toLocaleDateString()}</Text>
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    );
  };

  // Fetch templates when component mounts
  useEffect(() => {
    fetchTemplates();
  }, []);

  return (
    <div>
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <FormOutlined />
              Form Builder
            </span>
          }
          key="builder"
        >
          {renderBuilder()}
        </TabPane>
        <TabPane
          tab={
            <span>
              <FileTextOutlined />
              Template Library
            </span>
          }
          key="templates"
        >
          {renderTemplateLibrary()}
        </TabPane>
      </Tabs>
    </div>
  );
};

export default FormBuilder;
