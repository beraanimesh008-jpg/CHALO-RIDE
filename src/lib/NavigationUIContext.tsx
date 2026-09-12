/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState } from 'react';

interface NavigationUIContextType {
  isNavigating: boolean;
  startNavigation: (destination: { lat: number; lng: number; address: string }) => void;
  stopNavigation: () => void;
  activeDestination: { lat: number; lng: number; address: string } | null;
  voicePromptEnabled: boolean;
  toggleVoicePrompt: () => void;
  currentStepInstruction: string;
  setInstruction: (text: string) => void;
}

const NavigationUIContext = createContext<NavigationUIContextType | undefined>(undefined);

export const NavigationUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeDestination, setActiveDestination] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [voicePromptEnabled, setVoicePromptEnabled] = useState(true);
  const [currentStepInstruction, setCurrentStepInstruction] = useState('Head towards pickup location');

  const startNavigation = (destination: { lat: number; lng: number; address: string }) => {
    setActiveDestination(destination);
    setIsNavigating(true);
    setCurrentStepInstruction(`Proceed along main road towards ${destination.address}`);
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    setActiveDestination(null);
  };

  const toggleVoicePrompt = () => {
    setVoicePromptEnabled(prev => !prev);
  };

  return (
    <NavigationUIContext.Provider
      value={{
        isNavigating,
        startNavigation,
        stopNavigation,
        activeDestination,
        voicePromptEnabled,
        toggleVoicePrompt,
        currentStepInstruction,
        setInstruction: setCurrentStepInstruction
      }}
    >
      {children}
    </NavigationUIContext.Provider>
  );
};

export const useNavigationUI = () => {
  const context = useContext(NavigationUIContext);
  if (!context) {
    throw new Error('useNavigationUI must be used within NavigationUIProvider');
  }
  return context;
};
