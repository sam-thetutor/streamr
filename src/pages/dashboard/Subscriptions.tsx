// @ts-nocheck
import React, { useState } from "react";
import { Text, Button, Icon } from "@stellar/design-system";
import { Link } from "react-router-dom";
import { Box } from "../../components/layout/Box";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import { useWallet } from "../../hooks/useWallet";
import { SubscriptionCard } from "../../components/dashboard/SubscriptionCard";
import { EmptyState } from "../../components/dashboard/EmptyState";
import "./subscriptions.css";

export const Subscriptions: React.FC = () => {
  const { address } = useWallet();
  const { 
    subscriptions, 
    mySubscriptions, 
    subscriptionsToMe, 
    isLoading, 
    error, 
    refetch, 
    charge, 
    cancel, 
    deposit,
    isCharging, 
    isCancelling,
    isDepositing
  } = useSubscriptions();
  const [activeTab, setActiveTab] = useState<"all" | "subscriber" | "receiver">("all");

  // Determine which subscriptions to display based on active tab
  const subscriptionsToDisplay = activeTab === "subscriber" 
    ? mySubscriptions 
    : activeTab === "receiver" 
    ? subscriptionsToMe 
    : subscriptions;

  if (!address) {
    return (
      <div className="subscriptions-page">
        <Box gap="lg" direction="column">
          <Text as="h1" size="xxl" className="page-title">Subscriptions</Text>
          <EmptyState
            icon={<Icon.User03 size="xl" />}
            title="Connect Your Wallet"
            description="Please connect your wallet to view your subscriptions."
            action={{
              label: "Connect Wallet",
              onClick: () => (window.location.href = "/")
            }}
          />
        </Box>
      </div>
    );
  }

  if (!subscriptions || subscriptions.length === 0) {
    if (isLoading) {
      return (
        <div className="subscriptions-page">
          <Box gap="lg" direction="column">
            <Text as="h1" size="xxl" className="page-title">Subscriptions</Text>
            <Box gap="md" direction="column" align="center">
              <Icon.Loading01 size="xl" />
              <Text as="p" size="md" color="secondary">Loading subscriptions...</Text>
            </Box>
          </Box>
        </div>
      );
    }

    return (
      <div className="subscriptions-page">
        <Box gap="lg" direction="column">
          <Box gap="md" direction="row" justify="space-between" align="center" wrap="wrap">
            <Text as="h1" size="xxl" className="page-title">Subscriptions</Text>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.location.href = "/dashboard/subscriptions/create"}
            >
              Create Subscription
            </Button>
          </Box>
          <EmptyState
            icon={<Icon.Inbox01 size="xl" />}
            title="No subscriptions found"
            description="Create your first subscription to set up recurring payments."
            action={{
              label: "Create Subscription",
              onClick: () => (window.location.href = "/dashboard/subscriptions/create")
            }}
          />
        </Box>
      </div>
    );
  }

  return (
    <div className="subscriptions-page">
      <Box gap="lg" direction="column">
        {/* Header */}
        <Box gap="md" direction="row" justify="space-between" align="center" wrap="wrap">
          <Box gap="sm" direction="column">
            <Text as="h1" size="xxl" className="page-title">Subscriptions</Text>
            <Text as="p" size="md" color="secondary">
              {subscriptions.length} {subscriptions.length === 1 ? 'subscription' : 'subscriptions'} total
            </Text>
          </Box>
          <Box gap="sm" direction="row" wrap="wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              Refresh
            </Button>
            <Link to="/dashboard/subscriptions/create">
              <Button variant="primary" size="sm">
                Create Subscription
              </Button>
            </Link>
          </Box>
        </Box>

        {/* Tabs */}
        <div className="subscriptions-tabs">
          <button
            className={`tab-button ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({subscriptions.length})
          </button>
          <button
            className={`tab-button ${activeTab === "subscriber" ? "active" : ""}`}
            onClick={() => setActiveTab("subscriber")}
          >
            My Subscriptions ({mySubscriptions.length})
          </button>
          <button
            className={`tab-button ${activeTab === "receiver" ? "active" : ""}`}
            onClick={() => setActiveTab("receiver")}
          >
            Receiving ({subscriptionsToMe.length})
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <Box gap="sm" direction="row" align="center" className="error-message">
            <Icon.AlertCircle size="sm" />
            <Text as="p" size="sm" color="error">
              Error loading subscriptions: {error instanceof Error ? error.message : "Unknown error"}
            </Text>
          </Box>
        )}

        {/* Subscriptions Grid */}
        <div className="subscriptions-grid">
          {subscriptionsToDisplay.map((subscription) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  type={subscription.subscriber === address ? "subscriber" : "receiver"}
                  onCharge={charge}
                  onCancel={cancel}
                  onDeposit={(id, amount) => deposit({ subscriptionId: id, amount, tokenContract: subscription.token_contract })}
                  isCharging={isCharging}
                  isCancelling={isCancelling}
                  isDepositing={isDepositing}
                />
          ))}
        </div>
      </Box>
    </div>
  );
};
