import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import LandingPage from '@/pages/LandingPage';
import WaitlistPage from '@/pages/WaitlistPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import GameRoomPage from '@/pages/GameRoomPage';
import ArmyBuilderPage from '@/pages/ArmyBuilderPage';
import VenueDashboardPage from '@/pages/VenueDashboardPage';
import MonopolyGamePage from '@/games/monopoly/MonopolyGamePage';
import CatanGamePage from '@/games/catan/CatanGamePage';
import CodenamesGamePage from '@/games/codenames/CodenamesGamePage';
import RiskGamePage from '@/games/risk/RiskGamePage';
import PlayerDashboardPage from '@/pages/PlayerDashboardPage';
import GameLobbyPage from '@/pages/GameLobbyPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/game/:roomCode" element={<GameRoomPage />} />
          <Route path="/lobby/:roomCode" element={<GameLobbyPage />} />
          <Route path="/army-builder" element={<ArmyBuilderPage />} />
          <Route path="/venue" element={<VenueDashboardPage />} />
          <Route path="/games/monopoly" element={<MonopolyGamePage />} />
          <Route path="/games/catan" element={<CatanGamePage />} />
          <Route path="/games/codenames" element={<CodenamesGamePage />} />
          <Route path="/games/risk" element={<RiskGamePage />} />
          <Route path="/player" element={<PlayerDashboardPage />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}
