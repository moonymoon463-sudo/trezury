// Placeholder for backward compatibility
export function useRealtimeLending() {
  return {
    poolData: [],
    userSupplies: [],
    userBorrows: [],
    healthFactor: 0,
    loading: false,
    metrics: {
      totalSuppliedUSD: 0,
      totalBorrowedUSD: 0,
      netAPY: 0,
      healthStatus: 'healthy'
    }
  };
}