/**
 * CatanBuildMode.tsx
 * AAA Production Build Mode UI Component.
 * Provides HUD toggle, building selection, valid placement highlighting, and instant feedback.
 * Fully event-driven and state-bound.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BuildingType } from './CatanEngine';
import { CatanEventBus } from './CatanEventBus';
import { Hammer, Home, Building2, Route, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BuildModeState = {
  active: BuildingType | null;
  playerId: string | null;
};

interface BuildModeHUDProps {
  buildMode: BuildModeState;
  onEnterBuildMode: (type: BuildingType) => void;
  onExitBuildMode: () => void;
  disabled?: boolean;
  className?: string;
}

// Mobile-first sizing: 48px touch targets, 12px spacing
const BUILD_BUTTONS: Array<{
  type: BuildingType;
  icon: React.ReactNode;
  label: string;
  color: string;
  hoverColor: string;
}> = [
  { type: 'settlement', icon: <Home className="w-6 h-6" />, label: 'Settlement', color: 'bg-green-600', hoverColor: 'hover:bg-green-500' },
  { type: 'city', icon: <Building2 className="w-6 h-6" />, label: 'City', color: 'bg-blue-600', hoverColor: 'hover:bg-blue-500' },
  { type: 'road', icon: <Route className="w-6 h-6" />, label: 'Road', color: 'bg-amber-600', hoverColor: 'hover:bg-amber-500' },
];

export function BuildModeHUD({ buildMode, onEnterBuildMode, onExitBuildMode, disabled = false, className }: BuildModeHUDProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-exit build mode on turn change (event-driven)
  useEffect(() => {
    const unsubscribe = CatanEventBus.on('TURN_CHANGED', () => {
      if (buildMode.active) {
        onExitBuildMode();
      }
    });
    return unsubscribe;
  }, [buildMode.active, onExitBuildMode]);

  // Handle build mode entry with animation
  const handleEnterBuildMode = useCallback((type: BuildingType) => {
    if (disabled) return;
    setIsAnimating(true);
    onEnterBuildMode(type);
    // Reset animation after transition
    setTimeout(() => setIsAnimating(false), 300);
  }, [disabled, onEnterBuildMode]);

  // Handle build mode exit
  const handleExitBuildMode = useCallback(() => {
    setIsAnimating(false);
    onExitBuildMode();
  }, [onExitBuildMode]);

  // Determine active button for visual feedback
  const activeButton = useMemo(() => {
    return BUILD_BUTTONS.find(b => b.type === buildMode.active);
  }, [buildMode.active]);

  if (!buildMode.active) {
    // Collapsed state: only show build mode toggle button
    return (
      <div className={cn('fixed bottom-6 right-6 z-40 flex flex-col gap-3', className)}>
        <button
          onClick={() => handleEnterBuildMode('settlement')} // Default to settlement
          disabled={disabled}
          className={cn(
            'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200',
            disabled ? 'bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
          )}
          aria-label="Enter Build Mode"
        >
          <Hammer className="w-7 h-7 text-white" />
        </button>
      </div>
    );
  }

  // Expanded state: show all build options + exit button
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-40 bg-slate-900/95 backdrop-blur-sm rounded-2xl shadow-2xl p-4 border border-slate-700',
      'transition-all duration-300 ease-out',
      isAnimating ? 'scale-95 opacity-80' : 'scale-100 opacity-100',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Hammer className="w-5 h-5 text-indigo-400" />
          <span className="text-white font-semibold text-base">Build Mode</span>
        </div>
        <button
          onClick={handleExitBuildMode}
          className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
          aria-label="Exit Build Mode"
        >
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Active Building Indicator */}
      {activeButton && (
        <div className={cn(
          'mb-4 p-3 rounded-lg border-2 transition-colors',
          activeButton.color.replace('bg-', 'border-').replace('-600', '-500')
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', activeButton.color)}>
              {activeButton.icon}
            </div>
            <div>
              <div className="text-white font-medium">{activeButton.label}</div>
              <div className="text-slate-400 text-sm">Click a valid location to build</div>
            </div>
          </div>
        </div>
      )}

      {/* Build Options */}
      <div className="space-y-2">
        {BUILD_BUTTONS.map(({ type, icon, label, color, hoverColor }) => (
          <button
            key={type}
            onClick={() => handleEnterBuildMode(type)}
            disabled={disabled}
            className={cn(
              'w-full h-12 rounded-lg flex items-center gap-3 px-3 transition-all duration-200',
              disabled ? 'opacity-50 cursor-not-allowed bg-slate-800' : 
                buildMode.active === type 
                  ? `${color} text-white shadow-md` 
                  : `${hoverColor} bg-slate-800 text-slate-300 hover:text-white`
            )}
          >
            <div className={cn('p-1 rounded', buildMode.active === type ? 'bg-white/20' : 'bg-slate-700')}>
              {icon}
            </div>
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <p className="text-slate-400 text-xs text-center">
          Valid locations will be highlighted on the board
        </p>
      </div>
    </div>
  );
}

/**
 * Hook to manage build mode state and event subscriptions
 */
export function useBuildModeState(initialPlayerId: string | null = null): BuildModeState & {
  setBuildMode: (type: BuildingType | null) => void;
} {
  const [buildMode, setBuildModeState] = useState<BuildModeState>({
    active: null,
    playerId: initialPlayerId,
  });

  // Event-driven updates
  useEffect(() => {
    const unsubscribeEnter = CatanEventBus.on('BUILD_MODE_ENTERED', ({ buildingType, playerId }) => {
      setBuildModeState({ active: buildingType, playerId });
    });

    const unsubscribeExit = CatanEventBus.on('BUILD_MODE_EXITED', () => {
      setBuildModeState({ active: null, playerId: null });
    });

    return () => {
      unsubscribeEnter();
      unsubscribeExit();
    };
  }, []);

  const setBuildMode = useCallback((type: BuildingType | null) => {
    if (type) {
      CatanEventBus.dispatch({
        type: 'BUILD_MODE_ENTERED',
        payload: { buildingType: type, playerId: buildMode.playerId || 'unknown' }
      });
    } else {
      CatanEventBus.dispatch({
        type: 'BUILD_MODE_EXITED',
        payload: { playerId: buildMode.playerId || 'unknown' }
      });
    }
  }, [buildMode.playerId]);

  return {
    ...buildMode,
    setBuildMode,
  };
}
