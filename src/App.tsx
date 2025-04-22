import { Refine } from "@refinedev/core";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import routerProvider, {
  CatchAllNavigate,
  NavigateToResource,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router-v6";
import { Authenticated } from "@refinedev/core";
import { useNotificationProvider } from "@refinedev/antd";
import { ConfigProvider, App as AntdApp } from "antd";
import { RefineThemes } from "@refinedev/antd";
import { DevtoolsProvider } from "@refinedev/devtools";

import { Layout } from "@/components";
import { resources } from "@/config/resources";
import { authProvider, dataProvider, liveProvider } from "@/providers";

import { DashboardPage } from "@/routes/dashboard";
import { LoginPage } from "@/routes/login";
import { RegisterPage } from "@/routes/registration";
import { FunderDashboard } from "@/routes/funder/funderDashboard";
import { ApprovalQueue } from "@/routes/funder/approvals/approvalQueue";
import { FundDisbursement } from "@/routes/funder/disbursements/fundDisbursement";
import { FunderAnalytics } from "@/routes/funder/analytics/funderAnalytics";

import { IncubateeDashboard } from "@/routes/incubatee";
import { ProjectSubmission } from "@/routes/incubatee/projects/projectSubmission";

import { ConsultantDashboard } from "@/routes/consultants/ConsultantDashboard";
import { FeedbackWorkspace } from "@/routes/consultants/feedback/FeedbackWorkspace";
import { ProjectAnalytics } from "@/routes/consultants/analytics/ProjectAnalytics";
import { AuditTools } from "@/routes/consultants/audit/AuditTools";

import { OperationsDashboard } from "@/routes/operations/OperationsDashboard";
import { OperationsFormsManagement } from "@/routes/operations/forms"
import { OperationsParticipantsManagement } from "@/routes/operations/participants";
import { OperationsResourceManagement } from "@/routes/operations/resources";

import "@refinedev/antd/dist/reset.css";

const App = () => {
  return (
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
              resources={resources}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
                liveMode: "auto",
                useNewQueryKeys: true,
              }}
            >
              <Routes>
                <Route
                  element={
                    <Authenticated fallback={<CatchAllNavigate to="/login" />}>
                      <Layout>
                        <Outlet />
                      </Layout>
                    </Authenticated>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />

                  {/* Funder routes */}
                  <Route path="funder">
                    <Route index element={<FunderDashboard />} />
                    <Route path="approvals" element={<ApprovalQueue />} />
                    <Route path="disbursements" element={<FundDisbursement />} />
                    <Route path="analytics" element={<FunderAnalytics />} />
                  </Route>

                  {/* Incubatee routes */}
                  <Route path="incubatee">
                    <Route index element={<IncubateeDashboard />} />
                    <Route path="projects" element={<ProjectSubmission />} />
                  </Route>

                  {/* Consultant routes */}
                  <Route path="consultant">
                    <Route index element={<ConsultantDashboard />} />
                    <Route path="feedback" element={<FeedbackWorkspace />} />
                    <Route path="analytics" element={<ProjectAnalytics />} />
                    <Route path="audit" element={<AuditTools />} />
                  </Route>

                  {/* Operations routes */}
                  <Route path="operations">
                    <Route index element={<OperationsDashboard />} />
                    <Route path="forms" element={<OperationsFormsManagement />} />
                    <Route path="participants" element={<OperationsParticipantsManagement />} />
                    <Route path="resources" element={<OperationsResourceManagement />} />
                  </Route>
                </Route>

                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* 404 fallback */}
                <Route path="*" element={<h1>Page Not Found</h1>} />
              </Routes>

              <UnsavedChangesNotifier />
              <DocumentTitleHandler />
            </Refine>
          </DevtoolsProvider>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  );
};

export default App;
