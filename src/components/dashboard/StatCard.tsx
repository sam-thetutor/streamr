// @ts-nocheck
import React from "react";
import { Text, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import "./dashboard-components.css";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color?: "blue" | "purple" | "green" | "orange";
  isLoading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color = "blue",
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className={`stat-card stat-card-${color}`}>
        <Box gap="md" direction="column">
          <Box gap="sm" direction="row" align="center">
            <div className="stat-icon skeleton" style={{ color: 'var(--color-text-inverse)' }}>
              {React.cloneElement(icon as React.ReactElement, { style: { color: 'var(--color-text-inverse)' } })}
            </div>
            <Text as="p" size="sm" className="skeleton-text" style={{ color: 'var(--color-text-inverse)' }}>
              {title}
            </Text>
          </Box>
          <Text as="p" size="xxl" className="skeleton-text" style={{ color: 'var(--color-text-inverse)' }}>
            --
          </Text>
        </Box>
      </div>
    );
  }

  return (
    <div className={`stat-card stat-card-${color}`}>
      <Box gap="md" direction="column">
        <Box gap="sm" direction="row" align="center">
          <div className="stat-icon" style={{ color: 'var(--color-text-inverse)' }}>
            {React.cloneElement(icon as React.ReactElement, { style: { color: 'var(--color-text-inverse)' } })}
          </div>
          <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)' }}>
            {title}
          </Text>
        </Box>
        <Text as="p" size="xxl" className="stat-value" style={{ color: 'var(--color-text-inverse)' }}>
          {value}
        </Text>
      </Box>
    </div>
  );
};

