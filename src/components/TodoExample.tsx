import React, { useState } from 'react';
import { 
  Card, 
  Tabs, 
  Space, 
  Typography, 
  Radio, 
  Switch, 
  Divider,
  Row,
  Col
} from 'antd';
import Todo, { TodoItem } from './Todo';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

export const TodoExample: React.FC = () => {
  // Sample data
  const [basicItems, setBasicItems] = useState<TodoItem[]>([
    { id: '1', text: 'Create project plan', isCompleted: true },
    { id: '2', text: 'Design component architecture', isCompleted: false },
    { id: '3', text: 'Implement core functionality', isCompleted: false },
    { id: '4', text: 'Write unit tests', isCompleted: false },
    { id: '5', text: 'Document API', isCompleted: false },
  ]);

  const [categorizedItems, setCategorizedItems] = useState<TodoItem[]>([
    { id: '1', text: 'Review financial statements', isCompleted: true, category: 'Financial' },
    { id: '2', text: 'Verify cash flow projections', isCompleted: false, category: 'Financial' },
    { id: '3', text: 'Check for legal disputes', isCompleted: false, category: 'Legal' },
    { id: '4', text: 'Verify IP ownership', isCompleted: true, category: 'Legal' },
    { id: '5', text: 'Analyze market size', isCompleted: false, category: 'Market' },
    { id: '6', text: 'Identify key competitors', isCompleted: false, category: 'Market' },
    { id: '7', text: 'Assess founding team', isCompleted: true, category: 'Team' },
  ]);

  const [customizedItems, setCustomizedItems] = useState<TodoItem[]>([
    { 
      id: '1', 
      text: 'Prepare quarterly report', 
      isCompleted: false, 
      priority: 'High',
      dueDate: '2023-12-31',
      notes: 'Include financial projections and growth metrics'
    },
    { 
      id: '2', 
      text: 'Schedule team meeting', 
      isCompleted: true, 
      priority: 'Medium',
      dueDate: '2023-12-15'
    },
    { 
      id: '3', 
      text: 'Review marketing materials', 
      isCompleted: false, 
      priority: 'Low',
      dueDate: '2024-01-10'
    },
  ]);

  // Configuration options for the customizable example
  const [showCategories, setShowCategories] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [allowAddItem, setAllowAddItem] = useState(true);
  const [allowDeleteItem, setAllowDeleteItem] = useState(true);
  const [allowEditItem, setAllowEditItem] = useState(true);
  const [allowAddNotes, setAllowAddNotes] = useState(true);

  const categories = ['Project', 'Meeting', 'Personal', 'Research'];
  const [configItems, setConfigItems] = useState<TodoItem[]>([
    { id: '1', text: 'Configure application settings', isCompleted: false, category: 'Project' },
    { id: '2', text: 'Review sprint backlog', isCompleted: true, category: 'Meeting' },
  ]);

  return (
    <Card title={<Title level={3}>Todo Component Examples</Title>}>
      <Paragraph>
        These examples showcase the flexibility of the Todo component and how it can be used in different scenarios.
      </Paragraph>
      
      <Tabs defaultActiveKey="1">
        <TabPane tab="Basic Todo List" key="1">
          <Paragraph>
            A simple todo list with checkboxes and the ability to add, edit, and delete items.
          </Paragraph>
          <Todo
            title="Project Tasks"
            description="Track your project tasks and progress"
            items={basicItems}
            onChange={setBasicItems}
          />
        </TabPane>
        
        <TabPane tab="Categorized Todo List" key="2">
          <Paragraph>
            Todo items organized by categories, ideal for complex checklists with multiple sections.
          </Paragraph>
          <Todo
            title="Due Diligence Checklist"
            description="Comprehensive checklist for investment due diligence"
            items={categorizedItems}
            categories={['Financial', 'Legal', 'Market', 'Team']}
            showCategories={true}
            onChange={setCategorizedItems}
          />
        </TabPane>
        
        <TabPane tab="Advanced Features" key="3">
          <Paragraph>
            Todo list with additional features like priority levels, due dates, and notes.
          </Paragraph>
          <Todo
            title="Task Management"
            description="Manage tasks with priorities and due dates"
            items={customizedItems}
            onChange={setCustomizedItems}
          />
        </TabPane>
        
        <TabPane tab="Customizable" key="4">
          <Row gutter={[24, 16]}>
            <Col span={8}>
              <Card title="Configuration Options">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Switch 
                      checked={showCategories} 
                      onChange={setShowCategories} 
                    /> Show Categories
                  </div>
                  <div>
                    <Switch 
                      checked={showProgress} 
                      onChange={setShowProgress} 
                    /> Show Progress
                  </div>
                  <div>
                    <Switch 
                      checked={allowAddItem} 
                      onChange={setAllowAddItem} 
                    /> Allow Adding Items
                  </div>
                  <div>
                    <Switch 
                      checked={allowDeleteItem} 
                      onChange={setAllowDeleteItem} 
                    /> Allow Deleting Items
                  </div>
                  <div>
                    <Switch 
                      checked={allowEditItem} 
                      onChange={setAllowEditItem}
                    /> Allow Editing Items
                  </div>
                  <div>
                    <Switch 
                      checked={allowAddNotes} 
                      onChange={setAllowAddNotes}
                    /> Allow Adding Notes
                  </div>
                </Space>
              </Card>
            </Col>
            <Col span={16}>
              <Todo
                title="Configurable Todo List"
                description="Adjust options to see how the component behaves"
                items={configItems}
                categories={categories}
                showCategories={showCategories}
                showProgress={showProgress}
                allowAddItem={allowAddItem}
                allowDeleteItem={allowDeleteItem}
                allowEditItem={allowEditItem}
                allowAddNotes={allowAddNotes}
                onChange={setConfigItems}
              />
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </Card>
  );
};

export default TodoExample; 