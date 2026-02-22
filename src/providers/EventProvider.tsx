import { create } from 'zustand';
import type { Event } from '../lib/types';

type EventStore = {
  activeEvent: Event | null;
  setActiveEvent: (event: Event | null) => void;
};

export const useEventStore = create<EventStore>((set) => ({
  activeEvent: null,
  setActiveEvent: (event) => set({ activeEvent: event }),
}));
