import React, { useState, useEffect } from 'react';
import './styles.css';
import '../../../apps/web/src/styles/canvas-design-system.css';

// Simple SVG icons to avoid lucide-react issues
const SunIcon = () => (
  <svg className="w-16 h-16 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" />
    <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" />
    <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const CloudIcon = () => (
  <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const CloudRainIcon = () => (
  <svg className="w-16 h-16 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
    <line x1="8" y1="19" x2="8" y2="21" stroke="currentColor" strokeWidth="2" />
    <line x1="12" y1="19" x2="12" y2="21" stroke="currentColor" strokeWidth="2" />
    <line x1="16" y1="19" x2="16" y2="21" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const DropletsIcon = () => (
  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
  </svg>
);

const WindIcon = () => (
  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface WeatherData {
  id: number;
  city: string;
  country: string;
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: 'sunny' | 'cloudy' | 'rainy';
  timestamp?: number; // Add timestamp for sorting
}

export interface WeatherCarouselProps {
  cities?: WeatherData[];
  searchCity?: string;
}

// Default fallback data for when no cities are provided
const defaultCities: WeatherData[] = [
  {
    id: 1,
    city: 'New York',
    country: 'USA',
    temp: 72,
    condition: 'Partly Cloudy',
    humidity: 65,
    windSpeed: 12,
    icon: 'cloudy',
    timestamp: Date.now() - 86400000, // 1 day ago for default data
  },
];

export const WeatherCarousel: React.FC<WeatherCarouselProps> = ({ cities: propCities, searchCity }) => {
  // Use prop cities if provided, otherwise use default
  const [cities, setCities] = useState<WeatherData[]>(() => {
    const initialCities = propCities && propCities.length > 0 ? propCities : defaultCities;
    // Add timestamps to prop cities if they don't have them
    return initialCities.map((city, index) => ({
      ...city,
      timestamp: city.timestamp || (Date.now() - (index * 1000)) // Stagger timestamps if not present
    }));
  });
  const [searchTerm, setSearchTerm] = useState(searchCity || '');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Function to sort cities by timestamp (newest first)
  const getSortedCities = () => {
    return [...cities].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  };

  // Update cities when props change
  useEffect(() => {
    if (propCities && propCities.length > 0) {
      const updatedCities = propCities.map((city) => ({
        ...city,
        timestamp: city.timestamp || Date.now()
      }));
      setCities(updatedCities);
    }
  }, [propCities]);

  // Function to check if a city is recently searched (within last hour)
  const isRecentlySearched = (timestamp?: number) => {
    if (!timestamp) return false;
    const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds
    return timestamp > oneHourAgo;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Check if city already exists
      const existingCityIndex = cities.findIndex(
        city => city.city.toLowerCase() === searchTerm.trim().toLowerCase()
      );
      
      if (existingCityIndex !== -1) {
        // Update existing city with new timestamp to move it to top
        const updatedCities = [...cities];
        updatedCities[existingCityIndex] = {
          ...updatedCities[existingCityIndex],
          timestamp: Date.now()
        };
        setCities(updatedCities);
      } else {
        // Add new city with current timestamp
        const newCity: WeatherData = {
          id: cities.length + 1,
          city: searchTerm.trim(),
          country: 'USA',
          temp: Math.floor(Math.random() * 30) + 60,
          condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
          humidity: Math.floor(Math.random() * 40) + 40,
          windSpeed: Math.floor(Math.random() * 15) + 5,
          icon: ['sunny', 'cloudy', 'rainy'][
            Math.floor(Math.random() * 3)
          ] as WeatherData['icon'],
          timestamp: Date.now()
        };
        setCities([newCity, ...cities]);
      }
      setSearchTerm('');
      setCurrentIndex(0); // Reset to first slide to show newest
    }
  };

  const nextSlide = () => {
    const sortedCities = getSortedCities();
    setCurrentIndex((prev) => (prev + 1) % sortedCities.length);
  };

  const prevSlide = () => {
    const sortedCities = getSortedCities();
    setCurrentIndex((prev) => (prev - 1 + sortedCities.length) % sortedCities.length);
  };

  const getWeatherIcon = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return <SunIcon />;
      case 'cloudy':
        return <CloudIcon />;
      case 'rainy':
        return <CloudRainIcon />;
      default:
        return <SunIcon />;
    }
  };

  const getBackgroundGradient = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return 'weather-card-sunny';
      case 'cloudy':
        return 'weather-card-cloudy';
      case 'rainy':
        return 'weather-card-rainy';
      default:
        return 'weather-card-sunny';
    }
  };

  // Calculate visible cards (show 3 at a time on desktop) - use sorted cities
  const getVisibleCities = () => {
    const sortedCities = getSortedCities();
    if (sortedCities.length <= 3) return sortedCities;
    const visible = [];
    for (let i = 0; i < 3; i++) {
      const idx = (currentIndex + i) % sortedCities.length;
      visible.push(sortedCities[idx]);
    }
    return visible;
  };

  return (
    <div className="canvas-component">
      <div className="canvas-container">
        {/* Header */}
        <div className="canvas-header canvas-header-gradient">
          <h1 className="canvas-header-title">Weather Dashboard</h1>
          <p className="canvas-header-subtitle">Major Cities Weather Updates</p>
        </div>

        {/* Search Bar */}
        <div className="canvas-section">
          <form onSubmit={handleSearch} className="canvas-search-form">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a city..."
              className="canvas-input canvas-input-search"
            />
            <button 
              type="submit" 
              className="canvas-button canvas-button-icon canvas-search-button"
            >
              <SearchIcon />
            </button>
          </form>
        </div>

        {/* Weather Cards Carousel */}
        <div className="canvas-carousel">
          <div className="canvas-carousel-container">
            <div className="canvas-carousel-track weather-carousel-track">
              {getVisibleCities().map((city) => (
                <div key={city.id} className="canvas-carousel-slide canvas-carousel-slide-auto">
                  <div className={`canvas-card weather-card ${getBackgroundGradient(city.icon)}`}>
                    {/* City Name */}
                    <div className="canvas-card-header weather-card-header">
                      <h2 className="canvas-card-title weather-city-name">
                        {city.city}
                        {isRecentlySearched(city.timestamp) && (
                          <span className="canvas-badge canvas-badge-accent weather-recent-badge">NEW</span>
                        )}
                      </h2>
                      <p className="canvas-card-subtitle weather-country-name">{city.country}</p>
                    </div>

                    {/* Weather Icon */}
                    <div className="weather-icon-container">
                      {getWeatherIcon(city.icon)}
                    </div>

                    {/* Temperature */}
                    <div className="weather-temp-container">
                      <div className="weather-temperature">{city.temp}°F</div>
                      <p className="weather-condition">{city.condition}</p>
                    </div>

                    {/* Weather Details */}
                    <div className="canvas-grid canvas-grid-2 weather-details-grid">
                      <div className="canvas-flex canvas-flex-center-start weather-detail-item">
                        <DropletsIcon />
                        <div>
                          <p className="canvas-text-muted weather-detail-label">Humidity</p>
                          <p className="canvas-text-primary weather-detail-value">{city.humidity}%</p>
                        </div>
                      </div>
                      <div className="canvas-flex canvas-flex-center-start weather-detail-item">
                        <WindIcon />
                        <div>
                          <p className="canvas-text-muted weather-detail-label">Wind</p>
                          <p className="canvas-text-primary weather-detail-value">{city.windSpeed} mph</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation */}
          {getSortedCities().length > 3 && (
            <div className="canvas-carousel-nav">
              <button 
                onClick={prevSlide} 
                className="canvas-carousel-button"
              >
                <ChevronLeftIcon />
              </button>
              
              <div className="canvas-carousel-dots">
                {getSortedCities().map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`canvas-carousel-dot ${idx === currentIndex ? 'canvas-carousel-dot-active' : ''}`}
                  />
                ))}
              </div>
              
              <button 
                onClick={nextSlide} 
                className="canvas-carousel-button"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

