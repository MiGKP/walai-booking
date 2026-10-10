import { create } from "zustand";
import api from "@/lib/api";

export interface PendingNotificationItem {
  id: string;
  type: string;
  title: string;
  customer_name: string;
  amount: number;
  detail: string;
  time: string;
  href: string;
}

export interface NotificationCounts {
  room_slips: number;
  boat_slips: number;
  today_checkins: number;
  today_checkouts: number;
  today_boat_checkins: number;
  total_urgent: number;
}

interface AdminNotificationState {
  counts: NotificationCounts;
  recentItems: PendingNotificationItem[];
  isLoading: boolean;
  lastFetchedAt: number | null;
  fetchNotifications: (silent?: boolean) => Promise<void>;
}

export const useAdminNotificationStore = create<AdminNotificationState>((set, get) => ({
  counts: {
    room_slips: 0,
    boat_slips: 0,
    today_checkins: 0,
    today_checkouts: 0,
    today_boat_checkins: 0,
    total_urgent: 0,
  },
  recentItems: [],
  isLoading: false,
  lastFetchedAt: null,

  fetchNotifications: async (silent = false) => {
    if (!silent) {
      set({ isLoading: true });
    }
    try {
      const res = await api.get<{
        success: boolean;
        data: {
          counts: NotificationCounts;
          recent_items: PendingNotificationItem[];
        };
      }>("/settings/notifications/pending");

      if (res.data?.success && res.data.data) {
        set({
          counts: res.data.data.counts,
          recentItems: res.data.data.recent_items || [],
          lastFetchedAt: Date.now(),
        });
      }
    } catch {
      // Ignore background fetch errors to prevent disrupting user UI
    } finally {
      if (!silent) {
        set({ isLoading: false });
      }
    }
  },
}));
