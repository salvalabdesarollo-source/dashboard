export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://vps-5610837-x.dattaweb.com/prod";

// Socket.io necesita la URL base sin /prod porque nginx maneja el routing
const getSocketBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  // Extraer la URL base sin el path /prod
  const url = new URL(API_BASE_URL);
  return `${url.protocol}//${url.host}`;
};

// Determinar el path del socket basado en si API_BASE_URL incluye /prod
const getSocketPath = () => {
  if (process.env.NEXT_PUBLIC_SOCKET_PATH) {
    return process.env.NEXT_PUBLIC_SOCKET_PATH;
  }
  // Si API_BASE_URL incluye /prod, usar /prod/socket.io/, sino /socket.io/
  if (API_BASE_URL.includes("/prod")) {
    return "/prod/socket.io/";
  }
  return "/socket.io/";
};

export const SOCKET_URL = getSocketBaseUrl();

export const SOCKET_PATH = getSocketPath();
