import React from "react";
import { Layout } from "@stellar/design-system";
import "./App.module.css";
import ConnectAccount from "./components/ConnectAccount.tsx";
import { SimpleHeroSection } from "./components/SimpleHeroSection";
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { CreateStream } from "./pages/dashboard/CreateStream";
import { MyStreams } from "./pages/dashboard/MyStreams";
import { StreamDetails } from "./pages/dashboard/StreamDetails";
import { Subscriptions } from "./pages/dashboard/Subscriptions";
import { CreateSubscription } from "./pages/dashboard/CreateSubscription";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NotFound } from "./pages/NotFound";

const AppLayout: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");

  React.useEffect(() => {
    const header = document.querySelector(".Layout__header");
    if (header) {
      if (isDashboard) {
        header.setAttribute("data-dashboard", "true");
      } else {
        header.removeAttribute("data-dashboard");
      }
    }
  }, [isDashboard]);

  return (
    <main>
      <Layout.Header
        projectId="streamr"
        projectTitle={isDashboard ? "" : "Streamr"}
        contentRight={<ConnectAccount />}
      />
      <Outlet />
      {!isDashboard && (
        <Layout.Footer>
          
        </Layout.Footer>
      )}
    </main>
  );
};

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <Layout.Content>
              <SimpleHeroSection />
            </Layout.Content>
          }
        />
        {/* Protected Dashboard Routes - Requires Login */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/streams/create" element={<CreateStream />} />
            <Route path="/dashboard/streams/:id" element={<StreamDetails />} />
            <Route path="/dashboard/streams" element={<MyStreams />} />
            <Route path="/dashboard/subscriptions/create" element={<CreateSubscription />} />
            <Route path="/dashboard/subscriptions" element={<Subscriptions />} />
          </Route>
        </Route>
        {/* 404 Catch-all Route */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;

