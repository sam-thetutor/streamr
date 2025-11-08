import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Layout } from "@stellar/design-system";
import { Sidebar } from "./Sidebar";
import "./dashboard.css";

export const DashboardLayout: React.FC = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Add data attribute to body for CSS targeting
  React.useEffect(() => {
    document.body.setAttribute("data-dashboard", "true");
    return () => {
      document.body.removeAttribute("data-dashboard");
    };
  }, []);

  return (
    <>
      <div className="dashboard-container">
        <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <main className={`dashboard-main ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <div className="dashboard-content">
            <Outlet />
          </div>
        </main>
      </div>
      <div className={`dashboard-footer ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Layout.Footer>
          <span>
            © {new Date().getFullYear()} Streamr. Licensed under the{" "}
            <a
              href="http://www.apache.org/licenses/LICENSE-2.0"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apache License, Version 2.0
            </a>
            .
          </span>
        </Layout.Footer>
      </div>
    </>
  );
};

