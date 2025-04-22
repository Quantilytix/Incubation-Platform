import React, { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Table, Tag, Typography, Button, Tabs } from "antd";
import {
  DollarOutlined,
  UserOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase";
import { ApprovalQueue } from "./approvals/approvalQueue";

const { Title } = Typography;
const { TabPane } = Tabs;

export const FunderDashboard: React.FC = () => {
  const [smes, setSMEs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSMEs = async () => {
      try {
        const snapshot = await getDocs(collection(db, "smelist"));
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSMEs(data);
      } catch (error) {
        console.warn("Using fallback dummy SMEs due to error:", error);
        setSMEs([
          { id: 1, name: "BrightTech", sector: "ICT", performance: "Good" },
          { id: 2, name: "Green Farms", sector: "Agriculture", performance: "Average" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchSMEs();
  }, []);

  const renderSMETable = () => (
    <Table
      loading={loading}
      dataSource={smes}
      rowKey="id"
      columns={[
        {
          title: "Name",
          dataIndex: "name",
        },
        {
          title: "Sector",
          dataIndex: "sector",
        },
        {
          title: "Performance",
          dataIndex: "performance",
          render: (text) => (
            <Tag color={text === "Good" ? "green" : "orange"}>{text}</Tag>
          ),
        },
        {
          title: "Actions",
          render: (_, record) => (
            <>
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => console.log("View SME", record.id)}
              >
                View
              </Button>
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => console.log("Download Document for", record.id)}
              >
                Download
              </Button>
            </>
          ),
        },
      ]}
    />
  );

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Funder Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total SMEs"
              value={smes.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card>
            <Statistic
              title="Interventions Completed"
              value={12}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>

        <Col span={8}>
          <Card>
            <Statistic
              title="Funds Allocated"
              value={"R1,200,000"}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>

        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey="1">
              <TabPane tab="SMEs" key="1">
                {renderSMETable()}
              </TabPane>
              <TabPane tab="Interventions" key="2">
                <ApprovalQueue />
              </TabPane>
              <TabPane tab="Reports" key="3">
                <p>Reports content coming soon...</p>
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
