"use client";

import React, { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface CanvasContextType {
  canvasContent: ReactNode | null;
  setCanvasContent: (content: ReactNode | null) => void;
  canvasVisible: boolean;
  setCanvasVisible: (visible: boolean) => void;
  hasContent: boolean;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function CanvasProvider({ children }: { children: ReactNode }) {
  const [canvasContent, setCanvasContentState] = useState<ReactNode | null>(null);
  const [canvasVisible, setCanvasVisibleState] = useState(false);

  const setCanvasContent = useCallback((content: ReactNode | null) => {
    setCanvasContentState(content);
  }, []);

  const setCanvasVisible = useCallback((visible: boolean) => {
    setCanvasVisibleState(visible);
  }, []);

  return (
    <CanvasContext.Provider
      value={{
        canvasContent,
        setCanvasContent,
        canvasVisible,
        setCanvasVisible,
        hasContent: canvasContent !== null,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }
  return context;
}
