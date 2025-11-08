import React from "react";
import { Text, Icon } from "@stellar/design-system";
import { Box } from "../layout/Box";
import "./home.css";

interface StepProps {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ number, title, description, icon }) => {
  return (
    <div className="glass-card step-card">
      <div className="step-number">{number}</div>
      <div className="step-icon-wrapper">{icon}</div>
      <Box gap="sm" direction="column" align="center">
        <Text as="h4" size="md" className="step-title">
          {title}
        </Text>
        <Text as="p" size="sm" className="step-description">
          {description}
        </Text>
      </Box>
    </div>
  );
};

export const HowItWorks: React.FC = () => {
  const steps = [
    {
      number: 1,
      title: "Connect Wallet",
      description: "Link your Stellar wallet to get started",
      icon: <Icon.User03 size="lg" />,
    },
    {
      number: 2,
      title: "Create Stream or Subscription",
      description: "Set up your payment stream or recurring subscription",
      icon: <Icon.PlusSquare size="lg" />,
    },
    {
      number: 3,
      title: "Manage & Monitor",
      description: "Track your payments and manage them anytime",
      icon: <Icon.Eye size="lg" />,
    },
  ];

  return (
    <div className="how-it-works-section">
      <Text as="h2" size="xl" className="section-title">
        How It Works
      </Text>
      <Box gap="lg" direction="row" wrap="wrap" justify="center">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <Step {...step} />
            {index < steps.length - 1 && (
              <div className="step-connector">
                <Icon.Code02 size="md" />
              </div>
            )}
          </React.Fragment>
        ))}
      </Box>
    </div>
  );
};

