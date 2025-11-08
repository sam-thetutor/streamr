import React from "react";
import { Text, Button, Icon } from "@stellar/design-system";
import { useNavigate, useLocation } from "react-router-dom";
import { Box } from "../components/layout/Box";
import { Layout } from "@stellar/design-system";
import { useWallet } from "../hooks/useWallet";
import "./login-required.css";

export const LoginRequired: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { connect, isConnecting } = useWallet();

  const attemptedPath = location.pathname;

  const handleConnect = async () => {
    try {
      await connect();
      navigate(attemptedPath);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  return (
    <Layout.Content>
      <div className="login-required-page">
        <Box gap="lg" direction="column" align="center">
          <Icon.Wallet01 size="xl" />
          <Text as="h1" size="xl">Login Required</Text>
          <Text as="p" size="md" color="secondary">
            You need to connect your wallet to access this page.
          </Text>
          <Button
            variant="primary"
            size="lg"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </Button>
        </Box>
      </div>
    </Layout.Content>
  );
};

