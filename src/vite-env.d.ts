/// <reference types="vite/client" />

import type { GraveyardApi } from '../electron/preload';

declare global {
  interface Window {
    graveyard?: GraveyardApi;
  }
}

export {};
