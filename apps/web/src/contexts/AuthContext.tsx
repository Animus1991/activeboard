import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { auth, type User } from '@/lib/api';

// Mock user for development/testing when backend is unavailable
const MOCK_USER: User = {
  id: 'mock-user-1',
  email: 'user@example.com',
  username: 'User1',
  displayName: 'User1',
  totalGamesPlayed: 0,
  totalPlayTimeMinutes: 0,
  preferredGameSystems: [],
};

// Check if we should use mock mode (backend unavailable)
// In development, always allow mock fallback
const USE_MOCK = true;

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Try to get user from API, fall back to mock if it fails
      auth.me()
        .then(setUser)
        .catch(() => {
          // If API fails and we have a mock token, use mock user
          if (token === 'mock-token' && USE_MOCK) {
            const savedUser = localStorage.getItem('mockUser');
            if (savedUser) {
              setUser(JSON.parse(savedUser));
            }
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await auth.login(email, password);
      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      setUser(response.user);
    } catch (error) {
      // If backend is unavailable and mock mode is enabled, use mock login
      if (USE_MOCK) {
        const mockUser = { ...MOCK_USER, email, displayName: email.split('@')[0] };
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('mockUser', JSON.stringify(mockUser));
        setUser(mockUser);
        return;
      }
      throw error;
    }
  };

  const register = async (data: { email: string; username: string; password: string; displayName?: string }) => {
    try {
      const response = await auth.register(data);
      localStorage.setItem('token', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      setUser(response.user);
    } catch (error) {
      // If backend is unavailable and mock mode is enabled, use mock register
      if (USE_MOCK) {
        const mockUser = { ...MOCK_USER, ...data, id: `mock-${Date.now()}` };
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('mockUser', JSON.stringify(mockUser));
        setUser(mockUser);
        return;
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth.logout();
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('mockUser');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
