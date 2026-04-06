import React, { createContext, useContext, useMemo } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children, value = {} }) {
  const memoValue = useMemo(() => value, [value]);
  return <AppContext.Provider value={memoValue}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  return useContext(AppContext);
}

export default AppContext;
