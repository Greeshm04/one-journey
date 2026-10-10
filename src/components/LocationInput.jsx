/**
 * src/components/LocationInput.jsx
 *
 * Location Search & Autocomplete Input Component.
 * Supports Metro stations, Bus stops, Landmark POIs, Geocoded addresses, and GPS.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchLocations } from '../services/geocoding.js';
import { t } from '../i18n.js';

export function LocationInput({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  onGpsClick,
  gpsBtnLabel,
  nodes = [],
  gps = null,
  lang = 'en',
  id,
}) {
  const [query, setQuery] = useState(typeof value === 'string' ? value : value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Sync internal text when external value changes
  useEffect(() => {
    const nextVal = typeof value === 'string' ? value : value?.name || '';
    setQuery(nextVal);
  }, [value]);

  // Perform search with local instant results + debounced live geocoding
  const performSearch = useCallback(
    (text) => {
      const q = text.trim();
      if (!q) {
        setSuggestions([]);
        setIsOpen(false);
        setLoading(false);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // First do an immediate search with local dataset (stops + landmarks)
      searchLocations({
        query: q,
        nodes,
        gps,
        limit: 8,
      }).then((localResults) => {
        if (localResults.length > 0) {
          setSuggestions(localResults);
          setIsOpen(true);
        }
      });

      // Then trigger debounced async geocoding for external OpenStreetMap places
      clearTimeout(debounceTimerRef.current);
      setLoading(true);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const results = await searchLocations({
            query: q,
            nodes,
            gps,
            limit: 8,
            signal: abortControllerRef.current?.signal,
          });
          setSuggestions(results);
          if (results.length > 0) {
            setIsOpen(true);
          }
        } catch {
          // Ignore abort errors
        } finally {
          setLoading(false);
        }
      }, 250);
    },
    [nodes, gps]
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setHighlightedIndex(-1);
    if (onChange) onChange(val);
    performSearch(val);
  };

  const handleSelectSuggestion = (item) => {
    setQuery(item.name);
    setIsOpen(false);
    setSuggestions([]);
    if (onSelect) {
      onSelect(item);
    } else if (onChange) {
      onChange(item.name);
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (onChange) onChange('');
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && query.trim()) {
        performSearch(query);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const renderBadge = (type, isStation) => {
    switch (type) {
      case 'metro':
        return <span className="loc-badge loc-badge-metro">🚇 Metro</span>;
      case 'bus':
        return <span className="loc-badge loc-badge-bus">🚌 Bus</span>;
      case 'transit_hub':
        return <span className="loc-badge loc-badge-hub">🚉 Hub</span>;
      case 'landmark':
        return <span className="loc-badge loc-badge-landmark">🏛️ Landmark</span>;
      case 'area':
        return <span className="loc-badge loc-badge-area">📍 Area</span>;
      default:
        return <span className="loc-badge loc-badge-place">📍 Place</span>;
    }
  };

  return (
    <div className="location-input-field" ref={containerRef}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="field-control-wrapper">
        <input
          id={id}
          ref={inputRef}
          type="text"
          className="location-text-input"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (query.trim() && suggestions.length > 0) setIsOpen(true);
            else if (query.trim()) performSearch(query);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
        />

        <div className="input-actions">
          {loading && <span className="input-spinner" title="Searching..." />}

          {query && (
            <button
              type="button"
              className="clear-btn"
              onClick={handleClear}
              title="Clear input"
              aria-label="Clear"
            >
              ×
            </button>
          )}

          {onGpsClick && (
            <button
              type="button"
              className="gps-action-btn"
              onClick={onGpsClick}
              title="Use current location"
            >
              <svg
                className="gps-svg-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <line x1="12" y1="1" x2="12" y2="4" />
                <line x1="12" y1="20" x2="12" y2="23" />
                <line x1="1" y1="12" x2="4" y2="12" />
                <line x1="20" y1="12" x2="23" y2="12" />
              </svg>
              <span>GPS</span>
            </button>
          )}
        </div>

        {isOpen && suggestions.length > 0 && (
          <div className="location-dropdown">
            <div className="dropdown-header">
              <span>{t(lang, 'locationSuggestions') || 'Suggested Locations & Stations'}</span>
              <small>Nearby metro/bus automatically routed</small>
            </div>
            <ul className="suggestions-list" role="listbox">
              {suggestions.map((item, idx) => (
                <li
                  key={item.id || idx}
                  role="option"
                  aria-selected={highlightedIndex === idx}
                  className={`suggestion-item ${highlightedIndex === idx ? 'highlighted' : ''} ${
                    item.isStation ? 'is-station' : 'is-place'
                  }`}
                  onClick={() => handleSelectSuggestion(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="item-icon-col">
                    <span className="type-icon">
                      {item.type === 'metro'
                        ? '🚇'
                        : item.type === 'bus'
                        ? '🚌'
                        : item.type === 'transit_hub'
                        ? '🚉'
                        : '📍'}
                    </span>
                  </div>

                  <div className="item-details">
                    <div className="item-primary-row">
                      <span className="item-name">{item.name}</span>
                      {renderBadge(item.type, item.isStation)}
                    </div>
                    {item.fullName && item.fullName !== item.name && (
                      <div className="item-secondary">{item.fullName}</div>
                    )}
                  </div>

                  {item.distanceText && (
                    <div className="item-distance-pill">
                      <span>{item.distanceText}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
