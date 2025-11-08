import React from "react";
import { Text, Icon } from "@stellar/design-system";
import "../components/home/hero.css";

export const SimpleHeroSection: React.FC = () => {
  return (
    <section className="hero-section hero-section--showcase">
      <div className="hero-section__inner">

        <Text as="h1" size="xl" className="hero-heading">
          Automate transactions
          <br />
          and stream them by the second.
        </Text>

        <Text as="p" size="lg" className="hero-lead">
          Automate, manage subscriptions, and stream recurring payments.
        </Text>

        <div className="hero-actions">
          <a className="hero-action hero-action--primary" href="/dashboard/streams/create" style={{ textDecoration: "none" }}>
            Create a stream
            <Icon.ArrowRight size="sm" />

          </a>
          <a className="hero-action hero-action--secondary" href="dashboard/subscriptions/create" style={{ textDecoration: "none" }}>
            Launch a subscription
            <Icon.ArrowRight size="sm" />
          </a>
        </div>
      </div>
    </section>
  );
};

