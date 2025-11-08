/**
 * Theme Provider - Applies theme classes globally
 * This ensures consistent theming across the app
 */
import React, { useEffect } from "react";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Add theme class to body for global theme access
    document.body.classList.add("streamr-theme");
    
    return () => {
      document.body.classList.remove("streamr-theme");
    };
  }, []);

  return <>{children}</>;
};

