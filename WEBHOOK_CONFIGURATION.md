# Stripe Webhook Events Configuration

## Required Webhook Events for Complete Data Capture

To ensure all payment and subscription data is properly captured in the local database, configure the following webhook events in your Stripe Dashboard:

### **✅ Currently Handled Events**

#### **Primary Payment & Registration Events**
- `checkout.session.completed` - ✅ **Already implemented**
  - Handles player registrations (coach, upfront, subscription)
  - Creates players and moves verification files
  - Sets up subscriptions for subscription players

#### **Payment Tracking Events**
- `payment_intent.succeeded` - ✅ **Enhanced implementation**
  - Handles special event payments (summer camp, tournaments, presentations)
  - Handles player registration payments without specific orderType
  - Stores all payment metadata including gift aid declarations

- `invoice.payment_succeeded` - ✅ **New implementation**
  - Captures monthly subscription payments
  - Links payments to existing players via subscription ID
  - Essential for tracking recurring membership fees

- `charge.succeeded` - ✅ **New implementation**
  - Backup coverage for direct charges
  - Handles payments not processed via payment intents

#### **Subscription Management Events**
- `customer.subscription.updated` - ✅ **New implementation**
  - Tracks subscription status changes
  - Updates local subscription records when Stripe data changes
  - Captures cancellations, pauses, reactivations

- `customer.subscription.deleted` - ✅ **New implementation**
  - Handles subscription deletions/cancellations
  - Updates local records to reflect final status

### **⚙️ Stripe Dashboard Webhook Configuration**

1. **Go to Stripe Dashboard → Developers → Webhooks**
2. **Select your webhook endpoint**
3. **Enable these specific events:**
   ```
   checkout.session.completed
   payment_intent.succeeded
   invoice.payment_succeeded
   charge.succeeded
   customer.subscription.updated
   customer.subscription.deleted
   ```

### **🔄 Data Flow Summary**

#### **Player Registration Flow:**
1. `checkout.session.completed` → Creates player, stores files, handles payment
2. `payment_intent.succeeded` → Stores payment details in database
3. For subscription players: Creates subscription with metadata

#### **Monthly Payment Flow:**
1. `invoice.payment_succeeded` → Stores monthly subscription payment
2. Links payment to player via subscription ID
3. Preserves all payment metadata for reporting

#### **Subscription Management Flow:**
1. `customer.subscription.updated` → Updates subscription status changes
2. `customer.subscription.deleted` → Handles cancellations
3. Maintains complete subscription lifecycle in local database

### **📊 Benefits of Complete Event Handling**

✅ **No Missing Payments** - All payment types are captured
✅ **Gift Aid Tracking** - Metadata preserved across all payment events
✅ **Fast Admin Queries** - Local database eliminates Stripe API calls
✅ **Complete Audit Trail** - Full payment and subscription history
✅ **Reliable Reporting** - No dependency on external API availability
✅ **Performance** - Instant access to payment data for club staff

### **🚨 Important Notes**

- **Test webhook events** in Stripe's webhook testing tool before going live
- **Monitor webhook delivery** in Stripe Dashboard for failed deliveries
- **Backup sync command** available: `node ace sync:stripe` for historical data
- **Idempotency** built-in via webhook event IDs to prevent duplicate processing
- **Race condition fix**: Player registration payments are handled by `checkout.session.completed` to ensure proper player linking

### **🔧 Troubleshooting Commands**

- **Fix orphaned transactions**: `node ace fix:transaction-player-links` - Links existing transactions missing player IDs
- **Sync historical data**: `node ace sync:stripe` - Import old Stripe data into local database
- **Check webhook status**: Monitor Stripe Dashboard → Developers → Webhooks for delivery status

### **📋 Race Condition Solution**

The webhook handlers have been designed to prevent race conditions between `payment_intent.succeeded` and `checkout.session.completed`:

1. **Player registration payments** (`registrationId` present) are skipped in `payment_intent.succeeded`
2. **Payment storage happens** in `checkout.session.completed` after player creation
3. **Existing transactions are updated** with player IDs after player creation
4. **Fix command available** to repair any orphaned transaction records
