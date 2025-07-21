# Backfill Recent Stripe Data

This command will backfill all Stripe transactions and player registrations from June 30th, 2025 onwards.

## Usage

```bash
node ace backfill:stripe
```

## What it does

1. **Fetches Checkout Sessions** - Processes all completed checkout sessions from June 30th onwards
2. **Creates/Updates Players** - Creates new player records or updates existing ones based on session metadata
3. **Processes Payments** - Stores all payment intents (registration fees, upfront payments)
4. **Processes Subscriptions** - Stores subscription data for monthly payment players
5. **Processes Invoices** - Captures monthly subscription payments

## Expected Output

The command will show:
- Number of checkout sessions processed
- Number of players created
- Number of subscriptions processed
- Number of payments processed

## Important Notes

- This command is safe to run multiple times (it won't create duplicates)
- It only processes data from June 30th, 2025 onwards
- It automatically links players to their Stripe transactions
- It preserves gift aid declarations and other metadata

## Run This Now

Since you have 11 registered players but no database records, run this command to backfill everything:

```bash
node ace backfill:stripe
```

This should populate your database with all the missing player registrations and transaction data.
