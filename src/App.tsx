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
// 🔹 Incubatee Routes
// ───────────────────────────────────────────────────────────
import { IncubateeDashboard } from '@/routes/incubatee'
import { MonthlyPerformanceForm } from '@/routes/incubatee/projects/projectSubmission'
import { DocumentHub } from './routes/incubatee/documents/DocumentsHub'

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
import InterventionsTrackingView from './routes/incubatee/interventions'

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
import OperationsOnboardingForm from './routes/directors/operations/onboarding'
import OperationsOnboardingDashboard from './routes/directors/operations'
import FunderOpportunities from './routes/funder/opportunities'
import { FunderPortfolio } from './routes/funder/portfolio'
import FunderDueDiligence from './routes/funder/due-diligence'
import FunderCalendarPage from './routes/funder/calendar'
import FunderDocuments from './routes/funder/documents'

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
                    <Route path='admin'>
                      <Route index element={<AdminDashboard />} />
                      <Route path='forms' element={<FormManagement />} />
                    </Route>
                    <Route path='projectadmin'>
                      <Route index element={<ProjectAdminDashboard />} />
                      <Route path='impact' element={<ImpactAnalysisForm />} />
                      <Route
                        path='monitoring'
                        element={<MonitoringEvaluationSection />}
                      />
                    </Route>

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
                      <Route path='documents' element={<DocumentHub />} />
                    </Route>
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
                          element={<ParticipantOnboardingForm />}
                        />
                        <Route
                          path='success'
                          element={<ParticipantSuccess />}
                        />
                      </Route>
                    </Route>

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

                    <Route path='chat' element={<Chat />} />
                    <Route path='applications' element={<ApplicationsPage />} />
                  </Route>
                  <Route path='/' element={<LoginPage />} />
                  <Route path='/login' element={<LoginPage />} />
                  <Route
                    path='/director/onboarding'
                    element={<DirectorOnboardingPage />}
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
