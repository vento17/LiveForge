import type { IpcChannels, IpcReq, IpcRes } from '../../shared/types/ipc';

// Single typed entry point for all IPC calls.
// Components never touch window.api directly.

type InvokeChannels = {
  [K in keyof IpcChannels]: IpcChannels[K]['req'] extends never ? never : K;
}[keyof IpcChannels];

type EventChannels = {
  [K in keyof IpcChannels]: IpcChannels[K]['req'] extends never ? K : never;
}[keyof IpcChannels];

export const bridge = {
  invoke: <K extends InvokeChannels>(
    channel: K,
    payload: IpcReq<K>
  ): Promise<IpcRes<K>> =>
    window.api.invoke<IpcRes<K>>(channel, payload),

  send: <K extends InvokeChannels>(
    channel: K,
    payload: IpcReq<K>
  ): void =>
    window.api.send(channel, payload),

  on: <K extends EventChannels>(
    channel: K,
    listener: (payload: IpcRes<K>) => void
  ): (() => void) =>
    window.api.on(channel, listener as (...args: unknown[]) => void),
};

// Augment window type
declare global {
  interface Window {
    api: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<T>;
      send: (channel: string, payload?: unknown) => void;
      on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
    };
  }
}
