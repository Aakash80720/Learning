
import React from "react";
import { WeatherCarousel, WeatherCarouselProps } from "./weather-info/ui";
import { YouTubeCarousel, YouTubeCarouselProps }from './news-info/ui';

// Component map type for TypeScript
interface ComponentMap extends Record<string, React.ComponentType<any>> {
  weather: React.FC<WeatherCarouselProps>;
  news: React.FC<YouTubeCarouselProps>;
}

const componentMap: ComponentMap = {
  weather: WeatherCarousel,
  news: YouTubeCarousel,
};

export { componentMap };
export default componentMap;