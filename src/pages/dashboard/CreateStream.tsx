// @ts-nocheck
import React, { useState, useMemo, useEffect, useRef } from "react";
import { Text, Input, Icon, Button } from "@stellar/design-system";
import { useWallet } from "../../hooks/useWallet";
import { useStreamerContract } from "../../hooks/useStreamerContract";
import { useQueryClient } from "@tanstack/react-query";
import { Box } from "../../components/layout/Box";
import { stellarNetwork } from "../../contracts/util";
import { getTokenContractAddress, type TokenType } from "../../contracts/tokens";
import "./create-stream.css";

// Inject input styles to override Stellar CSS
const injectInputStyles = () => {
  const styleId = 'form-input-transparent-overrides';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .glass-form-card .Input__container,
    .glass-form-card .Input .Input__container,
    .glass-form-card .Input__container *,
    .glass-form-card .Input .Input__container * {
      background-color: transparent !important;
      background: transparent !important;
      --Input-color-background: transparent !important;
    }
    .glass-form-card .Input__container:hover,
    .glass-form-card .Input__container:focus,
    .glass-form-card .Input__container:focus-within,
    .glass-form-card .Input:hover .Input__container,
    .glass-form-card .Input:focus .Input__container,
    .glass-form-card .Input:focus-within .Input__container,
    .glass-form-card .Input__container:hover *,
    .glass-form-card .Input__container:focus *,
    .glass-form-card .Input__container:focus-within * {
      background-color: transparent !important;
      background: transparent !important;
    }
    .glass-form-card .Input__container input,
    .glass-form-card .Input__container input:hover,
    .glass-form-card .Input__container input:focus,
    .glass-form-card .Input__container input:active,
    .glass-form-card .Input__container input:disabled {
      background-color: transparent !important;
      background: transparent !important;
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .glass-form-card input,
    .glass-form-card textarea,
    .glass-form-card select {
      background-color: transparent !important;
      background: transparent !important;
      background-image: none !important;
      -webkit-appearance: none;
      appearance: none;
      color-scheme: dark;
    }
    .glass-form-card input:-webkit-autofill,
    .glass-form-card input:-webkit-autofill:hover,
    .glass-form-card input:-webkit-autofill:focus,
    .glass-form-card input:-webkit-autofill:active {
      -webkit-box-shadow: 0 0 0px 1000px transparent inset !important;
      box-shadow: 0 0 0px 1000px transparent inset !important;
      -webkit-text-fill-color: #ffffff !important;
      caret-color: #ffffff !important;
      transition: background-color 99999s ease 0s !important;
    }
    .glass-form-card input:-webkit-autofill-previewed {
      -webkit-box-shadow: 0 0 0px 1000px transparent inset !important;
      box-shadow: 0 0 0px 1000px transparent inset !important;
      -webkit-text-fill-color: #ffffff !important;
    }
    .glass-form-card .Input,
    .glass-form-card .Input * {
      --Input-color-background: transparent !important;
    }
    .glass-form-card [class*="Input"] [class*="container"],
    .glass-form-card [class*="Input"] [class*="container"] *,
    .glass-form-card [class*="Input"] [class*="container"] input,
    .glass-form-card [class*="Input"] [class*="container"] input:hover,
    .glass-form-card [class*="Input"] [class*="container"] input:focus {
      background-color: transparent !important;
      background: transparent !important;
    }
    .glass-form-card [class*="Input"] [class*="container"] input {
      color: #ffffff !important;
      -webkit-text-fill-color: #ffffff !important;
    }
  `;
  document.head.appendChild(style);
};

export const CreateStream: React.FC = () => {
  // Hooks must be called unconditionally at the top level
  const { address } = useWallet();
  const { executeContractMethod, getContractClient } = useStreamerContract();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inject styles to ensure transparent inputs
  useEffect(() => {
    injectInputStyles();
  }, []);
  
  // Multi-recipient entries: address + per-period amount (display units)
  const [recipients, setRecipients] = useState<Array<{ address: string; amount: string }>>([]);
  const [tempRecipient, setTempRecipient] = useState<string>("");
  const [tempAmount, setTempAmount] = useState<string>("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [tokenType, setTokenType] = useState<TokenType>("usdc");
  const [deposit, setDeposit] = useState("");
  // Legacy single amount removed in favor of per-recipient amount
  const [ratePeriod, setRatePeriod] = useState<"hour" | "day" | "week" | "month">("day");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  // Helpers
  const periodSecondsMap: Record<string, number> = {
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2592000,
  };

  const MAX_TITLE_LENGTH = 120;
  const MAX_DESCRIPTION_LENGTH = 1024;

  const tokenSymbol = useMemo(() => (tokenType === "usdc" ? "USDC" : "XLM"), [tokenType]);

  // Preview values
  const preview = useMemo(() => {
    const periodSeconds = periodSecondsMap[ratePeriod];
    const parsed = recipients
      .filter(r => r.address && r.amount)
      .map(r => ({
        address: r.address,
        amountNum: Number(r.amount),
        perSecond: Number(r.amount) > 0 ? (Number(r.amount) / periodSeconds) : 0,
      }));
    const totalRecipients = parsed.length;
    const totalPerPeriod = parsed.reduce((a, b) => a + (isFinite(b.amountNum) ? b.amountNum : 0), 0);
    const totalPerSecond = parsed.reduce((a, b) => a + (isFinite(b.perSecond) ? b.perSecond : 0), 0);
    const depositNum = Number(deposit || 0);
    // Estimate duration in seconds using display units consistently (approx; true drain computed on-chain in atomic units)
    const estSeconds = totalPerSecond > 0 ? ((depositNum) / totalPerSecond) : 0;
    const estDays = estSeconds > 0 ? Math.floor(estSeconds / 86400) : 0;
    const estHours = estSeconds > 0 ? Math.floor((estSeconds % 86400) / 3600) : 0;
    return { parsed, totalRecipients, totalPerPeriod, totalPerSecond, estDays, estHours };
  }, [recipients, ratePeriod, deposit, periodSecondsMap]);

  const triggerImport = () => fileInputRef.current?.click();

  const handleAddOrUpdateRecipient = () => {
    const addr = tempRecipient.trim();
    const amt = tempAmount.trim();
    if (!addr || !amt) return;
    if (!addr.startsWith('G') && !addr.startsWith('C')) {
      setError("Recipient address must start with 'G' or 'C'");
      return;
    }
    const n = Number(amt);
    if (!isFinite(n) || n <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    setError(null);

    setRecipients(prev => {
      const next = [...prev];
      if (editIndex !== null) {
        next[editIndex] = { address: addr, amount: amt };
      } else {
        next.push({ address: addr, amount: amt });
      }
      return next;
    });
    setTempRecipient("");
    setTempAmount("");
    setEditIndex(null);
  };

  const handleEditRecipient = (index: number) => {
    const r = recipients[index];
    setTempRecipient(r.address);
    setTempAmount(r.amount);
    setEditIndex(index);
  };

  const handleDeleteRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
    if (editIndex === index) {
      setEditIndex(null);
      setTempRecipient("");
      setTempAmount("");
    }
  };

  const importCsv = (text: string) => {
    // CSV format: address,amount
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const rows = lines.map(l => l.split(/,|\t/).map(s => s.trim()));
    const entries: Array<{ address: string; amount: string }> = [];
    for (const [addr, amt] of rows) {
      if (!addr || !amt) continue;
      entries.push({ address: addr, amount: amt });
    }
    if (entries.length) {
      setRecipients(entries);
      setError(null);
    }
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importCsv(text);
    } catch (err) {
      console.error("Import failed:", err);
      setError("Failed to import recipients file. Use CSV with columns: address,amount");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Get token contract address based on selected token and network
  const tokenContract = useMemo(() => {
    return getTokenContractAddress(stellarNetwork, tokenType);
  }, [tokenType]);

  // No single-rate memo; per-recipient amounts are converted on submit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (!address) {
        setError("Please connect your wallet");
        return;
      }

      if (!executeContractMethod || !getContractClient) {
        setError("Contract methods not available. Please refresh the page.");
        return;
      }

      const hasToken = !!tokenContract;
      const hasDeposit = !!deposit;
      const validRecipients = recipients.length > 0 && recipients.every(r => r.address && r.amount);
      if (!hasToken || !hasDeposit || !validRecipients) {
        setError("Please fill in all required fields");
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

      // Validate addresses - Stellar addresses start with 'G' or contract addresses start with 'C'
      for (const r of recipients) {
        if (!r.address.startsWith('G') && !r.address.startsWith('C')) {
          setError("Each recipient must start with 'G' (account) or 'C' (contract)");
          return;
        }
      }

      // Validate deposit amount (must be > 0)
      const depositNum = parseFloat(deposit);
      if (isNaN(depositNum) || depositNum <= 0) {
        setError("Deposit amount must be greater than 0");
        return;
      }

      // Validate per-period amounts
      for (const r of recipients) {
        const n = parseFloat(r.amount);
        if (isNaN(n) || n <= 0) {
          setError("Each recipient amount must be > 0");
          return;
        }
      }

      setIsCreating(true);
      setError(null);
      setSuccess(null);

      try {
        const client = getContractClient();
        if (!client) {
          throw new Error("Failed to get contract client");
        }

        const depositAtomic = BigInt(Math.floor(depositNum * 10000000));

        // Validate depositAtomic is positive (contract requires deposit > 0)
        if (depositAtomic <= 0) {
          throw new Error("Deposit amount is too small");
        }

        // Derive per-period amount and period_seconds based on the selected ratePeriod
        // We treat the entered rateAmount as the amount per selected period
        const periodSeconds = BigInt(periodSecondsMap[ratePeriod]);
        const amountsPerPeriodAtomic = recipients.map(r => BigInt(Math.floor(parseFloat(r.amount) * 10000000)));
        const recipientAddresses = recipients.map(r => r.address);

        console.log("Creating stream with per-recipient allocations:", {
          sender: address,
          recipients: recipientAddresses,
          token_contract: tokenContract,
          amounts_per_period: amountsPerPeriodAtomic.map(x => x.toString()),
          period_seconds: periodSeconds.toString(),
          deposit: depositAtomic.toString(),
          title: trimmedTitle,
          description: trimmedDescription,
        });

        // The contract client expects strings for addresses, not Address objects
        // It handles the conversion internally
        const result = await executeContractMethod(async () => {
          try {
            const assembledTx = await client.create_stream({
              sender: address,
              recipients: recipientAddresses,
              token_contract: tokenContract,
              amounts_per_period: amountsPerPeriodAtomic,
              period_seconds: periodSeconds,
              deposit: depositAtomic,
              title: trimmedTitle ? trimmedTitle : undefined,
              description: trimmedDescription ? trimmedDescription : undefined,
            });
            return assembledTx;
          } catch (err: any) {
            console.error("Error in create_stream call:", err);
            throw err;
          }
        });

        console.log("Stream creation result:", result);

        // Get stream ID from the result
        const streamId = result?.result || result?.streamId || "unknown";
        setSuccess(`Stream created successfully! Stream ID: ${streamId}`);
        
        // Invalidate and refetch streams query to show the new stream
        queryClient.invalidateQueries({ queryKey: ["streams"] });
        
        // Reset form after delay
        setTimeout(() => {
          setRecipients([]);
          setDeposit("");
          setTitle("");
          setDescription("");
          setSuccess(null);
        }, 5000);
      } catch (err: any) {
        console.error("Error creating stream:", err);
        
        // Extract error message
        let errorMessage = "Failed to create stream. Please try again.";
        
        if (err?.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else if (err?.error) {
          errorMessage = err.error;
        }
        
        setError(errorMessage);
      } finally {
        setIsCreating(false);
      }
    } catch (err: any) {
      console.error("Unexpected error in handleSubmit:", err);
      setError("An unexpected error occurred. Please try again.");
      setIsCreating(false);
    }
  };

  if (!address) {
    return (
      <div className="create-stream-page">
        <div className="form-empty-state">
          <Box gap="md" direction="column" align="center">
            <Icon.User03 size="xl" style={{ color: 'var(--color-text-inverse)' }} />
            <Text as="h2" size="lg" style={{ color: 'var(--color-text-inverse)' }}>
              Connect Your Wallet
            </Text>
            <Text as="p" size="md" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
              Please connect your wallet to create a stream
            </Text>
          </Box>
        </div>
      </div>
    );
  }

  return (
    <div className="create-stream-page">
      <Box gap="lg" direction="column">
        <Box gap="xs" direction="column">
          <Text as="h1" size="xl" className="page-title" style={{ color: 'var(--color-text-inverse)' }}>
            Create Stream
          </Text>
          <Text as="p" size="md" style={{ color: 'var(--color-text-inverse)', opacity: 0.75 }}>
            Configure the details of your continuous payment and add the recipients you want to fund.
          </Text>
        </Box>

        <div className="create-stream-layout">
          <form onSubmit={handleSubmit} className="form-sections">
            <section className="section-card glass-form-card">
              <div className="section-header">
                <div>
                  <Text as="h3" size="md" className="section-title">
                    Stream details
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Give recipients context about what this stream is funding.
                  </Text>
                </div>
              </div>

              <div className="field-grid two">
                <div className="form-field">
                  <label htmlFor="stream-title">Stream title</label>
                  <Input
                    id="stream-title"
                    fieldSize="md"
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter a descriptive title"
                    maxLength={MAX_TITLE_LENGTH}
                    disabled={isCreating}
                    autoComplete="off"
                  />
                  <span className="field-hint">
                    {title.trim().length}/{MAX_TITLE_LENGTH} characters
                  </span>
                </div>

                <div className="form-field full">
                  <label htmlFor="stream-description">Description</label>
                  <textarea
                    id="stream-description"
                    className="description-textarea"
                    value={description}
                    onChange={(e) => {
                      setDescription(e.target.value);
                      setError(null);
                    }}
                    placeholder="Add context for recipients or viewers (optional)"
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    disabled={isCreating}
                  />
                  <span className="field-hint">
                    {description.trim().length}/{MAX_DESCRIPTION_LENGTH} characters
                  </span>
                </div>
              </div>
            </section>

            <section className="section-card glass-form-card">
              <div className="section-header">
                <div>
                  <Text as="h3" size="md" className="section-title">
                    Schedule & funding
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Choose the asset, per-period cadence, and how much to deposit upfront.
                  </Text>
                </div>
              </div>

              <div className="field-grid three">
                <div className="form-field">
                  <label htmlFor="token-select">Token *</label>
                  <select
                    id="token-select"
                    value={tokenType}
                    onChange={(e) => {
                      setTokenType(e.target.value as TokenType);
                      setError(null);
                    }}
                    className="token-select"
                    disabled={isCreating}
                  >
                    <option value="usdc">USDC</option>
                    <option value="xlm">XLM</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="rate-period">Amounts are per</label>
                  <select
                    id="rate-period"
                    value={ratePeriod}
                    onChange={(e) => setRatePeriod(e.target.value as typeof ratePeriod)}
                    className="rate-period-select"
                    disabled={isCreating}
                  >
                    <option value="hour">Hour</option>
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </select>
                </div>

                <div className="form-field">
                  <label htmlFor="deposit">Total deposit amount *</label>
                  <Input
                    id="deposit"
                    fieldSize="md"
                    type="number"
                    value={deposit}
                    onChange={(e) => {
                      setDeposit(e.target.value);
                      setError(null);
                    }}
                    placeholder="100.00"
                    step="0.01"
                    min="0"
                    disabled={isCreating}
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
              </div>
            </section>

            <section className="section-card glass-form-card">
              <div className="section-header">
                <div>
                  <Text as="h3" size="md" className="section-title">
                    Recipients
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Add one or more accounts and specify how much each should receive every {ratePeriod}.
                  </Text>
                </div>
                <div className="section-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv,.tsv,text/tab-separated-values"
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                  />
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={triggerImport}
                    disabled={isCreating}
                    title="Import recipients from CSV (address,amount)"
                  >
                    <Icon.Upload01 size="sm" /> Import CSV
                  </button>
                </div>
              </div>

              <div className="recipient-input-row">
                <Input
                  id="recipient-input"
                  fieldSize="md"
                  type="text"
                  value={tempRecipient}
                  onChange={(e) => setTempRecipient(e.target.value)}
                  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  disabled={isCreating}
                  autoComplete="off"
                  data-lpignore="true"
                  data-form-type="other"
                />
                <Input
                  id="amount-input"
                  fieldSize="md"
                  type="number"
                  value={tempAmount}
                  onChange={(e) => setTempAmount(e.target.value)}
                  placeholder={`Amount per ${ratePeriod}`}
                  step="0.01"
                  min="0"
                  disabled={isCreating}
                  autoComplete="off"
                  data-lpignore="true"
                />
                <button
                  type="button"
                  onClick={handleAddOrUpdateRecipient}
                  className="add-recipient-button"
                  title={editIndex !== null ? "Update recipient" : "Add recipient"}
                  disabled={isCreating}
                >
                  {editIndex !== null ? (
                    <>
                      <Icon.CheckCircle size="sm" /> Update
                    </>
                  ) : (
                    <>
                      <Icon.PlusSquare size="sm" /> Add
                    </>
                  )}
                </button>
              </div>

              <div className="recipient-table">
                <div className="recipient-table-header">
                  <span>Recipient</span>
                  <span>Per {ratePeriod}</span>
                  <span>Per second</span>
                  <span>Actions</span>
                </div>
                {recipients.length === 0 ? (
                  <div className="recipient-empty">
                    <Icon.Inbox01 size="sm" />
                    <span>No recipients yet. Add someone above or import a CSV.</span>
                  </div>
                ) : (
                  recipients.map((r, i) => {
                    const perSecond = Number(r.amount) / periodSecondsMap[ratePeriod];
                    return (
                      <div key={i} className="recipient-table-row">
                        <code className="addr">{r.address}</code>
                        <span>{Number(r.amount).toFixed(2)} {tokenSymbol}</span>
                        <span>{(isFinite(perSecond) ? perSecond : 0).toFixed(6)} {tokenSymbol}/s</span>
                        <span className="recipient-actions">
                          <button type="button" onClick={() => handleEditRecipient(i)}>
                            Edit
                          </button>
                          <button type="button" className="destructive" onClick={() => handleDeleteRecipient(i)}>
                            Delete
                          </button>
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {error && (
              <div className="feedback-banner error">
                <Icon.AlertCircle size="sm" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="feedback-banner success">
                <Icon.CheckCircle size="sm" />
                <span>{success}</span>
              </div>
            )}

            <div className="form-footer">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={
                  isCreating ||
                  !tokenContract ||
                  !deposit ||
                  recipients.length === 0 ||
                  !recipients.every(r => r.address && r.amount)
                }
              >
                {isCreating ? (
                  <>
                    <Icon.Loading01 size="sm" /> Creating
                  </>
                ) : (
                  <>
                    <Icon.PlusSquare size="sm" /> Create Stream
                  </>
                )}
              </Button>
              <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.65 }}>
                You’ll be asked to review and sign the transaction with your connected wallet.
              </Text>
            </div>
          </form>

          <aside className="preview-panel glass-form-card">
            <Box gap="md" direction="column">
              <div className="section-header">
                <div>
                  <Text as="h3" size="md" className="section-title">
                    Stream preview
                  </Text>
                  <Text as="p" size="sm" className="section-subtitle">
                    Key metrics update in real-time as you configure the stream.
                  </Text>
                </div>
              </div>

              <div className="preview-grid">
                <div className="preview-card">
                  <Text as="p" size="sm" style={{ opacity: 0.8 }}>Recipients</Text>
                  <Text as="p" size="lg" className="stream-stat-value">{preview.totalRecipients}</Text>
                </div>
                <div className="preview-card">
                  <Text as="p" size="sm" style={{ opacity: 0.8 }}>Total per {ratePeriod}</Text>
                  <Text as="p" size="lg" className="stream-stat-value">{preview.totalPerPeriod.toFixed(2)} {tokenSymbol}</Text>
                </div>
                <div className="preview-card">
                  <Text as="p" size="sm" style={{ opacity: 0.8 }}>Total per second</Text>
                  <Text as="p" size="lg" className="stream-stat-value">{preview.totalPerSecond.toFixed(6)} {tokenSymbol}/s</Text>
                </div>
                <div className="preview-card">
                  <Text as="p" size="sm" style={{ opacity: 0.8 }}>Est. duration</Text>
                  <Text as="p" size="lg" className="stream-stat-value">{preview.estDays}d {preview.estHours}h</Text>
                </div>
              </div>

              {(title.trim().length > 0 || description.trim().length > 0) && (
                <div className="preview-meta">
                  {title.trim().length > 0 && (
                    <Text as="p" size="lg" weight="medium" style={{ color: 'var(--color-text-inverse)' }}>
                      {title.trim()}
                    </Text>
                  )}
                  {description.trim().length > 0 && (
                    <Text as="p" size="sm" style={{ color: 'var(--color-text-inverse)', opacity: 0.8 }}>
                      {description.trim()}
                    </Text>
                  )}
                </div>
              )}

              <div className="preview-recipient-list">
                <div className="preview-recipient-header">
                  <span>Recipient</span>
                  <span>Per {ratePeriod}</span>
                </div>
                {recipients.length === 0 ? (
                  <div className="preview-recipient-empty">
                    <Icon.Inbox01 size="sm" />
                    <span>No recipients yet.</span>
                  </div>
                ) : (
                  recipients.map((r, i) => (
                    <div key={i} className="preview-recipient-row">
                      <code className="addr">{r.address}</code>
                      <span>{Number(r.amount).toFixed(2)} {tokenSymbol}</span>
                    </div>
                  ))
                )}
              </div>
            </Box>
          </aside>
        </div>
      </Box>
    </div>
  );
};
