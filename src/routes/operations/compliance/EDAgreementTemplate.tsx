import React from 'react';
import { Typography, Divider, Space, Row, Col } from 'antd';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

// Styled components for document formatting
const DocumentContainer = styled.div`
  padding: 40px;
  background-color: white;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-width: 800px;
  margin: 0 auto;
`;

const LogoContainer = styled.div`
  text-align: center;
  margin-bottom: 20px;
`;

const SectionTitle = styled(Title)`
  page-break-before: always;
`;

const SignatureSection = styled.div`
  margin-top: 40px;
  margin-bottom: 20px;
`;

const SignatureLine = styled.div`
  border-bottom: 1px solid #000;
  width: 250px;
  margin-top: 40px;
  margin-bottom: 10px;
`;

const AnnexureTable = styled.div`
  border: 1px solid #d9d9d9;
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
`;

interface EDAgreementTemplateProps {
  donorCompany: string;
  donorRegistration: string;
  donorAddress: string;
  beneficiaryCompany: string;
  beneficiaryRegistration: string;
  beneficiaryAddress: string;
  implementerCompany: string;
  implementerRegistration: string;
  implementerAddress: string;
  programDuration: string;
  supportValue: string;
  dateOfSigning?: string;
}

const EDAgreementTemplate: React.FC<EDAgreementTemplateProps> = ({
  donorCompany = "XXXX PTY LTD",
  donorRegistration = "2001/XXXX/XXX",
  donorAddress = "",
  beneficiaryCompany = "XXXX Pty Ltd",
  beneficiaryRegistration = "2024/XXX/XXX",
  beneficiaryAddress = "7 Ochil XXX",
  implementerCompany = "Epont",
  implementerRegistration = "2009/XXX",
  implementerAddress = "XXXXX",
  programDuration = "1 year",
  supportValue = "R70,000 (Seventy thousands rands)",
  dateOfSigning = "",
}) => {
  return (
    <DocumentContainer>
      <LogoContainer>
        {/* Logo placeholder */}
        <div style={{ height: '60px', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong>COMPANY LOGO</Text>
        </div>
      </LogoContainer>
      
      <Title level={2} style={{ textAlign: 'center' }}>
        ENTERPRISE DEVELOPMENT – DONOR/BENEFICIARY AGREEMENT FOR THE INCUBATOR/ESD PROGRAM
      </Title>
      
      <Divider />
      
      <Title level={3} style={{ textAlign: 'center' }}>BETWEEN</Title>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Title level={4}>{donorCompany}</Title>
        <Text strong>Company Registration Number: </Text><Text>{donorRegistration}</Text><br />
        <Text strong>Physical Address: </Text><Text>{donorAddress}</Text><br />
        <Text strong style={{ marginTop: '10px' }}>"The Company/Donor"</Text>
      </div>
      
      <Title level={3} style={{ textAlign: 'center' }}>AND</Title>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Title level={4}>{beneficiaryCompany}</Title>
        <Text strong>Company Registration Number: </Text><Text>{beneficiaryRegistration}</Text><br />
        <Text strong>Physical Address: </Text><Text>{beneficiaryAddress}</Text><br />
        <Text strong style={{ marginTop: '10px' }}>"The Beneficiary"</Text>
      </div>
      
      <Title level={3} style={{ textAlign: 'center' }}>AND</Title>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <Title level={4}>{implementerCompany}</Title>
        <Text strong>Registration Number: </Text><Text>{implementerRegistration}</Text><br />
        <Text strong>Physical Address: </Text><Text>{implementerAddress}</Text><br />
        <Text strong style={{ marginTop: '10px' }}>"The Implementer"</Text>
      </div>
      
      <Divider />
      
      <Title level={3}>Contents</Title>
      <Paragraph>
        <ul>
          <li>PARTIES</li>
          <li>INTERPRETATIONS</li>
          <li>CONDITIONS OF ENTERPRISE DEVELOPMENT AGREEMENT</li>
          <li>WARRANTIES BY THE PARTIES</li>
          <li>WHOLE AGREEMENT</li>
          <li>ANNEXURE A: POTENTIAL INTERVENTIONS</li>
          <li>ANNEXURE B: SIGNED GROWTH PLAN (ATTACHED)</li>
        </ul>
      </Paragraph>
      
      <Divider />
      
      <Title level={3} id="parties">PARTIES</Title>
      <Paragraph>
        1. The parties to this agreement are – 
           <ol type="a">
             <li><strong>{donorCompany}</strong>, the Company/Donor funding the XXXX Incubator program for the beneficiary.</li>
             <li><strong>{beneficiaryCompany}</strong>, the beneficiary company who will be supported via business development support services by {donorCompany} (the Donor company) for the purposes of enterprise development.</li>
             <li><strong>{implementerCompany}</strong>, the appointed implementer of the incubator, via which support services is provided.</li>
           </ol>
      </Paragraph>
      
      <Title level={3} id="interpretations">INTERPRETATIONS</Title>
      <Paragraph>
        {donorCompany} is currently rolling out its own ESD/Incubator program, for the benefit of its suppliers and the broader SMME community in Rustenburg, North West province, respectively. This business incubator is intended to provide needs-based business development support to enterprises of Rustenburg Chrome Mining.
      </Paragraph>
      <Paragraph>
        This is a Rustenburg Chrome Mining-led Enterprise and Supplier Development (ESD) business support programme in which Rustenburg Chrome Mining is investing in black-owned emerging micro enterprises (EMEs) and qualifying small enterprises (QSEs), who are 51% or more black-owned, from their respective mining host communities in Rustenburg, North West Province. This initiative is aligned to a sector-based approach, supporting local economies to grow.
      </Paragraph>
      <Paragraph>
        In this agreement,
        <ol>
          <li><strong>The Company/Donor</strong> means, {donorCompany}, a company duly registered and incorporated according to the company laws of the Republic of South Africa.</li>
          <li><strong>{beneficiaryCompany}</strong> is a company duly registered and incorporated according to the company laws of the Republic of South Africa, who is more than 51% black-owned EME or QSE.</li>
          <li><strong>The Implementer</strong> means <strong>{implementerCompany}</strong>, a company duly registered and incorporated according to the company laws of the Republic of South Africa as the appointed project implementer of {donorCompany}.</li>
          <li><strong>Enterprise Development</strong> Contributions means monetary and non-monetary contributions carried out for business support services for the beneficiaries (and including direct costs paid and professional services), with the objective of contributing to the development, sustainability and financial and operational independence of those beneficiaries.</li>
          <li><strong>Independent B-BBEE Verification Agency</strong> means a verification agency in the Republic of South Africa accredited by SANAS (South African National Accreditation System) or in possession of a valid pre-assessment letter from SANAS and independent from the company being verified.</li>
          <li><strong>BEE Affidavit</strong> is a declaration that states what the measure of black ownership in the company is. It is officiated by the signature of a Commissioner of Oath, Department of Trade Industry and Competition or by the CIPC.</li>
          <li><strong>BEE Certificate</strong> means a certificate issued by an independent SANAS-accredited B-BBEE Verification Agency which provides the company's true and accurate BEE status.</li>
          <li><strong>BEE Verification</strong> is an independent audit process aimed at verifying and validating the Broad-Based Black Economic Empowerment (B-BBEE) status of a legal entity.</li>
        </ol>
      </Paragraph>
      
      <Title level={3} id="conditions">CONDITIONS OF ENTERPRISE DEVELOPMENT AGREEMENT</Title>
      <Paragraph>
        The parties agree:
        <ol>
          <li>For the purpose of financial, operational, and developmental sustainability, in the beneficiary enterprise, The Company/Donor wishes to assist the Beneficiary according to the Enterprise Development Contributions defined in the Broad Based Black Economic Empowerment Act 2003 and subsequent Codes of Good Practice on Black Economic Empowerment, 2013.</li>
          <li>The Company will provide needs-based Enterprise Development services to the Beneficiary, via the appointed implementer of the {donorCompany} Incubator (using a business diagnostic assessment confirmed at the start of the program).</li>
          <li>The program will be for business support of the beneficiary, for a period of up to {programDuration} commencing on the signing of the agreement. The business interventions/services will be selected from the menu of services to be provided found in <strong>Annexure A</strong>, based on need of the business.</li>
          <li>The total minimum value of support and professional services to be provided to the beneficiary will be on average <strong>{supportValue}</strong>, <strong>excluding VAT</strong>, covering various business support interventions (implemented in the form of professional time by the implementer or third-party expenditure), These business support interventions are guided by the signed beneficiary growth plan <strong>(Annexure B<sup>1</sup>)</strong>.</li>
        </ol>
      </Paragraph>
      
      <Title level={3} id="warranties">WARRANTIES BY THE PARTIES</Title>
      <Paragraph>
        <ol>
          <li>The information provided in this agreement is correct in all respects and that the parties have provided documentary evidence which is a true reflection of their current status as at the date of signing this agreement.</li>
          <li>Enterprise Development Contributions are utilised for the purpose to which they are made and ensure that sound governance is maintained in the usage of such contributions.</li>
          <li>That no law especially, Gazette 25899 B-BBEE Act 53 of 2003 and the Codes of Good Practice on Broad-Based Black Economic Empowerment or Gazette 42496 of 31 May 2019 nor Gazette 31255 of 18 July 2008 has been circumvented in the implementation of this initiative to promote B-BBEE scoring for the company.</li>
          <li>The company is required to take all steps to ensure that the sustainability of the Beneficiary is ensured through the enterprise development initiative.</li>
          <li>Upon signing this agreement, the Beneficiary agrees to furnish the Company (via the implementer) with the following information:
             <ol type="a">
               <li>The B-BBEE Status of the company with the provision of a B-BBEE Certificate or affidavit</li>
               <li>In terms of the percentage black ownership, in the company, evidence required is as follows:
                 <ol type="i">
                   <li>Certified copy of Identity Document of all black shareholders</li>
                   <li>Other requested supporting documents</li>
                 </ol>
               </li>
             </ol>
          </li>
          <li>The beneficiary also agrees to furnish the implementer with the following:
             <ol type="a">
               <li>An acknowledgement letter from the beneficiary (at the end of the program or periodically), confirming that the initiatives and/or contributions as stated in the agreement have actually been implemented.</li>
               <li>Relevant payroll records, in the case of increased headcount, as a result of the interventions administered.</li>
               <li>Monthly turnover, profit, headcount, and other statistics in the required format</li>
               <li>Sign off evidence for donor every quarter (or monthly if required)</li>
               <li>Any other information that is requested for the purpose of this enterprise development program.</li>
             </ol>
          </li>
          <li>The implementer agrees to provide the Donor Company with:
             <ol type="a">
               <li>All relevant evidence<sup>2</sup> supporting an enterprise development initiative designed to ensure sustainable growth of the beneficiary enterprise.</li>
               <li>Professional hours, with rates, incurred to support the business development efforts during the period of support.</li>
               <li>Third party spend/payments incurred for the benefit of the beneficiary, and any other payment provided for the said beneficiary.</li>
               <li>Dates on which assistance was provided.</li>
             </ol>
          </li>
        </ol>
      </Paragraph>
      
      <Title level={3} id="agreement">WHOLE AGREEMENT</Title>
      <Paragraph>
        <ol>
          <li>This agreement constitutes the whole agreement between the parties as to the subject-matter and no agreement or representation between the parties other than those set out herein is binding on the parties.</li>
        </ol>
      </Paragraph>
      
      <SignatureSection>
        <Title level={4}>The Company</Title>
        <Paragraph>
          Signed at _____________________ on _______ day of_________________ 20___
        </Paragraph>
        <Paragraph>
          Name of the Duly Authorized Person of the Company: 
        </Paragraph>
        <Row>
          <Col span={12}>
            <Paragraph>
              Signature: <SignatureLine />
            </Paragraph>
          </Col>
          <Col span={12}>
            <Paragraph>
              Witness: <SignatureLine />
            </Paragraph>
          </Col>
        </Row>
        
        <Title level={4}>The Beneficiary</Title>
        <Paragraph>
          Signed at _____________________ on {dateOfSigning || "___ day of _________________ 20___"}
        </Paragraph>
        <Paragraph>
          Name of the Duly Authorized Person of the Beneficiary: 
        </Paragraph>
        <Row>
          <Col span={12}>
            <Paragraph>
              Signature: <SignatureLine />
            </Paragraph>
          </Col>
          <Col span={12}>
            <Paragraph>
              Witness: <SignatureLine />
            </Paragraph>
          </Col>
        </Row>
        
        <Title level={4}>The Implementer</Title>
        <Paragraph>
          Signed at _____________________ on _______ day of_________________ 20___
        </Paragraph>
        <Paragraph>
          Name of the Duly Authorized Person of the implementer: 
        </Paragraph>
        <Row>
          <Col span={12}>
            <Paragraph>
              Signature: <SignatureLine />
            </Paragraph>
          </Col>
          <Col span={12}>
            <Paragraph>
              Witness: <SignatureLine />
            </Paragraph>
          </Col>
        </Row>
      </SignatureSection>
      
      <Divider />
      
      <Title level={3} id="annexure-a">ANNEXURE A: POTENTIAL INTERVENTIONS</Title>
      <AnnexureTable>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Business Plan Development</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Marketing & Communications</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>HR Policies & Procedures</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Financial Management</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Cash Flow Management</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Tax Compliance</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Legal Compliance</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Software Systems Implementation</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Business Mentorship</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Digital Marketing</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Process Optimization</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Website Development</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Tender Preparation</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Quality Management</td>
              <td style={{ padding: '8px', border: '1px solid #d9d9d9' }}>Market Access</td>
            </tr>
          </tbody>
        </table>
      </AnnexureTable>
      
      <Title level={3} id="annexure-b">ANNEXURE B: SIGNED GROWTH PLAN (ATTACHED)</Title>
      <Paragraph>
        <i>These will be attached once completed</i>
      </Paragraph>
      
      <Divider />
      
      <Paragraph style={{ fontSize: '10px' }}>
        <sup>1</sup> A growth plan is a diagnostic assessment that has been developed at the start of the program and agreed by the beneficiary, which guides the implementation of the needs-based types of interventions (found in Annexure A). Periodically this growth plan may be reviewed and updated based on evolving needs of the beneficiary.
      </Paragraph>
      <Paragraph style={{ fontSize: '10px' }}>
        <sup>2</sup> This is to be kept confidential in terms of the POPIA Act of 2021
      </Paragraph>
    </DocumentContainer>
  );
};

export default EDAgreementTemplate; 