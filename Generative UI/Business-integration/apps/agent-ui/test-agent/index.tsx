import React from "react";
import "./styles.css";

// Weather Component
interface WeatherProps {
  city: string;
  temperature?: string;
  condition?: string;
}

export const WeatherComponent = ({ 
  city, 
  temperature = "72°F", 
  condition = "Sunny" 
} : WeatherProps) => {
  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes("sunny") || lowerCondition.includes("clear")) {
      return "☀️";
    } else if (lowerCondition.includes("cloud")) {
      return "☁️";
    } else if (lowerCondition.includes("rain")) {
      return "🌧️";
    } else if (lowerCondition.includes("snow")) {
      return "❄️";
    } else if (lowerCondition.includes("storm")) {
      return "⛈️";
    }
    return "🌤️";
  };

  return (
    <div className="weather-card">
      <div className="weather-card-header">
        <div>
          <h3 className="weather-city">{city}</h3>
          <p className="weather-temp">{temperature}</p>
          <p className="weather-condition">{condition}</p>
        </div>
        <div className="weather-icon">{getWeatherIcon(condition)}</div>
      </div>
    </div>
  );
};
