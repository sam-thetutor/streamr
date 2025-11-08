// @ts-nocheck
import React, { useState } from "react";
import { Text, Button, Icon, Input, Modal } from "@stellar/design-system";
import { Box } from "../layout/Box";
import { FormattedSubscription } from "../../hooks/useSubscriptions";
import { getTokenSymbol } from "../../contracts/tokens";
import { stellarNetwork } from "../../contracts/util";
import "./dashboard-components.css";

interface SubscriptionCardProps {
  subscription: FormattedSubscription;
  type: "subscriber" | "receiver";
  onCancel?: (subscriptionId: number) => void;
  onCharge?: (subscriptionId: number) => void;
  onDeposit?: (subscriptionId: number, amount: bigint) => void;
  isCancelling?: boolean;
  isCharging?: boolean;
  isDepositing?: boolean;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  type,
  onCancel,
  onCharge,
  onDeposit,
  isCancelling = false,
  isCharging = false,
  isDepositing = false,
}) => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "Due now";

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Format interval
  const formatInterval = (seconds: bigint) => {
    const s = Number(seconds);
    if (s < 3600) return `${s / 60} minutes`;
    if (s < 86400) return `${s / 3600} hours`;
    if (s < 604800) return `${s / 86400} days`;
    if (s < 2592000) return `${s / 604800} weeks`;
    return `${s / 2592000} months`;
  };

  const canCancel = subscription.active && type === "subscriber";
  const canCharge = subscription.isDue && type === "receiver";
  const canDeposit = subscription.active && type === "subscriber";

  // Get token symbol from contract address
  const tokenSymbol = getTokenSymbol(subscription.token_contract, stellarNetwork);

  const subscriptionTitle = (subscription.title || "").toString().trim();
  const subscriptionDescription = (subscription.description || "").toString().trim();
  const displayTitle = subscriptionTitle.length ? subscriptionTitle : `Subscription #${subscription.id}`;
  if (process.env.NODE_ENV !== "production") {
    console.debug("SubscriptionCard render", {
      id: subscription.id,
      rawTitle: subscription.title,
      displayTitle,
    });
  }

  const handleDeposit = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    const amount = BigInt(Math.floor(parseFloat(depositAmount) * 10000000));
    onDeposit?.(subscription.id, amount);
    setShowDepositModal(false);
    setDepositAmount("");
  };

  return (
    <div className="subscription-card">
      <Box gap="sm" direction="column">
        {/* Header */}
        <Box gap="sm" direction="row" justify="space-between" align="center">
          <Box gap="xs" direction="column">
            <Text as="h3" size="md" className="subscription-card-title">
              {displayTitle}
            </Text>
            <Text as="p" size="xs" style={{ color: 'var(--color-text-inverse)', opacity: 0.6 }}>
              Subscription #{subscription.id}
            </Text>
            {subscriptionDescription.length > 0 && (
              <Text as="p" size="sm" className="subscription-card-description">
                {subscriptionDescription}
              </Text>
            )}
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              {type === "subscriber" ? "To" : "From"}: {formatAddress(type === "subscriber" ? subscription.receiver : subscription.subscriber)}
            </Text>
          </Box>
          <div className={`subscription-status subscription-status-${subscription.active ? "active" : "inactive"}`}>
            <Text as="span" size="xs">
              {subscription.active ? (subscription.isDue ? "Due" : "Active") : "Inactive"}
            </Text>
          </div>
        </Box>

        {/* Subscription Details */}
        <Box gap="sm" direction="column">
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Amount per interval
            </Text>
            <Text as="p" size="md" className="subscription-amount">
              {subscription.amountPerIntervalFormatted} {tokenSymbol}
            </Text>
          </Box>
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Interval
            </Text>
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)' }}>
              {formatInterval(subscription.interval_seconds)}
            </Text>
          </Box>
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Next payment
            </Text>
            <Text as="p" size="sm" className={subscription.isDue ? "subscription-due" : ""} style={{ color: 'var(--color-text-inverse)' }}>
              {subscription.isDue
                ? "Due now"
                : formatTimeRemaining(subscription.timeUntilNextPayment)}
            </Text>
          </Box>
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Next payment date
            </Text>
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)' }}>
              {subscription.nextPaymentDate.toLocaleDateString()}
            </Text>
          </Box>
          <Box gap="xs" direction="row" justify="space-between" align="center">
            <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Balance (Escrowed)
            </Text>
            <Text as="p" size="md" className="subscription-balance">
              {subscription.balanceFormatted} {tokenSymbol}
            </Text>
          </Box>
        </Box>

        {/* Actions */}
        {(canCancel || canCharge || canDeposit) && (
          <Box gap="sm" direction="row" wrap="wrap">
            {canDeposit && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowDepositModal(true)}
                disabled={isDepositing}
              >
                Deposit
              </Button>
            )}
            {canCharge && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onCharge?.(subscription.id)}
                disabled={isCharging}
              >
                {isCharging ? (
                  <>
                    <Icon.Loading01 size="sm" />
                    Charging...
                  </>
                ) : (
                  "Charge Now"
                )}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCancel?.(subscription.id)}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <>
                    <Icon.Loading01 size="sm" />
                    Cancelling...
                  </>
                ) : (
                  "Cancel"
                )}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Deposit Modal */}
      {showDepositModal && (
        <Modal
          visible={showDepositModal}
          onClose={() => {
            setShowDepositModal(false);
            setDepositAmount("");
          }}
        >
          <Box gap="md" direction="column">
            <Text as="h2" size="lg">
              Deposit Funds
            </Text>
            <Text as="p" size="sm" color="secondary">
              Add funds to your subscription. These funds are isolated and will be used for future payments.
            </Text>
            <Input
              id="deposit-amount"
              label={`Amount (${tokenSymbol})`}
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="e.g., 10.00"
              fieldSize="md"
              min="0.01"
              step="0.01"
              className="deposit-input"
            />
            <Box gap="sm" direction="row" justify="flex-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowDepositModal(false);
                  setDepositAmount("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0 || isDepositing}
              >
                {isDepositing ? (
                  <>
                    <Icon.Loading01 size="sm" />
                    Depositing...
                  </>
                ) : (
                  "Deposit"
                )}
              </Button>
            </Box>
          </Box>
        </Modal>
      )}
    </div>
  );
};

