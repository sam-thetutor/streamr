#![no_std]

use soroban_sdk::token::Client as TokenClient;
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Vec,
};

const MAX_TITLE_LEN: u32 = 120;
const MAX_DESCRIPTION_LEN: u32 = 1024;

fn normalize_optional_text(input: Option<String>, max_len: u32) -> Option<String> {
    match input {
        Some(value) => {
            if value.len() == 0 {
                None
            } else {
                if value.len() > max_len {
                    panic!();
                }
                Some(value)
            }
        }
        None => None,
    }
}

/// Error codes
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
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
    NotInitialized = 11,
}

/// Data keys in storage
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    PlatformAdmin,
    NextStreamId,
    StreamKey(u32), // stream_id -> Stream
    NextSubscriptionId,
    SubscriptionKey(u32),               // subscription_id -> Subscription
    TokenContract,                      // Address (optional global token id if you want a default)
    UserSentStreams(Address), // user address -> Vec<u32> (stream IDs where user is sender)
    UserReceivedStreams(Address), // user address -> Vec<u32> (stream IDs where user is recipient)
    UserSubscriptions(Address), // user address -> Vec<u32> (subscription IDs where user is subscriber)
    UserReceivedSubscriptions(Address), // user address -> Vec<u32> (subscription IDs where user is receiver)
}

/// A streaming payment: continuous rate-based escrow
#[contracttype]
#[derive(Clone)]
pub struct Stream {
    pub id: u32,
    pub sender: Address,
    pub recipients: Vec<Address>, // Multiple recipients (changed from single Address)
    pub token_contract: Address,
    // Per-recipient rate in atomic units per second, derived from amount-per-period / period_seconds
    pub recipient_rate_per_second: Map<Address, i128>,
    pub deposit: i128,   // total deposited initially (remaining is derived)
    pub start_time: u64, // ledger timestamp seconds
    pub recipient_last_withdraw: Map<Address, u64>, // Per-recipient last withdrawal time
    pub recipient_total_withdrawn: Map<Address, i128>, // Per-recipient total withdrawn amount
    pub is_active: bool,
    pub title: Option<String>,
    pub description: Option<String>,
}

/// A recurring subscription (pull/payments at intervals)
#[contracttype]
#[derive(Clone)]
pub struct Subscription {
    pub id: u32,
    pub subscriber: Address,
    pub receiver: Address,
    pub token_contract: Address,
    pub amount_per_interval: i128,
    pub interval_seconds: u64,
    pub next_payment_time: u64,
    pub active: bool,
    pub balance: i128, // Escrowed balance for this subscription (isolated from other subscriptions)
    pub title: Option<String>,
    pub description: Option<String>,
}

#[contract]
pub struct Streamer;

#[contractimpl]
impl Streamer {
    /// Initialize platform admin and optional default token contract.
    /// Call once.
    pub fn init(env: Env, platform_admin: Address, default_token: Option<Address>) {
        if env
            .storage()
            .persistent()
            .get::<_, Address>(&DataKey::PlatformAdmin)
            .is_some()
        {
            panic!();
        }
        env.storage()
            .persistent()
            .set(&DataKey::PlatformAdmin, &platform_admin);
        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &1u32);
        env.storage()
            .persistent()
            .set(&DataKey::NextSubscriptionId, &1u32);
        if let Some(t) = default_token {
            env.storage().persistent().set(&DataKey::TokenContract, &t);
        }
    }

    // ===========================
    // STREAMING: create / withdraw / cancel
    // ===========================

    /// Create a stream. Transfers `deposit` tokens from the sender to this contract
    /// and registers a new payment stream with multiple recipients.
    /// Each recipient receives the full `rate_per_second` (multiplicative model).
    ///
    /// Returns the stream id.
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipients: Vec<Address>,
        token_contract: Address,
        amounts_per_period: Vec<i128>, // atomic units for each recipient
        period_seconds: u64,           // e.g., 30 days in seconds
        deposit: i128,
        title: Option<String>,
        description: Option<String>,
    ) -> u32 {
        // auth
        sender.require_auth();

        // Validate inputs
        if recipients.len() == 0 {
            panic!(); // At least one recipient required
        }

        // Check lengths and duplicates
        if recipients.len() != amounts_per_period.len() {
            panic!();
        }
        for i in 0..recipients.len() {
            for j in (i + 1)..recipients.len() {
                if recipients.get(i).unwrap() == recipients.get(j).unwrap() {
                    panic!(); // Duplicate recipient found
                }
            }
        }

        if period_seconds == 0 || deposit <= 0 {
            panic!();
        }

        // compute start time
        let start_time: u64 = env.ledger().timestamp();

        // Transfer tokens from sender to contract
        let token = TokenClient::new(&env, &token_contract);
        let contract_addr = env.current_contract_address();

        // Transfer deposit from sender to contract
        token.transfer(&sender, &contract_addr, &deposit);

        // allocate stream id
        let mut next_id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::NextStreamId)
            .unwrap_or(1u32);
        let stream_id = next_id;

        // Create maps for tracking
        let mut recipient_last_withdraw = Map::new(&env);
        let mut recipient_total_withdrawn = Map::new(&env);
        let mut recipient_rate_per_second = Map::new(&env);

        // Derive per-recipient rate: amount_per_period / period_seconds (integer division)
        let normalized_title = normalize_optional_text(title, MAX_TITLE_LEN);
        let normalized_description = normalize_optional_text(description, MAX_DESCRIPTION_LEN);

        for i in 0..recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let amt = amounts_per_period.get(i).unwrap();
            if amt <= 0i128 {
                panic!();
            }
            let rate_i: i128 = amt / (period_seconds as i128);
            if rate_i <= 0i128 {
                // Too small for given period
                panic!();
            }
            recipient_rate_per_second.set(recipient.clone(), rate_i);
            // Initialize last withdraw maps (optional; default on read is start_time)
            // Initialize totals to 0
            recipient_total_withdrawn.set(recipient.clone(), 0i128);
        }

        let stream = Stream {
            id: stream_id,
            sender: sender.clone(),
            recipients: recipients.clone(),
            token_contract: token_contract.clone(),
            recipient_rate_per_second,
            deposit,
            start_time,
            recipient_last_withdraw,
            recipient_total_withdrawn,
            is_active: true,
            title: normalized_title.clone(),
            description: normalized_description.clone(),
        };
        env.storage()
            .persistent()
            .set(&DataKey::StreamKey(stream_id), &stream);
        next_id += 1;
        env.storage()
            .persistent()
            .set(&DataKey::NextStreamId, &next_id);

        // Update user stream indexes
        // Add to sender's sent streams
        let sender_clone = sender.clone();
        let mut sent_streams: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserSentStreams(sender_clone.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        sent_streams.push_back(stream_id);
        env.storage()
            .persistent()
            .set(&DataKey::UserSentStreams(sender_clone), &sent_streams);

        // Add to each recipient's received streams
        for i in 0..recipients.len() {
            let recipient = recipients.get(i).unwrap();
            let recipient_clone = recipient.clone();
            let mut received_streams: Vec<u32> = env
                .storage()
                .persistent()
                .get(&DataKey::UserReceivedStreams(recipient_clone.clone()))
                .unwrap_or_else(|| Vec::new(&env));
            received_streams.push_back(stream_id);
            env.storage().persistent().set(
                &DataKey::UserReceivedStreams(recipient_clone),
                &received_streams,
            );
        }

        // emit event (include all recipients)
        env.events().publish(
            (symbol_short!("strm_crt"), stream_id),
            (
                sender,
                recipients.clone(),
                deposit,
                start_time,
                normalized_title,
                normalized_description,
            ),
        );

        stream_id
    }

    /// Withdraw accrued funds for a stream.
    /// The recipient parameter specifies which recipient is withdrawing.
    /// Each recipient can withdraw independently based on their own rate (full rate_per_second).
    pub fn withdraw_stream(env: Env, stream_id: u32, recipient: Address) -> i128 {
        // fetch stream
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::StreamKey(stream_id))
            .unwrap_or_else(|| panic!());

        if !stream.is_active {
            panic!();
        }

        // Verify recipient is in the recipients list
        let mut is_recipient = false;
        for i in 0..stream.recipients.len() {
            let r = stream.recipients.get(i).unwrap();
            if r == recipient {
                is_recipient = true;
                break;
            }
        }
        if !is_recipient {
            panic!(); // Not a recipient of this stream
        }

        let now: u64 = env.ledger().timestamp();

        // Get this recipient's last withdrawal time (default to start_time)
        let last_withdraw = stream
            .recipient_last_withdraw
            .get(recipient.clone())
            .unwrap_or(stream.start_time);

        if now <= last_withdraw {
            return 0i128;
        }

        // Calculate this recipient's accrued amount using their individual rate
        let rate_i = stream
            .recipient_rate_per_second
            .get(recipient.clone())
            .unwrap_or(0i128);
        if rate_i <= 0i128 {
            panic!();
        }
        let elapsed = (now - last_withdraw) as i128;
        let recipient_accrued = elapsed.saturating_mul(rate_i);

        // Calculate total distributed across ALL recipients
        // Total outflow rate = sum of per-recipient rates
        let mut total_outflow_rate: i128 = 0i128;
        for i in 0..stream.recipients.len() {
            let r = stream.recipients.get(i).unwrap();
            let ri = stream.recipient_rate_per_second.get(r).unwrap_or(0i128);
            total_outflow_rate = total_outflow_rate.saturating_add(ri);
        }
        let total_elapsed_from_start = (now - stream.start_time) as i128;
        let total_distributed = total_elapsed_from_start.saturating_mul(total_outflow_rate);
        let remaining_deposit = stream.deposit.saturating_sub(total_distributed);

        // Calculate how much this recipient can withdraw
        // We need to ensure we don't exceed the remaining deposit
        // Since each recipient gets the full rate, we need to check if there's enough for this withdrawal
        let transfer_amount = core::cmp::min(recipient_accrued, remaining_deposit);

        if transfer_amount <= 0 {
            panic!(); // Nothing to withdraw
        }

        // TOKEN TRANSFER: contract -> recipient
        let token = TokenClient::new(&env, &stream.token_contract);
        let contract_addr = env.current_contract_address();

        token.transfer(&contract_addr, &recipient, &transfer_amount);

        // Update this recipient's last withdrawal time
        stream.recipient_last_withdraw.set(recipient.clone(), now);

        // Update this recipient's total withdrawn
        let current_total = stream
            .recipient_total_withdrawn
            .get(recipient.clone())
            .unwrap_or(0i128);
        let new_total = current_total.saturating_add(transfer_amount);
        stream
            .recipient_total_withdrawn
            .set(recipient.clone(), new_total);

        // Check if deposit is exhausted (all remaining would be distributed)
        // Calculate new remaining after this withdrawal
        let new_remaining = remaining_deposit.saturating_sub(transfer_amount);
        if new_remaining <= 0 {
            stream.is_active = false;
        }

        env.storage()
            .persistent()
            .set(&DataKey::StreamKey(stream_id), &stream);

        env.events().publish(
            (symbol_short!("strm_wd"), stream_id),
            (recipient.clone(), transfer_amount, now),
        );

        transfer_amount
    }

    /// Cancel a stream. Caller must be the sender.
    /// Calculates remaining deposit after all recipients' withdrawals and refunds to sender.
    pub fn cancel_stream(env: Env, stream_id: u32) {
        let mut stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::StreamKey(stream_id))
            .unwrap_or_else(|| panic!());

        // only sender can cancel
        stream.sender.require_auth();

        if !stream.is_active {
            panic!();
        }

        // compute remaining deposit after all recipients' withdrawals
        let now: u64 = env.ledger().timestamp();
        // Total outflow rate = sum of per-recipient rates
        let mut total_outflow_rate: i128 = 0i128;
        for i in 0..stream.recipients.len() {
            let r = stream.recipients.get(i).unwrap();
            let ri = stream.recipient_rate_per_second.get(r).unwrap_or(0i128);
            total_outflow_rate = total_outflow_rate.saturating_add(ri);
        }
        let elapsed_from_start = (now - stream.start_time) as i128;
        let total_distributed = elapsed_from_start.saturating_mul(total_outflow_rate);
        let remaining_deposit = stream.deposit.saturating_sub(total_distributed);

        let token = TokenClient::new(&env, &stream.token_contract);
        let contract_addr = env.current_contract_address();

        // Refund remaining deposit to sender
        if remaining_deposit > 0 {
            token.transfer(&contract_addr, &stream.sender, &remaining_deposit);
        }

        // mark inactive
        stream.is_active = false;
        stream.deposit = 0;
        env.storage()
            .persistent()
            .set(&DataKey::StreamKey(stream_id), &stream);

        env.events().publish(
            (symbol_short!("strm_can"), stream_id),
            (stream.sender.clone(), remaining_deposit, now),
        );
    }

    // ===========================
    // SUBSCRIPTIONS: recurring payments (interval pulls)
    // ===========================

    /// Deposit funds to a subscription (isolated escrow per subscription)
    /// Subscriber must authorize (require_auth). Funds are isolated to this specific subscription.
    pub fn deposit_to_subscription(env: Env, subscription_id: u32, amount: i128) {
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionKey(subscription_id))
            .unwrap_or_else(|| panic!());

        sub.subscriber.require_auth();

        if amount <= 0 {
            panic!();
        }

        // Transfer tokens from subscriber to contract
        let token = TokenClient::new(&env, &sub.token_contract);
        let contract_addr = env.current_contract_address();
        token.transfer(&sub.subscriber, &contract_addr, &amount);

        // Update subscription balance (isolated)
        sub.balance = sub.balance.saturating_add(amount);
        env.storage()
            .persistent()
            .set(&DataKey::SubscriptionKey(subscription_id), &sub);

        env.events().publish(
            (symbol_short!("sub_dep"), subscription_id),
            (sub.subscriber.clone(), amount, sub.balance),
        );
    }

    /// Create a subscription. Subscriber must authorize (require_auth).
    /// This model expects the subscriber to periodically ensure the contract has funds to perform the pull,
    /// or to have previously transferred allowance/escrow. The sponsor of payments (service owner) receives fixed amounts per interval.
    ///
    /// next_payment_time should typically be `now + interval_seconds` or now depending on desired behavior.
    pub fn create_subscription(
        env: Env,
        subscriber: Address,
        receiver: Address,
        token_contract: Address,
        amount_per_interval: i128,
        interval_seconds: u64,
        first_payment_time: u64,
        title: Option<String>,
        description: Option<String>,
    ) -> u32 {
        subscriber.require_auth();

        if amount_per_interval <= 0 || interval_seconds == 0 {
            panic!();
        }

        let mut next_id: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::NextSubscriptionId)
            .unwrap_or(1u32);
        let sub_id = next_id;

        let normalized_title = normalize_optional_text(title, MAX_TITLE_LEN);
        let normalized_description = normalize_optional_text(description, MAX_DESCRIPTION_LEN);

        let subscription = Subscription {
            id: sub_id,
            subscriber: subscriber.clone(),
            receiver: receiver.clone(),
            token_contract: token_contract.clone(),
            amount_per_interval,
            interval_seconds,
            next_payment_time: first_payment_time,
            active: true,
            balance: 0i128, // Start with zero balance - subscriber must deposit
            title: normalized_title.clone(),
            description: normalized_description.clone(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::SubscriptionKey(sub_id), &subscription);
        next_id += 1;
        env.storage()
            .persistent()
            .set(&DataKey::NextSubscriptionId, &next_id);

        // Update user subscription indexes
        // Add to subscriber's subscriptions
        let subscriber_clone = subscriber.clone();
        let mut subscriber_subs: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserSubscriptions(subscriber_clone.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        subscriber_subs.push_back(sub_id);
        env.storage().persistent().set(
            &DataKey::UserSubscriptions(subscriber_clone),
            &subscriber_subs,
        );

        // Add to receiver's received subscriptions
        let receiver_clone = receiver.clone();
        let mut receiver_subs: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::UserReceivedSubscriptions(receiver_clone.clone()))
            .unwrap_or_else(|| Vec::new(&env));
        receiver_subs.push_back(sub_id);
        env.storage().persistent().set(
            &DataKey::UserReceivedSubscriptions(receiver_clone),
            &receiver_subs,
        );

        env.events().publish(
            (symbol_short!("sub_crt"), sub_id),
            (
                subscriber,
                receiver,
                amount_per_interval,
                interval_seconds,
                first_payment_time,
                normalized_title,
                normalized_description,
            ),
        );

        sub_id
    }

    /// Charge (execute) a due subscription. Can be called by anyone (keep it open), but it will transfer
    /// tokens from contract -> receiver. This assumes the contract already holds the subscriber funds,
    /// or you have some pull authorization pattern (not implemented here).
    ///
    /// The typical pattern: a keeper checks subscriptions whose next_payment_time <= now and triggers this call.
    pub fn charge_subscription(env: Env, subscription_id: u32) {
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionKey(subscription_id))
            .unwrap_or_else(|| panic!());

        if !sub.active {
            panic!();
        }

        let now: u64 = env.ledger().timestamp();
        if now < sub.next_payment_time {
            panic!();
        }

        // Determine how many intervals are due (in case of backlog)
        let mut due_intervals: u64 = 1;
        if now >= sub.next_payment_time + sub.interval_seconds {
            due_intervals = (now - sub.next_payment_time) / sub.interval_seconds + 1;
        }

        // total amount to transfer
        let amount_to_transfer =
            (sub.amount_per_interval as i128).saturating_mul(due_intervals as i128);

        // Check subscription balance (isolated per subscription)
        if sub.balance < amount_to_transfer {
            panic!();
        }

        // Transfer from contract to receiver
        let token = TokenClient::new(&env, &sub.token_contract);
        let contract_addr = env.current_contract_address();

        token.transfer(&contract_addr, &sub.receiver, &amount_to_transfer);

        // Deduct from subscription balance (isolated)
        sub.balance = sub.balance.saturating_sub(amount_to_transfer);

        // update next payment time
        sub.next_payment_time = sub.next_payment_time + due_intervals * sub.interval_seconds;
        env.storage()
            .persistent()
            .set(&DataKey::SubscriptionKey(subscription_id), &sub);

        env.events().publish(
            (symbol_short!("sub_chrg"), subscription_id),
            (
                sub.receiver.clone(),
                amount_to_transfer,
                sub.next_payment_time,
            ),
        );
    }

    /// Cancel a subscription (subscriber must auth)
    /// Refunds any remaining balance to the subscriber
    pub fn cancel_subscription(env: Env, subscription_id: u32) {
        let mut sub: Subscription = env
            .storage()
            .persistent()
            .get(&DataKey::SubscriptionKey(subscription_id))
            .unwrap_or_else(|| panic!());

        sub.subscriber.require_auth();

        let refund_amount = sub.balance;

        // Refund remaining balance to subscriber (if any)
        if sub.balance > 0 {
            let token = TokenClient::new(&env, &sub.token_contract);
            let contract_addr = env.current_contract_address();
            token.transfer(&contract_addr, &sub.subscriber, &sub.balance);
        }

        sub.balance = 0;
        sub.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::SubscriptionKey(subscription_id), &sub);

        let now: u64 = env.ledger().timestamp();
        env.events().publish(
            (symbol_short!("sub_can"), subscription_id),
            (
                sub.subscriber.clone(),
                sub.receiver.clone(),
                refund_amount,
                now,
            ),
        );
    }

    // ===========================
    // RECIPIENT INFO QUERIES
    // ===========================

    /// Get detailed information about a specific recipient in a stream.
    /// Returns: (total_withdrawn, current_accrued, last_withdraw_time)
    pub fn get_recipient_info(env: Env, stream_id: u32, recipient: Address) -> (i128, i128, u64) {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::StreamKey(stream_id))
            .unwrap_or_else(|| panic!());

        // Verify recipient is in the list
        let mut is_recipient = false;
        for i in 0..stream.recipients.len() {
            let r = stream.recipients.get(i).unwrap();
            if r == recipient {
                is_recipient = true;
                break;
            }
        }
        if !is_recipient {
            panic!(); // Not a recipient
        }

        let now = env.ledger().timestamp();

        // Get total withdrawn (default to 0)
        let total_withdrawn = stream
            .recipient_total_withdrawn
            .get(recipient.clone())
            .unwrap_or(0i128);

        // Get last withdrawal time (default to start_time)
        let last_withdraw = stream
            .recipient_last_withdraw
            .get(recipient.clone())
            .unwrap_or(stream.start_time);

        // Calculate current accrued (not yet withdrawn) using per-recipient rate
        let rate_i = stream
            .recipient_rate_per_second
            .get(recipient.clone())
            .unwrap_or(0i128);
        let elapsed = (now - last_withdraw) as i128;
        let current_accrued = elapsed.saturating_mul(rate_i);

        // Cap accrued by remaining deposit
        // Total outflow rate = sum of per-recipient rates
        let mut total_outflow_rate: i128 = 0i128;
        for i in 0..stream.recipients.len() {
            let r = stream.recipients.get(i).unwrap();
            let ri = stream.recipient_rate_per_second.get(r).unwrap_or(0i128);
            total_outflow_rate = total_outflow_rate.saturating_add(ri);
        }
        let total_elapsed_from_start = (now - stream.start_time) as i128;
        let total_distributed = total_elapsed_from_start.saturating_mul(total_outflow_rate);
        let remaining_deposit = stream.deposit.saturating_sub(total_distributed);

        // Limit accrued by available deposit (if remaining is negative, cap at 0)
        let capped_accrued = if remaining_deposit > 0 {
            core::cmp::min(current_accrued, remaining_deposit)
        } else {
            0i128
        };

        (total_withdrawn, capped_accrued, last_withdraw)
    }

    /// Get information about all recipients in a stream.
    /// Returns a Vec of (Address, total_withdrawn, current_accrued, last_withdraw_time)
    pub fn get_all_recipients_info(env: Env, stream_id: u32) -> Vec<(Address, i128, i128, u64)> {
        let stream: Stream = env
            .storage()
            .persistent()
            .get(&DataKey::StreamKey(stream_id))
            .unwrap_or_else(|| panic!());

        let mut result = Vec::new(&env);
        let now = env.ledger().timestamp();

        // Calculate remaining deposit for all recipients (sum of per-recipient rates)
        let mut total_outflow_rate: i128 = 0i128;
        for i in 0..stream.recipients.len() {
            let r = stream.recipients.get(i).unwrap();
            let ri = stream.recipient_rate_per_second.get(r).unwrap_or(0i128);
            total_outflow_rate = total_outflow_rate.saturating_add(ri);
        }
        let total_elapsed_from_start = (now - stream.start_time) as i128;
        let total_distributed = total_elapsed_from_start.saturating_mul(total_outflow_rate);
        let remaining_deposit = stream.deposit.saturating_sub(total_distributed);

        for i in 0..stream.recipients.len() {
            let recipient = stream.recipients.get(i).unwrap();

            let total_withdrawn = stream
                .recipient_total_withdrawn
                .get(recipient.clone())
                .unwrap_or(0i128);

            let last_withdraw = stream
                .recipient_last_withdraw
                .get(recipient.clone())
                .unwrap_or(stream.start_time);

            let elapsed = (now - last_withdraw) as i128;
            let rate_i = stream
                .recipient_rate_per_second
                .get(recipient.clone())
                .unwrap_or(0i128);
            let current_accrued = elapsed.saturating_mul(rate_i);

            // Cap accrued by remaining deposit (if remaining is negative, cap at 0)
            let capped_accrued = if remaining_deposit > 0 {
                core::cmp::min(current_accrued, remaining_deposit)
            } else {
                0i128
            };

            result.push_back((
                recipient.clone(),
                total_withdrawn,
                capped_accrued,
                last_withdraw,
            ));
        }

        result
    }

    // ===========================
    // QUERY HELPERS
    // ===========================
    pub fn get_stream(env: Env, stream_id: u32) -> Stream {
        env.storage()
            .persistent()
            .get(&DataKey::StreamKey(stream_id))
            .unwrap_or_else(|| panic!())
    }

    pub fn get_subscription(env: Env, subscription_id: u32) -> Subscription {
        env.storage()
            .persistent()
            .get(&DataKey::SubscriptionKey(subscription_id))
            .unwrap_or_else(|| panic!())
    }

    /// Get all stream IDs where the user is the sender
    pub fn get_user_sent_stream_ids(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserSentStreams(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get all stream IDs where the user is the recipient
    pub fn get_user_received_stream_ids(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserReceivedStreams(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get all streams where the user is the sender
    pub fn get_user_sent_streams(env: Env, user: Address) -> Vec<Stream> {
        let stream_ids = Self::get_user_sent_stream_ids(env.clone(), user);
        let mut streams = Vec::new(&env);
        for i in 0..stream_ids.len() {
            let stream_id = stream_ids.get(i).unwrap();
            if let Some(stream) = env
                .storage()
                .persistent()
                .get::<_, Stream>(&DataKey::StreamKey(stream_id))
            {
                streams.push_back(stream);
            }
        }
        streams
    }

    /// Get all streams where the user is the recipient
    pub fn get_user_received_streams(env: Env, user: Address) -> Vec<Stream> {
        let stream_ids = Self::get_user_received_stream_ids(env.clone(), user);
        let mut streams = Vec::new(&env);
        for i in 0..stream_ids.len() {
            let stream_id = stream_ids.get(i).unwrap();
            if let Some(stream) = env
                .storage()
                .persistent()
                .get::<_, Stream>(&DataKey::StreamKey(stream_id))
            {
                streams.push_back(stream);
            }
        }
        streams
    }

    /// Get all streams where the user is either sender or recipient
    /// Note: This may include duplicates if a stream has the same user as both sender and recipient
    pub fn get_user_streams(env: Env, user: Address) -> Vec<Stream> {
        let mut streams = Vec::new(&env);
        let mut seen_ids = Vec::new(&env);

        // Get sent streams
        let sent_ids = Self::get_user_sent_stream_ids(env.clone(), user.clone());
        for i in 0..sent_ids.len() {
            let stream_id = sent_ids.get(i).unwrap();
            if let Some(stream) = env
                .storage()
                .persistent()
                .get::<_, Stream>(&DataKey::StreamKey(stream_id))
            {
                streams.push_back(stream);
                seen_ids.push_back(stream_id);
            }
        }

        // Get received streams (skip if already added)
        let received_ids = Self::get_user_received_stream_ids(env.clone(), user);
        for i in 0..received_ids.len() {
            let stream_id = received_ids.get(i).unwrap();

            // Check if we've already added this stream
            let mut found = false;
            for j in 0..seen_ids.len() {
                if seen_ids.get(j).unwrap() == stream_id {
                    found = true;
                    break;
                }
            }
            if !found {
                if let Some(stream) = env
                    .storage()
                    .persistent()
                    .get::<_, Stream>(&DataKey::StreamKey(stream_id))
                {
                    streams.push_back(stream);
                    seen_ids.push_back(stream_id);
                }
            }
        }

        streams
    }

    /// Get all subscription IDs where the user is the subscriber
    pub fn get_user_subs_ids(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserSubscriptions(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get all subscription IDs where the user is the receiver
    pub fn get_user_rcvd_subs_ids(env: Env, user: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::UserReceivedSubscriptions(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Get all subscriptions where the user is the subscriber
    pub fn get_user_subscriptions(env: Env, user: Address) -> Vec<Subscription> {
        let subscription_ids = Self::get_user_subs_ids(env.clone(), user);
        let mut subscriptions = Vec::new(&env);
        for i in 0..subscription_ids.len() {
            let subscription_id = subscription_ids.get(i).unwrap();
            if let Some(subscription) = env
                .storage()
                .persistent()
                .get::<_, Subscription>(&DataKey::SubscriptionKey(subscription_id))
            {
                subscriptions.push_back(subscription);
            }
        }
        subscriptions
    }

    /// Get all subscriptions where the user is the receiver
    pub fn get_user_received_subscriptions(env: Env, user: Address) -> Vec<Subscription> {
        let subscription_ids = Self::get_user_rcvd_subs_ids(env.clone(), user);
        let mut subscriptions = Vec::new(&env);
        for i in 0..subscription_ids.len() {
            let subscription_id = subscription_ids.get(i).unwrap();
            if let Some(subscription) = env
                .storage()
                .persistent()
                .get::<_, Subscription>(&DataKey::SubscriptionKey(subscription_id))
            {
                subscriptions.push_back(subscription);
            }
        }
        subscriptions
    }

    /// Get all subscriptions where the user is either subscriber or receiver
    /// Note: This may include duplicates if a subscription has the same user as both subscriber and receiver
    pub fn get_user_subscriptions_all(env: Env, user: Address) -> Vec<Subscription> {
        let mut subscriptions = Vec::new(&env);
        let mut seen_ids = Vec::new(&env);

        // Get subscriptions where user is subscriber
        let subscriber_ids = Self::get_user_subs_ids(env.clone(), user.clone());
        for i in 0..subscriber_ids.len() {
            let subscription_id = subscriber_ids.get(i).unwrap();
            if let Some(subscription) = env
                .storage()
                .persistent()
                .get::<_, Subscription>(&DataKey::SubscriptionKey(subscription_id))
            {
                subscriptions.push_back(subscription);
                seen_ids.push_back(subscription_id);
            }
        }

        // Get subscriptions where user is receiver (skip if already added)
        let receiver_ids = Self::get_user_rcvd_subs_ids(env.clone(), user);
        for i in 0..receiver_ids.len() {
            let subscription_id = receiver_ids.get(i).unwrap();

            // Check if we've already added this subscription
            let mut found = false;
            for j in 0..seen_ids.len() {
                if seen_ids.get(j).unwrap() == subscription_id {
                    found = true;
                    break;
                }
            }
            if !found {
                if let Some(subscription) = env
                    .storage()
                    .persistent()
                    .get::<_, Subscription>(&DataKey::SubscriptionKey(subscription_id))
                {
                    subscriptions.push_back(subscription);
                    seen_ids.push_back(subscription_id);
                }
            }
        }

        subscriptions
    }

    // Admin utility to set/replace token contract default (if you use a global default)
    pub fn set_token_contract(env: Env, token: Address) {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::PlatformAdmin)
            .unwrap_or_else(|| panic!());
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::TokenContract, &token);
    }
}
