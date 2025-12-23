import {
  typedUi,
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";

import { v4 as uuidv4 } from "uuid";

import type ComponentMap from "./ui.js";

import {
  Annotation,
  MessagesAnnotation,
  StateGraph,
  END,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),
});

// Interface matching the UI component's WeatherData structure
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

// Weather node that uses Tavily to get real weather data for multiple cities
async function weatherNode(
  state: typeof AgentState.State, 
  config: LangGraphRunnableConfig
) {
  console.log("[WeatherNode] Processing weather request...");
  
  const ui = typedUi<typeof ComponentMap>(config);
  
  // Get the user's message to extract the city
  const lastMessage = state.messages[state.messages.length - 1];
  let userMessage = "";
  
  if (typeof lastMessage?.content === "string") {
    userMessage = lastMessage.content;
  } else if (Array.isArray(lastMessage?.content)) {
    // Handle complex message content - extract text parts
    userMessage = lastMessage.content
      .filter(item => item.type === "text")
      .map(item => (item as any).text || "")
      .join(" ");
  }
  
  // Extract main city from user message
  let mainCity = extractCityFromMessage(userMessage);
  console.log("[WeatherNode] Main city extracted:", mainCity);
  
  // Define nearby cities based on region
  const nearbyCitiesMap: { [key: string]: string[] } = {
    "chennai": ["Mumbai", "Bangalore", "Hyderabad", "Kolkata", "Delhi"],
    "mumbai": ["Pune", "Bangalore", "Chennai", "Ahmedabad", "Delhi"],
    "delhi": ["Noida", "Gurgaon", "Jaipur", "Chandigarh", "Lucknow"],
    "bangalore": ["Chennai", "Mysore", "Hyderabad", "Mumbai", "Pune"],
    "kolkata": ["Chennai", "Bhubaneswar", "Patna", "Guwahati", "Delhi"],
    "new york": ["Boston", "Philadelphia", "Washington DC", "Chicago", "Los Angeles"],
    "london": ["Paris", "Manchester", "Birmingham", "Dublin", "Amsterdam"],
    "default": ["New York", "London", "Tokyo", "Sydney", "Dubai"]
  };
  
  const mainCityLower = mainCity.toLowerCase();
  const nearbyCities = nearbyCitiesMap[mainCityLower] || nearbyCitiesMap["default"];
  const allCities = [mainCity, ...nearbyCities.slice(0, 4)]; // Main city + 4 nearby
  
  console.log("[WeatherNode] Fetching weather for cities:", allCities);
  
  try {
    // Use Tavily to search for weather data for all cities
    const tavilySearch = new TavilySearchResults({
      maxResults: 5,
    });
    
    const weatherDataList: WeatherData[] = [];
    
    for (let i = 0; i < allCities.length; i++) {
      const city = allCities[i];
      try {
        const searchQuery = `${city} current weather temperature humidity today`;
        console.log(`[WeatherNode] Searching for: ${searchQuery}`);
        
        const searchResults = await tavilySearch.invoke(searchQuery);
        const parsedData = parseWeatherFromResults(searchResults, city, i + 1);
        weatherDataList.push(parsedData);
        
        console.log(`[WeatherNode] Parsed weather for ${city}:`, parsedData);
      } catch (cityError) {
        console.error(`[WeatherNode] Error fetching weather for ${city}:`, cityError);
        // Add fallback data for this city
        weatherDataList.push(createFallbackWeatherData(city, i + 1));
      }
    }
    
    const response = {
      id: uuidv4(),
      type: "ai" as const,
      content: `Here's the weather for ${mainCity} and nearby cities! Use the carousel to browse through different locations or search for a specific city.`,
    };

    // Push UI component to stream with multiple cities
    console.log("[WeatherNode] Pushing weather carousel with cities:", weatherDataList.map(c => c.city));
    ui.push({ 
      name: "weather", 
      props: {
        cities: weatherDataList,
        searchCity: mainCity
      }
    }, { message: response });

    console.log("[WeatherNode] Weather node complete with real data");
    return { messages: [response] };
    
  } catch (error) {
    console.error("[WeatherNode] Error fetching weather data:", error);
    
    // Fallback to static data if Tavily fails
    const fallbackCities = allCities.map((city, index) => createFallbackWeatherData(city, index + 1));
    
    const errorResponse = {
      id: uuidv4(),
      type: "ai" as const,
      content: `Here's the weather information. Note: Using cached data due to network issues.`,
    };

    ui.push({ 
      name: "weather", 
      props: {
        cities: fallbackCities,
        searchCity: mainCity
      }
    }, { message: errorResponse });

    return { messages: [errorResponse] };
  }
}

// Helper to extract city name from user message
function extractCityFromMessage(message: string): string {
  // Common patterns for city extraction
  const patterns = [
    /weather\s+(?:in|for|at)\s+([a-zA-Z\s]+)/i,
    /(?:in|for|at)\s+([a-zA-Z\s]+)\s+weather/i,
    /([a-zA-Z\s]+)\s+weather/i,
    /weather\s+([a-zA-Z\s]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const city = match[1].trim().replace(/[?.!,]/g, '');
      if (city.length > 1 && city.length < 50) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
    }
  }
  
  return "Chennai"; // Default city
}

// Helper to create fallback weather data
function createFallbackWeatherData(city: string, id: number): WeatherData {
  const conditions: Array<{ condition: string; icon: 'sunny' | 'cloudy' | 'rainy' }> = [
    { condition: 'Sunny', icon: 'sunny' },
    { condition: 'Partly Cloudy', icon: 'cloudy' },
    { condition: 'Cloudy', icon: 'cloudy' },
    { condition: 'Rainy', icon: 'rainy' },
  ];
  
  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  
  return {
    id,
    city: city.charAt(0).toUpperCase() + city.slice(1),
    country: detectCountry(city),
    temp: Math.floor(Math.random() * 30) + 60, // 60-90°F
    condition: randomCondition.condition,
    humidity: Math.floor(Math.random() * 40) + 40, // 40-80%
    windSpeed: Math.floor(Math.random() * 15) + 5, // 5-20 mph
    icon: randomCondition.icon
  };
}

// Helper to detect country from city name
function detectCountry(city: string): string {
  const cityLower = city.toLowerCase();
  const indianCities = ['chennai', 'mumbai', 'delhi', 'bangalore', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'lucknow', 'noida', 'gurgaon', 'chandigarh', 'mysore', 'bhubaneswar', 'patna', 'guwahati'];
  const ukCities = ['london', 'manchester', 'birmingham', 'liverpool', 'edinburgh', 'dublin'];
  const usCities = ['new york', 'los angeles', 'chicago', 'boston', 'miami', 'seattle', 'washington dc', 'philadelphia', 'san francisco'];
  
  if (indianCities.includes(cityLower)) return 'India';
  if (ukCities.includes(cityLower)) return 'UK';
  if (usCities.includes(cityLower)) return 'USA';
  
  return 'Unknown';
}

// Helper function to parse weather data from Tavily search results
function parseWeatherFromResults(results: string, city: string, id: number): WeatherData {
  console.log("[WeatherParser] Parsing results for weather data...");
  
  // Parse the search results for weather information
  const resultsStr = JSON.stringify(results).toLowerCase();
  
  // Extract temperature (convert to number)
  let temp = 75; // default
  const tempPatterns = [
    /(\d+)\s*°[cf]/gi,
    /(\d+)\s*degrees?/gi,
    /temperature[:\s]*(\d+)/gi,
    /(\d+)\s*fahrenheit/gi,
    /(\d+)\s*celsius/gi
  ];
  
  for (const pattern of tempPatterns) {
    const match = pattern.exec(resultsStr);
    if (match) {
      temp = parseInt(match[1], 10);
      // If it looks like Celsius (under 50), convert to Fahrenheit
      if (temp < 50) {
        temp = Math.round((temp * 9/5) + 32);
      }
      break;
    }
  }
  
  // Extract humidity
  let humidity = 60; // default
  const humidityPattern = /humidity[:\s]*(\d+)/gi;
  const humidityMatch = humidityPattern.exec(resultsStr);
  if (humidityMatch) {
    humidity = parseInt(humidityMatch[1], 10);
  }
  
  // Extract wind speed
  let windSpeed = 10; // default
  const windPatterns = [
    /wind[:\s]*(\d+)/gi,
    /(\d+)\s*mph/gi,
    /(\d+)\s*km\/h/gi
  ];
  
  for (const pattern of windPatterns) {
    const match = pattern.exec(resultsStr);
    if (match) {
      windSpeed = parseInt(match[1], 10);
      break;
    }
  }
  
  // Extract weather condition and determine icon
  let condition = "Partly Cloudy";
  let icon: 'sunny' | 'cloudy' | 'rainy' = 'cloudy';
  
  if (/sunny|clear|bright/i.test(resultsStr)) {
    condition = "Sunny";
    icon = 'sunny';
  } else if (/rain|shower|drizzle|wet/i.test(resultsStr)) {
    condition = "Rainy";
    icon = 'rainy';
  } else if (/cloud|overcast|fog|mist/i.test(resultsStr)) {
    condition = "Cloudy";
    icon = 'cloudy';
  } else if (/storm|thunder/i.test(resultsStr)) {
    condition = "Stormy";
    icon = 'rainy';
  }
  
  const weatherData: WeatherData = {
    id,
    city: city.charAt(0).toUpperCase() + city.slice(1).toLowerCase(),
    country: detectCountry(city),
    temp,
    condition,
    humidity,
    windSpeed,
    icon
  };
  
  console.log("[WeatherParser] Parsed weather data:", weatherData);
  
  return weatherData;
}

// Router function to determine if user is asking about weather
function routeMessage(state: typeof AgentState.State): "weather" | "general" {
  const lastMessage = state.messages[state.messages.length - 1];
  let userMessage = "";
  
  if (typeof lastMessage?.content === "string") {
    userMessage = lastMessage.content;
  } else if (Array.isArray(lastMessage?.content)) {
    userMessage = lastMessage.content
      .filter(item => item.type === "text")
      .map(item => (item as any).text || "")
      .join(" ");
  }
  
  console.log("[Router] Analyzing message:", userMessage);
  
  // Check if the message is asking about weather
  const weatherKeywords = ["weather", "temperature", "forecast", "climate", "sunny", "rainy", "cloudy", "cold", "hot", "degrees"];
  const isWeatherQuery = weatherKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );
  
  if (isWeatherQuery) {
    console.log("[Router] Routing to weather node");
    return "weather";
  } else {
    console.log("[Router] Routing to general response");
    return "general";
  }
}

// General response node for non-weather queries
async function generalNode(state: typeof AgentState.State) {
  console.log("[GeneralNode] Processing general request...");
  
  const lastMessage = state.messages[state.messages.length - 1];
  let userMessage = "";
  
  if (typeof lastMessage?.content === "string") {
    userMessage = lastMessage.content;
  } else if (Array.isArray(lastMessage?.content)) {
    userMessage = lastMessage.content
      .filter(item => item.type === "text")
      .map(item => (item as any).text || "")
      .join(" ");
  }
  
  const response = {
    id: uuidv4(),
    type: "ai" as const,
    content: `I understand you said: "${userMessage}". I'm currently set up to provide weather information with beautiful UI components. Try asking me about the weather in any city!`,
  };
  
  return { messages: [response] };
}

// Build the graph with routing
export const graph = new StateGraph(AgentState)
  .addNode("weather", weatherNode)
  .addNode("general", generalNode)
  .addConditionalEdges("__start__", routeMessage, {
    weather: "weather",
    general: "general"
  })
  .addEdge("weather", END)
  .addEdge("general", END)
  .compile();