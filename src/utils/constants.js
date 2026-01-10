/**
 * System Constants
 */
module.exports = {
  FEE_PERCENTAGES: {
    TOTAL: 25,
    DEBT: 10,
    OPERATIONAL: 10,
    TRANSACTION: 5
  },
  DONATION_STATUS: {
    PENDING: 'pending',
    CONVERTED: 'converted',
    BATCHED: 'batched',
    SENT: 'sent',
    FAILED: 'failed'
  },
  BATCH_STATUS: {
    DRAFT: 'draft',
    PENDING: 'pending',
    PROCESSING: 'processing',
    AWAITING_SIMPLEX: 'awaiting_simplex',
    SENDING: 'sending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
  },
  CAMPAIGN_STATUS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    ARCHIVED: 'archived'
  },
  USER_ROLES: {
    ADMIN: 'admin',
    OPERATOR: 'operator',
    VIEWER: 'viewer'
  }
};
