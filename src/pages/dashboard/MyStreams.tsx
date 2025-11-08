// @ts-nocheck
import React, { useState } from "react";
import { Text, Button, Icon } from "@stellar/design-system";
import { useNavigate } from "react-router-dom";
import { Box } from "../../components/layout/Box";
import { useStreams } from "../../hooks/useStreams";
import { useWallet } from "../../hooks/useWallet";
import { StreamCard } from "../../components/dashboard/StreamCard";
import { EmptyState } from "../../components/dashboard/EmptyState";
import "./my-streams.css";

export const MyStreams: React.FC = () => {
  const { address } = useWallet();
  const navigate = useNavigate();
  const { streams, sentStreams, receivedStreams, isLoading, error, refetch, withdraw, cancel, isWithdrawing, isCancelling } = useStreams();
  const [activeTab, setActiveTab] = useState<"all" | "sent" | "received">("all");

  // Determine which streams to display based on active tab
  const streamsToDisplay = activeTab === "sent" 
    ? sentStreams 
    : activeTab === "received" 
    ? receivedStreams 
    : streams;

  if (!streams || streams.length === 0) {
    if (isLoading) {
      return (
        <div className="my-streams-page">
          <Box gap="lg" direction="column">
            <Text as="h1" size="xl" className="page-title">My Streams</Text>
            <Box gap="md" direction="column" align="center">
              <Icon.Loading01 size="xl" />
              <Text as="p" size="md" color="secondary">Loading streams...</Text>
            </Box>
          </Box>
        </div>
      );
    }

    return (
      <div className="my-streams-page">
        <Box gap="lg" direction="column">
          <Text as="h1" size="xl" className="page-title">My Streams</Text>
          <EmptyState
            icon={<Icon.Inbox01 size="xl" />}
            title="No streams found"
            description="Create your first stream to get started with continuous payments."
            action={{
              label: "Create Stream",
              onClick: () => window.location.href = "/dashboard/streams/create"
            }}
          />
        </Box>
      </div>
    );
  }

  return (
    <div className="my-streams-page">
      <Box gap="lg" direction="column">
        {/* Header */}
        <Box gap="md" direction="row" justify="space-between" align="center" wrap="wrap">
          <Box gap="sm" direction="column">
            <Text as="h1" size="xl" className="page-title">My Streams</Text>
            <Text as="p" size="md" color="secondary">
              {streams.length} {streams.length === 1 ? 'stream' : 'streams'} total
            </Text>
          </Box>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>

        {/* Tabs */}
        <div className="streams-tabs">
          <button
            className={`tab-button ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All ({streams.length})
          </button>
          <button
            className={`tab-button ${activeTab === "sent" ? "active" : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            Sent ({sentStreams.length})
          </button>
          <button
            className={`tab-button ${activeTab === "received" ? "active" : ""}`}
            onClick={() => setActiveTab("received")}
          >
            Received ({receivedStreams.length})
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <Box gap="sm" direction="row" align="center">
            <Icon.AlertCircle size="sm" />
            <Text as="p" size="sm" color="error">
              Error loading streams: {error instanceof Error ? error.message : "Unknown error"}
            </Text>
          </Box>
        )}

        {/* Streams Grid */}
        <div className="streams-grid">
          {streamsToDisplay.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              type={stream.sender === address ? "sent" : "received"}
              onWithdraw={withdraw}
              onCancel={cancel}
              isWithdrawing={isWithdrawing}
              isCancelling={isCancelling}
              onOpenDetails={(s) => {
                navigate(`/dashboard/streams/${s.id}`);
              }}
            />
          ))}
        </div>
      </Box>
    </div>
  );
};

