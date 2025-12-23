"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherComponent = void 0;
const react_1 = __importDefault(require("react"));
require("./styles.css");
const WeatherComponent = ({ city, temperature = "72°F", condition = "Sunny" }) => {
    const getWeatherIcon = (condition) => {
        const lowerCondition = condition.toLowerCase();
        if (lowerCondition.includes("sunny") || lowerCondition.includes("clear")) {
            return "☀️";
        }
        else if (lowerCondition.includes("cloud")) {
            return "☁️";
        }
        else if (lowerCondition.includes("rain")) {
            return "🌧️";
        }
        else if (lowerCondition.includes("snow")) {
            return "❄️";
        }
        else if (lowerCondition.includes("storm")) {
            return "⛈️";
        }
        return "🌤️";
    };
    return (react_1.default.createElement("div", { className: "weather-card" },
        react_1.default.createElement("div", { className: "weather-card-header" },
            react_1.default.createElement("div", null,
                react_1.default.createElement("h3", { className: "weather-city" }, city),
                react_1.default.createElement("p", { className: "weather-temp" }, temperature),
                react_1.default.createElement("p", { className: "weather-condition" }, condition)),
            react_1.default.createElement("div", { className: "weather-icon" }, getWeatherIcon(condition)))));
};
exports.WeatherComponent = WeatherComponent;
