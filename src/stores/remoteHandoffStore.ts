import { create } from "zustand";
import {
  cancelRemoteHandoff,
  fetchRemoteHandoffStatus,
  startRemoteHandoff,
  type CcConnectHandoffStartRequest,
  type CcConnectHandoffStatus,
} from "../lib/remoteHandoff";

const EMPTY_STATUS: CcConnectHandoffStatus = {
  active: false,
  running: false,
  info: null,
  warning: null,
};

interface RemoteHandoffStore {
  status: CcConnectHandoffStatus;
  loaded: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  refresh: () => Promise<CcConnectHandoffStatus>;
  start: (request: CcConnectHandoffStartRequest) => Promise<CcConnectHandoffStatus>;
  cancel: () => Promise<CcConnectHandoffStatus>;
}

export const useRemoteHandoffStore = create<RemoteHandoffStore>((set) => ({
  status: EMPTY_STATUS,
  loaded: false,
  busy: false,
  setBusy: (busy) => set({ busy }),

  refresh: async () => {
    const status = await fetchRemoteHandoffStatus();
    set({ status, loaded: true });
    return status;
  },

  start: async (request) => {
    const status = await startRemoteHandoff(request);
    set({ status, loaded: true });
    return status;
  },

  cancel: async () => {
    const status = await cancelRemoteHandoff();
    set({ status, loaded: true });
    return status;
  },
}));
