import { Refine } from '@refinedev/core'
import { BrowserRouter, Route, Routes, Outlet } from 'react-router-dom'
import routerProvider, {
  CatchAllNavigate,
  UnsavedChangesNotifier,
  DocumentTitleHandler
} from '@refinedev/react-router-v6'
import { Authenticated } from '@refinedev/core'
import { useNotificationProvider } from '@refinedev/antd'
import { ConfigProvider, App as AntdApp } from 'antd'
import { RefineThemes } from '@refinedev/antd'
import { DevtoolsProvider } from '@refinedev/devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { CustomLayout } from '@/components/layout' // ✅ Updated import

import { authProvider, dataProvider, liveProvider } from '@/providers'

import { AdminDashboard } from '@/routes/operations/admin/adminDashboard'
import FormManagement from '@/routes/admin/forms'
import MonitoringEvaluationSection from '@/routes/projectadmin/monitoring'
import { LoginPage } from '@/routes/login'
import Chat from '@/routes/chat/chat'
import { RegisterPage } from '@/routes/registration'
import { FunderDashboard } from '@/routes/funder/funderDashboard'
import { ApprovalQueue } from '@/routes/funder/approvals/approvalQueue'
import { FundDisbursement } from '@/routes/funder/disbursements/fundDisbursement'
import { FunderAnalytics } from '@/routes/funder/analytics/funderAnalytics'
import { IncubateeDashboard } from '@/routes/incubatee'
import { MonthlyPerformanceForm } from '@/routes/incubatee/projects/projectSubmission'
import { ConsultantDashboard } from '@/routes/consultants/ConsultantDashboard'
import { AssignedInterventions } from '@/routes/consultants/allocated'
import { InterventionTrack } from '@/routes/consultants/allocated/intervention'
import { FeedbackWorkspace } from '@/routes/consultants/feedback/FeedbackWorkspace'
import { ProjectAnalytics } from '@/routes/consultants/analytics/ProjectAnalytics'
import { DirectorDashboard } from '@/routes/directors/directorDashboard'
import { OperationsDashboard } from '@/routes/operations/OperationsDashboard'
import OperationsFormsManagement from '@/routes/operations/forms'
import OperationsParticipantsManagement from '@/routes/operations/participants'
import OperationsResourceManagement from '@/routes/operations/resources'
import OperationsCompliance from './routes/operations/compliance'
import OperationsReports from './routes/operations/reports'

import '@refinedev/antd/dist/reset.css'
import { DocumentHub } from './routes/incubatee/documents/DocumentsHub'
import { ConsultantAssignments } from './routes/operations/assignments'
import { ProjectAdminDashboard } from './routes/projectadmin/projectAdminDashboard'
import { ImpactAnalysisForm } from './routes/projectadmin/impact'

const queryClient = new QueryClient()

const App = () => {
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
                notificationProvider={useNotificationProvider}
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
                    <Route path='/' element={<AdminDashboard />} />
                    <Route path='admin'>
                      <Route path='forms' element={<FormManagement />} />
                    </Route>
                    <Route path='projectadmin'>
                      <Route index element={<ProjectAdminDashboard />} />
                      <Route
                        path='compliance'
                        element={<OperationsCompliance />}
                      />
                      <Route path='impact' element={<ImpactAnalysisForm />} />
                      <Route
                        path='monitoring'
                        element={<MonitoringEvaluationSection />}
                      />
                    </Route>
                    <Route path='director' element={<DirectorDashboard />} />
                    <Route path='funder'>
                      <Route index element={<FunderDashboard />} />
                      <Route path='analytics' element={<FunderAnalytics />} />
                    </Route>
                    <Route path='incubatee'>
                      <Route index element={<IncubateeDashboard />} />
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
                    </Route>

                    <Route path='operations'>
                      <Route index element={<OperationsDashboard />} />
                       <Route   path='forms' element={<AdminDashboard />} />
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
                  </Route>

                  <Route path='/login' element={<LoginPage />} />
                  <Route path='/register' element={<RegisterPage />} />

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
