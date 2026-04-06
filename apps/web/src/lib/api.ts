const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data: ApiResponse<T> = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'An error occurred');
  }

  return data.data as T;
}

// Auth API
export interface User {
  id: string;
  email: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  preferredGameSystems?: string[];
  vrHeadset?: string;
  totalGamesPlayed?: number;
  totalPlayTimeMinutes?: number;
  isVerified?: boolean;
  isAdmin?: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const auth = {
  register: (data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) => apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  login: (email: string, password: string) =>
    apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),

  me: () => apiRequest<User>('/auth/me'),

  refresh: (refreshToken: string) =>
    apiRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),
};

// Waitlist API
export interface WaitlistEntry {
  position: number;
  referralCode: string;
  referralLink?: string;
}

export interface WaitlistStats {
  totalSignups: number;
  wargamerPercentage: number;
  vrOwnershipPercentage: number;
}

export const waitlist = {
  join: (data: {
    email: string;
    name?: string;
    primaryInterest?: string;
    currentPlatforms?: string[];
    hasVrHeadset?: boolean;
    vrHeadsetType?: string;
    playFrequency?: string;
    biggestPainPoint?: string;
    willingToPay?: string;
    referredBy?: string;
  }) => apiRequest<WaitlistEntry>('/waitlist', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  stats: () => apiRequest<WaitlistStats>('/waitlist/stats'),

  check: (email: string) =>
    apiRequest<{
      onWaitlist: boolean;
      status?: string;
      referralCode?: string;
      referralCount?: number;
      priority?: number;
    }>(`/waitlist/check/${encodeURIComponent(email)}`),
};

// Games API
export interface GameSystem {
  id: string;
  slug: string;
  name: string;
  publisher?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  avgPlayTimeMinutes?: number;
  complexity?: string;
  rulesUrl?: string;
  iconUrl?: string;
  coverImageUrl?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  releasePhase?: string;
}

export interface Faction {
  id: string;
  gameSystemId: string;
  slug: string;
  name: string;
  description?: string;
  playstyle?: string;
  iconUrl?: string;
  colorPrimary?: string;
  colorSecondary?: string;
}

export interface UnitType {
  id: string;
  factionId: string;
  slug: string;
  name: string;
  description?: string;
  pointsCost?: number;
  quality?: number;
  defense?: number;
  modelCount?: number;
  equipment?: string[];
  specialRules?: string[];
}

export const games = {
  listSystems: () => apiRequest<GameSystem[]>('/games/systems'),

  getSystem: (slug: string) =>
    apiRequest<GameSystem & { factions: Faction[] }>(`/games/systems/${slug}`),

  getFaction: (id: string) =>
    apiRequest<Faction & { gameSystem: GameSystem; unitTypes: UnitType[] }>(
      `/games/factions/${id}`
    ),

  getUnit: (id: string) =>
    apiRequest<UnitType & { faction: Faction & { gameSystem: GameSystem } }>(
      `/games/units/${id}`
    ),
};

// Rooms API
export interface GameRoom {
  id: string;
  code: string;
  hostId: string;
  gameSystemId: string;
  name: string;
  description?: string;
  maxPlayers?: number;
  pointsLimit?: number;
  isPrivate?: boolean;
  hasPassword?: boolean;
  status: string;
  createdAt: string;
  startedAt?: string;
  host?: User;
  gameSystem?: GameSystem;
  players?: RoomPlayer[];
}

export interface RoomPlayer {
  id: string;
  roomId: string;
  userId: string;
  isReady: boolean;
  isConnected: boolean;
  deviceType?: string;
  user?: User;
}

export const rooms = {
  list: () => apiRequest<GameRoom[]>('/rooms'),

  create: (data: {
    name: string;
    description?: string;
    gameSystemId: string;
    maxPlayers?: number;
    pointsLimit?: number;
    isPrivate?: boolean;
    password?: string;
  }) => apiRequest<GameRoom>('/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getByCode: (code: string) => apiRequest<GameRoom>(`/rooms/code/${code}`),

  get: (id: string) => apiRequest<GameRoom>(`/rooms/${id}`),

  join: (id: string, password?: string) =>
    apiRequest<RoomPlayer>(`/rooms/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  leave: (id: string) =>
    apiRequest<void>(`/rooms/${id}/leave`, { method: 'POST' }),

  toggleReady: (id: string) =>
    apiRequest<{ isReady: boolean }>(`/rooms/${id}/ready`, { method: 'POST' }),

  start: (id: string) =>
    apiRequest<GameRoom>(`/rooms/${id}/start`, { method: 'POST' }),
};
