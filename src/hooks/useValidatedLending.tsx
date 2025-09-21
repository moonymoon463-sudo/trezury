// Placeholder for backward compatibility
export function useValidatedLending() {
  return {
    validationErrors: [],
    clearValidationErrors: () => {},
    validateHealthFactor: () => Promise.resolve(true),
    getPerformanceStats: () => ({})
  };
}