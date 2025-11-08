// @ts-nocheck
import React, { useState, useMemo, useEffect } from "react";
import { Text, Input, Button, Icon } from "@stellar/design-system";
import { useWallet } from "../../hooks/useWallet";
import { useStreamerContract } from "../../hooks/useStreamerContract";
import { useQueryClient } from "@tanstack/react-query";
import { useNotification } from "../../hooks/useNotification";
import { Box } from "../../components/layout/Box";
import { stellarNetwork } from "../../contracts/util";
import { getTokenContractAddress, type TokenType } from "../../contracts/tokens";
import "./create-subscription.css";

// Inject input styles to override Stellar CSS
const injectInputStyles = () => {
  const styleId = 'form-input-transparent-overrides';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .glass-form-card .Input__container,
    .glass-form-card .Input .Input__container,
    .glass-form-card .Input__container * {
      background-color: transparent !important;
      background: transparent !important;
      --Input-color-background: transparent !important;
    }
    .glass-form-card .Input__container:hover,
    .glass-form-card .Input__container:focus,
    .glass-form-card .Input__container:focus-within,
    .glass-form-card .Input:hover .Input__container,
    .glass-form-card .Input:focus .Input__container {
      background-color: transparent !important;
      background: transparent !important;
    }
    .glass-form-card .Input__container input,
    .glass-form-card .Input__container input:hover,
    .glass-form-card .Input__container input:focus {
      background-color: transparent !important;
      background: transparent !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .glass-form-card .Input {
      --Input-color-background: transparent !important;
    }
    .glass-form-card [class*="Input"] [class*="container"],
    .glass-form-card [class*="Input"] [class*="container"] * {
      background-color: transparent !important;
      background: transparent !important;
    }
  `;
  document.head.appendChild(style);
};

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 6, minimumFractionDigits: 0, ...options }).format(value);

export const CreateSubscription: React.FC = () => {
  const { address } = useWallet();
  const { executeContractMethod, getContractClient } = useStreamerContract();
  const queryClient = useQueryClient();
  const { addNotification } = useNotification();

  // Inject styles to ensure transparent inputs
  useEffect(() => {
    injectInputStyles();
  }, []);

  const [receiver, setReceiver] = useState("");
  const [tokenType, setTokenType] = useState<TokenType>("usdc");
  const [amount, setAmount] = useState("");
  const [intervalType, setIntervalType] = useState<"days" | "weeks" | "months">("months");
  const [intervalValue, setIntervalValue] = useState("1");
  const [firstPaymentDays, setFirstPaymentDays] = useState("0"); // Days until first payment (0 = immediate)
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const MAX_TITLE_LENGTH = 120;
  const MAX_DESCRIPTION_LENGTH = 1024;

  const tokenSymbol = useMemo(() => (tokenType === "usdc" ? "USDC" : "XLM"), [tokenType]);

  // Get token contract address
  const tokenContract = useMemo(() => {
    return getTokenContractAddress(stellarNetwork, tokenType);
  }, [tokenType]);

  // Calculate interval in seconds
  const intervalSeconds = useMemo(() => {
    if (!intervalValue || parseFloat(intervalValue) <= 0) return null;

    const value = parseFloat(intervalValue);
    let multiplier = 1;

    switch (intervalType) {
      case "days":
        multiplier = 86400; // seconds in a day
        break;
      case "weeks":
        multiplier = 604800; // seconds in a week
        break;
      case "months":
        multiplier = 2592000; // seconds in 30 days (approximate month)
        break;
    }

    return Math.floor(value * multiplier);
  }, [intervalValue, intervalType]);

  // Calculate first payment time (current time + delay)
  const firstPaymentTime = useMemo(() => {
    if (firstPaymentDays === "" || parseFloat(firstPaymentDays) < 0) return null;

    const days = parseFloat(firstPaymentDays) || 0;
    const now = Math.floor(Date.now() / 1000);
    const secondsToAdd = days * 86400;

    return now + secondsToAdd;
  }, [firstPaymentDays]);

  // Calculate amount per interval in atomic units
  const amountPerInterval = useMemo(() => {
    if (!amount || parseFloat(amount) <= 0) return null;
    // Assuming 7 decimals for tokens
    return BigInt(Math.floor(parseFloat(amount) * 10000000));
  }, [amount]);

  const nextChargeLabel = useMemo(() => {
    if (!firstPaymentTime) return "Pending input";
    if (firstPaymentDays === "0") return "Immediate after creation";
    const date = new Date(firstPaymentTime * 1000);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [firstPaymentTime, firstPaymentDays]);

  const perSecondAmount = useMemo(() => {
    if (!amount || !intervalSeconds || intervalSeconds <= 0) return 0;
    return parseFloat(amount) / intervalSeconds;
  }, [amount, intervalSeconds]);

  const intervalSummary = useMemo(() => {
    if (!intervalValue) return "";
    const plural = Number(intervalValue) === 1 ? "" : "s";
    return `${intervalValue} ${intervalType.replace('s', '')}${plural}`;
  }, [intervalType, intervalValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!address) {
      setError("Please connect your wallet");
      return;
    }

    try {
      // Validation
      if (!receiver || receiver.trim() === "") {
        setError("Please enter a receiver address");
        return;
      }

      if (!receiver.match(/^[A-Z0-9]{56}$/)) {
        setError("Invalid Stellar address format");
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        setError("Please enter a valid amount");
        return;
      }

      if (!intervalSeconds || intervalSeconds <= 0) {
        setError("Please enter a valid interval");
        return;
      }

      if (firstPaymentTime === null) {
        setError("Please enter a valid first payment delay");
        return;
      }

      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();

      if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        setError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
        return;
      }

      if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
        setError(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`);
        return;
      }

      setIsCreating(true);
      setError(null);
      setSuccess(null);

      try {
        const client = getContractClient();

        const result = await executeContractMethod(async () => {
          try {
            const assembledTx = await client.create_subscription({
              subscriber: address,
              receiver: receiver,
              token_contract: tokenContract,
              amount_per_interval: amountPerInterval!,
              interval_seconds: intervalSeconds!,
              first_payment_time: firstPaymentTime!,
              title: trimmedTitle ? trimmedTitle : undefined,
              description: trimmedDescription ? trimmedDescription : undefined,
            });
            return assembledTx;
          } catch (err: any) {
            console.error("Error in create_subscription call:", err);
            throw err;
          }
        });

        console.log("Subscription creation result:", result);

        const subscriptionId = result?.result || result?.subscriptionId || "unknown";
        setSuccess(`Subscription created successfully! Subscription ID: ${subscriptionId}`);

        // Invalidate and refetch subscriptions query
        queryClient.invalidateQueries({ queryKey: ["subscriptions", address] });

        // Reset form after delay
        setTimeout(() => {
          setReceiver("");
          setAmount("");
          setIntervalValue("1");
          setFirstPaymentDays("0");
          setTitle("");
          setDescription("");
          setSuccess(null);
        }, 5000);
      } catch (err: any) {
        console.error("Error creating subscription:", err);

        let errorMessage = "Failed to create subscription. Please try again.";
        if (err?.message) {
          if (err.message.includes("rejected") || err.message.includes("User rejected")) {
            errorMessage = "Transaction was cancelled.";
          } else if (err.message.includes("insufficient")) {
            errorMessage = "Insufficient balance. Please check your wallet.";
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
        addNotification(errorMessage, "error");
      } finally {
        setIsCreating(false);
      }
    } catch (err: any) {
      console.error("Unexpected error:", err);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  const previewDetails = {
    amount: amount ? `${formatNumber(Number(amount), { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${tokenSymbol}` : "--",
    perSecond: perSecondAmount > 0 ? `${formatNumber(perSecondAmount, { maximumFractionDigits: 6 })} ${tokenSymbol}/s` : "--",
    interval: intervalSummary || "--",
    nextCharge: nextChargeLabel,
    intervalSeconds: intervalSeconds ? `${formatNumber(intervalSeconds)} seconds` : "--",
    receiver,
  };

  return (
    <div className="create-subscription-page">
      <Box gap="lg" direction="column">
        <Box gap="xs" direction="column">
          <Text as="h1" size="xl" className="page-title">
            Create Subscription
          </Text>
          <Text as="p" size="md" style={{ opacity: 0.8 }}>
            Configure a recurring payment schedule and track the next charge at a glance.
          </Text>
        </Box>

        <div className="create-subscription-layout">
          <form onSubmit={handleSubmit} className="subscription-form-sections">
            {/* Subscription Details */}
            <Box gap="md" direction="column" className="glass-form-card section-card">
              <Box gap="xs" direction="column" className="section-header">
                <Box gap="xs" direction="column">
                  <Text as="h3" size="lg" className="section-title">
                    Subscription Details
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Give the subscription a recognizable title and explain its purpose.
                  </Text>
                </Box>
              </Box>
              <div className="field-grid">
                <div className="form-field full">
                  <label htmlFor="subscription-title">Subscription Title *</label>
                  <Input
                    id="subscription-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter a descriptive title"
                    disabled={isCreating}
                    maxLength={MAX_TITLE_LENGTH}
                  />
                  <Text as="p" size="xs" className="field-hint">
                    {title.trim().length}/{MAX_TITLE_LENGTH} characters
                  </Text>
                </div>
                <div className="form-field full">
                  <label htmlFor="subscription-description">Description</label>
                  <textarea
                    id="subscription-description"
                    className="description-textarea"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setError(null);
                    }}
                    placeholder="Add optional context for this subscription"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    disabled={isCreating}
                  />
                  <Text as="p" size="xs" className="field-hint">
                    {description.trim().length}/{MAX_DESCRIPTION_LENGTH} characters
                  </Text>
                </div>
              </div>
            </Box>

            {/* Recipient & Token */}
            <Box gap="md" direction="column" className="glass-form-card section-card">
              <Box gap="xs" direction="column" className="section-header">
                <Box gap="xs" direction="column">
                  <Text as="h3" size="lg" className="section-title">
                    Recipient & Token
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Select who receives payments and which asset funds the subscription.
                  </Text>
                </Box>
              </Box>
              <div className="field-grid two">
                <div className="form-field full">
                  <label htmlFor="receiver">Receiver Address *</label>
                  <Input
                    id="receiver"
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                    placeholder="GDMPPU5FPBKHDZEUYHBT4JWHPLUJHZDILGSIENDA7SBX5GU2OHJK2XDF"
                    disabled={isCreating}
                    autoComplete="off"
                    required
                  />
                  <Text as="p" size="xs" className="field-hint">
                    Stellar public key starting with "G" (56 characters)
                  </Text>
                </div>
                <div className="form-field">
                  <label htmlFor="token">Token *</label>
                  <select
                    id="token"
                    value={tokenType}
                    onChange={(e) => setTokenType(e.target.value as TokenType)}
                    disabled={isCreating}
                    className="form-select"
                  >
                    <option value="usdc">USDC</option>
                    <option value="xlm">XLM</option>
                  </select>
                </div>
              </div>
            </Box>

            {/* Billing Schedule */}
            <Box gap="md" direction="column" className="glass-form-card section-card">
              <Box gap="xs" direction="column" className="section-header">
                <Box gap="xs" direction="column">
                  <Text as="h3" size="lg" className="section-title">
                    Billing Schedule
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Define the amount, cadence, and start date for recurring charges.
                  </Text>
                </Box>
              </Box>
              <div className="field-grid two">
                <div className="form-field">
                  <label htmlFor="amount">Amount per Interval *</label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10.00"
                    disabled={isCreating}
                    autoComplete="off"
                    required
                  />
                  <Text as="p" size="xs" className="field-hint">
                    Charged in {tokenSymbol} every interval
                  </Text>
                </div>
                <div className="form-field">
                  <label htmlFor="intervalType">Interval Type *</label>
                  <select
                    id="intervalType"
                    value={intervalType}
                    onChange={(e) => setIntervalType(e.target.value as "days" | "weeks" | "months")}
                    disabled={isCreating}
                    className="interval-select"
                  >
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="intervalValue">Interval Value *</label>
                  <Input
                    id="intervalValue"
                    type="number"
                    min="1"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(e.target.value)}
                    placeholder="1"
                    disabled={isCreating}
                    autoComplete="off"
                    required
                  />
                  <Text as="p" size="xs" className="field-hint">
                    {intervalValue && intervalSeconds
                      ? `Interval equals ${formatNumber(intervalSeconds)} seconds`
                      : "Enter how many units per interval"}
                  </Text>
                </div>
                <div className="form-field">
                  <label htmlFor="firstPaymentDays">Days Until First Payment *</label>
                  <Input
                    id="firstPaymentDays"
                    type="number"
                    min="0"
                    value={firstPaymentDays}
                    onChange={(e) => setFirstPaymentDays(e.target.value)}
                    placeholder="0"
                    disabled={isCreating}
                    autoComplete="off"
                    required
                  />
                  <Text as="p" size="xs" className="field-hint">
                    {firstPaymentDays === "0"
                      ? "First payment triggers immediately"
                      : `First payment after ${firstPaymentDays} day(s)`}
                  </Text>
                </div>
              </div>
            </Box>

            <div className="form-footer">
              {error && (
                <div className="feedback-banner error">
                  <Icon.AlertCircle size="sm" />
                  <Text as="p" size="sm">{error}</Text>
                </div>
              )}

              {success && (
                <div className="feedback-banner success">
                  <Icon.CheckCircle size="sm" />
                  <Text as="p" size="sm">{success}</Text>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isCreating || !address}
                isLoading={isCreating}
              >
                {isCreating ? (
                  <>
                    <Icon.Loading01 size="sm" /> Creating Subscription
                  </>
                ) : (
                  "Create Subscription"
                )}
              </Button>
            </div>
          </form>

          {/* Preview */}
          <Box gap="md" direction="column" className="glass-form-card preview-panel">
            <Box gap="xs" direction="column">
              <Text as="h3" size="lg" className="section-title">
                Subscription Preview
              </Text>
              <Text as="p" size="sm" className="section-subtitle">
                Snapshot of the billing cadence and recipient before creating.
              </Text>
            </Box>

            {(title.trim().length > 0 || description.trim().length > 0) && (
              <Box gap="xs" direction="column" className="preview-meta">
                {title.trim().length > 0 && (
                  <Text as="p" size="lg" weight="medium">
                    {title.trim()}
                  </Text>
                )}
                {description.trim().length > 0 && (
                  <Text as="p" size="sm" style={{ opacity: 0.75 }}>
                    {description.trim()}
                  </Text>
                )}
              </Box>
            )}

            <div className="preview-grid">
              <div className="preview-card">
                <Text as="p" size="sm" style={{ opacity: 0.7 }}>Amount / Interval</Text>
                <Text as="p" size="lg" style={{ fontWeight: 600 }}>{previewDetails.amount}</Text>
              </div>
              <div className="preview-card">
                <Text as="p" size="sm" style={{ opacity: 0.7 }}>Per Second Rate</Text>
                <Text as="p" size="lg" style={{ fontWeight: 600 }}>{previewDetails.perSecond}</Text>
              </div>
              <div className="preview-card">
                <Text as="p" size="sm" style={{ opacity: 0.7 }}>Interval</Text>
                <Text as="p" size="lg" style={{ fontWeight: 600 }}>{previewDetails.interval}</Text>
                <Text as="p" size="xs" style={{ opacity: 0.6 }}>{previewDetails.intervalSeconds}</Text>
              </div>
              <div className="preview-card">
                <Text as="p" size="sm" style={{ opacity: 0.7 }}>Next Charge</Text>
                <Text as="p" size="lg" style={{ fontWeight: 600 }}>{previewDetails.nextCharge}</Text>
              </div>
            </div>

            {previewDetails.receiver ? (
              <div className="preview-recipient">
                <Text as="p" size="sm" style={{ opacity: 0.7 }}>Receiver</Text>
                <code>{previewDetails.receiver}</code>
              </div>
            ) : (
              <div className="preview-recipient-empty">
                <Icon.User03 size="sm" /> Receiver address will appear here
              </div>
            )}
          </Box>
        </div>
      </Box>
    </div>
  );
};

