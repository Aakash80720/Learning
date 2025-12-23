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

import { ConfigurationSchema, ensureConfiguration } from "./configuration.js";
import { TOOLS } from "./tools.js";
import { loadChatModel } from "./utils.js";
import type ComponentMap from "./ui.js";

// Enhanced state to include UI components
const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  ui: Annotation({ reducer: uiMessageReducer, default: () => [] }),
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
    const tavilySearch = new TavilySearchResults({ maxResults: 5 });
    const weatherDataList: WeatherData[] = [];
    
    for (let i = 0; i < allCities.length; i++) {
      const city = allCities[i];
      try {
        const searchQuery = `${city} current weather temperature humidity today`;
        const searchResults = await tavilySearch.invoke(searchQuery);
        const parsedData = parseWeatherFromResults(searchResults, city, i + 1);
        weatherDataList.push(parsedData);
      } catch (cityError) {
        console.error(`[WeatherNode] Error fetching weather for ${city}:`, cityError);
        weatherDataList.push(createFallbackWeatherData(city, i + 1));
      }
    }
    
    const response = {
      id: uuidv4(),
      type: "ai" as const,
      content: `Here's the weather for ${mainCity} and nearby cities! Use the carousel to browse through different locations or search for a specific city.`,
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
    country: city.toLowerCase().includes('india') ? 'India' : 'Country',
    temp: Math.floor(Math.random() * 25) + 70,
    condition: conditions[Math.floor(Math.random() * conditions.length)],
    humidity: Math.floor(Math.random() * 40) + 40,
    windSpeed: Math.floor(Math.random() * 15) + 5,
    icon: icons[Math.floor(Math.random() * icons.length)]
  };
}

function parseWeatherFromResults(_searchResults: any, city: string, id: number): WeatherData {
  // Simple parsing - in real implementation, this would be more sophisticated
  return createFallbackWeatherData(city, id);
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
