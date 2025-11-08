import React from "react";
import { useWallet } from "../hooks/useWallet";
import { useNavigate } from "react-router-dom";
import "./DashboardLink.css";

export const DashboardLink: React.FC = () => {
  const { address } = useWallet();
  const navigate = useNavigate();

  if (!address) {
    return null;
  }

  return (
    <button
      className="dashboard-link"
      onClick={() => navigate("/dashboard")}
    >
      <span className="dashboard-link-text">Dashboard</span>
    </button>
  );
};

