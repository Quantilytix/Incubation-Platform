// ───────────────────────────────────────────────────────────
// 🔹 Core Libraries
// ───────────────────────────────────────────────────────────
import {
  BrowserRouter,
  Route,
  Routes,
  Outlet,
  useParams
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ───────────────────────────────────────────────────────────
// 🔹 Refine Core & Utilities
// ───────────────────────────────────────────────────────────
import { Refine, Authenticated } from '@refinedev/core'
import routerProvider, {
  CatchAllNavigate,
  UnsavedChangesNotifier,
  DocumentTitleHandler
} from '@refinedev/react-router-v6'
import { useNotificationProvider } from '@refinedev/antd'
import { DevtoolsProvider } from '@refinedev/devtools'
import { RefineThemes } from '@refinedev/antd'

// ───────────────────────────────────────────────────────────
// 🔹 Ant Design
// ───────────────────────────────────────────────────────────
import { ConfigProvider, App as AntdApp } from 'antd'
import '@refinedev/antd/dist/reset.css'

// ───────────────────────────────────────────────────────────
// 🔹 App Providers
// ───────────────────────────────────────────────────────────
import { authProvider, dataProvider, liveProvider } from '@/providers'

// ───────────────────────────────────────────────────────────
// 🔹 Layout
// ───────────────────────────────────────────────────────────
import { CustomLayout } from '@/components/layout'

// ───────────────────────────────────────────────────────────
// 🔹 Public Pages
// ───────────────────────────────────────────────────────────
import { LoginPage } from '@/routes/login'
import { RegisterPage } from '@/routes/registration'

// ───────────────────────────────────────────────────────────
// 🔹 Admin & Director Dashboards
// ───────────────────────────────────────────────────────────
import { AdminDashboard } from '@/routes/operations/admin/adminDashboard'
import { DirectorDashboard } from '@/routes/directors/directorDashboard'

// ───────────────────────────────────────────────────────────
// 🔹 Operations Routes
// ───────────────────────────────────────────────────────────
import OperationsFormsManagement from '@/routes/operations/forms'
import OperationsParticipantsManagement from '@/routes/operations/participants'
import OperationsResourceManagement from '@/routes/operations/resources'
import OperationsCompliance from './routes/operations/compliance'
import OperationsReports from './routes/operations/reports'
import { ConsultantAssignments } from './routes/operations/assignments'
import ParticipantSuccess from './routes/operations/participants/success'
import { ConsultantPage } from './routes/operations/consultants'
// NEW IMPORT: Finance Dashboard
import FinanceRequests from './routes/operations/inhouse/requested/FinanceRequest'
import FinanceVerifications from './routes/operations/inhouse/verifications/FinanceVerifications'
import FinancePayments from './routes/operations/inhouse/payments/FinancePayments'
import FinanceInvoices from './routes/operations/inhouse/invoices/FinanceInvoices'
import FinanceReports from './routes/operations/inhouse/reports/FinanceReports'
// ───────────────────────────────────────────────────────────
// 🔹 Funder Routes
// ───────────────────────────────────────────────────────────
import { FunderDashboard } from '@/routes/funder/funderDashboard'
import { FunderAnalytics } from '@/routes/funder/analytics/funderAnalytics'
// ───────────────────────────────────────────────────────────
// 🔹 Funder Routes
// ───────────────────────────────────────────────────────────
import InvestorDashboard from './routes/investor/investor/Dashboard'
import { FunderOpportunities } from './routes/investor/opportunities'
import { FunderPortfolio } from './routes/investor/portfolio'
import Analytics, { InvestorAnalytics } from './routes/investor/analytics'
import { FunderDocuments } from './routes/investor/documents'
import { FunderDueDiligence } from './routes/investor/due-diligence'
import FunderCalendarPage from './routes/investor/calendar'
import { GovernmentDashboard, ParticipantDirectory } from './routes/government'
import ProgramsDirectory from './routes/government/programs'
import { ImpactReports } from './routes/government/reports'
// ───────────────────────────────────────────────────────────
// 🔹 Incubatee Routes
// ───────────────────────────────────────────────────────────
import { IncubateeDashboard } from '@/routes/incubatee'
import { MonthlyPerformanceForm } from '@/routes/incubatee/metrics'
import InterventionsTrackingView from './routes/incubatee/interventions'

// ───────────────────────────────────────────────────────────
// 🔹 Consultant Routes
// ───────────────────────────────────────────────────────────
import { ConsultantDashboard } from '@/routes/consultants/ConsultantDashboard'
import { AssignedInterventions } from '@/routes/consultants/allocated'
import { InterventionTrack } from '@/routes/consultants/allocated/intervention'
import { FeedbackWorkspace } from '@/routes/consultants/feedback/FeedbackWorkspace'
import { ProjectAnalytics } from '@/routes/consultants/analytics/ProjectAnalytics'
import Finances from '@/routes/consultants/finance'

// ───────────────────────────────────────────────────────────
// 🔹 Project Admin Routes
// ───────────────────────────────────────────────────────────
import MonitoringEvaluationSection from '@/routes/operations/monitoring'
import { ImpactAnalysisForm } from './routes/operations/impact'

// ───────────────────────────────────────────────────────────
// 🔹 Registration Routes
// ───────────────────────────────────────────────────────────
import ParticipantFormalRegistration from './routes/registration/onboarding'

// ───────────────────────────────────────────────────────────
// 🔹 Utilities / Misc
// ───────────────────────────────────────────────────────────
import Chat from '@/routes/chat/chat'
import ApplicationsPage from './routes/applications'
import { DirectorOnboardingPage } from './routes/directors/onboarding'
import OperationsOnboardingDashboard from './routes/directors/operations'
import ParticipantRegistrationStepForm from './routes/registration/onboarding'
import ProgramManager from './routes/programs'
import GenericProgramExpenseForm from './routes/expenses'
import SystemSetupForm from './routes/system'
import InterventionDatabaseView from './routes/interventions'
import ProjectAdminReports from './routes/projectadmin/reports'
import FinancialReportsInterface from './routes/incubatee/financials'
import ApplicationTracker from './routes/incubatee/tracker'
import LandingPage from './routes/landing'
import RoleDetailPage from './routes/landing/role'
import SMEDashboard from './routes/incubatee/sme'
import SMEInquirySubmission from './routes/incubatee/sme/submit-inquiry'
import SMEInquiries from './routes/incubatee/sme/inquiries'
import IncubateeLayout from './components/IncubateeLayout'
import IncubateeAnalytics from './routes/incubatee/analytics'
import ProfileForm from './routes/incubatee/profile'
import GrowthPlanPage from './routes/incubatee/diagnostic'
import KPIManager from './routes/kpis/KPIManager'
import KPITrackerView from './routes/kpis/KPITrackerView'
import GAPAnalysisTable from './routes/gap'
import GAPAnalysisForm from './routes/gap/new/form'
import GAPAnalysisDetailView from './routes/gap/view'
import GAPAnalysisFormWrapper from './components/GAPAnalysisFormWrapper'
import { BranchManagement } from '@/components/branch-management/BranchManagement'
import { DepartmentManagement } from '@/components/department-management/DepartmentManagement'
import ReceptionistDashboardPage from '@/routes/receptionist/dashboard'
import NewInquiry from '@/routes/receptionist/inquiries/new'
import InquiriesList from '@/routes/receptionist/inquiries'
import InquiryDetailPage from '@/routes/receptionist/inquiries/[id]'
import EditInquiry from '@/routes/receptionist/inquiries/[id]/edit'
import ContactsList from '@/routes/receptionist/contacts'
import FollowUpsList from '@/routes/receptionist/follow-ups'
import ReceptionistReports from '@/routes/receptionist/reports'
import Appointments from './routes/consultants/appointments'
import DashboardSwitcher from './routes/operations/dashboardSwitcher'
import InterventionsRequests from './routes/operations/requests'
import GroupMovementTimeline from './routes/operations/groupHistory'
import { ParticipantsFinancialView } from './routes/operations/finance'
import InterventionsManager from './routes/operations/interventions'
import GroupProgressForm from './routes/incubatee/group'
import DiagnosticPlanBuilder from './routes/operations/plan'
import TrainingDashboard from './routes/operations/training'
import TrainingRegistrationForm from './routes/operations/training/register'
import ModuleCompletionForm from './routes/operations/training/completion'
import AllocatedHistory from './routes/consultants/allocated/history'
import SignatureCaptureForm from './routes/incubatee/signature'
import CenterCoordinatorDashboard from './routes/projectadmin'
import MOVApprovalForm from './routes/projectadmin/movs'
import Resources from './routes/resources'
import RequestedResources from './routes/resources/requests/RequestedResources'
import Allocations from './routes/resources/allocations/allocations'
import UserAppointments from './routes/incubatee/appointments'
import { ComplianceDocuments } from './routes/incubatee/documents/compliance'
import DocumentsHub from './routes/incubatee/documents/hub'
import IncubateeInquiriesPage from './routes/incubatee/inquiries'
import ResourceRequestForm from './routes/incubatee/resources'
import RoadmapFlow from './routes/incubatee/roadmap'
import ConfirmedInterventionsView from './routes/operations/plan/confirmed'
import ConsultantQueriesView from './routes/consultants/queries'
import { FinancialPortal } from './routes/consultants/interventions/finance'
import EmployeeTimesheet from './routes/auxiliary'
import EmployeeLeave from './routes/auxiliary/leave'
import InternalResourceRequestView from './routes/resources/internal'
import ProjectManagerDashboardSwitcher from './routes/projectmanager'
import PurchaseRequestProcessor from './routes/projectmanager/inhouse/requests'
import ProjectAdminInquiryDetailPage from './routes/projectadmin/inquiries/[id]'
import CenterCoordinatorFollowUps from './routes/projectadmin/follow-ups'
import ProjectAdminEditInquiryPage from './routes/projectadmin/inquiries/[id]/edit'
import MarketLinkageManager from './routes/consultants/interventions/linkages'
import DiagnosticDocument from './routes/operations/plan/diagnostic'
import WellnessResponsesPage from './routes/consultants/interventions/wellness'
import FormBuilder from './components/forms/form-builder'
import HSEDocumentDashboard from './routes/consultants/interventions/hse'
import ReportSwitcher from './routes/operations/reports/reportsSwitcher'
import MonitoringMOVApprovals from './routes/operations/monitoring/movs'
import ConsolidatedMOVApprovals from './routes/projectadmin/movs/approvals'
import AdminLeaveManagement from './routes/operations/hr/leave'

const queryClient = new QueryClient()

const App = () => {
  const notificationProvider = useNotificationProvider()
  const ConfirmedInterventionsWrapper = () => {
    const { participantId, department } = useParams()
    return (
      <ConfirmedInterventionsView
        participantId={participantId as string}
        department={department as string}
      />
    )
  }

  return (
    <>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ConfigProvider theme={RefineThemes.Blue}>
            <AntdApp>
              <DevtoolsProvider>
                <Refine
                  routerProvider={routerProvider}
                  dataProvider={dataProvider}
                  liveProvider={liveProvider}
                  notificationProvider={notificationProvider}
                  authProvider={authProvider}
                  options={{
                    syncWithLocation: true,
                    warnWhenUnsavedChanges: true,
                    liveMode: 'auto',
                    useNewQueryKeys: true,
                    title: {
                      text: 'Smart Incubation Platform',
                      icon: null // or <YourIconComponent /> if needed
                    }
                  }}
                >
                  <Routes>
                    <Route
                      element={
                        <Authenticated
                          fallback={<CatchAllNavigate to='/login' />}
                        >
                          <CustomLayout /> {/* ✅ Replaces ThemedLayoutV2 */}
                        </Authenticated>
                      }
                    >
                      {/* System Admin Routes */}
                      <Route path='admin'>
                        <Route index element={<AdminDashboard />} />
                      </Route>
                      {/* Project Admin Routes */}
                      <Route path='projectadmin'>
                        <Route index element={<CenterCoordinatorDashboard />} />
                        <Route path='movs' element={<MOVApprovalForm />} />
                        <Route
                          path='inquiries'
                          element={<ProjectAdminInquiryDetailPage />}
                        />
                        <Route
                          path='inquiries/:id'
                          element={<ProjectAdminInquiryDetailPage />}
                        />
                        <Route
                          path='inquiries/:id/edit'
                          element={<ProjectAdminEditInquiryPage />}
                        />
                        <Route
                          path='follow-ups'
                          element={<CenterCoordinatorFollowUps />}
                        />
                        <Route
                          path='movs/approvals'
                          element={<MonitoringMOVApprovals />}
                        />
                        <Route
                          path='reports'
                          element={<ProjectAdminReports />}
                        />
                      </Route>
                      {/* Director Routes */}
                      <Route path='director'>
                        <Route index element={<DirectorDashboard />} />
                        <Route
                          path='operators'
                          element={<OperationsOnboardingDashboard />}
                        />
                        <Route path='branches' element={<BranchManagement />} />
                        <Route
                          path='departments'
                          element={<DepartmentManagement />}
                        />
                      </Route>
                      {/* Funder Routes */}
                      <Route path='funder'>
                        <Route index element={<FunderDashboard />} />
                        <Route path='analytics' element={<FunderAnalytics />} />
                      </Route>
                      {/* Project Manager Routes */}
                      <Route path='projectmanager'>
                        <Route
                          index
                          element={<ProjectManagerDashboardSwitcher />}
                        />
                        <Route
                          path='inhouse/requests'
                          element={<PurchaseRequestProcessor />}
                        />
                      </Route>
                      {/* Incubatee Routes */}
                      <Route path='incubatee'>
                        <Route index element={<IncubateeDashboard />} />
                        <Route
                          path='interventions'
                          element={<InterventionsTrackingView />}
                        />
                        <Route path='group' element={<GroupProgressForm />} />
                        <Route path='roadmap' element={<RoadmapFlow />} />
                        <Route
                          path='appointments'
                          element={<UserAppointments />}
                        />
                        <Route
                          path='inquiries'
                          element={<IncubateeInquiriesPage />}
                        />
                        <Route
                          path='/incubatee/gap-analysis'
                          element={<GAPAnalysisFormWrapper />}
                        />
                        <Route
                          path='metrics'
                          element={<MonthlyPerformanceForm />}
                        />
                        <Route
                          path='financials'
                          element={<FinancialReportsInterface />}
                        />
                        <Route
                          path='signature'
                          element={<SignatureCaptureForm />}
                        />
                        <Route
                          path='resources'
                          element={<ResourceRequestForm />}
                        />
                        <Route
                          path='documents/compliance'
                          element={<ComplianceDocuments />}
                        />
                        <Route
                          path='documents/hub'
                          element={<DocumentsHub />}
                        />
                      </Route>
                      {/* Investor Routes */}
                      <Route path='investor'>
                        <Route index element={<InvestorDashboard />} />
                        <Route
                          path='opportunities'
                          element={<FunderOpportunities />}
                        />
                        <Route path='portfolio' element={<FunderPortfolio />} />
                        <Route
                          path='due-diligence'
                          element={<FunderDueDiligence />}
                        />
                        <Route path='analytics' element={<FunderAnalytics />} />
                        <Route path='documents' element={<FunderDocuments />} />
                        <Route
                          path='calendar'
                          element={<FunderCalendarPage />}
                        />
                      </Route>
                      {/* Auxiliary Routes */}
                      <Route path='auxiliary'>
                        <Route index element={<EmployeeTimesheet />} />
                        <Route path='leave' element={<EmployeeLeave />} />
                      </Route>
                      {/* Consultant Routes */}
                      <Route path='consultant'>
                        <Route index element={<ConsultantDashboard />} />
                        <Route
                          path='feedback'
                          element={<FeedbackWorkspace />}
                        />
                        <Route
                          path='interventions/finance'
                          element={<FinancialPortal />}
                        />
                        <Route
                          path='interventions/Linkages'
                          element={<MarketLinkageManager />}
                        />
                        <Route
                          path='interventions/hse'
                          element={<HSEDocumentDashboard />}
                        />
                        <Route
                          path='interventions/wellness'
                          element={<WellnessResponsesPage />}
                        />
                        <Route
                          path='queries'
                          element={<ConsultantQueriesView />}
                        />
                        <Route path='finances' element={<Finances />} />
                        <Route path='appointments' element={<Appointments />} />
                        <Route
                          path='analytics'
                          element={<ProjectAnalytics />}
                        />
                        <Route
                          path='allocated/history'
                          element={<AllocatedHistory />}
                        />
                        <Route path='allocated'>
                          <Route index element={<AssignedInterventions />} />
                          <Route
                            path='intervention/:id'
                            element={<InterventionTrack />}
                          />
                        </Route>
                        <Route path='participants'>
                          <Route
                            index
                            element={<OperationsParticipantsManagement />}
                          />
                          <Route
                            path='new'
                            element={<ParticipantRegistrationStepForm />}
                          />
                          <Route
                            path='success'
                            element={<ParticipantSuccess />}
                          />
                        </Route>
                      </Route>
                      {/* Operations Routes */}
                      <Route path='operations'>
                        <Route index element={<DashboardSwitcher />} />
                        <Route
                          path='forms'
                          element={<OperationsFormsManagement />}
                        />
                        <Route
                          path='hr/leave'
                          element={<AdminLeaveManagement />}
                        />
                        <Route
                          path='forms/form-builder'
                          element={<FormBuilder />}
                        />
                        <Route path='impact' element={<ImpactAnalysisForm />} />
                        <Route
                          path='inhouse/requested'
                          element={<FinanceRequests />}
                        />
                        <Route
                          path='inhouse/verification'
                          element={<FinanceVerifications />}
                        />
                        <Route
                          path='inhouse/reported'
                          element={<FinanceReports />}
                        />
                        <Route
                          path='inhouse/payments'
                          element={<FinancePayments />}
                        />
                        <Route
                          path='inhouse/invoices'
                          element={<FinanceInvoices />}
                        />
                        <Route
                          path='monitoring'
                          element={<MonitoringEvaluationSection />}
                        />
                        <Route
                          path='monitoring/movs'
                          element={<MonitoringMOVApprovals />}
                        />
                        <Route
                          path='training'
                          element={<TrainingDashboard />}
                        />
                        <Route
                          path='training/register'
                          element={<TrainingRegistrationForm />}
                        />
                        <Route
                          path='training/completion'
                          element={<ModuleCompletionForm />}
                        />
                        <Route
                          path='requests'
                          element={<InterventionsRequests />}
                        />
                        <Route
                          path='plan'
                          element={<DiagnosticPlanBuilder />}
                        />
                        <Route
                          path='plan/diagnostic'
                          element={<DiagnosticDocument />}
                        />
                        <Route
                          path='plan/confirmed/:participantId/:department'
                          element={<ConfirmedInterventionsWrapper />}
                        />
                        <Route
                          path='assignments'
                          element={<ConsultantAssignments />}
                        />
                        <Route
                          path='participants'
                          element={<OperationsParticipantsManagement />}
                        />
                        <Route
                          path='interventions'
                          element={<InterventionsManager />}
                        />
                        <Route
                          path='finance'
                          element={<ParticipantsFinancialView />}
                        />
                        <Route
                          path='groupHistory'
                          element={<GroupMovementTimeline />}
                        />
                        <Route path='gap'>
                          <Route index element={<GAPAnalysisTable />} />
                          {/* This is for adding new */}
                          <Route
                            path='new'
                            element={<GAPAnalysisForm mode='rom' />}
                          />
                          <Route
                            path=':id'
                            element={<GAPAnalysisDetailView />}
                          />
                        </Route>
                        <Route path='consultants'>
                          <Route index element={<ConsultantPage />} />
                        </Route>
                        <Route
                          path='resources'
                          element={<OperationsResourceManagement />}
                        />
                        <Route
                          path='compliance'
                          element={<OperationsCompliance />}
                        />
                        <Route path='kpis'>
                          <Route index element={<KPIManager />} />{' '}
                          {/* This is /operations/kpis */}
                          <Route path='KPIManager' element={<KPIManager />} />
                          {/* Explicit paths */}
                          <Route
                            path='KPITrackerView'
                            element={<KPITrackerView />}
                          />
                        </Route>
                        <Route path='reports' element={<ReportSwitcher />} />
                      </Route>

                      {/* Government Routes */}
                      <Route path='government'>
                        <Route index element={<GovernmentDashboard />} />
                        <Route path='analytics' element={<FunderAnalytics />} />
                        <Route index element={<GovernmentDashboard />} />
                        <Route
                          path='participants'
                          element={<ParticipantDirectory />}
                        />
                        <Route
                          path='programs'
                          element={<ProgramsDirectory />}
                        />
                        <Route path='reports' element={<ImpactReports />} />
                      </Route>

                      {/* Receptionist Routes */}
                      <Route path='receptionist'>
                        <Route index element={<ReceptionistDashboardPage />} />
                        <Route path='inquiries' element={<InquiriesList />} />
                        <Route path='inquiries/new' element={<NewInquiry />} />
                        <Route
                          path='inquiries/:id'
                          element={<InquiryDetailPage />}
                        />
                        <Route
                          path='inquiries/:id/edit'
                          element={<EditInquiry />}
                        />
                        <Route path='contacts' element={<ContactsList />} />
                        <Route path='follow-ups' element={<FollowUpsList />} />
                        <Route
                          path='reports'
                          element={<ReceptionistReports />}
                        />
                      </Route>
                      <Route
                        path='interventions'
                        element={<InterventionDatabaseView />}
                      />
                      <Route path='chat' element={<Chat />} />
                      <Route
                        path='expenses'
                        element={<GenericProgramExpenseForm />}
                      />
                      <Route path='system' element={<SystemSetupForm />} />

                      <Route
                        path='applications'
                        element={<ApplicationsPage />}
                      />
                      <Route path='resources'>
                        <Route index element={<Resources />} />
                        <Route
                          path='requests'
                          element={<RequestedResources />}
                        />
                        <Route
                          path='internal'
                          element={<InternalResourceRequestView />}
                        />
                        <Route path='allocations' element={<Allocations />} />
                      </Route>
                      <Route path='programs' element={<ProgramManager />} />
                    </Route>
                    {/* 🔹 IncubateeLayout Routes: SME, Tracker, Analytics */}
                    <Route element={<IncubateeLayout />}>
                      <Route path='/incubatee/sme' element={<SMEDashboard />} />
                      <Route
                        path='/incubatee/sme/submit-inquiry'
                        element={<SMEInquirySubmission />}
                      />
                      <Route
                        path='/incubatee/sme/inquiries'
                        element={<SMEInquiries />}
                      />
                      <Route
                        path='/incubatee/tracker'
                        element={<ApplicationTracker />}
                      />
                      <Route
                        path='/incubatee/profile'
                        element={<ProfileForm />}
                      />
                      <Route
                        path='/incubatee/analytics'
                        element={<IncubateeAnalytics />}
                      />
                    </Route>

                    <Route path='/' element={<LandingPage />} />
                    <Route path='/role/:roleId' element={<RoleDetailPage />} />
                    <Route path='/landing/sme' element={<SMEDashboard />} />
                    <Route path='/login' element={<LoginPage />} />

                    <Route
                      path='/director/onboarding'
                      element={<DirectorOnboardingPage />}
                    />
                    <Route path='/registration'>
                      <Route index element={<RegisterPage />} />
                      <Route
                        path='/registration/onboarding'
                        element={<ParticipantFormalRegistration />}
                      />
                    </Route>

                    <Route path='*' element={<h1>Page Not Found</h1>} />
                  </Routes>

                  <UnsavedChangesNotifier />
                  <DocumentTitleHandler />
                </Refine>
              </DevtoolsProvider>
            </AntdApp>
          </ConfigProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </>
  )
}

export default App
