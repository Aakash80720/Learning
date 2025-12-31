"use client";

import React from "react";
import { Resizable } from "re-resizable";
import { X, ChevronLeft, Layers } from "lucide-react";
import { useCanvas } from "@/providers/Canvas";
import "../../styles/canvas-design-system.css";

interface CanvasProps {
  title?: string;
  subtitle?: string;
  defaultWidth?: number;
}

export function Canvas({
  title = "Preview",
  subtitle = "Live Component",
  defaultWidth = 480,
}: CanvasProps) {
  const { canvasContent, canvasVisible, setCanvasVisible, hasContent } = useCanvas();

  return (
    <>
      {/* Right Panel - Resizable Canvas */}
      {canvasVisible && (
        <Resizable
          defaultSize={{
            width: defaultWidth,
            height: "100%",
          }}
          minWidth={320}
          maxWidth={800}
          enable={{
            top: false,
            right: false,
            bottom: false,
            left: true,
            topRight: false,
            bottomRight: false,
            bottomLeft: false,
            topLeft: false,
          }}
          className="border-l border-gray-200 shadow-2xl"
          handleStyles={{
            left: {
              width: "6px",
              left: "-3px",
              cursor: "ew-resize",
            },
          }}
          handleClasses={{
            left: "hover:bg-blue-500/20 transition-colors duration-200",
          }}
        >
          <div className="canvas-component">
            {/* Canvas Header */}
            <div className="canvas-header" style={{ 
              background: 'var(--canvas-surface)', 
              margin: '0',
              borderBottom: '1px solid var(--canvas-border-color)'
            }}>
              <div className="canvas-flex canvas-items-center canvas-gap-4">
                <div style={{ 
                  width: '6px', 
                  height: '40px', 
                  background: 'var(--canvas-gradient-blue)', 
                  borderRadius: '999px' 
                }}></div>
                <div>
                  <h2 className="canvas-text-lg canvas-font-semibold canvas-text-primary">
                    {title}
                  </h2>
                  <p className="canvas-text-sm canvas-text-muted">{subtitle}</p>
                </div>
              </div>
              <div className="canvas-flex canvas-items-center canvas-gap-2">
                {hasContent && (
                  <div className="canvas-flex canvas-items-center canvas-gap-2" style={{
                    padding: 'var(--canvas-space-2) var(--canvas-space-3)',
                    background: '#dcfce7',
                    borderRadius: 'var(--canvas-border-radius)',
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      background: '#16a34a',
                      borderRadius: '50%',
                      animation: 'canvas-pulse 2s infinite'
                    }}></div>
                    <span className="canvas-text-sm canvas-font-medium" style={{color: '#15803d'}}>Live</span>
                  </div>
                )}
                <button
                  onClick={() => setCanvasVisible(false)}
                  className="canvas-carousel-button canvas-transition-fast"
                  title="Close canvas"
                  style={{ background: 'transparent', border: 'none' }}
                >
                  <X className="w-4 h-4 canvas-text-muted" />
                </button>
              </div>
            </div>

            {/* Canvas Content */}
            <div className="canvas-content-scroll">
              {canvasContent ? (
                <div className="canvas-container">
                  {canvasContent}
                </div>
              ) : (
                <div className="canvas-empty">
                  <div className="canvas-empty-icon">
                    <Layers className="w-16 h-16" />
                  </div>
                  <h3 className="canvas-empty-title">No component to preview</h3>
                  <p className="canvas-empty-description">
                    Ask about weather or news to see live components here
                  </p>
                </div>
              )}
            </div>
          </div>
        </Resizable>
      )}

      {/* Toggle Canvas Button - When Hidden */}
      {!canvasVisible && (
        <button
          onClick={() => setCanvasVisible(true)}
          className={`fixed right-0 top-1/2 -translate-y-1/2 bg-white border text-gray-700 px-2 py-4 rounded-l-xl shadow-xl hover:shadow-2xl transition-all duration-300 group z-50 ${
            hasContent 
              ? "border-blue-300 bg-blue-50 hover:bg-blue-100" 
              : "border-gray-200 hover:bg-gray-50"
          }`}
          title="Open canvas preview"
        >
          <div className="flex flex-col items-center gap-2">
            {hasContent && (
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            )}
            <ChevronLeft className={`w-5 h-5 transition-colors ${
              hasContent ? "text-blue-500" : "text-gray-400 group-hover:text-blue-500"
            }`} />
            <span 
              className={`text-[10px] font-medium tracking-wider uppercase ${
                hasContent ? "text-blue-500" : "text-gray-400 group-hover:text-blue-500"
              }`}
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Canvas
            </span>
          </div>
        </button>
      )}
    </>
  );
}

export default Canvas;
