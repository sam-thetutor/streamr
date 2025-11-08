// @ts-nocheck
import React from "react";
import { Text, Button } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { Box } from "../components/layout/Box";
import { Layout } from "@stellar/design-system";
import "./not-found.css";

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Layout.Content>
      <div className="not-found-page">
        <Box gap="lg" direction="column" align="center">
          <Text as="h1" size="xxl" className="error-code">404</Text>
          <Text as="h2" size="lg">Page Not Found</Text>
          <Text as="p" size="md" color="secondary">
            The page you're looking for doesn't exist.
          </Text>
          <Button variant="primary" onClick={() => navigate("/")}>
            Go to Home
          </Button>
        </Box>
      </div>
    </Layout.Content>
  );
};

