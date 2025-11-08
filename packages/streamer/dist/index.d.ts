import { Buffer } from "buffer";
import { AssembledTransaction, Client as ContractClient, ClientOptions as ContractClientOptions, MethodOptions } from '@stellar/stellar-sdk/contract';
import type { u32, u64, i128, Option } from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk';
export * as contract from '@stellar/stellar-sdk/contract';
export * as rpc from '@stellar/stellar-sdk/rpc';
export declare const networks: {
    readonly testnet: {
        readonly networkPassphrase: "Test SDF Network ; September 2015";
        readonly contractId: "CDGAKUYVMN3G4R5YQ2QEUPXVODZYQHYBSD4X6VQB2OEL7LG2DFZ2PYML";
    };
};
/**
 * Error codes
 */
export declare enum Errors {
    AlreadyInitialized = 1,
    InvalidParameters = 2,
    ContractInsufficientBalance = 3,
    StreamNotFound = 4,
    StreamInactive = 5,
    NothingToWithdraw = 6,
    SubscriptionNotFound = 7,
    SubscriptionInactive = 8,
    NotDueYet = 9,
    InsufficientContractBalance = 10,
    NotInitialized = 11
}
/**
 * Data keys in storage
 */
export type DataKey = {
    tag: "PlatformAdmin";
    values: void;
} | {
    tag: "NextStreamId";
    values: void;
} | {
    tag: "StreamKey";
    values: readonly [u32];
} | {
    tag: "NextSubscriptionId";
    values: void;
} | {
    tag: "SubscriptionKey";
    values: readonly [u32];
} | {
    tag: "TokenContract";
    values: void;
} | {
    tag: "UserSentStreams";
    values: readonly [string];
} | {
    tag: "UserReceivedStreams";
    values: readonly [string];
} | {
    tag: "UserSubscriptions";
    values: readonly [string];
} | {
    tag: "UserReceivedSubscriptions";
    values: readonly [string];
};
/**
 * A streaming payment: continuous rate-based escrow
 */
export interface Stream {
    deposit: i128;
    description: Option<string>;
    id: u32;
    is_active: boolean;
    recipient_last_withdraw: Map<string, u64>;
    recipient_rate_per_second: Map<string, i128>;
    recipient_total_withdrawn: Map<string, i128>;
    recipients: Array<string>;
    sender: string;
    start_time: u64;
    title: Option<string>;
    token_contract: string;
}
/**
 * A recurring subscription (pull/payments at intervals)
 */
export interface Subscription {
    active: boolean;
    amount_per_interval: i128;
    balance: i128;
    description: Option<string>;
    id: u32;
    interval_seconds: u64;
    next_payment_time: u64;
    receiver: string;
    subscriber: string;
    title: Option<string>;
    token_contract: string;
}
export interface Client {
    /**
     * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Initialize platform admin and optional default token contract.
     * Call once.
     */
    init: ({ platform_admin, default_token }: {
        platform_admin: string;
        default_token: Option<string>;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a create_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Create a stream. Transfers `deposit` tokens from the sender to this contract
     * and registers a new payment stream with multiple recipients.
     * Each recipient receives the full `rate_per_second` (multiplicative model).
     *
     * Returns the stream id.
     */
    create_stream: ({ sender, recipients, token_contract, amounts_per_period, period_seconds, deposit, title, description }: {
        sender: string;
        recipients: Array<string>;
        token_contract: string;
        amounts_per_period: Array<i128>;
        period_seconds: u64;
        deposit: i128;
        title: Option<string>;
        description: Option<string>;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a withdraw_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Withdraw accrued funds for a stream.
     * The recipient parameter specifies which recipient is withdrawing.
     * Each recipient can withdraw independently based on their own rate (full rate_per_second).
     */
    withdraw_stream: ({ stream_id, recipient }: {
        stream_id: u32;
        recipient: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<i128>>;
    /**
     * Construct and simulate a cancel_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Cancel a stream. Caller must be the sender.
     * Calculates remaining deposit after all recipients' withdrawals and refunds to sender.
     */
    cancel_stream: ({ stream_id }: {
        stream_id: u32;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a deposit_to_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Deposit funds to a subscription (isolated escrow per subscription)
     * Subscriber must authorize (require_auth). Funds are isolated to this specific subscription.
     */
    deposit_to_subscription: ({ subscription_id, amount }: {
        subscription_id: u32;
        amount: i128;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a create_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Create a subscription. Subscriber must authorize (require_auth).
     * This model expects the subscriber to periodically ensure the contract has funds to perform the pull,
     * or to have previously transferred allowance/escrow. The sponsor of payments (service owner) receives fixed amounts per interval.
     *
     * next_payment_time should typically be `now + interval_seconds` or now depending on desired behavior.
     */
    create_subscription: ({ subscriber, receiver, token_contract, amount_per_interval, interval_seconds, first_payment_time, title, description }: {
        subscriber: string;
        receiver: string;
        token_contract: string;
        amount_per_interval: i128;
        interval_seconds: u64;
        first_payment_time: u64;
        title: Option<string>;
        description: Option<string>;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<u32>>;
    /**
     * Construct and simulate a charge_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Charge (execute) a due subscription. Can be called by anyone (keep it open), but it will transfer
     * tokens from contract -> receiver. This assumes the contract already holds the subscriber funds,
     * or you have some pull authorization pattern (not implemented here).
     *
     * The typical pattern: a keeper checks subscriptions whose next_payment_time <= now and triggers this call.
     */
    charge_subscription: ({ subscription_id }: {
        subscription_id: u32;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a cancel_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Cancel a subscription (subscriber must auth)
     * Refunds any remaining balance to the subscriber
     */
    cancel_subscription: ({ subscription_id }: {
        subscription_id: u32;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
    /**
     * Construct and simulate a get_recipient_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get detailed information about a specific recipient in a stream.
     * Returns: (total_withdrawn, current_accrued, last_withdraw_time)
     */
    get_recipient_info: ({ stream_id, recipient }: {
        stream_id: u32;
        recipient: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<readonly [i128, i128, u64]>>;
    /**
     * Construct and simulate a get_all_recipients_info transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get information about all recipients in a stream.
     * Returns a Vec of (Address, total_withdrawn, current_accrued, last_withdraw_time)
     */
    get_all_recipients_info: ({ stream_id }: {
        stream_id: u32;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<readonly [string, i128, i128, u64]>>>;
    /**
     * Construct and simulate a get_stream transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_stream: ({ stream_id }: {
        stream_id: u32;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Stream>>;
    /**
     * Construct and simulate a get_subscription transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    get_subscription: ({ subscription_id }: {
        subscription_id: u32;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Subscription>>;
    /**
     * Construct and simulate a get_user_sent_stream_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all stream IDs where the user is the sender
     */
    get_user_sent_stream_ids: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a get_user_received_stream_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all stream IDs where the user is the recipient
     */
    get_user_received_stream_ids: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a get_user_sent_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all streams where the user is the sender
     */
    get_user_sent_streams: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<Stream>>>;
    /**
     * Construct and simulate a get_user_received_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all streams where the user is the recipient
     */
    get_user_received_streams: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<Stream>>>;
    /**
     * Construct and simulate a get_user_streams transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all streams where the user is either sender or recipient
     * Note: This may include duplicates if a stream has the same user as both sender and recipient
     */
    get_user_streams: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<Stream>>>;
    /**
     * Construct and simulate a get_user_subs_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all subscription IDs where the user is the subscriber
     */
    get_user_subs_ids: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a get_user_rcvd_subs_ids transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all subscription IDs where the user is the receiver
     */
    get_user_rcvd_subs_ids: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<u32>>>;
    /**
     * Construct and simulate a get_user_subscriptions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all subscriptions where the user is the subscriber
     */
    get_user_subscriptions: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<Subscription>>>;
    /**
     * Construct and simulate a get_user_received_subscriptions transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all subscriptions where the user is the receiver
     */
    get_user_received_subscriptions: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<Subscription>>>;
    /**
     * Construct and simulate a get_user_subscriptions_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     * Get all subscriptions where the user is either subscriber or receiver
     * Note: This may include duplicates if a subscription has the same user as both subscriber and receiver
     */
    get_user_subscriptions_all: ({ user }: {
        user: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<Array<Subscription>>>;
    /**
     * Construct and simulate a set_token_contract transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
     */
    set_token_contract: ({ token }: {
        token: string;
    }, options?: {
        /**
         * The fee to pay for the transaction. Default: BASE_FEE
         */
        fee?: number;
        /**
         * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
         */
        timeoutInSeconds?: number;
        /**
         * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
         */
        simulate?: boolean;
    }) => Promise<AssembledTransaction<null>>;
}
export declare class Client extends ContractClient {
    readonly options: ContractClientOptions;
    static deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions & Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
    }): Promise<AssembledTransaction<T>>;
    constructor(options: ContractClientOptions);
    readonly fromJSON: {
        init: (json: string) => AssembledTransaction<null>;
        create_stream: (json: string) => AssembledTransaction<number>;
        withdraw_stream: (json: string) => AssembledTransaction<bigint>;
        cancel_stream: (json: string) => AssembledTransaction<null>;
        deposit_to_subscription: (json: string) => AssembledTransaction<null>;
        create_subscription: (json: string) => AssembledTransaction<number>;
        charge_subscription: (json: string) => AssembledTransaction<null>;
        cancel_subscription: (json: string) => AssembledTransaction<null>;
        get_recipient_info: (json: string) => AssembledTransaction<readonly [bigint, bigint, bigint]>;
        get_all_recipients_info: (json: string) => AssembledTransaction<(readonly [string, bigint, bigint, bigint])[]>;
        get_stream: (json: string) => AssembledTransaction<Stream>;
        get_subscription: (json: string) => AssembledTransaction<Subscription>;
        get_user_sent_stream_ids: (json: string) => AssembledTransaction<number[]>;
        get_user_received_stream_ids: (json: string) => AssembledTransaction<number[]>;
        get_user_sent_streams: (json: string) => AssembledTransaction<Stream[]>;
        get_user_received_streams: (json: string) => AssembledTransaction<Stream[]>;
        get_user_streams: (json: string) => AssembledTransaction<Stream[]>;
        get_user_subs_ids: (json: string) => AssembledTransaction<number[]>;
        get_user_rcvd_subs_ids: (json: string) => AssembledTransaction<number[]>;
        get_user_subscriptions: (json: string) => AssembledTransaction<Subscription[]>;
        get_user_received_subscriptions: (json: string) => AssembledTransaction<Subscription[]>;
        get_user_subscriptions_all: (json: string) => AssembledTransaction<Subscription[]>;
        set_token_contract: (json: string) => AssembledTransaction<null>;
    };
}
