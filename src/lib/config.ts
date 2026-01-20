export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://vps-5610837-x.dattaweb.com/prod";

export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? API_BASE_URL;

export const SOCKET_PATH = process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/socket.io/";
