import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { LoginRequired } from "../pages/LoginRequired";

interface ProtectedRouteProps {
  /**
   * If true, redirects to home instead of showing login required page
   * @default false
   */
  redirect?: boolean;
}

/**
 * ProtectedRoute component that checks if user is authenticated
 * If not authenticated, shows LoginRequired page or redirects to home
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ redirect = false }) => {
  const { address } = useWallet();

  // If user is not logged in
  if (!address) {
    if (redirect) {
      return <Navigate to="/" replace />;
    }
    return <LoginRequired />;
  }

  // User is authenticated, render the child routes
  return <Outlet />;
};

