import React from 'react';
import { Card, Col, Row, Typography, Statistic } from 'antd';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { TeamOutlined, StarOutlined, SolutionOutlined } from '@ant-design/icons';

const { Title } = Typography;

export const ProjectAdminDashboard: React.FC = () => {
  // Dummy Data
  const ongoingInterventions = 42;
  const avgParticipation = 87; // in percent
  const avgConsultantRating = 4.5;

  const topConsultants = [
    ['Dr. Brown', 4.8],
    ['Jane Wilson', 4.7],
    ['Amir Khan', 4.5],
    ['Thando Ndlovu', 4.3],
    ['Lerato M.', 4.2],
  ];

  const topInterventions = [
    ['Website Development', 12],
    ['Market Research', 9],
    ['Branding Support', 8],
    ['Financial Literacy', 6],
    ['Product Testing', 5],
  ];

  // Age Distribution Data
  const ageDistributionData = [
    { name: 'Youth (18-24)', y: 30 },
    { name: 'Young Adults (25-34)', y: 40 },
    { name: 'Adults (35-44)', y: 20 },
    { name: 'Older Adults (45+)', y: 10 },
  ];

  // Gender Distribution Data
  const genderDistributionData = [
    { name: 'Male', y: 45 },
    { name: 'Female', y: 50 },
    { name: 'Other', y: 5 },
  ];

  // Highcharts Configs
  const consultantRatingsChart: Highcharts.Options = {
    chart: { type: 'column' },
    title: { text: 'Top Rated Consultants' },
    xAxis: {
      categories: topConsultants.map((c) => c[0]),
      title: { text: 'Consultants' },
    },
    yAxis: {
      min: 0,
      max: 5,
      title: { text: 'Average Rating' },
    },
    series: [
      {
        name: 'Rating',
        type: 'column',
        data: topConsultants.map((c) => c[1]),
        color: '#faad14',
      },
    ],
  };

  const interventionNeedsChart: Highcharts.Options = {
    chart: { type: 'bar' },
    title: { text: 'Most Needed Interventions' },
    xAxis: {
      categories: topInterventions.map((i) => i[0]),
      title: { text: 'Intervention Type' },
    },
    yAxis: {
      min: 0,
      title: { text: 'Number of Requests' },
    },
    series: [
      {
        name: 'Requests',
        type: 'bar',
        data: topInterventions.map((i) => i[1]),
        color: '#1890ff',
      },
    ],
  };

  const ageDistributionChart: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'Age Distribution' },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>',
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %',
        },
      },
    },
    series: [
      {
        name: 'Age Groups',
        type: 'pie',
        data: ageDistributionData,
      },
    ],
  };

  const genderDistributionChart: Highcharts.Options = {
    chart: { type: 'pie' },
    title: { text: 'Gender Distribution' },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>',
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>: {point.percentage:.1f} %',
        },
      },
    },
    series: [
      {
        name: 'Gender',
        type: 'pie',
        data: genderDistributionData,
      },
    ],
  };

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Project Admin Dashboard</Title>

      {/* KPIs */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Ongoing Interventions"
              value={ongoingInterventions}
              prefix={<SolutionOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Participation Rate"
              value={`${avgParticipation}%`}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Consultant Rating"
              value={avgConsultantRating}
              precision={1}
              prefix={<StarOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={consultantRatingsChart} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={interventionNeedsChart} />
          </Card>
        </Col>
      </Row>

      {/* Age and Gender Distribution Charts */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={ageDistributionChart} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <HighchartsReact highcharts={Highcharts} options={genderDistributionChart} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
