import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Reusable Google Places Autocomplete input.
 *
 * Props:
 *   value         – current display text (controlled)
 *   onChange(val)  – fires when user types (text only, no selection yet)
 *   onSelect({ description, placeId, mainText, secondaryText, lat, lng })
 *                 – fires when user picks a suggestion (includes geocoded lat/lng)
 *   placeholder   – input placeholder
 *   types         – Google Places types filter, e.g. ['(cities)'] or ['address']
 *   countryRestriction – restrict to country code, e.g. 'in' for India
 *   className     – extra className on wrapper div
 *   inputClassName – extra className on the <input>
 *   error         – error message string (shown below input)
 *   disabled      – boolean
 */
export default function PlacesAutocomplete({
  value = '',
  onChange,
  onSelect,
  placeholder = 'Search...',
  types = [],
  countryRestriction = 'in',
  className = '',
  inputClassName = '',
  error = '',
  disabled = false,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const serviceRef = useRef(null);
  const geocoderRef = useRef(null);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Initialize Google Autocomplete service (requires Maps JS API to be loaded)
  useEffect(() => {
    if (window.google?.maps?.places) {
      serviceRef.current = new window.google.maps.places.AutocompleteService();
      geocoderRef.current = new window.google.maps.Geocoder();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowList(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced fetch predictions
  const fetchPredictions = useCallback((input) => {
    if (!serviceRef.current || !input.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const request = {
      input,
      componentRestrictions: countryRestriction ? { country: countryRestriction } : undefined,
    };
    if (types.length > 0) request.types = types;

    serviceRef.current.getPlacePredictions(request, (results, status) => {
      setLoading(false);
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        setSuggestions(results.map(r => ({
          description: r.description,
          placeId: r.place_id,
          mainText: r.structured_formatting?.main_text || r.description,
          secondaryText: r.structured_formatting?.secondary_text || '',
        })));
      } else {
        setSuggestions([]);
      }
    });
  }, [types, countryRestriction]);

  function handleInputChange(e) {
    const val = e.target.value;
    onChange?.(val);
    setShowList(true);

    // Debounce API calls (300ms)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 300);
  }

  async function handleSelect(suggestion) {
    setShowList(false);
    onChange?.(suggestion.description);

    // Geocode to get lat/lng
    if (geocoderRef.current) {
      try {
        const resp = await geocoderRef.current.geocode({ placeId: suggestion.placeId });
        if (resp.results?.[0]) {
          const loc = resp.results[0].geometry.location;
          onSelect?.({
            ...suggestion,
            lat: loc.lat(),
            lng: loc.lng(),
          });
          return;
        }
      } catch (err) {
        console.warn('[PlacesAutocomplete] Geocode failed:', err);
      }
    }

    // Fallback without lat/lng
    onSelect?.(suggestion);
  }

  return (
    <div className={`places-autocomplete ${className}`} ref={wrapperRef}>
      <div className="places-input-wrapper">
        <input
          type="text"
          className={`form-input ${error ? 'input-error' : ''} ${inputClassName}`}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={() => { if (suggestions.length > 0) setShowList(true); }}
          disabled={disabled}
          autoComplete="off"
        />
        {loading && (
          <span className="places-spinner">
            <span className="spinner-sm" />
          </span>
        )}
      </div>

      {showList && suggestions.length > 0 && (
        <ul className="places-dropdown">
          {suggestions.map((s, i) => (
            <li
              key={s.placeId || i}
              className="places-option"
              onClick={() => handleSelect(s)}
            >
              <span className="places-icon">📍</span>
              <div className="places-text">
                <span className="places-main">{s.mainText}</span>
                {s.secondaryText && (
                  <span className="places-secondary">{s.secondaryText}</span>
                )}
              </div>
            </li>
          ))}
          <li className="places-powered">
            Powered by Google
          </li>
        </ul>
      )}

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
