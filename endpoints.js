// ==================== API ENDPOINTS STRUCTURE ====================

// 1. USER AUTHENTICATION
POST   /api/auth/login           // Admin login
POST   /api/auth/logout          // Logout
GET    /api/auth/me             // Get current user

// 2. CAMPAIGN MANAGEMENT
GET    /api/campaigns           // List all campaigns
POST   /api/campaigns           // Create manual campaign
GET    /api/campaigns/:id       // Get campaign details
PUT    /api/campaigns/:id       // Update campaign
DELETE /api/campaigns/:id       // Delete campaign
GET    /api/campaigns/:id/donations // Get campaign donations
POST   /api/campaigns/import-whydonate // Auto-create from WhyDonate

// 3. WHATSAPP INTEGRATION
POST   /api/whatsapp/scan             // Trigger scan for number
GET    /api/whatsapp/scans            // List scan jobs
GET    /api/whatsapp/scans/:id        // Get scan details
GET    /api/whatsapp/chats            // List scanned chats
POST   /api/whatsapp/chats/:id/process // Process specific chat
GET    /api/whatsapp/numbers          // List tracked WhatsApp numbers

// 4. DONATION MANAGEMENT
GET    /api/donations                 // List all donations
GET    /api/donations/:id             // Get donation details
PUT    /api/donations/:id             // Update donation
POST   /api/donations/batch-create    // Create multiple donations
GET    /api/donations/stats           // Get donation statistics
GET    /api/donations/pending         // Get pending donations

// 5. BATCH PROCESSING
GET    /api/batches                   // List all batches
POST   /api/batches                   // Create new batch
GET    /api/batches/:id               // Get batch details
POST   /api/batches/:id/process       // Process batch (to EUR)
POST   /api/batches/:id/initiate-simplex // Start Simplex purchase
POST   /api/batches/:id/simplex-callback // Simplex callback
POST   /api/batches/:id/send-tron     // Send to TRON network
GET    /api/batches/:id/status        // Check batch status
DELETE /api/batches/:id               // Cancel batch

// 6. CURRENCY & EXCHANGE
GET    /api/currencies                // List supported currencies
GET    /api/exchange-rates            // Get current rates
POST   /api/exchange-rates/refresh    // Fetch from Stripe
GET    /api/exchange-rates/history    // Get rate history

// 7. FEE MANAGEMENT
GET    /api/fees/allocations          // List fee allocations
POST   /api/fees/distribute           // Manually distribute fees
GET    /api/fees/summary              // Fee summary by period
GET    /api/fees/accounts             // List fee destination accounts

// 8. ADMIN & SYSTEM
GET    /api/admin/dashboard           // Admin dashboard data
POST   /api/admin/config              // Update system config
GET    /api/admin/logs                // View system logs
POST   /api/admin/backup              // Trigger backup

// ==================== FRONTEND COMPONENTS STRUCTURE ====================

/*
Dashboard Structure:
1. Campaign Manager
   - List campaigns with stats
   - Create/Edit campaigns
   - Link to WhatsApp numbers

2. WhatsApp Scanner
   - Input WhatsApp number
   - Scan status monitor
   - View extracted donations

3. Donation Queue
   - Pending donations
   - Fee breakdown display
   - Batch selection interface

4. Batch Processor
   - Create new batches
   - Review fee calculations
   - Manual process triggers
   - Status monitor

5. Transaction History
   - Completed batches
   - Blockchain transaction viewer
   - Fee allocation reports

6. System Configuration
   - Fee percentages (10%, 10%, 5%)
   - Wallet addresses
   - API keys management
*/

// ==================== EXAMPLE IMPLEMENTATION ====================

// Example: WhatsApp Scan Endpoint
app.post('/api/whatsapp/scan', authenticate, async (req, res) => {
    try {
        const { whatsappNumber, scanRange } = req.body;
        const userId = req.user.id;
        
        // 1. Create scan job
        const scanJob = await db.whatsapp_scan_jobs.create({
            whatsapp_number: whatsappNumber,
            initiated_by: userId,
            status: 'pending'
        });
        
        // 2. Start background scan
        queue.add('scan-whatsapp', {
            scanId: scanJob.scan_id,
            whatsappNumber,
            userId
        });
        
        // 3. Return immediate response
        res.json({
            success: true,
            scanId: scanJob.scan_id,
            message: 'Scan started in background'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example: Create Batch with Fee Calculation
app.post('/api/batches', authenticate, async (req, res) => {
    try {
        const { donationIds, targetWallet } = req.body;
        
        // Get donations with fee calculation
        const donations = await db.donations.findAll({
            where: { donation_id: donationIds, status: 'pending' }
        });
        
        // Calculate totals with 25% fee breakdown
        let totals = {
            gross: 0,
            debt: 0,        // 10%
            operational: 0, // 10%
            transaction: 0, // 5%
            net: 0
        };
        
        donations.forEach(donation => {
            totals.gross += donation.euro_amount;
            totals.debt += donation.debt_fee_amount;
            totals.operational += donation.operational_fee_amount;
            totals.transaction += donation.transaction_fee_amount;
            totals.net += donation.net_amount_eur;
        });
        
        // Create batch
        const batch = await db.transaction_batches.create({
            campaign_id: donations[0].campaign_id,
            total_gross_eur: totals.gross,
            total_debt_fee_eur: totals.debt,
            total_operational_fee_eur: totals.operational,
            total_transaction_fee_eur: totals.transaction,
            total_net_eur: totals.net,
            target_wallet: targetWallet,
            network: 'TRON',
            status: 'draft',
            initiated_by: req.user.id
        });
        
        // Link donations to batch
        await db.batch_donations.bulkCreate(
            donations.map(d => ({
                batch_id: batch.batch_id,
                donation_id: d.donation_id
            }))
        );
        
        res.json({
            success: true,
            batch: {
                ...batch.toJSON(),
                feeBreakdown: {
                    debt: { percent: 10, amount: totals.debt },
                    operational: { percent: 10, amount: totals.operational },
                    transaction: { percent: 5, amount: totals.transaction },
                    totalFees: totals.debt + totals.operational + totals.transaction,
                    netAmount: totals.net
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Example: Simplex Integration
app.post('/api/batches/:id/initiate-simplex', authenticate, async (req, res) => {
    try {
        const batch = await db.transaction_batches.findByPk(req.params.id);
        
        if (!batch) return res.status(404).json({ error: 'Batch not found' });
        if (batch.status !== 'processing') {
            return res.status(400).json({ error: 'Batch not ready for Simplex' });
        }
        
        // Get current EUR to USDT rate
        const rate = await getExchangeRate('EUR', 'USDT');
        
        // Calculate USDT amount
        const usdtAmount = batch.total_net_eur * rate;
        
        // Create Simplex payment request
        const simplexRequest = {
            account_details: {
                app_provider_id: process.env.SIMPLEX_APP_ID,
                app_end_user_id: req.user.id
            },
            transaction_details: {
                payment_details: {
                    quote_id: `BATCH-${batch.batch_id}`,
                    fiat_total_amount: {
                        amount: batch.total_net_eur.toString(),
                        currency: 'EUR'
                    },
                    requested_digital_amount: {
                        amount: usdtAmount.toString(),
                        currency: 'USDT'
                    },
                    destination_wallet: batch.target_wallet,
                    network: batch.network
                }
            }
        };
        
        // Call Simplex API
        const response = await axios.post(
            `${process.env.SIMPLEX_API}/payments/partner/initiate`,
            simplexRequest,
            { headers: { 'Authorization': `Bearer ${process.env.SIMPLEX_API_KEY}` } }
        );
        
        // Update batch
        await batch.update({
            status: 'awaiting_simplex',
            target_usdt_amount: usdtAmount,
            eur_to_usdt_rate: rate
        });
        
        res.json({
            success: true,
            redirectUrl: response.data.payment_url,
            batchId: batch.batch_id
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});