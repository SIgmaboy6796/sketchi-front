// src/state/uiStore.ts
import { create } from 'zustand';

// Define the shape of your state and the actions to modify it
interface UIState {
  isFinancesWindowOpen: boolean;
  isGamePaused: boolean;
  toggleFinancesWindow: () => void;
  togglePause: () => void;
}

// Create the store
export const useUIStore = create<UIState>((set) => ({
  // Initial State
  isFinancesWindowOpen: false,
  isGamePaused: false,

  // Actions
  toggleFinancesWindow: () =>
    set((state) => ({ isFinancesWindowOpen: !state.isFinancesWindowOpen })),
  
  togglePause: () => set((state) => ({ isGamePaused: !state.isGamePaused })),
}));
