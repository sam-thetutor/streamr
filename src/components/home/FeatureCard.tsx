import React from "react";
import { Card, Text, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import "./home.css";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  ctaText: string;
  onClick: () => void;
  gradient: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  ctaText,
  onClick,
  gradient,
}) => {
  return (
    <div className="glass-card feature-card">
      <Card variant="primary" noPadding>
        <div className="feature-icon-wrapper" style={{ background: gradient }}>
          {icon}
        </div>
        <Box gap="sm" direction="column">
          <Text as="h3" size="lg" className="feature-title">
            {title}
          </Text>
          <Text as="p" size="md" className="feature-description">
            {description}
          </Text>
          <button className="glass-button" onClick={onClick}>
            {ctaText}
            <Icon.Code02 size="sm" />
          </button>
        </Box>
      </Card>
    </div>
  );
};

