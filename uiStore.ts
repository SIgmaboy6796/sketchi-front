
import { create } from 'zustand';

// Define the shape of your state and the actions to modify it
interface UIState {
  isFinancesWindowOpen: boolean;
  isGamePaused: boolean;
  isConsoleOpen: boolean;
  companyValue: number;
  operatingProfit: number;
  cash: number;
  toggleFinancesWindow: () => void;
  togglePause: () => void;
  toggleConsole: () => void;
  updateFinances: (updates: Partial<Pick<UIState, 'companyValue' | 'operatingProfit' | 'cash'>>) => void;
}

// Create the store
export const useUIStore = create<UIState>((set) => ({
  // Initial State
  isFinancesWindowOpen: false,
  isGamePaused: false,
  isConsoleOpen: false,
  companyValue: 100000,
  operatingProfit: 50000,
  cash: 250000,

  // Actions
  toggleFinancesWindow: () =>
    set((state) => ({ isFinancesWindowOpen: !state.isFinancesWindowOpen })),
  
  togglePause: () => set((state) => ({ isGamePaused: !state.isGamePaused })),

  toggleConsole: () =>
    set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),

  updateFinances: (updates) =>
    set((state) => ({
      companyValue: updates.companyValue ?? state.companyValue,
      operatingProfit: updates.operatingProfit ?? state.operatingProfit,
      cash: updates.cash ?? state.cash,
    })),
}));
