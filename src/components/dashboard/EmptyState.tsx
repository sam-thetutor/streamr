// @ts-nocheck
import React from "react";
import { Text, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import "./dashboard-components.css";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <div className="empty-state">
      <Box gap="lg" direction="column" align="center">
        {icon || <Icon.Inbox01 size="xl" className="empty-state-icon" />}
        <Box gap="sm" direction="column" align="center">
          <Text as="h3" size="lg" className="empty-state-title">
            {title}
          </Text>
          <Text as="p" size="md" className="empty-state-description">
            {description}
          </Text>
        </Box>
        {action && (
          <button className="empty-state-button" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </Box>
    </div>
  );
};

