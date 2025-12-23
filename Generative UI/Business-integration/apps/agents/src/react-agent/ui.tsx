import React, { useState } from 'react';
import SliderComponent from 'react-slick';
import { Cloud, Sun, CloudRain, Wind, Droplets, Search } from 'lucide-react';
import './styles.css';

// Fix type issue with react-slick
const Slider = SliderComponent as any;

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

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      // Mock search functionality - in real app, this would call an API
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

  const getWeatherIcon = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return <Sun className="w-16 h-16 text-yellow-400" />;
      case 'cloudy':
        return <Cloud className="w-16 h-16 text-gray-400" />;
      case 'rainy':
        return <CloudRain className="w-16 h-16 text-blue-400" />;
      default:
        return <Sun className="w-16 h-16 text-yellow-400" />;
    }
  };

  const getBackgroundGradient = (icon: string) => {
    switch (icon) {
      case 'sunny':
        return 'from-orange-400 via-yellow-300 to-yellow-200';
      case 'cloudy':
        return 'from-gray-400 via-gray-300 to-gray-200';
      case 'rainy':
        return 'from-blue-500 via-blue-400 to-blue-300';
      default:
        return 'from-orange-400 via-yellow-300 to-yellow-200';
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl mb-4 text-gray-800">Weather Dashboard</h1>
          <p className="text-xl text-gray-600">Major Cities Weather Updates</p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-12">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a city..."
              className="w-full px-6 py-4 pr-14 rounded-full shadow-lg border-2 border-transparent focus:border-indigo-400 focus:outline-none transition-all duration-300 bg-white"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-indigo-500 hover:bg-indigo-600 text-white p-3 rounded-full transition-colors duration-300"
            >
              <Search className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Weather Cards Carousel */}
        <div className="px-4">
          <Slider {...settings}>
            {cities.map((city) => (
              <div key={city.id} className="px-3">
                <div
                  className={`bg-gradient-to-br ${getBackgroundGradient(
                    city.icon
                  )} rounded-3xl shadow-2xl p-8 transform transition-all duration-300 hover:scale-105 hover:shadow-3xl`}
                >
                  {/* City Name */}
                  <div className="text-center mb-6">
                    <h2 className="text-3xl text-white mb-1">{city.city}</h2>
                    <p className="text-white/80">{city.country}</p>
                  </div>

                  {/* Weather Icon */}
                  <div className="flex justify-center mb-6">
                    {getWeatherIcon(city.icon)}
                  </div>

                  {/* Temperature */}
                  <div className="text-center mb-6">
                    <div className="text-6xl text-white mb-2">
                      {city.temp}°F
                    </div>
                    <p className="text-xl text-white/90">{city.condition}</p>
                  </div>

                  {/* Weather Details */}
                  <div className="grid grid-cols-2 gap-4 bg-white/20 backdrop-blur-sm rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-white" />
                      <div>
                        <p className="text-xs text-white/70">Humidity</p>
                        <p className="text-white">{city.humidity}%</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="w-5 h-5 text-white" />
                      <div>
                        <p className="text-xs text-white/70">Wind</p>
                        <p className="text-white">{city.windSpeed} mph</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>

        {/* Info Text */}
        <div className="text-center mt-12">
          <p className="text-gray-600">
            Swipe or use navigation to browse weather in different cities
          </p>
        </div>
      </div>
    </div>
  );
};

const ComponentMap = {
  weather: WeatherCarousel,
};

export default ComponentMap;
