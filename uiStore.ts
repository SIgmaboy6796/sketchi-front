
import { create } from 'zustand';

// Define the shape of your state and the actions to modify it
interface UIState {
  isGamePaused: boolean;
  cash: number;
  troops: number;
  togglePause: () => void;
  updateStats: (updates: Partial<Pick<UIState, 'cash' | 'troops'>>) => void;
}

// Create the store
export const useUIStore = create<UIState>((set) => ({
  // Initial State
  isGamePaused: false,
  cash: 250000,
  troops: 500,

  // Actions
  togglePause: () => set((state) => ({ isGamePaused: !state.isGamePaused })),

  updateStats: (updates) =>
    set((state) => ({
      cash: updates.cash ?? state.cash,
      troops: updates.troops ?? state.troops,
    })),
}));
