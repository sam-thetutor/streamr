import React from "react";
import { Text, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import "./home.css";

interface StatItemProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}

const StatItem: React.FC<StatItemProps> = ({ label, value, icon, gradient }) => {
  return (
    <div className="glass-card stat-card">
      <div className="stat-icon-wrapper" style={{ background: gradient }}>
        {icon}
      </div>
      <Box gap="xs" direction="column" align="center">
        <Text as="p" size="xl" className="stat-value">
          {value}
        </Text>
        <Text as="p" size="sm" className="stat-label">
          {label}
        </Text>
      </Box>
    </div>
  );
};

export const StatsSection: React.FC = () => {
  const stats = [
    {
      label: "Active Streams",
      value: "0",
      icon: <Icon.Code02 size="lg" />,
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      label: "Subscriptions",
      value: "0",
      icon: <Icon.PlusSquare size="lg" />,
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      label: "Total Volume",
      value: "0 XLM",
      icon: <Icon.Eye size="lg" />,
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  return (
    <div className="stats-section">
      <Box gap="lg" direction="row" wrap="wrap" justify="center">
        {stats.map((stat, index) => (
          <StatItem key={index} {...stat} />
        ))}
      </Box>
    </div>
  );
};

