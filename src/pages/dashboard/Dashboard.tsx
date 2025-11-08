// @ts-nocheck
import React, { useMemo } from "react";
import { Text, Icon } from "@stellar/design-system";
import { Link } from "react-router-dom";
import { Box } from "../../components/layout/Box";
import { StatCard } from "../../components/dashboard/StatCard";
import { useStreams } from "../../hooks/useStreams";
import { useSubscriptions } from "../../hooks/useSubscriptions";
import { useWalletBalance } from "../../hooks/useWalletBalance";
import { useWallet } from "../../hooks/useWallet";
import { getTokenSymbol } from "../../contracts/tokens";
import { stellarNetwork } from "../../contracts/util";
import "./dashboard-overview.css";

export const Dashboard: React.FC = () => {
  const { address } = useWallet();
  const { streams, isLoading: streamsLoading } = useStreams();
  const { subscriptions, isLoading: subscriptionsLoading } = useSubscriptions();
  const { xlm, isLoading: balanceLoading } = useWalletBalance();

    // Calculate statistics
  const stats = useMemo(() => {
    // Active streams (sent + received) - streams from useStreams are already FormattedStream[]
    const activeStreams = streams.filter((s) => s.is_active);
    const activeStreamsCount = activeStreams.length;

    // Active subscriptions (my subscriptions + receiving)
    const activeSubscriptions = subscriptions.filter((s) => s.active);
    const activeSubscriptionsCount = activeSubscriptions.length;

    // Calculate total stream balance (sum of remaining deposits)
    const streamBalances: { amount: bigint; token: string }[] = [];

    activeStreams.forEach((stream) => {
      // Streams from useStreams are FormattedStream[], so remainingDeposit is available
      const remainingBalance = (stream as any).remainingDeposit || BigInt(0);

      if (remainingBalance > 0) {
        streamBalances.push({
          amount: remainingBalance,
          token: stream.token_contract,
        });
      }
    });

    // Calculate total subscription balance (sum of escrowed balances)
    let totalSubscriptionBalance = BigInt(0);
    const subscriptionBalances: { amount: bigint; token: string }[] = [];

    activeSubscriptions.forEach((subscription) => {
      if (subscription.balance > 0) {
        subscriptionBalances.push({
          amount: subscription.balance,
          token: subscription.token_contract,
        });
      }
    });

    // Format balances by token type
    const formatBalanceByToken = (
      balances: { amount: bigint; token: string }[]
    ) => {
      const byToken = balances.reduce((acc, b) => {
        const symbol = getTokenSymbol(b.token, stellarNetwork);
        if (!acc[symbol]) {
          acc[symbol] = BigInt(0);
        }
        acc[symbol] += b.amount;
        return acc;
      }, {} as Record<string, bigint>);

      return Object.entries(byToken)
        .map(([symbol, amount]) => {
          const formatted = (Number(amount) / 10000000).toFixed(2);
          return `${formatted} ${symbol}`;
        })
        .join(" + ") || "0.00";
    };

    const streamBalanceFormatted = formatBalanceByToken(streamBalances);
    const subscriptionBalanceFormatted =
      formatBalanceByToken(subscriptionBalances);

    return {
      activeStreamsCount,
      activeSubscriptionsCount,
      streamBalanceFormatted,
      subscriptionBalanceFormatted,
      walletBalance: xlm || "0",
    };
  }, [streams, subscriptions, xlm]);

  const isLoading = streamsLoading || subscriptionsLoading || balanceLoading;

  if (!address) {
    return (
      <div className="dashboard-overview">
        <Box gap="lg" direction="column">
          <Text as="h1" size="xxl" className="page-title">
            Dashboard Overview
          </Text>
          <Box gap="md" direction="column" align="center">
            <Icon.User03 size="xl" />
            <Text as="p" size="md" color="secondary">
              Please connect your wallet to view your dashboard.
            </Text>
          </Box>
        </Box>
      </div>
    );
  }

  return (
    <div className="dashboard-overview">
      <Box gap="lg" direction="column">
        {/* Header */}
        <Box gap="sm" direction="row" justify="space-between" align="center">
          <Text as="h1" size="xxl" className="page-title">
            Dashboard Overview
          </Text>
        </Box>

        {/* Statistics Cards */}
        <div className="stats-grid">
          <StatCard
            title="Active Streams"
            value={stats.activeStreamsCount.toString()}
            icon={<Icon.Code02 size="lg" />}
            color="blue"
            isLoading={isLoading}
          />
          <StatCard
            title="Active Subscriptions"
            value={stats.activeSubscriptionsCount.toString()}
            icon={<Icon.PlusSquare size="lg" />}
            color="purple"
            isLoading={isLoading}
          />
          <StatCard
            title="Stream Balance"
            value={stats.streamBalanceFormatted}
            icon={<Icon.Wallet01 size="lg" />}
            color="green"
            isLoading={isLoading}
          />
          <StatCard
            title="Subscription Balance"
            value={stats.subscriptionBalanceFormatted}
            icon={<Icon.PlusSquare size="lg" />}
            color="orange"
            isLoading={isLoading}
          />
          <StatCard
            title="Wallet Balance (XLM)"
            value={stats.walletBalance}
            icon={<Icon.Wallet01 size="lg" />}
            color="blue"
            isLoading={balanceLoading}
          />
        </div>

        {/* Quick Actions */}
        <Box gap="md" direction="column">
          <Text as="h2" size="lg">
            Quick Actions
          </Text>
          <div className="quick-actions-grid">
            <Link to="/dashboard/streams/create" className="quick-action-card">
              <Box gap="sm" direction="column" align="center">
                <Icon.PlusSquare size="xl" style={{ color: 'var(--color-text-inverse)' }} />
                <Text as="p" size="md" style={{ color: 'var(--color-text-inverse)' }}>
                  Create Stream
                </Text>
              </Box>
            </Link>
            <Link
              to="/dashboard/subscriptions/create"
              className="quick-action-card"
            >
              <Box gap="sm" direction="column" align="center">
                <Icon.PlusSquare size="xl" style={{ color: 'var(--color-text-inverse)' }} />
                <Text as="p" size="md" style={{ color: 'var(--color-text-inverse)' }}>
                  Create Subscription
                </Text>
              </Box>
            </Link>
            <Link to="/dashboard/streams" className="quick-action-card">
              <Box gap="sm" direction="column" align="center">
                <Icon.Code02 size="xl" style={{ color: 'var(--color-text-inverse)' }} />
                <Text as="p" size="md" style={{ color: 'var(--color-text-inverse)' }}>
                  View All Streams
                </Text>
              </Box>
            </Link>
            <Link to="/dashboard/subscriptions" className="quick-action-card">
              <Box gap="sm" direction="column" align="center">
                <Icon.Code02 size="xl" style={{ color: 'var(--color-text-inverse)' }} />
                <Text as="p" size="md" style={{ color: 'var(--color-text-inverse)' }}>
                  View All Subscriptions
                </Text>
              </Box>
            </Link>
          </div>
        </Box>
      </Box>
    </div>
  );
};
