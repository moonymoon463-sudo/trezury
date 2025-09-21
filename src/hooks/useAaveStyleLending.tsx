// Placeholder for backward compatibility
export function useAaveStyleLending() {
  return {
    poolReserves: [],
    userSupplies: [],
    userBorrows: [],
    healthFactor: { factor: 0 },
    loading: false,
    supply: () => Promise.resolve(),
    withdraw: () => Promise.resolve(),
    borrow: () => Promise.resolve(),
    repay: () => Promise.resolve(),
    setCollateral: () => Promise.resolve(),
    refetch: () => Promise.resolve()
  };
}