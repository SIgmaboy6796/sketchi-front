import { create } from 'zustand';

// Create the store
export const useUIStore = create((set: any) => ({
  // Initial State
  isGamePaused: false,
  cash: 250000,
  troops: 500,

  // Actions
  togglePause: () => set((state: any) => ({ isGamePaused: !state.isGamePaused })),

  updateStats: (updates: any) =>
    set((state: any) => ({
      cash: updates.cash ?? state.cash,
      troops: updates.troops ?? state.troops,
    })),
}));
