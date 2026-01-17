# Base44 Integration Examples
## Code Samples for D2C Platform Integration

This document provides practical code examples for integrating Base44 with the D2C custom backend.

---

## Table of Contents

1. [Base44 Backend Functions](#base44-backend-functions)
2. [API Authentication](#api-authentication)
3. [Frontend API Calls](#frontend-api-calls)
4. [Error Handling](#error-handling)
5. [Status Polling](#status-polling)

---

## 1. Base44 Backend Functions

### Example 1: Process Batch (Calls Custom Backend)

**Base44 Backend Function:** `processBatch`

```javascript
// Base44 Backend Function
// Name: processBatch
// Trigger: Called from frontend button click

import { fetch } from '@base44/platform/http';

export default async function processBatch(batchId, userId) {
  const customBackendUrl = process.env.CUSTOM_BACKEND_URL;
  const apiKey = process.env.CUSTOM_BACKEND_API_KEY;
  
  try {
    const response = await fetch(`${customBackendUrl}/api/batches/${batchId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`, // Or use API key header
        'X-User-Id': userId // Pass Base44 user ID if needed
      },
      body: JSON.stringify({
        triggeredBy: userId,
        timestamp: new Date().toISOString()
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Batch processing failed');
    }
    
    const result = await response.json();
    
    // Update Base44 database with result
    // This is pseudocode - actual Base44 syntax may differ
    await updateRecord('Batches', batchId, {
      status: result.status,
      processedAt: new Date(),
      processingResult: result
    });
    
    return {
      success: true,
      batchId: result.batchId,
      status: result.status,
      message: 'Batch processing initiated'
    };
    
  } catch (error) {
    console.error('Batch processing error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### Example 2: Calculate Fees (Calls Custom Backend)

**Base44 Backend Function:** `calculateDonationFees`

```javascript
// Base44 Backend Function
// Name: calculateDonationFees
// Trigger: Called when donation amount changes in form

import { fetch } from '@base44/platform/http';

export default async function calculateDonationFees(amount, currency, donationId = null) {
  const customBackendUrl = process.env.CUSTOM_BACKEND_URL;
  const apiKey = process.env.CUSTOM_BACKEND_API_KEY;
  
  try {
    const response = await fetch(`${customBackendUrl}/api/donations/calculate-fees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        amount: parseFloat(amount),
        currency: currency,
        donationId: donationId
      })
    });
    
    if (!response.ok) {
      throw new Error('Fee calculation failed');
    }
    
    const fees = await response.json();
    
    return {
      success: true,
      originalAmount: amount,
      euroAmount: fees.euroAmount,
      totalFeePercent: fees.totalFeePercent,
      totalFeeEur: fees.totalFeeEur,
      debtFeeEur: fees.debtFeeEur,
      operationalFeeEur: fees.operationalFeeEur,
      transactionFeeEur: fees.transactionFeeEur,
      netAmountEur: fees.netAmountEur
    };
    
  } catch (error) {
    console.error('Fee calculation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### Example 3: Initiate Simplex Purchase (Calls Custom Backend)

**Base44 Backend Function:** `initiateSimplexPurchase`

```javascript
// Base44 Backend Function
// Name: initiateSimplexPurchase
// Trigger: Called from "Buy USDT via Simplex" button

import { fetch } from '@base44/platform/http';

export default async function initiateSimplexPurchase(batchId, userData) {
  const customBackendUrl = process.env.CUSTOM_BACKEND_URL;
  const apiKey = process.env.CUSTOM_BACKEND_API_KEY;
  
  try {
    const response = await fetch(`${customBackendUrl}/api/batches/${batchId}/initiate-simplex`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        userData: {
          userId: userData.userId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Simplex initiation failed');
    }
    
    const result = await response.json();
    
    // Update batch with payment URL
    await updateRecord('Batches', batchId, {
      simplexPaymentUrl: result.paymentUrl,
      simplexPaymentId: result.paymentId,
      simplexStatus: 'pending'
    });
    
    return {
      success: true,
      paymentUrl: result.paymentUrl,
      paymentId: result.paymentId,
      quoteId: result.quoteId
    };
    
  } catch (error) {
    console.error('Simplex initiation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### Example 4: Send TRON Transaction (Calls Custom Backend)

**Base44 Backend Function:** `sendTronTransaction`

```javascript
// Base44 Backend Function
// Name: sendTronTransaction
// Trigger: Called from "Send to TRON" button

import { fetch } from '@base44/platform/http';

export default async function sendTronTransaction(batchId) {
  const customBackendUrl = process.env.CUSTOM_BACKEND_URL;
  const apiKey = process.env.CUSTOM_BACKEND_API_KEY;
  
  try {
    const response = await fetch(`${customBackendUrl}/api/batches/${batchId}/send-tron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'TRON transaction failed');
    }
    
    const result = await response.json();
    
    // Update batch with transaction info
    await updateRecord('Batches', batchId, {
      tronTransactionHash: result.transactionHash,
      tronStatus: 'pending',
      sentAt: new Date()
    });
    
    return {
      success: true,
      transactionHash: result.transactionHash,
      transaction: result.transaction,
      message: 'Transaction sent to TRON network'
    };
    
  } catch (error) {
    console.error('TRON transaction error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### Example 5: Trigger WhatsApp Scan (Calls Custom Backend)

**Base44 Backend Function:** `scanWhatsApp`

```javascript
// Base44 Backend Function
// Name: scanWhatsApp
// Trigger: Called from "Scan WhatsApp" button

import { fetch } from '@base44/platform/http';

export default async function scanWhatsApp(whatsappNumber, userId) {
  const customBackendUrl = process.env.CUSTOM_BACKEND_URL;
  const apiKey = process.env.CUSTOM_BACKEND_API_KEY;
  
  try {
    const response = await fetch(`${customBackendUrl}/api/whatsapp/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        whatsappNumber: whatsappNumber,
        userId: userId
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'WhatsApp scan failed');
    }
    
    const result = await response.json();
    
    // Create scan job record in Base44 database
    await createRecord('WhatsAppScanJobs', {
      scanId: result.scanId,
      whatsappNumber: whatsappNumber,
      status: 'pending',
      initiatedBy: userId,
      createdAt: new Date()
    });
    
    return {
      success: true,
      scanId: result.scanId,
      message: 'WhatsApp scan initiated',
      estimatedTime: '2-5 minutes'
    };
    
  } catch (error) {
    console.error('WhatsApp scan error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## 2. API Authentication

### API Key Configuration in Base44 Secrets

```javascript
// Base44 Secrets Configuration
// Store in Base44 Settings → Secrets

CUSTOM_BACKEND_URL=https://api.yourdomain.com
CUSTOM_BACKEND_API_KEY=your-api-key-here
```

### Custom Backend API Key Validation (Example)

```javascript
// Custom Backend Middleware (Express.js)
// src/middleware/apiAuth.js

const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                 req.headers['x-api-key'];
  
  const validApiKey = process.env.API_KEY; // Or check against database
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }
  
  next();
};

module.exports = { authenticateApiKey };
```

---

## 3. Frontend API Calls

### Example: Calling Backend Function from Base44 UI

```javascript
// Base44 Frontend Component (React-like syntax)
// This is pseudocode - actual Base44 syntax may differ

import { callBackendFunction } from '@base44/platform/functions';
import { useState } from 'react';

export default function BatchProcessButton({ batchId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  
  const handleProcessBatch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await callBackendFunction('processBatch', {
        batchId: batchId,
        userId: currentUser.id
      });
      
      if (result.success) {
        setStatus('Processing started');
        // Poll for status updates
        pollBatchStatus(batchId);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button 
      onClick={handleProcessBatch}
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Process Batch'}
    </button>
  );
}
```

---

## 4. Error Handling

### Example: Comprehensive Error Handling in Base44 Backend Function

```javascript
// Base44 Backend Function
// Name: safeProcessBatch

import { fetch } from '@base44/platform/http';

export default async function safeProcessBatch(batchId, userId) {
  const customBackendUrl = process.env.CUSTOM_BACKEND_URL;
  const apiKey = process.env.CUSTOM_BACKEND_API_KEY;
  
  try {
    // Validate inputs
    if (!batchId) {
      throw new Error('Batch ID is required');
    }
    
    // Make API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(`${customBackendUrl}/api/batches/${batchId}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        triggeredBy: userId,
        timestamp: new Date().toISOString()
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Handle different HTTP status codes
    if (response.status === 401) {
      throw new Error('Authentication failed - check API key');
    }
    
    if (response.status === 404) {
      throw new Error('Batch not found');
    }
    
    if (response.status === 400) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid request');
    }
    
    if (response.status === 500) {
      throw new Error('Server error - please try again later');
    }
    
    if (!response.ok) {
      throw new Error(`Unexpected error: ${response.status}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      data: result
    };
    
  } catch (error) {
    // Handle specific error types
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout - please try again'
      };
    }
    
    if (error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error - check internet connection'
      };
    }
    
    // Log error for debugging
    console.error('Batch processing error:', {
      batchId,
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    };
  }
}
```

---

## 5. Status Polling

### Example: Poll Batch Status (Frontend)

```javascript
// Base44 Frontend Component
// Poll batch status until complete

import { callBackendFunction } from '@base44/platform/functions';
import { useState, useEffect } from 'react';

export default function BatchStatusPolling({ batchId }) {
  const [status, setStatus] = useState('pending');
  const [polling, setPolling] = useState(false);
  
  const pollBatchStatus = async () => {
    if (polling) return;
    
    setPolling(true);
    
    const poll = async () => {
      try {
        // Get batch from Base44 database
        const batch = await getRecord('Batches', batchId);
        
        if (batch.status === 'completed' || 
            batch.status === 'failed' || 
            batch.status === 'cancelled') {
          setStatus(batch.status);
          setPolling(false);
          return;
        }
        
        // Continue polling if still processing
        setTimeout(poll, 5000); // Poll every 5 seconds
        
      } catch (error) {
        console.error('Status polling error:', error);
        setPolling(false);
      }
    };
    
    poll();
  };
  
  useEffect(() => {
    if (batchId) {
      pollBatchStatus();
    }
    
    // Cleanup on unmount
    return () => {
      setPolling(false);
    };
  }, [batchId]);
  
  return (
    <div>
      <p>Status: {status}</p>
      {polling && <p>Polling for updates...</p>}
    </div>
  );
}
```

### Alternative: Webhook Approach (If Base44 Supports)

```javascript
// Custom Backend Webhook Handler
// This sends updates back to Base44 (if webhooks are supported)

// POST /api/webhooks/base44/batch-update
app.post('/api/webhooks/base44/batch-update', async (req, res) => {
  const { batchId, status, data } = req.body;
  
  // Notify Base44 of status update
  // This would require Base44 to support webhooks or provide a callback API
  // Otherwise, use polling as shown above
  
  res.json({ received: true });
});
```

---

## 6. Custom Backend API Endpoints (Reference)

### Batch Processing Endpoint

```javascript
// Custom Backend
// POST /api/batches/:id/process

app.post('/api/batches/:id/process', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const { triggeredBy } = req.body;
    
    const batch = await BatchService.processBatch(id, triggeredBy);
    
    res.json({
      success: true,
      batchId: batch.batchId,
      status: batch.status,
      totalNetEur: batch.totalNetEur,
      fees: batch.fees
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

---

## Notes

1. **Base44 Syntax**: The actual syntax for Base44 backend functions may differ. Refer to Base44 documentation for exact syntax.

2. **Environment Variables**: Store sensitive data (API keys, URLs) in Base44 Secrets, not in code.

3. **Error Handling**: Always implement comprehensive error handling for API calls.

4. **Polling vs Webhooks**: Use polling for status updates if Base44 doesn't support webhooks well.

5. **Authentication**: Choose between API keys (simpler) or JWT passthrough (more complex but preserves user context).

---

**Last Updated:** 2024  
**Base44 Version:** Latest (check docs for current syntax)
