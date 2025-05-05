// ───────────────────────────────────────────────────────────
// 🔹 Core Libraries
// ───────────────────────────────────────────────────────────
import { BrowserRouter, Route, Routes, Outlet } from 'react-router-dom'
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
// 🔹 Admin & Operations Dashboards
// ───────────────────────────────────────────────────────────
import { AdminDashboard } from '@/routes/operations/admin/adminDashboard'
import { DirectorDashboard } from '@/routes/directors/directorDashboard'
import { OperationsDashboard } from '@/routes/operations/OperationsDashboard'

// ───────────────────────────────────────────────────────────
// 🔹 Admin Routes
// ───────────────────────────────────────────────────────────
import FormManagement from '@/routes/admin/forms'

// ───────────────────────────────────────────────────────────
// 🔹 Operations Routes
// ───────────────────────────────────────────────────────────
import OperationsFormsManagement from '@/routes/operations/forms'
import OperationsParticipantsManagement from '@/routes/operations/participants'
import OperationsResourceManagement from '@/routes/operations/resources'
import OperationsCompliance from './routes/operations/compliance'
import OperationsReports from './routes/operations/reports'
import { ConsultantAssignments } from './routes/operations/assignments'
import ParticipantOnboardingForm from './routes/operations/participants/new/ParticipantOnboardingForm'
import ParticipantSuccess from './routes/operations/participants/success'
import { ConsultantPage } from './routes/operations/consultants'
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
import { InvestorAnalytics } from './routes/investor/analytics'
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
import { MonthlyPerformanceForm } from '@/routes/incubatee/projects/projectSubmission'
import { DocumentHub } from './routes/incubatee/documents/DocumentsHub'
import InterventionsTrackingView from './routes/incubatee/interventions'

// ───────────────────────────────────────────────────────────
// 🔹 Consultant Routes
// ───────────────────────────────────────────────────────────
import { ConsultantDashboard } from '@/routes/consultants/ConsultantDashboard'
import { AssignedInterventions } from '@/routes/consultants/allocated'
import { InterventionTrack } from '@/routes/consultants/allocated/intervention'
import { FeedbackWorkspace } from '@/routes/consultants/feedback/FeedbackWorkspace'
import { ProjectAnalytics } from '@/routes/consultants/analytics/ProjectAnalytics'

// ───────────────────────────────────────────────────────────
// 🔹 Project Admin Routes
// ───────────────────────────────────────────────────────────
import { ProjectAdminDashboard } from './routes/projectadmin/projectAdminDashboard'
import MonitoringEvaluationSection from '@/routes/projectadmin/monitoring'
import { ImpactAnalysisForm } from './routes/projectadmin/impact'

// ───────────────────────────────────────────────────────────
// 🔹 Registration Routes
// ───────────────────────────────────────────────────────────
import ParticipantFormalRegistration from './routes/registration/onboarding'

// ───────────────────────────────────────────────────────────
// 🔹 Utilities / Misc
// ───────────────────────────────────────────────────────────
import Chat from '@/routes/chat/chat'
import ApplicationsPage from './routes/applications'
import { ConsultantOnboardingForm } from './routes/operations/consultants/new'
import { DirectorOnboardingPage } from './routes/directors/onboarding'
import OperationsOnboardingDashboard from './routes/directors/operations'
import ParticipantRegistrationStepForm from './routes/registration/onboarding'
import ProgramManager from './routes/programs'
import ProgramExpenseForm from './routes/expenses'
import GenericProgramExpenseForm from './routes/expenses'
import SystemSetupForm from './routes/system'
import InterventionDatabaseView from './routes/interventions'
import ProjectAdminReports from './routes/projectadmin/reports'
import FinancialReportsInterface from './routes/incubatee/financials'
import ApplicationTracker from './routes/incubatee/tracker'

const queryClient = new QueryClient()

const App = () => {
  const notificationProvider = useNotificationProvider()

  return (
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
                  useNewQueryKeys: true
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
                      <Route path='forms' element={<FormManagement />} />
                    </Route>
                    {/* Project Admin Routes */}
                    <Route path='projectadmin'>
                      <Route index element={<ProjectAdminDashboard />} />
                      <Route path='impact' element={<ImpactAnalysisForm />} />
                      <Route
                        path='monitoring'
                        element={<MonitoringEvaluationSection />}
                      />
                      <Route path='reports' element={<ProjectAdminReports />} />
                    </Route>
                    {/* Director Routes */}
                    <Route path='director'>
                      <Route index element={<DirectorDashboard />} />
                      <Route
                        path='operators'
                        element={<OperationsOnboardingDashboard />}
                      />
                    </Route>
                    {/* Funder Routes */}
                    <Route path='funder'>
                      <Route index element={<FunderDashboard />} />
                      <Route path='analytics' element={<FunderAnalytics />} />
                    </Route>
                    {/* Incubatee Routes */}
                    <Route path='incubatee'>
                      <Route index element={<IncubateeDashboard />} />
                      <Route
                        path='interventions'
                        element={<InterventionsTrackingView />}
                      />
                      <Route
                        path='projects'
                        element={<MonthlyPerformanceForm />}
                      />
                      <Route
                        path='financials'
                        element={<FinancialReportsInterface />}
                      />
                      <Route path='documents' element={<DocumentHub />} />
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
                      <Route path='calendar' element={<FunderCalendarPage />} />
                    </Route>
                    {/* Consultant Routes */}
                    <Route path='consultant'>
                      <Route index element={<ConsultantDashboard />} />
                      <Route path='feedback' element={<FeedbackWorkspace />} />
                      <Route path='analytics' element={<ProjectAnalytics />} />
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
                      <Route index element={<OperationsDashboard />} />
                      <Route
                        path='forms'
                        element={<OperationsFormsManagement />}
                      />
                      <Route
                        path='assignments'
                        element={<ConsultantAssignments />}
                      />
                      <Route
                        path='participants'
                        element={<OperationsParticipantsManagement />}
                      />
                      <Route path='consultants'>
                        <Route index element={<ConsultantPage />} />
                        <Route
                          path='new'
                          element={<ConsultantOnboardingForm />}
                        />
                      </Route>
                      <Route
                        path='resources'
                        element={<OperationsResourceManagement />}
                      />
                      <Route
                        path='compliance'
                        element={<OperationsCompliance />}
                      />
                      <Route path='reports' element={<OperationsReports />} />
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
                      <Route path='programs' element={<ProgramsDirectory />} />
                      <Route path='reports' element={<ImpactReports />} />
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

                    <Route path='applications' element={<ApplicationsPage />} />
                    <Route path='programs' element={<ProgramManager />} />
                  </Route>
                  <Route path='/' element={<LoginPage />} />
                  <Route path='/login' element={<LoginPage />} />

                  <Route
                    path='/director/onboarding'
                    element={<DirectorOnboardingPage />}
                  />
                  <Route
                    path='/incubatee/tracker'
                    element={<ApplicationTracker />}
                  />
                  <Route path='/registration'>
                    <Route index element={<RegisterPage />} />
                    <Route
                      path='/registration/onboarding/:userId'
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
  )
}

export default App
