import { create } from "zustand";
import { markTourSeen } from "@/lib/tour";

export const TOUR_STEPS = 5;

interface TourState {
  step: number | null;
  start: () => void;
  goTo: (step: number) => void;
  end: () => void;
}

export const useTour = create<TourState>((set) => ({
  step: null,
  start: () => {
    markTourSeen();
    set({ step: 0 });
  },
  goTo: (step) => set({ step: step < TOUR_STEPS ? step : null }),
  end: () => {
    markTourSeen();
    set({ step: null });
  },
}));
