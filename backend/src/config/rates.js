module.exports = {
  stripeApiKey: process.env.STRIPE_API_KEY,
  stripeApiUrl: process.env.STRIPE_API_URL || 'https://api.stripe.com/v1',
  simplexApiUrl: process.env.SIMPLEX_API_URL || 'https://sandbox.test-simplex.com',
  simplexApiKey: process.env.SIMPLEX_API_KEY,
  simplexAppId: process.env.SIMPLEX_APP_PROVIDER_ID || process.env.SIMPLEX_APP_ID,
  exchangeRateUpdateMinutes: parseInt(process.env.EXCHANGE_RATE_UPDATE_MINUTES || '30', 10)
};
