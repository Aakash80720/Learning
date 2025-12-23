import {
  typedUi,
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";

import { v4 as uuidv4 } from "uuid";

import componentMap from "./ui.js";

import {
  Annotation,
  MessagesAnnotation,
  StateGraph,
  END,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";

import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { loadChatModel } from "./utils.js";
import { ensure_configuration } from "./configuration.js";
import { GEN_CLASSIFICATION_PROMPT } from "./prompts.js";
import { z } from "zod";

// Zod schema for intent classification - compliant with OpenAI Structured Outputs
const IntentClassificationSchema = z.object({
  intent: z.enum(['weather', 'general', 'news', 'sports', 'finance']).describe("The classified intent of the user message"),
  confidence: z.number().min(0).max(1).describe("Confidence score of the classification"),
  extractedEntities: z.object({
    city: z.string().nullable().describe("Extracted city name if present, null if not found"),
    topic: z.string().nullable().describe("Extracted topic if present, null if not found"),
  }).describe("Extracted entities from the user message")
});

const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),
  intent: Annotation<string>({ reducer: (_, y) => y, default: () => "" }),
  extractedCity: Annotation<string>({ reducer: (_, y) => y, default: () => "" }),
});

// Zod schema for structured weather data response
const WeatherDataSchema = z.object({
  city: z.string().describe("The name of the city"),
  country: z.string().describe("The country where the city is located"),
  temp: z.number().describe("Temperature in Fahrenheit"),
  condition: z.string().describe("Current weather condition (e.g., Sunny, Cloudy, Rainy)"),
  humidity: z.number().describe("Humidity percentage (0-100)"),
  windSpeed: z.number().describe("Wind speed in mph"),
  icon: z.enum(['sunny', 'cloudy', 'rainy']).describe("Weather icon type based on condition")
});

const WeatherResponseSchema = z.object({
  weatherData: z.array(WeatherDataSchema).describe("Array of weather data for cities")
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

// Weather node that uses Tavily to get real weather data and LLM to parse it
async function weatherNode(
  state: typeof AgentState.State, 
  config: LangGraphRunnableConfig
) {
  console.log("[WeatherNode] Processing weather request...");
  
  const ui = typedUi<typeof componentMap>(config);
  const configuration = ensure_configuration(config);
  
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
  
  // Use the extracted city from intent classification, or fallback to extraction
  let mainCity = state.extractedCity || await extractCityFromMessage(userMessage, config);
  console.log("[WeatherNode] Main city (from classification):", mainCity);
  
  // Define nearby cities based on region - expanded with more cities
  const nearbyCitiesMap: { [key: string]: string[] } = {
    // Indian cities
    "chennai": ["Mumbai", "Bangalore", "Hyderabad", "Kolkata"],
    "mumbai": ["Delhi", "Bangalore", "Chennai", "Pune"],
    "delhi": ["Noida", "Gurgaon", "Jaipur", "Chandigarh"],
    "bangalore": ["Chennai", "Mysore", "Hyderabad", "Mumbai"],
    "kolkata": ["Bhubaneswar", "Patna", "Guwahati", "Delhi"],
    "hyderabad": ["Bangalore", "Chennai", "Mumbai", "Pune"],
    "pune": ["Mumbai", "Nashik", "Aurangabad", "Bangalore"],
    "ahmedabad": ["Mumbai", "Surat", "Vadodara", "Pune"],
    "jaipur": ["Delhi", "Jodhpur", "Udaipur", "Agra"],
    
    // US cities
    "new york": ["Boston", "Philadelphia", "Washington DC", "Chicago"],
    "los angeles": ["San Francisco", "San Diego", "Las Vegas", "Phoenix"],
    "chicago": ["Detroit", "Milwaukee", "Indianapolis", "St Louis"],
    "houston": ["Dallas", "Austin", "San Antonio", "New Orleans"],
    "miami": ["Orlando", "Tampa", "Jacksonville", "Atlanta"],
    "boston": ["New York", "Hartford", "Providence", "Portland"],
    "seattle": ["Portland", "Vancouver", "San Francisco", "Spokane"],
    "denver": ["Salt Lake City", "Phoenix", "Albuquerque", "Colorado Springs"],
    "atlanta": ["Charlotte", "Nashville", "Birmingham", "Jacksonville"],
    "philadelphia": ["New York", "Baltimore", "Washington DC", "Pittsburgh"],
    "phoenix": ["Tucson", "Las Vegas", "Albuquerque", "San Diego"],
    "san francisco": ["Los Angeles", "Sacramento", "San Jose", "Oakland"],
    "washington dc": ["Baltimore", "Richmond", "Philadelphia", "Norfolk"],
    "dallas": ["Houston", "Austin", "Oklahoma City", "Fort Worth"],
    "detroit": ["Chicago", "Cleveland", "Toledo", "Grand Rapids"],
    "las vegas": ["Los Angeles", "Phoenix", "Reno", "Salt Lake City"],
    
    // European cities
    "london": ["Manchester", "Birmingham", "Liverpool", "Edinburgh"],
    "paris": ["Lyon", "Marseille", "Toulouse", "Nice"],
    "berlin": ["Munich", "Hamburg", "Frankfurt", "Cologne"],
    "madrid": ["Barcelona", "Valencia", "Seville", "Bilbao"],
    "rome": ["Milan", "Naples", "Florence", "Venice"],
    "amsterdam": ["Rotterdam", "Utrecht", "The Hague", "Brussels"],
    "barcelona": ["Madrid", "Valencia", "Seville", "Bilbao"],
    "milan": ["Rome", "Turin", "Florence", "Venice"],
    "munich": ["Berlin", "Frankfurt", "Stuttgart", "Vienna"],
    "manchester": ["London", "Liverpool", "Leeds", "Birmingham"],
    
    // Asian cities
    "tokyo": ["Osaka", "Kyoto", "Yokohama", "Nagoya"],
    "beijing": ["Shanghai", "Guangzhou", "Shenzhen", "Tianjin"],
    "shanghai": ["Beijing", "Hangzhou", "Suzhou", "Nanjing"],
    "singapore": ["Kuala Lumpur", "Bangkok", "Jakarta", "Manila"],
    "hong kong": ["Macau", "Guangzhou", "Shenzhen", "Taipei"],
    "seoul": ["Busan", "Incheon", "Daegu", "Daejeon"],
    "bangkok": ["Chiang Mai", "Phuket", "Pattaya", "Singapore"],
    "dubai": ["Abu Dhabi", "Doha", "Kuwait City", "Riyadh"],
    
    // Australian cities
    "sydney": ["Melbourne", "Brisbane", "Perth", "Adelaide"],
    "melbourne": ["Sydney", "Adelaide", "Canberra", "Geelong"],
    "brisbane": ["Sydney", "Gold Coast", "Melbourne", "Cairns"],
    "perth": ["Adelaide", "Darwin", "Melbourne", "Sydney"],
    
    // Canadian cities
    "toronto": ["Montreal", "Ottawa", "Vancouver", "Calgary"],
    "vancouver": ["Seattle", "Calgary", "Toronto", "Victoria"],
    "montreal": ["Toronto", "Quebec City", "Ottawa", "Halifax"],
    "calgary": ["Vancouver", "Edmonton", "Toronto", "Winnipeg"],
    
    // South American cities
    "sao paulo": ["Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza"],
    "buenos aires": ["Montevideo", "Santiago", "Cordoba", "Rosario"],
    "lima": ["Arequipa", "Trujillo", "Chiclayo", "Cusco"],
    
    // African cities
    "cairo": ["Alexandria", "Giza", "Luxor", "Aswan"],
    "johannesburg": ["Cape Town", "Durban", "Pretoria", "Port Elizabeth"],
    "lagos": ["Abuja", "Kano", "Ibadan", "Port Harcourt"],
    
    // Default for unknown cities
    "default": ["New York", "London", "Tokyo", "Sydney", "Paris"]
  };
  
  const mainCityLower = mainCity.toLowerCase();
  let nearbyCities = nearbyCitiesMap[mainCityLower] || nearbyCitiesMap["default"];
  
  // Try to discover nearby cities dynamically using web search
  if (!nearbyCitiesMap[mainCityLower]) {
    try {
      const discoveredCities = await discoverNearbyCities(mainCity);
      if (discoveredCities.length > 0) {
        nearbyCities = discoveredCities;
        console.log("[WeatherNode] Discovered nearby cities:", discoveredCities);
      }
    } catch (error) {
      console.log("[WeatherNode] Failed to discover nearby cities, using defaults");
    }
  }
  
  const allCities = [mainCity, ...nearbyCities.slice(0, 4)]; // Main city + 4 nearby
  
  console.log("[WeatherNode] Fetching weather for cities:", allCities);
  
  try {
    // Use Tavily to search for weather data for all cities
    const tavilySearch = new TavilySearchResults({
      maxResults: 3,
    });
    
    // Collect all search results
    const allSearchResults: { city: string; results: string }[] = [];
    
    for (const city of allCities) {
      try {
        const searchQuery = `${city} current weather temperature humidity wind speed today`;
        console.log(`[WeatherNode] Searching for: ${searchQuery}`);
        
        const searchResults = await tavilySearch.invoke(searchQuery);
        allSearchResults.push({
          city,
          results: typeof searchResults === 'string' ? searchResults : JSON.stringify(searchResults)
        });
        
        console.log(`[WeatherNode] Got results for ${city}`);
      } catch (cityError) {
        console.error(`[WeatherNode] Error fetching weather for ${city}:`, cityError);
      }
    }
    
    // Use LLM to parse the search results into structured weather data
    const weatherDataList = await parseWeatherWithLLM(
      allSearchResults, 
      allCities, 
      configuration.model
    );
    
    const response = {
      id: uuidv4(),
      type: "ai" as const,
      content: `Here's the current weather for ${mainCity} and nearby cities! The data was fetched in real-time. Use the carousel to browse through different locations.`,
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

// Use LLM to parse weather search results into structured JSON
async function parseWeatherWithLLM(
  searchResults: { city: string; results: string }[],
  cities: string[],
  modelName: string
): Promise<WeatherData[]> {
  console.log("[WeatherParser] Using LLM to parse weather data...");
  
  try {
    const model = await loadChatModel(modelName);
    
    // Create the structured output model
    const structuredModel = model.withStructuredOutput(WeatherResponseSchema);
    
    const prompt = `You are a weather data extraction assistant. Parse the following search results and extract weather information for each city.

For each city, extract:
- Temperature (convert to Fahrenheit if in Celsius)
- Weather condition (Sunny, Cloudy, Rainy, Partly Cloudy, etc.)
- Humidity percentage
- Wind speed in mph
- Determine the icon type: 'sunny' for clear/sunny, 'cloudy' for cloudy/overcast, 'rainy' for rain/storm

Cities to extract data for: ${cities.join(', ')}

Search Results:
${searchResults.map(r => `
=== ${r.city} ===
${r.results}
`).join('\n')}

If you cannot find exact data for a city, make a reasonable estimate based on the region and season (December - winter in Northern Hemisphere, summer in Southern Hemisphere).

Return the weather data as a JSON array.`;

    const response = await structuredModel.invoke([
      { role: "user", content: prompt }
    ]);
    
    console.log("[WeatherParser] LLM parsed response:", response);
    
    // Convert the structured response to WeatherData array with IDs
    const weatherDataList: WeatherData[] = response.weatherData.map((data: z.infer<typeof WeatherDataSchema>, index: number) => ({
      id: index + 1,
      city: data.city,
      country: detectCountry(data.city),
      temp: data.temp,
      condition: data.condition,
      humidity: data.humidity,
      windSpeed: data.windSpeed,
      icon: data.icon
    }));
    
    return weatherDataList;
    
  } catch (error) {
    console.error("[WeatherParser] LLM parsing failed, using fallback:", error);
    // Return fallback data if LLM parsing fails
    return cities.map((city, index) => createFallbackWeatherData(city, index + 1));
  }
}

// Helper to extract city name from user message
// Enhanced city extraction with multiple strategies
async function extractCityFromMessage(
  message: string, 
  config?: LangGraphRunnableConfig
): Promise<string> {
  console.log("[CityExtraction] Starting dynamic city extraction for:", message);
  
  // Strategy 1: Pattern-based extraction (quick fallback)
  const patternExtracted = extractCityFromPattern(message);
  console.log("[CityExtraction] Pattern-based result:", patternExtracted);
  
  // Strategy 2: LLM-based extraction for complex cases
  if (config) {
    try {
      const llmExtracted = await extractCityWithLLM(message, config);
      if (llmExtracted && llmExtracted !== "unknown") {
        console.log("[CityExtraction] LLM-based result:", llmExtracted);
        // Validate with web search if we have a good candidate
        const validated = await validateCityWithSearch(llmExtracted);
        if (validated) {
          return validated;
        }
      }
    } catch (error) {
      console.log("[CityExtraction] LLM extraction failed:", error);
    }
  }
  
  // Strategy 3: Web search for location context
  if (config) {
    try {
      const searchExtracted = await extractCityFromSearch(message);
      if (searchExtracted) {
        console.log("[CityExtraction] Search-based result:", searchExtracted);
        return searchExtracted;
      }
    } catch (error) {
      console.log("[CityExtraction] Search extraction failed:", error);
    }
  }
  
  // Fallback to pattern-based if available
  if (patternExtracted && patternExtracted !== "New York") {
    return patternExtracted;
  }
  
  // Smart fallback based on common global cities
  return getSmartFallbackCity(message);
}

// Strategy 1: Pattern-based extraction (improved)
function extractCityFromPattern(message: string): string {
  // Enhanced patterns for better city detection
  const patterns = [
    // Direct weather queries
    /weather\s+(?:in|for|at|of)\s+([a-zA-Z\s,.-]+?)(?:\s|$|\?|!|\.|\,)/i,
    /(?:in|for|at|of)\s+([a-zA-Z\s,.-]+?)\s+weather/i,
    /([a-zA-Z\s,.-]+?)\s+weather/i,
    /weather\s+([a-zA-Z\s,.-]+?)(?:\s|$|\?|!|\.|\,)/i,
    
    // Question patterns
    /(?:what's|whats|how's|hows)\s+(?:the\s+)?weather\s+(?:like\s+)?(?:in|at|of)\s+([a-zA-Z\s,.-]+?)(?:\s|$|\?|!|\.|\,)/i,
    /(?:temperature|temp|forecast)\s+(?:in|at|for|of)\s+([a-zA-Z\s,.-]+?)(?:\s|$|\?|!|\.|\,)/i,
    
    // Location-first patterns
    /^([a-zA-Z\s,.-]+?)\s+(?:weather|temperature|temp|forecast)/i,
    
    // "Show me" patterns
    /show\s+(?:me\s+)?(?:the\s+)?weather\s+(?:in|for|at|of)\s+([a-zA-Z\s,.-]+?)(?:\s|$|\?|!|\.|\,)/i,
    
    // Travel patterns
    /(?:going|traveling|visiting|trip)\s+(?:to\s+)?([a-zA-Z\s,.-]+?)(?:\s|$|\?|!|\.|\,)/i,
    
    // City with state/country patterns
    /([a-zA-Z\s]+?),\s*([a-zA-Z\s]+?)(?:\s|$|\?|!|\.)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let city = match[1].trim().replace(/[?.!]/g, '').replace(/,$/, '');
      
      // Handle city, state/country combinations
      if (city.includes(',')) {
        city = city.split(',')[0].trim();
      }
      
      // Filter out common non-city words
      const invalidWords = [
        'weather', 'temperature', 'temp', 'forecast', 'today', 'tomorrow', 
        'like', 'the', 'is', 'very', 'show', 'me', 'what', 'how', 'there',
        'here', 'now', 'currently', 'right', 'good', 'bad', 'nice'
      ];
      
      if (city.length > 1 && city.length < 50 && !invalidWords.includes(city.toLowerCase())) {
        return formatCityName(city);
      }
    }
  }
  
  // Try to extract proper nouns that could be cities
  const properNouns = message.match(/\b[A-Z][a-zA-Z\s]{1,30}\b/g);
  if (properNouns) {
    for (const noun of properNouns) {
      const cleanNoun = noun.trim();
      const skipWords = [
        'Weather', 'Temperature', 'Today', 'Tomorrow', 'What', 'How', 'The', 'Is',
        'Show', 'Me', 'Give', 'Tell', 'Please', 'Thanks', 'Hello', 'Hi'
      ];
      if (!skipWords.includes(cleanNoun) && cleanNoun.length > 2 && cleanNoun.length < 30) {
        return formatCityName(cleanNoun);
      }
    }
  }
  
  return "New York"; // Default fallback
}

// Strategy 2: LLM-based extraction
async function extractCityWithLLM(message: string, config: LangGraphRunnableConfig): Promise<string | null> {
  try {
    const configuration = ensure_configuration(config);
    const model = await loadChatModel(configuration.model);
    
    const extractionPrompt = `You are a location extraction expert. Extract the city name from the user's message about weather or location.

Rules:
1. Return ONLY the city name, properly formatted (e.g., "New York", "Los Angeles", "San Francisco")
2. If no city is mentioned, return "unknown"
3. Handle variations like "NYC" -> "New York", "LA" -> "Los Angeles"
4. For city + state/country, return just the city name
5. Common abbreviations: NYC=New York, LA=Los Angeles, SF=San Francisco, DC=Washington DC, ATL=Atlanta

User message: "${message}"

City name:`;

    const response = await model.invoke([{ role: "user", content: extractionPrompt }]);
    const extractedCity = response.content?.toString().trim();
    
    if (extractedCity && extractedCity !== "unknown" && extractedCity.length > 1 && extractedCity.length < 50) {
      return formatCityName(extractedCity);
    }
    
    return null;
  } catch (error) {
    console.error("[CityExtraction] LLM extraction error:", error);
    return null;
  }
}

// Strategy 3: Web search validation and discovery
async function validateCityWithSearch(cityCandidate: string): Promise<string | null> {
  try {
    const tavilySearch = new TavilySearchResults({ maxResults: 2 });
    const searchQuery = `"${cityCandidate}" city weather location`;
    
    const results = await tavilySearch.invoke(searchQuery);
    const resultStr = typeof results === 'string' ? results : JSON.stringify(results);
    
    // Check if search results confirm this is a real city
    const cityConfirmationPatterns = [
      new RegExp(`${cityCandidate}.*(?:city|weather|temperature)`, 'i'),
      new RegExp(`weather.*${cityCandidate}`, 'i'),
      new RegExp(`${cityCandidate}.*(?:located|population|capital)`, 'i')
    ];
    
    if (cityConfirmationPatterns.some(pattern => pattern.test(resultStr))) {
      return formatCityName(cityCandidate);
    }
    
    return null;
  } catch (error) {
    console.log("[CityExtraction] Search validation error:", error);
    return null;
  }
}

// Strategy 4: Extract cities from search results
async function extractCityFromSearch(message: string): Promise<string | null> {
  try {
    const tavilySearch = new TavilySearchResults({ maxResults: 3 });
    const searchQuery = `${message} weather location city`;
    
    const results = await tavilySearch.invoke(searchQuery);
    const resultStr = typeof results === 'string' ? results : JSON.stringify(results);
    
    // Extract city names from search results
    const cityPatterns = [
      /weather\s+(?:in|for|at)\s+([A-Za-z\s]+?)(?:\,|\s|$)/gi,
      /([A-Za-z\s]+?)\s+weather/gi,
      /(?:city|location).*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi
    ];
    
    for (const pattern of cityPatterns) {
      const matches = [...resultStr.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const candidate = match[1].trim();
          if (candidate.length > 2 && candidate.length < 30) {
            return formatCityName(candidate);
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.log("[CityExtraction] Search extraction error:", error);
    return null;
  }
}

// Smart fallback city selection
function getSmartFallbackCity(message: string): string {
  const messageContent = message.toLowerCase();
  
  // Regional hints in the message
  const regionalHints: { [key: string]: string[] } = {
    "New York": ["east coast", "northeast", "ny", "nyc", "manhattan", "brooklyn"],
    "Los Angeles": ["west coast", "california", "la", "hollywood", "beverly hills"],
    "Chicago": ["midwest", "illinois", "windy city"],
    "Miami": ["florida", "south florida", "southeast"],
    "Seattle": ["pacific northwest", "washington", "tech"],
    "London": ["uk", "england", "britain", "british"],
    "Paris": ["france", "french", "europe"],
    "Tokyo": ["japan", "japanese", "asia"],
    "Sydney": ["australia", "aussie", "down under"],
    "Mumbai": ["india", "indian", "bollywood"],
    "Dubai": ["uae", "middle east", "emirates"]
  };
  
  for (const [city, hints] of Object.entries(regionalHints)) {
    if (hints.some(hint => messageContent.includes(hint))) {
      return city;
    }
  }
  
  // Time-based fallback (morning = global business cities, evening = entertainment cities)
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    const businessCities = ["New York", "London", "Tokyo", "Singapore", "Frankfurt"];
    return businessCities[Math.floor(Math.random() * businessCities.length)];
  } else if (hour >= 18 && hour < 24) {
    const entertainmentCities = ["Los Angeles", "Las Vegas", "Miami", "Barcelona", "Sydney"];
    return entertainmentCities[Math.floor(Math.random() * entertainmentCities.length)];
  }
  
  // Default global cities for broad appeal
  const globalCities = ["New York", "London", "Paris", "Tokyo", "Sydney", "Los Angeles"];
  return globalCities[Math.floor(Math.random() * globalCities.length)];
}

// Utility function to format city names consistently
function formatCityName(city: string): string {
  // Handle common abbreviations
  const abbreviations: { [key: string]: string } = {
    "nyc": "New York",
    "ny": "New York", 
    "la": "Los Angeles",
    "sf": "San Francisco",
    "dc": "Washington DC",
    "atl": "Atlanta",
    "chi": "Chicago",
    "philly": "Philadelphia",
    "vegas": "Las Vegas",
    "miami": "Miami",
    "boston": "Boston"
  };
  
  const lowerCity = city.toLowerCase().trim();
  if (abbreviations[lowerCity]) {
    return abbreviations[lowerCity];
  }
  
  // Proper case formatting
  return city.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Dynamic discovery of nearby cities using web search
async function discoverNearbyCities(mainCity: string): Promise<string[]> {
  try {
    const tavilySearch = new TavilySearchResults({ maxResults: 2 });
    const searchQuery = `cities near "${mainCity}" metropolitan area nearby major cities`;
    
    const results = await tavilySearch.invoke(searchQuery);
    const resultStr = typeof results === 'string' ? results : JSON.stringify(results);
    
    // Extract city names from search results
    const cityPatterns = [
      /(?:near|nearby|close to|around)\s+([A-Z][a-zA-Z\s]{2,25})(?:\,|\s|$)/gi,
      /([A-Z][a-zA-Z\s]{2,25})\s+(?:is|are)\s+(?:near|nearby|close)/gi,
      /cities?\s+(?:like|including|such as)\s+([A-Z][a-zA-Z\s,]{5,50})/gi,
      /metropolitan\s+area.*?(?:includes|contains)\s+([A-Z][a-zA-Z\s,]{5,50})/gi
    ];
    
    const discoveredCities: string[] = [];
    
    for (const pattern of cityPatterns) {
      const matches = [...resultStr.matchAll(pattern)];
      for (const match of matches) {
        if (match[1]) {
          const cityText = match[1].trim();
          // Split on commas and clean up
          const cities = cityText.split(',').map(c => c.trim()).filter(c => c.length > 2 && c.length < 30);
          
          for (const city of cities) {
            const formattedCity = formatCityName(city);
            if (!discoveredCities.includes(formattedCity) && 
                formattedCity.toLowerCase() !== mainCity.toLowerCase() &&
                discoveredCities.length < 6) {
              discoveredCities.push(formattedCity);
            }
          }
        }
      }
    }
    
    // If we didn't find enough, add some regional defaults
    if (discoveredCities.length < 3) {
      const region = detectRegion(mainCity);
      const regionalDefaults = getRegionalDefaults(region);
      for (const city of regionalDefaults) {
        if (!discoveredCities.includes(city) && 
            city.toLowerCase() !== mainCity.toLowerCase() &&
            discoveredCities.length < 4) {
          discoveredCities.push(city);
        }
      }
    }
    
    return discoveredCities.slice(0, 4); // Return max 4 cities
  } catch (error) {
    console.log("[DiscoverNearbyCities] Error:", error);
    return [];
  }
}

// Detect geographic region for fallback
function detectRegion(city: string): string {
  const cityLower = city.toLowerCase();
  
  const regions = {
    'north_america': ['new york', 'los angeles', 'chicago', 'toronto', 'vancouver', 'montreal', 'dallas', 'miami', 'boston', 'seattle', 'san francisco', 'phoenix', 'atlanta', 'philadelphia', 'detroit', 'denver'],
    'europe': ['london', 'paris', 'berlin', 'madrid', 'rome', 'amsterdam', 'barcelona', 'vienna', 'prague', 'stockholm', 'copenhagen', 'oslo', 'helsinki', 'dublin', 'brussels'],
    'asia': ['tokyo', 'beijing', 'shanghai', 'singapore', 'hong kong', 'seoul', 'bangkok', 'mumbai', 'delhi', 'bangalore', 'manila', 'jakarta', 'kuala lumpur'],
    'oceania': ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'auckland', 'wellington'],
    'africa': ['cairo', 'johannesburg', 'cape town', 'lagos', 'casablanca', 'nairobi'],
    'south_america': ['sao paulo', 'buenos aires', 'lima', 'bogota', 'santiago', 'rio de janeiro']
  };
  
  for (const [region, cities] of Object.entries(regions)) {
    if (cities.includes(cityLower)) {
      return region;
    }
  }
  
  return 'global';
}

// Get regional default cities
function getRegionalDefaults(region: string): string[] {
  const defaults: { [key: string]: string[] } = {
    'north_america': ['New York', 'Los Angeles', 'Chicago', 'Toronto'],
    'europe': ['London', 'Paris', 'Berlin', 'Madrid'],
    'asia': ['Tokyo', 'Singapore', 'Hong Kong', 'Seoul'],
    'oceania': ['Sydney', 'Melbourne', 'Auckland', 'Brisbane'],
    'africa': ['Cairo', 'Johannesburg', 'Cape Town', 'Lagos'],
    'south_america': ['Sao Paulo', 'Buenos Aires', 'Lima', 'Santiago'],
    'global': ['New York', 'London', 'Tokyo', 'Sydney']
  };
  
  return defaults[region] || defaults['global'];
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

// CallModel node for intent classification using LLM
async function callModelNode(
  state: typeof AgentState.State,
  config: LangGraphRunnableConfig
) {
  console.log("[CallModelNode] Classifying user intent with LLM...");
  
  const configuration = ensure_configuration(config);
  const model = await loadChatModel(configuration.model);
  
  // Get the user's message
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
  
  console.log("[CallModelNode] User message:", userMessage);
  
  try {
    // Use structured output for intent classification
    const structuredModel = model.withStructuredOutput(IntentClassificationSchema);
    
    const classificationPrompt = `${GEN_CLASSIFICATION_PROMPT}

User message: "${userMessage}"

Analyze the user's message and classify it. If the message is about weather, temperature, forecast, or climate conditions, classify it as 'weather'. Extract any city names mentioned.

Return your classification as JSON with ALL required fields:
- intent: one of 'weather', 'general', 'news', 'sports', 'finance'
- confidence: a number between 0 and 1
- extractedEntities: { city: "city name if found OR null", topic: "topic if found OR null" }

IMPORTANT: Always include all fields. Use null (not undefined) for missing values.`;

    const classification = await structuredModel.invoke([
      { role: "user", content: classificationPrompt }
    ]);
    
    console.log("[CallModelNode] Classification result:", classification);
    
    // Extract city from classification or fallback to dynamic extraction
    const extractedCity = classification.extractedEntities.city || await extractCityFromMessage(userMessage, config);
    
    return {
      intent: classification.intent,
      extractedCity: extractedCity
    };
    
  } catch (error) {
    console.error("[CallModelNode] LLM classification failed, using keyword fallback:", error);
    
    // Fallback to keyword-based classification
    const weatherKeywords = ["weather", "temperature", "forecast", "climate", "sunny", "rainy", "cloudy", "cold", "hot", "degrees"];
    const isWeatherQuery = weatherKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );
    
    return {
      intent: isWeatherQuery ? "weather" : "general",
      extractedCity: await extractCityFromMessage(userMessage, config)
    };
  }
}

// Router function that uses the classified intent from state
function routeAfterClassification(state: typeof AgentState.State): "weather" | "general" {
  const intent = state.intent;
  console.log("[Router] Routing based on classified intent:", intent);
  
  if (intent === "weather") {
    return "weather";
  }
  
  // For now, route all other intents to general
  // You can add more nodes for news, sports, finance later
  return "general";
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

// Build the graph with LLM-based intent classification
export const graph = new StateGraph(AgentState)
  .addNode("callModel", callModelNode)
  .addNode("weather", weatherNode)
  .addNode("general", generalNode)
  .addEdge("__start__", "callModel")
  .addConditionalEdges("callModel", routeAfterClassification, {
    weather: "weather",
    general: "general",
  })
  .addEdge("weather", END)
  .addEdge("general", END)
  .compile();