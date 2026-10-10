/**
 * src/components/RouteMap.jsx
 *
 * Interactive Leaflet Map for One Journey Transit.
 * Displays multimodal route geometry, color-coded transit legs (Metro/BRTS/AMTS/GTSL/Walk),
 * origin/destination pins, transfer points, and interactive popups.
 */

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { t, fmtDuration, legLabel } from '../i18n.js';

// Network brand colors
export const NETWORK_COLORS = {
  metro: '#8e24aa', // Royal Purple / Metro
  brts: '#f57c00',  // Vibrant Orange / BRTS Janmarg
  amts: '#e53935',  // Red / AMTS Bus
  gtsl: '#00897b',  // Teal / Gandhinagar Transit
  walk: '#176b4b',  // Emerald Green / Walk
};

// Create custom SVG Leaflet DivIcons
function createSvgIcon({ type, label, bg, color = '#ffffff', size = 32 }) {
  let innerSvg = '';

  if (type === 'start') {
    innerSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" fill="#176b4b" stroke="#ffffff" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="900" font-family="system-ui">A</text>
      </svg>`;
  } else if (type === 'end') {
    innerSvg = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" fill="#dc2626" stroke="#ffffff" stroke-width="2"/>
        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="900" font-family="system-ui">B</text>
      </svg>`;
  } else if (type === 'metro') {
    innerSvg = `
      <div style="background:#8e24aa; color:#fff; width:${size}px; height:${size}px; border-radius:50%; border:2px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:14px;">
        🚇
      </div>`;
  } else if (type === 'transfer') {
    innerSvg = `
      <div style="background:#f57c00; color:#fff; width:${size}px; height:${size}px; border-radius:50%; border:2px solid #fff; box-shadow:0 3px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:800;">
        🔄
      </div>`;
  } else if (type === 'bus') {
    innerSvg = `
      <div style="background:${bg || '#1a73e8'}; color:#fff; width:${size}px; height:${size}px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; font-size:11px;">
        🚌
      </div>`;
  } else {
    innerSvg = `
      <div style="background:${bg || '#176b4b'}; color:#fff; width:${size}px; height:${size}px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.2); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">
        ${label || '•'}
      </div>`;
  }

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div class="marker-container ${type}-marker">${innerSvg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

export function RouteMap({
  route,
  allNodes = [],
  gps = null,
  lang = 'en',
  stopMap = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);
  const [selectedLegIndex, setSelectedLegIndex] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Default coordinates: Ahmedabad / Gandhinagar center
  const defaultCenter = [23.10, 72.58];

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });

      // 100% Free OpenStreetMap standard tiles (No API key or watermark)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Custom Zoom Control top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Attribution bottom-right
      L.control.attribution({ position: 'bottomright', prefix: 'One Journey' }).addTo(map);

      layersGroupRef.current = L.featureGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map layers whenever route, gps or selectedLegIndex changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = layersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const allPoints = [];

    // 1. Draw User GPS Pin if available
    if (gps && gps.lat && gps.lon) {
      const gpsMarker = L.marker([gps.lat, gps.lon], {
        icon: L.divIcon({
          className: 'gps-pulse-marker',
          html: `<div class="gps-pulse-circle"><div class="gps-core-dot"></div></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).bindPopup(`<b>${t(lang, 'statusGps') || 'Your Current Location'}</b>`);

      group.addLayer(gpsMarker);
      allPoints.push([gps.lat, gps.lon]);
    }

    if (!route || !route.legs || route.legs.length === 0) {
      // If no route, just show default view or user GPS
      if (allPoints.length > 0) {
        map.setView(allPoints[0], 13);
      }
      return;
    }

    // 2. Draw each leg of the selected route
    route.legs.forEach((leg, index) => {
      const isSelected = selectedLegIndex === null || selectedLegIndex === index;
      const typeKey = leg.typeKey || leg.type || 'bus';
      const color = NETWORK_COLORS[typeKey] || NETWORK_COLORS.bus;
      const isWalk = leg.type === 'walk';

      // Build path coordinates for this leg
      let coords = [];
      if (leg.path && leg.path.length > 0) {
        coords = leg.path;
      } else if (leg.fromCoords && leg.toCoords) {
        coords = [
          [leg.fromCoords.lat, leg.fromCoords.lon],
          [leg.toCoords.lat, leg.toCoords.lon],
        ];
      }

      if (coords.length >= 2) {
        coords.forEach((pt) => allPoints.push(pt));

        // Glow / Outline background for polyline
        const outlinePolyline = L.polyline(coords, {
          color: '#ffffff',
          weight: isWalk ? 5 : isSelected ? 8 : 6,
          opacity: isSelected ? 0.9 : 0.4,
          lineCap: 'round',
          lineJoin: 'round',
        });
        group.addLayer(outlinePolyline);

        // Main polyline
        const mainPolyline = L.polyline(coords, {
          color: color,
          weight: isWalk ? 4 : isSelected ? 6 : 4,
          opacity: isSelected ? 1 : 0.5,
          dashArray: isWalk ? '6, 8' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        });

        const legTitle = leg.isFirstMile
          ? t(lang, 'walkToTransit')
          : leg.isLastMile
          ? t(lang, 'walkFromTransit')
          : legLabel(lang, typeKey);

        mainPolyline.bindPopup(`
          <div class="map-popup-card">
            <div class="popup-badge" style="background:${color}">${legTitle}</div>
            <div class="popup-title">${leg.from} → ${leg.to}</div>
            <div class="popup-meta">⏱️ ~${fmtDuration(lang, leg.mins)} ${leg.route ? `· Line: ${leg.route}` : ''}</div>
          </div>
        `);

        group.addLayer(mainPolyline);
      }

      // Add Start Marker on first leg
      if (index === 0 && leg.fromCoords) {
        const startMarker = L.marker([leg.fromCoords.lat, leg.fromCoords.lon], {
          icon: createSvgIcon({ type: 'start', size: 28 }),
          zIndexOffset: 1000,
        }).bindPopup(`
          <div class="map-popup-card">
            <span class="popup-badge" style="background:#176b4b">START</span>
            <b>${leg.from}</b>
          </div>
        `);
        group.addLayer(startMarker);
      }

      // Add Intermediate Station/Transfer Markers
      if (leg.toCoords) {
        const isDestination = index === route.legs.length - 1;
        const markerType = isDestination
          ? 'end'
          : leg.type === 'metro'
          ? 'metro'
          : index < route.legs.length - 1
          ? 'transfer'
          : 'bus';

        const stationMarker = L.marker([leg.toCoords.lat, leg.toCoords.lon], {
          icon: createSvgIcon({
            type: markerType,
            bg: color,
            size: isDestination ? 28 : 24,
          }),
          zIndexOffset: isDestination ? 1000 : 500,
        }).bindPopup(`
          <div class="map-popup-card">
            <span class="popup-badge" style="background:${color}">
              ${isDestination ? 'DESTINATION' : leg.type.toUpperCase()}
            </span>
            <b>${leg.to}</b>
            ${leg.mins ? `<div class="popup-meta">⏱️ Leg time: ~${fmtDuration(lang, leg.mins)}</div>` : ''}
          </div>
        `);
        group.addLayer(stationMarker);
      }
    });

    // Fit map bounds smoothly to cover all route points
    if (allPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 15,
          animate: true,
        });
      } catch {
        // Fallback
      }
    }

    // Invalidate size in case of container dimension updates
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [route, gps, selectedLegIndex, lang]);

  const handleResetBounds = () => {
    if (mapInstanceRef.current && layersGroupRef.current) {
      const bounds = layersGroupRef.current.getBounds();
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], animate: true });
      }
    }
  };

  return (
    <div className={`route-map-wrapper ${isExpanded ? 'is-map-expanded' : ''}`}>
      <div className="map-top-bar">
        <div className="map-header-info">
          <span className="map-live-dot" />
          <span className="map-title">{t(lang, 'interactiveRouteMap') || 'Interactive Route Map'}</span>
          {route && (
            <span className="map-route-summary">
              · {fmtDuration(lang, route.total)} ({route.transfers} {route.transfers === 1 ? t(lang, 'transfers') : t(lang, 'transfersPlural')})
            </span>
          )}
        </div>

        <div className="map-controls-group">
          <button
            type="button"
            className="map-control-btn"
            onClick={handleResetBounds}
            title="Fit route to screen"
          >
            🎯 {t(lang, 'fitRoute') || 'Fit'}
          </button>
          <button
            type="button"
            className="map-control-btn"
            onClick={() => {
              setIsExpanded(!isExpanded);
              setTimeout(() => mapInstanceRef.current?.invalidateSize(), 200);
            }}
            title={isExpanded ? 'Collapse Map' : 'Expand Map'}
          >
            {isExpanded ? '↙ Collapse' : '↗ Expand'}
          </button>
        </div>
      </div>

      <div className="leaflet-map-host" ref={mapContainerRef} />

      {/* Network Color Legend */}
      <div className="map-network-legend">
        <div className="legend-item">
          <span className="legend-color-bar" style={{ background: NETWORK_COLORS.metro }} />
          <span>Metro</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-bar" style={{ background: NETWORK_COLORS.brts }} />
          <span>BRTS</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-bar" style={{ background: NETWORK_COLORS.amts }} />
          <span>AMTS</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-bar" style={{ background: NETWORK_COLORS.gtsl }} />
          <span>GTSL</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-bar walk-bar" style={{ borderColor: NETWORK_COLORS.walk }} />
          <span>Walk</span>
        </div>
      </div>
    </div>
  );
}
