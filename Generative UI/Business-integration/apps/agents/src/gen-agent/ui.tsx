import React, { useState } from 'react';
import './styles.css';

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
}

interface WeatherCarouselProps {
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
  },
];

const WeatherCarousel: React.FC<WeatherCarouselProps> = ({ cities: propCities, searchCity }) => {
  // Use prop cities if provided, otherwise use default
  const [cities, setCities] = useState<WeatherData[]>(propCities && propCities.length > 0 ? propCities : defaultCities);
  const [searchTerm, setSearchTerm] = useState(searchCity || '');
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      const newCity: WeatherData = {
        id: cities.length + 1,
        city: searchTerm,
        country: 'USA',
        temp: Math.floor(Math.random() * 30) + 60,
        condition: ['Sunny', 'Cloudy', 'Rainy'][Math.floor(Math.random() * 3)],
        humidity: Math.floor(Math.random() * 40) + 40,
        windSpeed: Math.floor(Math.random() * 15) + 5,
        icon: ['sunny', 'cloudy', 'rainy'][
          Math.floor(Math.random() * 3)
        ] as WeatherData['icon'],
      };
      setCities([...cities, newCity]);
      setSearchTerm('');
    }
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % cities.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + cities.length) % cities.length);
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

  // Calculate visible cards (show 3 at a time on desktop)
  const getVisibleCities = () => {
    if (cities.length <= 3) return cities;
    const visible = [];
    for (let i = 0; i < 3; i++) {
      const idx = (currentIndex + i) % cities.length;
      visible.push(cities[idx]);
    }
    return visible;
  };

  return (
    <div className="weather-dashboard">
      <div className="weather-container">
        {/* Header */}
        <div className="weather-header">
          <h1 className="weather-title">Weather Dashboard</h1>
          <p className="weather-subtitle">Major Cities Weather Updates</p>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a city..."
              className="search-input"
            />
            <button type="submit" className="search-button">
              <SearchIcon />
            </button>
          </form>
        </div>

        {/* Weather Cards Carousel */}
        <div className="carousel-container">
          {cities.length > 3 && (
            <button onClick={prevSlide} className="carousel-button carousel-button-left">
              <ChevronLeftIcon />
            </button>
          )}
          
          <div className="carousel-track">
            {getVisibleCities().map((city) => (
              <div key={city.id} className="carousel-slide">
                <div className={`weather-card ${getBackgroundGradient(city.icon)}`}>
                  {/* City Name */}
                  <div className="card-header">
                    <h2 className="city-name">{city.city}</h2>
                    <p className="country-name">{city.country}</p>
                  </div>

                  {/* Weather Icon */}
                  <div className="icon-container">
                    {getWeatherIcon(city.icon)}
                  </div>

                  {/* Temperature */}
                  <div className="temp-container">
                    <div className="temperature">{city.temp}°F</div>
                    <p className="condition">{city.condition}</p>
                  </div>

                  {/* Weather Details */}
                  <div className="details-container">
                    <div className="detail-item">
                      <DropletsIcon />
                      <div>
                        <p className="detail-label">Humidity</p>
                        <p className="detail-value">{city.humidity}%</p>
                      </div>
                    </div>
                    <div className="detail-item">
                      <WindIcon />
                      <div>
                        <p className="detail-label">Wind</p>
                        <p className="detail-value">{city.windSpeed} mph</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {cities.length > 3 && (
            <button onClick={nextSlide} className="carousel-button carousel-button-right">
              <ChevronRightIcon />
            </button>
          )}
        </div>

        {/* Dots indicator */}
        <div className="dots-container">
          {cities.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`dot ${idx === currentIndex ? 'dot-active' : ''}`}
            />
          ))}
        </div>

        {/* Info Text */}
        <div className="info-text">
          <p>Use navigation to browse weather in different cities</p>
        </div>
      </div>
    </div>
  );
};

export default {
  weather: WeatherCarousel,
};
