import { Home, Globe, Layers, Radio, X, Eye, EyeOff, Cloud } from 'lucide-react';
import { useState } from 'react';

interface MapOverlayControlsProps {
  mapView: 'kupang' | 'indonesia';
  onMapViewChange: (view: 'kupang' | 'indonesia') => void;
  aisCount: number;
  nonAisCount: number;
  activeUavCount: number;
  anomaliesCount: number;
  showAIS: boolean;
  showADSB: boolean;
  showENC: boolean;
  showWeather: boolean;
  onToggleAIS: () => void;
  onToggleADSB: () => void;
  onToggleENC: () => void;
  onToggleWeather: () => void;
  showViewToggle?: boolean;
  showLegend?: boolean;
  showLayers?: boolean;
}

export default function MapOverlayControls({
  mapView,
  onMapViewChange,
  aisCount,
  nonAisCount,
  activeUavCount,
  anomaliesCount,
  showAIS,
  showADSB,
  showENC,
  showWeather,
  onToggleAIS,
  onToggleADSB,
  onToggleENC,
  onToggleWeather,
  showViewToggle = true,
  showLegend = true,
  showLayers = true
}: MapOverlayControlsProps) {
  const [showLayersPanel, setShowLayersPanel] = useState(false);

  return (
    <>
      {/* Top Left Controls */}
      {showViewToggle && (
        <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => onMapViewChange('kupang')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md transition-all border ${mapView === 'kupang'
              ? 'bg-[#21A68D] text-white border-[#21A68D] shadow-lg shadow-[#21A68D]/20'
              : 'bg-white/90 text-gray-700 border-gray-200 hover:bg-white hover:border-gray-300'
              }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">PSDKP Kupang</span>
          </button>

          <button
            onClick={() => onMapViewChange('indonesia')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-md transition-all border ${mapView === 'indonesia'
              ? 'bg-[#21A68D] text-white border-[#21A68D] shadow-lg shadow-[#21A68D]/20'
              : 'bg-white/90 text-gray-700 border-gray-200 hover:bg-white hover:border-gray-300'
              }`}
            title="View Indonesia"
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm font-medium">Indonesia</span>
          </button>
        </div>
      )}

      {/* Top Right Layers Button */}
      {showLayers && (
        <div className="absolute top-4 right-4 z-[1000]">
          <button
            className="p-2.5 rounded-lg bg-white/90 backdrop-blur-md text-gray-700 border border-gray-200 hover:bg-white transition-all shadow-md"
            onClick={() => setShowLayersPanel(!showLayersPanel)}
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Layers Panel */}
      {showLayers && showLayersPanel && (
        <div className="absolute top-16 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-lg p-4 shadow-xl border border-gray-200 min-w-[200px]">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Map Layers</h3>
            <button
              className="p-1 rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setShowLayersPanel(false)}
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          <div className="space-y-2">
            <button
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-all text-left"
              onClick={onToggleAIS}
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${showAIS ? 'bg-blue-500 shadow-sm shadow-blue-500/50' : 'bg-gray-200'}`}>
                  {showAIS ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                </div>
                <span className={`text-sm font-medium transition-colors ${showAIS ? 'text-gray-900' : 'text-gray-400'}`}>AIS Vessels</span>
              </div>
            </button>

            <button
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-all text-left"
              onClick={onToggleADSB}
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${showADSB ? 'bg-purple-500 shadow-sm shadow-purple-500/50' : 'bg-gray-200'}`}>
                  {showADSB ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                </div>
                <span className={`text-sm font-medium transition-colors ${showADSB ? 'text-gray-900' : 'text-gray-400'}`}>Aircraft</span>
              </div>
            </button>

            <button
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-all text-left"
              onClick={onToggleENC}
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${showENC ? 'bg-[#21A68D] shadow-sm shadow-[#21A68D]/50' : 'bg-gray-200'}`}>
                  {showENC ? <Eye className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                </div>
                <span className={`text-sm font-medium transition-colors ${showENC ? 'text-gray-900' : 'text-gray-400'}`}>Nautical Charts</span>
              </div>
            </button>

            <button
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-all text-left"
              onClick={onToggleWeather}
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${showWeather ? 'bg-orange-500 shadow-sm shadow-orange-500/50' : 'bg-gray-200'}`}>
                  {showWeather ? <Cloud className="w-3 h-3 text-white" /> : <EyeOff className="w-3 h-3 text-gray-400" />}
                </div>
                <span className={`text-sm font-medium transition-colors ${showWeather ? 'text-gray-900' : 'text-gray-400'}`}>Weather Layer</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Left Legend */}
      {showLegend && (
        <div className="absolute bottom-8 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-lg p-4 shadow-xl border border-gray-200" style={{ minWidth: '180px' }}>
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 border-b border-gray-100 pb-2">Map Legend</h3>

          <div className="mb-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase mb-2">Vessels</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-gray-600">AIS</span>
                </div>
                <span className="text-xs font-semibold text-gray-900">{aisCount}</span>
              </div>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase mb-2">Fleet</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-3 h-3 text-[#21A68D]" />
                <span className="text-xs text-gray-600">Active Assets</span>
              </div>
              <span className="text-xs font-semibold text-gray-900">{activeUavCount}</span>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-semibold text-gray-500 uppercase mb-2">Events</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="text-xs text-gray-600">Anomalies</span>
              </div>
              <span className="text-xs font-semibold text-red-600">{anomaliesCount}</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="text-[9px] font-semibold text-gray-500 uppercase mb-2">Weather</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-gray-600">Local Conditions</span>
              </div>
              <span className="text-xs font-semibold text-gray-900">Active</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
