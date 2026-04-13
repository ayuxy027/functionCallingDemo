import type { ChatMessageData } from "./ChatMessage";

export const mockMessages: ChatMessageData[] = [
  {
    id: "mock-1",
    role: "user",
    content: "What's the current weather in San Francisco and should I bring an umbrella today?",
    timestamp: "10:32 AM",
  },
  {
    id: "mock-2",
    role: "assistant",
    content:
      "It's currently 58°F and partly cloudy in San Francisco with a 35% chance of light rain this afternoon. I'd recommend bringing a light jacket and keeping an umbrella handy — the rain isn't certain, but it's likely enough to be prepared.",
    toolSteps: [
      {
        id: "step-1",
        toolName: "geocode_location",
        status: "completed",
        description: "Resolved 'San Francisco' to geographic coordinates for the weather API lookup.",
        detail: '{\n  "query": "San Francisco",\n  "lat": 37.7749,\n  "lng": -122.4194,\n  "confidence": 0.98\n}',
        durationMs: 120,
      },
      {
        id: "step-2",
        toolName: "get_current_weather",
        status: "completed",
        description: "Fetched real-time weather data including temperature, conditions, and precipitation probability.",
        detail: '{\n  "temp_f": 58,\n  "condition": "Partly Cloudy",\n  "humidity": 72,\n  "precip_chance": 0.35,\n  "wind_mph": 12\n}',
        durationMs: 340,
      },
      {
        id: "step-3",
        toolName: "get_hourly_forecast",
        status: "completed",
        description: "Retrieved the hourly forecast to check if rain is expected later in the day.",
        detail: '{\n  "hours": [\n    { "time": "12:00", "precip": 0.15 },\n    { "time": "15:00", "precip": 0.35 },\n    { "time": "18:00", "precip": 0.20 }\n  ]\n}',
        durationMs: 280,
      },
    ],
    timestamp: "10:32 AM",
  },
  {
    id: "mock-3",
    role: "user",
    content: "Can you find me a good Italian restaurant nearby that's open right now?",
    timestamp: "10:34 AM",
  },
  {
    id: "mock-4",
    role: "assistant",
    content:
      "I found Trattoria Contadina in North Beach — it's highly rated (4.6 stars), currently open, and about a 12-minute drive from downtown SF. They're known for their handmade pasta and have outdoor seating available.",
    toolSteps: [
      {
        id: "step-4",
        toolName: "search_places",
        status: "completed",
        description: "Searched for Italian restaurants near the user's location that are currently open.",
        detail: '{\n  "query": "Italian restaurant",\n  "location": "37.7749, -122.4194",\n  "radius_km": 5,\n  "open_now": true,\n  "results_count": 8\n}',
        durationMs: 450,
      },
      {
        id: "step-5",
        toolName: "get_place_details",
        status: "completed",
        description: "Retrieved detailed info for the top-rated result including reviews, hours, and amenities.",
        detail: '{\n  "name": "Trattoria Contadina",\n  "rating": 4.6,\n  "reviews": 847,\n  "address": "1800 Mason St",\n  "outdoor_seating": true,\n  "price_level": "$$"\n}',
        durationMs: 210,
      },
      {
        id: "step-6",
        toolName: "calculate_distance",
        status: "completed",
        description: "Calculated travel time from user's approximate location to the restaurant.",
        detail: '{\n  "origin": "Downtown SF",\n  "destination": "1800 Mason St",\n  "drive_min": 12,\n  "walk_min": 28\n}',
        durationMs: 180,
      },
    ],
    timestamp: "10:35 AM",
  },
];
