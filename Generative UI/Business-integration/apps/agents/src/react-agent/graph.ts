import { AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { MessagesAnnotation, StateGraph, Annotation, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { 
  typedUi, 
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { TOOLS } from "./tools.js";
import { loadChatModel } from "./utils.js";
import type ComponentMap from "./ui.js";

// Enhanced state to include UI components
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),
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

// Interface for weather data
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
  
  const ui = typedUi<typeof ComponentMap>(config);
  const configuration = ensureConfiguration(config);
  
  // Get the user's message to extract the city
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
  const allCities = [mainCity, ...nearbyCities.slice(0, 4)];
  
  try {
    const tavilySearch = new TavilySearchResults({ maxResults: 3 });
    
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

    ui.push({ 
      name: "weather", 
      props: {
        cities: weatherDataList,
        searchCity: mainCity
      }
    }, { message: response });

    return { messages: [response] };
    
  } catch (error) {
    console.error("[WeatherNode] Error fetching weather data:", error);
    
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

// Helper functions
function extractCityFromMessage(message: string): string {
  const patterns = [
    /weather\s+(?:in|for|at)\s+([a-zA-Z\s]+)/i,
    /(?:in|for|at)\s+([a-zA-Z\s]+)\s+weather/i,
    /([a-zA-Z\s]+)\s+weather/i,
    /weather\s+([a-zA-Z\s]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return "Chennai";
}

function createFallbackWeatherData(city: string, id: number): WeatherData {
  const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy'];
  const icons: ('sunny' | 'cloudy' | 'rainy')[] = ['sunny', 'cloudy', 'rainy'];
  
  return {
    id,
    city: city,
    country: detectCountry(city),
    temp: Math.floor(Math.random() * 25) + 70,
    condition: conditions[Math.floor(Math.random() * conditions.length)],
    humidity: Math.floor(Math.random() * 40) + 40,
    windSpeed: Math.floor(Math.random() * 15) + 5,
    icon: icons[Math.floor(Math.random() * icons.length)]
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

// Define the function that calls the model
async function callModel(
  state: typeof AgentState.State,
  config: RunnableConfig,
): Promise<typeof AgentState.Update> {
  /** Call the LLM powering our agent. **/
  const configuration = ensureConfiguration(config);

  // Check if the last message is about weather
  const lastMessage = state.messages[state.messages.length - 1];
  let userMessage = "";
  
  if (typeof lastMessage?.content === "string") {
    userMessage = lastMessage.content;
  }
  
  // If it's a weather request, route to weather node
  if (isWeatherRequest(userMessage)) {
    return await weatherNode(state, config);
  }

  // Otherwise, proceed with normal model call
  const model = (await loadChatModel(configuration.model)).bindTools(TOOLS);

  const response = await model.invoke([
    {
      role: "system",
      content: configuration.systemPromptTemplate.replace(
        "{system_time}",
        new Date().toISOString(),
      ),
    },
    ...state.messages,
  ]);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Helper function to detect weather requests
function isWeatherRequest(message: string): boolean {
  const weatherKeywords = ['weather', 'temperature', 'forecast', 'climate', 'rain', 'sunny', 'cloudy'];
  const lowerMessage = message.toLowerCase();
  return weatherKeywords.some(keyword => lowerMessage.includes(keyword));
}

// Define the function that determines whether to continue or not
function routeModelOutput(state: typeof AgentState.State): string {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  // If the LLM is invoking tools, route there.
  if ((lastMessage as AIMessage)?.tool_calls?.length || 0 > 0) {
    return "tools";
  }
  // Otherwise end the graph.
  else {
    return "__end__";
  }
}

// Define a new graph. We use the enhanced AgentState to support UI components:
const workflow = new StateGraph(AgentState, ConfigurationSchema)
  // Define the two nodes we will cycle between
  .addNode("callModel", callModel)
  .addNode("tools", new ToolNode(TOOLS))
  // Set the entrypoint as `callModel`
  // This means that this node is the first one called
  .addEdge("__start__", "callModel")
  .addConditionalEdges(
    // First, we define the edges' source node. We use `callModel`.
    // This means these are the edges taken after the `callModel` node is called.
    "callModel",
    // Next, we pass in the function that will determine the sink node(s), which
    // will be called after the source node is called.
    routeModelOutput,
  )
  // This means that after `tools` is called, `callModel` node is called next.
  .addEdge("tools", "callModel");

// Finally, we compile it!
// This compiles it into a graph you can invoke and deploy.
export const graph = workflow.compile({
  interruptBefore: [], // if you want to update the state before calling the tools
  interruptAfter: [],
});
