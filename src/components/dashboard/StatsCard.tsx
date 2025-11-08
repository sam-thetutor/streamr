import React from "react";
import { Card, Text, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import "./dashboard-components.css";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    direction: "up" | "down";
    value: string;
  };
  gradient?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
  gradient = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
}) => {
  return (
    <div className="stats-card-component">
      <Card variant="primary">
        <Box gap="md" direction="column">
          <Box gap="sm" direction="row" justify="space-between" align="center">
            <div className="stats-icon-wrapper" style={{ background: gradient }}>
              {icon}
            </div>
            {trend && (
              <div className={`stats-trend stats-trend-${trend.direction}`}>
                <Icon.ArrowUp
                  size="sm"
                  style={{
                    transform: trend.direction === "down" ? "rotate(180deg)" : "none",
                  }}
                />
                <Text as="span" size="sm" className="stats-trend-text">
                  {trend.value}
                </Text>
              </div>
            )}
          </Box>
          <Box gap="xs" direction="column">
            <Text as="p" size="xl" className="stats-value">
              {value}
            </Text>
            <Text as="p" size="sm" color="secondary" className="stats-label">
              {title}
            </Text>
          </Box>
        </Box>
      </Card>
    </div>
  );
};

