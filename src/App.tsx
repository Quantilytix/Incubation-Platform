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
import { ApprovalQueue } from "@/routes/funder/approvals";

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
                {/* Authenticated routes */}
                <Route
                  element={
                    <Authenticated fallback={<CatchAllNavigate to="/login" />}>
                      <Layout>
                        <Outlet />
                      </Layout>
                    </Authenticated>
                  }
                >
                  {/* Global dashboard route */}
                  <Route index element={<DashboardPage />} />
                  <Route path="dashboard" element={<DashboardPage />} />

                  {/* Funder routes */}
                  <Route path="funder">
                    <Route index element={<FunderDashboard />} />
                    <Route path="approvals" element={<ApprovalQueue />} />
                  </Route>

                  {/* Add more roles here as needed */}
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
