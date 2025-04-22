import React from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  List,
  Button,
  Tag,
} from "antd";
import {
  SolutionOutlined,
  BarChartOutlined,
  FileSearchOutlined,
  MessageOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title } = Typography;

export const ConsultantDashboard: React.FC = () => {
  const navigate = useNavigate();

  const feedbackItems = [
    { id: 1, sme: "BrightTech", summary: "Good progress but needs branding support." },
    { id: 2, sme: "Green Farms", summary: "Supply chain issues noted, suggest strategic partner." },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Consultant Workspace</Title>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Feedbacks"
              value={24}
              prefix={<MessageOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card>
            <Statistic
              title="Ongoing Audits"
              value={5}
              prefix={<FileSearchOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card>
            <Statistic
              title="Analysed Projects"
              value={12}
              prefix={<BarChartOutlined />}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Recent Feedback">
            <List
              itemLayout="horizontal"
              dataSource={feedbackItems}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="view"
                      onClick={() => navigate("/consultant/feedback")}
                      type="link"
                    >
                      View
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<b>{item.sme}</b>}
                    description={<Tag color="blue">{item.summary}</Tag>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card title="Quick Actions">
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Button
                  block
                  icon={<MessageOutlined />}
                  onClick={() => navigate("/consultant/feedback")}
                >
                  Feedback Workspace
                </Button>
              </Col>
              <Col span={8}>
                <Button
                  block
                  icon={<BarChartOutlined />}
                  onClick={() => navigate("/consultant/analytics")}
                >
                  Project Analytics
                </Button>
              </Col>
              <Col span={8}>
                <Button
                  block
                  icon={<FileSearchOutlined />}
                  onClick={() => navigate("/consultant/audit")}
                >
                  Audit Tools
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
