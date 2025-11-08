import React from "react";
import { Layout, Text, Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { HeroSection } from "../components/home/HeroSection";
import { StatsSection } from "../components/home/StatsSection";
import { HowItWorks } from "../components/home/HowItWorks";
import { FeatureCard } from "../components/home/FeatureCard";
import { Box } from "../components/layout/Box";
import "../components/home/home.css";

const Home: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: "Payment Streams",
      description: "Create continuous payment streams that automatically distribute funds over time. Perfect for salaries, royalties, and regular payouts.",
      icon: <Icon.Code02 size="lg" />,
      ctaText: "Create Stream",
      onClick: () => navigate("/dashboard/streams/create"),
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    },
    {
      title: "Subscriptions",
      description: "Set up recurring payments with flexible schedules. Manage subscriptions easily and automate your billing cycle.",
      icon: <Icon.PlusSquare size="lg" />,
      ctaText: "Create Subscription",
      onClick: () => navigate("/dashboard/subscriptions"),
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    },
    {
      title: "Manage & Monitor",
      description: "Track all your streams and subscriptions in one place. Monitor balances, pause or cancel anytime.",
      icon: <Icon.Eye size="lg" />,
      ctaText: "View Dashboard",
      onClick: () => navigate("/dashboard"),
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    },
  ];

  return (
    <Layout.Content>
      {/* Hero Section */}
      <HeroSection />

      {/* Stats Section */}
      <Layout.Inset>
        <StatsSection />
      </Layout.Inset>


      {/* Features Section */}
      <Layout.Inset>
        <div className="features-section">
          <Text as="h2" size="xl" className="section-title">
            Features
          </Text>
          <Box gap="lg" direction="row" wrap="wrap" justify="center">
            {features.map((feature, index) => (
              <FeatureCard key={index} {...feature} />
            ))}
          </Box>
        </div>
      </Layout.Inset>

      {/* How It Works Section */}
      <Layout.Inset>
        <HowItWorks />
      </Layout.Inset>
    </Layout.Content>
  );
};

export default Home;
