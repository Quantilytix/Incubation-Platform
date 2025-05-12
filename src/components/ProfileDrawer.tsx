import React from 'react'
import {
  Drawer,
  Tabs,
  Form,
  Input,
  Select,
  InputNumber,
  Divider,
  Row,
  Col,
  Button,
  DatePicker
} from 'antd'

const { TabPane } = Tabs

type Props = {
  open: boolean
  onClose: () => void
  form: any
  onSave: () => void
  last3Months: string[]
  last2Years: string[]
}

const ProfileDrawer: React.FC<Props> = ({
  open,
  onClose,
  form,
  onSave,
  last3Months,
  last2Years
}) => {
  return (
    <Drawer
      title='SME Profile'
      width={600}
      onClose={onClose}
      open={open}
      footer={
        <Button type='primary' onClick={onSave} block>
          Save Profile
        </Button>
      }
    >
      <Tabs defaultActiveKey='info'>
        <TabPane tab='Basic Info' key='info'>
          <Form layout='vertical' form={form}>
            <Divider orientation='left'>Personal Details</Divider>
            <Form.Item
              name='ownerName'
              label='Owner Name'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name='gender'
              label='Gender'
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value='Male'>Male</Select.Option>
                <Select.Option value='Female'>Female</Select.Option>
                <Select.Option value='Other'>Other</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name='idNumber'
              label='ID Number'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name='email' label='Email' rules={[{ type: 'email' }]}>
              <Input />
            </Form.Item>

            <Divider orientation='left'>Company Info</Divider>
            <Form.Item
              name='companyName'
              label='Company Name'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name='sector'
              label='Sector'
              rules={[
                { required: true, message: 'Please select or enter a sector' }
              ]}
            >
              <Select
                showSearch
                allowClear
                placeholder='Select or type a sector'
                optionFilterProp='children'
                filterOption={(input, option) =>
                  (option?.children as string)
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                <Select.Option value='Agriculture'>Agriculture</Select.Option>
                <Select.Option value='Mining'>Mining</Select.Option>
                <Select.Option value='Manufacturing'>
                  Manufacturing
                </Select.Option>
                <Select.Option value='Construction'>Construction</Select.Option>
                <Select.Option value='Utilities'>
                  Utilities (Electricity, Water, Gas)
                </Select.Option>
                <Select.Option value='Wholesale and Retail Trade'>
                  Wholesale and Retail Trade
                </Select.Option>
                <Select.Option value='Transport and Logistics'>
                  Transport and Logistics
                </Select.Option>
                <Select.Option value='Information Technology'>
                  Information Technology
                </Select.Option>
                <Select.Option value='Finance and Insurance'>
                  Finance and Insurance
                </Select.Option>
                <Select.Option value='Real Estate'>Real Estate</Select.Option>
                <Select.Option value='Professional and Technical Services'>
                  Professional and Technical Services
                </Select.Option>
                <Select.Option value='Education'>Education</Select.Option>
                <Select.Option value='Healthcare and Social Assistance'>
                  Healthcare and Social Assistance
                </Select.Option>
                <Select.Option value='Tourism and Hospitality'>
                  Tourism and Hospitality
                </Select.Option>
                <Select.Option value='Public Administration'>
                  Public Administration
                </Select.Option>
                <Select.Option value='Creative and Cultural Industries'>
                  Creative and Cultural Industries
                </Select.Option>
                <Select.Option value='Other'>Other</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item
              name='natureOfBusiness'
              label='Nature of Business'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name='blackOwnedPercent' label='Black-Owned Percentage'>
              <InputNumber
                min={0}
                max={100}
                style={{ width: '100%' }}
                addonAfter='%'
              />
            </Form.Item>
            <Form.Item name='beeLevel' label='BEEE Level'>
              <Select>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(level => (
                  <Select.Option key={level} value={level}>
                    Level {level}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name='dateOfRegistration'
              label='Date of Registration'
              rules={[{ required: true, message: 'Please select a date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name='registrationNumber' label='Registration Number'>
              <Input />
            </Form.Item>
            <Form.Item name='yearsOfTrading' label='Years of Trading'>
              <Input type='number' />
            </Form.Item>
            <Form.Item name='businessAddress' label='Business Address'>
              <Input />
            </Form.Item>
            <Form.Item
              name='province'
              label='Province'
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value='Eastern Cape'>Eastern Cape</Select.Option>
                <Select.Option value='Free State'>Free State</Select.Option>
                <Select.Option value='Gauteng'>Gauteng</Select.Option>
                <Select.Option value='KwaZulu-Natal'>
                  KwaZulu-Natal
                </Select.Option>
                <Select.Option value='Limpopo'>Limpopo</Select.Option>
                <Select.Option value='Mpumalanga'>Mpumalanga</Select.Option>
                <Select.Option value='Northern Cape'>
                  Northern Cape
                </Select.Option>
                <Select.Option value='North West'>North West</Select.Option>
                <Select.Option value='Western Cape'>Western Cape</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name='city' label='City' rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name='hub'
              label='Host Community'
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name='location' label='Location'>
              <Select>
                <Select.Option value='Urban'>Urban</Select.Option>
                <Select.Option value='Township'>Township</Select.Option>
                <Select.Option value='Rural'>Rural</Select.Option>
              </Select>
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab='Headcount & Revenue' key='metrics'>
          <Form layout='vertical' form={form}>
            <Divider orientation='left'>Monthly</Divider>
            {last3Months.map(month => (
              <Row gutter={16} key={month}>
                <Col span={8}>
                  <Form.Item
                    name={`revenue_${month}`}
                    label={`Revenue (${month})`}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      formatter={v =>
                        `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      }
                      parser={v => Number(v?.replace(/R\s?|(,*)/g, '') || 0)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={`permHeadcount_${month}`}
                    label='Perm. Staff'
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={`tempHeadcount_${month}`}
                    label='Temp. Staff'
                  >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            ))}

            <Divider orientation='left'>Annual</Divider>
            {last2Years.map(year => (
              <Row gutter={16} key={year}>
                <Col span={8}>
                  <Form.Item
                    name={`revenue_${year}`}
                    label={`Revenue (${year})`}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      formatter={v =>
                        `R ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                      }
                      parser={v => Number(v?.replace(/R\s?|(,*)/g, '') || 0)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={`permHeadcount_${year}`} label='Perm. Staff'>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name={`tempHeadcount_${year}`} label='Temp. Staff'>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            ))}
          </Form>
        </TabPane>
      </Tabs>
    </Drawer>
  )
}

export default ProfileDrawer
