import React, { useState, useEffect } from 'react';
import { 
  Card, 
  List, 
  Checkbox, 
  Input, 
  Button, 
  Space, 
  Typography, 
  Tooltip, 
  Progress, 
  Collapse, 
  Tag,
  Divider,
  Modal,
  Form
} from 'antd';
import { 
  EditOutlined, 
  DeleteOutlined, 
  PlusOutlined, 
  CheckCircleOutlined,
  QuestionCircleOutlined 
} from '@ant-design/icons';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

// Types
export interface TodoItem {
  id: string;
  text: string;
  isCompleted: boolean;
  category?: string;
  notes?: string;
  dueDate?: string;
  priority?: 'High' | 'Medium' | 'Low';
}

export interface TodoProps {
  title?: string;
  description?: string;
  items: TodoItem[];
  categories?: string[];
  showCategories?: boolean;
  showProgress?: boolean;
  allowAddItem?: boolean;
  allowDeleteItem?: boolean;
  allowEditItem?: boolean;
  allowAddNotes?: boolean;
  onChange?: (items: TodoItem[]) => void;
}

export const Todo: React.FC<TodoProps> = ({
  title = 'Todo List',
  description,
  items = [],
  categories = [],
  showCategories = false,
  showProgress = true,
  allowAddItem = true,
  allowDeleteItem = true,
  allowEditItem = true,
  allowAddNotes = true,
  onChange
}) => {
  const [todoItems, setTodoItems] = useState<TodoItem[]>(items);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [newItemCategory, setNewItemCategory] = useState(categories[0] || '');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isNotesModalVisible, setIsNotesModalVisible] = useState(false);
  const [currentNotes, setCurrentNotes] = useState('');
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Update local state when props change
  useEffect(() => {
    setTodoItems(items);
  }, [items]);

  // Calculate progress
  const calculateProgress = () => {
    if (todoItems.length === 0) return 0;
    const completedItems = todoItems.filter(item => item.isCompleted).length;
    return Math.round((completedItems / todoItems.length) * 100);
  };

  // Group items by category
  const getItemsByCategory = () => {
    const result: Record<string, TodoItem[]> = {};
    
    if (showCategories && categories.length > 0) {
      // Initialize categories
      categories.forEach(category => {
        result[category] = [];
      });
      
      // Group items
      todoItems.forEach(item => {
        const category = item.category || 'Uncategorized';
        if (!result[category]) {
          result[category] = [];
        }
        result[category].push(item);
      });
    } else {
      result['All Items'] = todoItems;
    }
    
    return result;
  };

  // Calculate progress by category
  const getCategoryProgress = (categoryItems: TodoItem[]) => {
    if (categoryItems.length === 0) return 0;
    const completedItems = categoryItems.filter(item => item.isCompleted).length;
    return Math.round((completedItems / categoryItems.length) * 100);
  };

  // Handle checkbox change
  const handleItemCheck = (itemId: string, e: CheckboxChangeEvent) => {
    const newItems = todoItems.map(item => {
      if (item.id === itemId) {
        return { ...item, isCompleted: e.target.checked };
      }
      return item;
    });
    
    setTodoItems(newItems);
    onChange?.(newItems);
  };

  // Add new item
  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    
    const newItem: TodoItem = {
      id: `item-${Date.now()}`,
      text: newItemText,
      isCompleted: false,
      category: showCategories ? newItemCategory : undefined
    };
    
    const newItems = [...todoItems, newItem];
    setTodoItems(newItems);
    setNewItemText('');
    onChange?.(newItems);
  };

  // Delete item
  const handleDeleteItem = (itemId: string) => {
    const newItems = todoItems.filter(item => item.id !== itemId);
    setTodoItems(newItems);
    onChange?.(newItems);
  };

  // Start editing item
  const handleStartEdit = (item: TodoItem) => {
    setEditingItemId(item.id);
    setEditText(item.text);
  };

  // Save edited item
  const handleSaveEdit = () => {
    if (!editingItemId || !editText.trim()) {
      setEditingItemId(null);
      return;
    }
    
    const newItems = todoItems.map(item => {
      if (item.id === editingItemId) {
        return { ...item, text: editText };
      }
      return item;
    });
    
    setTodoItems(newItems);
    setEditingItemId(null);
    onChange?.(newItems);
  };

  // Open notes modal
  const openNotesModal = (item: TodoItem) => {
    setCurrentItemId(item.id);
    setCurrentNotes(item.notes || '');
    form.setFieldsValue({ notes: item.notes || '' });
    setIsNotesModalVisible(true);
  };

  // Handle notes modal OK
  const handleNotesModalOk = () => {
    form.validateFields().then(values => {
      if (currentItemId) {
        const notes = values.notes.trim();
        handleAddNotes(currentItemId, notes);
        setIsNotesModalVisible(false);
        form.resetFields();
      }
    });
  };

  // Handle notes modal Cancel
  const handleNotesModalCancel = () => {
    setIsNotesModalVisible(false);
    form.resetFields();
  };

  // Add or update notes
  const handleAddNotes = (itemId: string, notes: string) => {
    const newItems = todoItems.map(item => {
      if (item.id === itemId) {
        return { ...item, notes };
      }
      return item;
    });
    
    setTodoItems(newItems);
    onChange?.(newItems);
  };

  // Render priority tag
  const renderPriorityTag = (priority?: string) => {
    if (!priority) return null;
    
    const color = priority === 'High' ? 'red' : 
                 priority === 'Medium' ? 'orange' : 'green';
    
    return <Tag color={color}>{priority}</Tag>;
  };

  const itemsByCategory = getItemsByCategory();

  return (
    <>
      <Card
        title={
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={4}>{title}</Title>
            {description && <Paragraph>{description}</Paragraph>}
            {showProgress && (
              <Progress 
                percent={calculateProgress()} 
                size="small" 
                status={calculateProgress() === 100 ? 'success' : 'active'}
              />
            )}
          </Space>
        }
      >
        {allowAddItem && (
          <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
            <Input 
              placeholder="New item" 
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onPressEnter={handleAddItem}
            />
            {showCategories && categories.length > 0 && (
              <Space>
                <Text>Category:</Text>
                <select 
                  value={newItemCategory} 
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '2px' }}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </Space>
            )}
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleAddItem}
            >
              Add Item
            </Button>
          </Space>
        )}

        {showCategories ? (
          <Collapse 
            activeKey={activeCategories}
            onChange={(keys) => setActiveCategories(keys as string[])}
          >
            {Object.entries(itemsByCategory).map(([category, categoryItems]) => (
              <Panel 
                header={
                  <Space>
                    <span>{category}</span>
                    {showProgress && (
                      <Progress 
                        percent={getCategoryProgress(categoryItems)} 
                        size="small" 
                        style={{ width: 120 }}
                      />
                    )}
                  </Space>
                } 
                key={category}
              >
                <List
                  itemLayout="horizontal"
                  dataSource={categoryItems}
                  renderItem={item => renderTodoItem(item)}
                />
              </Panel>
            ))}
          </Collapse>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={todoItems}
            renderItem={item => renderTodoItem(item)}
          />
        )}
      </Card>

      {/* Notes Modal */}
      <Modal
        title="Add Notes"
        open={isNotesModalVisible}
        onOk={handleNotesModalOk}
        onCancel={handleNotesModalCancel}
        destroyOnClose={true}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="notes" 
            label="Notes"
            rules={[{ required: false }]}
          >
            <TextArea 
              rows={4} 
              placeholder="Enter notes for this item..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );

  function renderTodoItem(item: TodoItem) {
    return (
      <List.Item
        actions={[
          allowAddNotes && (
            <Tooltip title="Add Notes">
              <Button 
                icon={<EditOutlined />} 
                type="text"
                onClick={() => openNotesModal(item)}
              />
            </Tooltip>
          ),
          allowEditItem && (
            editingItemId === item.id ? (
              <Button 
                type="link" 
                onClick={handleSaveEdit}
              >
                Save
              </Button>
            ) : (
              <Tooltip title="Edit Item">
                <Button 
                  icon={<EditOutlined />} 
                  type="text"
                  onClick={() => handleStartEdit(item)}
                />
              </Tooltip>
            )
          ),
          allowDeleteItem && (
            <Tooltip title="Delete Item">
              <Button 
                icon={<DeleteOutlined />} 
                type="text" 
                danger
                onClick={() => handleDeleteItem(item.id)}
              />
            </Tooltip>
          )
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <Checkbox 
              checked={item.isCompleted}
              onChange={(e) => handleItemCheck(item.id, e)}
            />
          }
          title={
            <Space>
              {editingItemId === item.id ? (
                <Input 
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onPressEnter={handleSaveEdit}
                  onBlur={handleSaveEdit}
                />
              ) : (
                <Text delete={item.isCompleted}>{item.text}</Text>
              )}
              {renderPriorityTag(item.priority)}
              {item.dueDate && (
                <Tag color="blue">{item.dueDate}</Tag>
              )}
            </Space>
          }
          description={item.notes && (
            <Text type="secondary">Notes: {item.notes}</Text>
          )}
        />
      </List.Item>
    );
  }
};

export default Todo; 