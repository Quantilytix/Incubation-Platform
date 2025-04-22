import { Refine } from "@refinedev/core";
import { BrowserRouter, Route, Routes, Outlet } from "react-router-dom";
import routerProvider from "@refinedev/react-router-v6";
import { Authenticated } from "@refinedev/core";

import { DashboardPage, LoginPage, RegisterPage } from "@/routes";
import { Layout } from "@/components";
import { resources } from "@/config/resources";
import { authProvider, dataProvider, liveProvider } from "@/providers";
import { useNotificationProvider } from "@refinedev/antd";

import { ConfigProvider, App as AntdApp } from "antd";
import { RefineThemes } from "@refinedev/antd";
import { DevtoolsProvider } from "@refinedev/devtools";
import {
  CatchAllNavigate,
  NavigateToResource,
  UnsavedChangesNotifier,
  DocumentTitleHandler,
} from "@refinedev/react-router-v6";

import "@refinedev/antd/dist/reset.css";

const App = () => {
  console.log("Rendering App.tsx");

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
                {/* Protected routes */}
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
                </Route>

                {/* Auth routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />

                {/* Catch-all fallback */}
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