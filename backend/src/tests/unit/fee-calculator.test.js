const FeeCalculator = require('../../services/fee-calculator.service');

describe('FeeCalculator', () => {
  test('calculates 25% fee breakdown for amount', () => {
    const result = FeeCalculator.calculateFees(100);

    expect(result.grossAmount).toBe(100);
    expect(result.totalFeePercent).toBe(25);
    expect(result.debtFeePercent).toBe(10);
    expect(result.operationalFeePercent).toBe(10);
    expect(result.transactionFeePercent).toBe(5);
    expect(result.debtFeeAmount).toBe(10);
    expect(result.operationalFeeAmount).toBe(10);
    expect(result.transactionFeeAmount).toBe(5);
    expect(result.totalFeeAmount).toBe(25);
    expect(result.netAmount).toBe(75);
  });

  test('calculates batch totals from donations', () => {
    const donations = [
      {
        euroAmount: 100,
        debtFeeAmount: 10,
        operationalFeeAmount: 10,
        transactionFeeAmount: 5,
        netAmountEur: 75
      },
      {
        euroAmount: 50,
        debt_fee_amount: 5,
        operational_fee_amount: 5,
        transaction_fee_amount: 2.5,
        net_amount_eur: 37.5
      }
    ];

    const result = FeeCalculator.calculateBatchFees(donations);

    expect(result.totalGrossEur).toBe(150);
    expect(result.totalDebtFeeEur).toBe(15);
    expect(result.totalOperationalFeeEur).toBe(15);
    expect(result.totalTransactionFeeEur).toBe(7.5);
    expect(result.totalFeeEur).toBe(37.5);
    expect(result.totalNetEur).toBe(112.5);
    expect(result.donationCount).toBe(2);
  });

  test('rejects invalid amount', () => {
    expect(() => FeeCalculator.calculateFees(0)).toThrow('Amount must be greater than 0');
  });
});
