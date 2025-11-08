import React from "react";
import { Text, Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { Box } from "../layout/Box";
import "./home.css";

export const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useWallet();

  return (
    <div className="hero-section">
      {/* Floating Particles Background */}
      <div className="hero-particles">
        <div className="particle particle-1"></div>
        <div className="particle particle-2"></div>
        <div className="particle particle-3"></div>
        <div className="particle particle-4"></div>
        <div className="particle particle-5"></div>
        <div className="particle particle-6"></div>
      </div>

      {/* Decorative Shapes */}
      <div className="hero-shapes">
        <div className="shape shape-circle"></div>
        <div className="shape shape-hexagon"></div>
        <div className="shape shape-diamond"></div>
      </div>

      {/* Animated Gradient Lines */}
      <div className="hero-gradient-lines">
        <div className="gradient-line line-1"></div>
        <div className="gradient-line line-2"></div>
      </div>

      {/* Main Content */}
      <div className="hero-content">
        <div className="hero-badge">
          <Icon.Zap size="sm" />
          <span>Built on Stellar</span>
        </div>

        <Text as="h1" size="xl" className="hero-title">
          Stream seamless recurring crypto payments
        </Text>

        <Text as="p" size="lg" className="hero-tagline">
          Automate salaries by streaming them so your team can withdraw whenever they want.
        </Text>
        <Text as="p" size="md" className="hero-tagline hero-tagline-secondary">
          Streamr is a multi-chain protocol that moves funds second-by-second, eliminating manual recurring payments.
        </Text>

        <div className="hero-cta">
          {address ? (
            <Box gap="md" direction="row" wrap="wrap" justify="center" className="hero-cta">
              <button className="hero-button hero-button-primary" onClick={() => navigate("/dashboard/streams/create")}>
                <span>Create Stream</span>
                <Icon.PlusSquare size="sm" />
              </button>
              <button className="hero-button hero-button-secondary" onClick={() => navigate("/dashboard/subscriptions")}>
                <span>Create Subscription</span>
                <Icon.PlusSquare size="sm" />
              </button>
            </Box>
          ) : (
            <Text as="p" size="sm" className="wallet-prompt">
              Connect your wallet to get started
            </Text>
          )}
        </div>
      </div>
    </div>
  );
};

