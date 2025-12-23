import React from "react";
import "./styles.css";
interface WeatherProps {
    city: string;
    temperature?: string;
    condition?: string;
}
export declare const WeatherComponent: ({ city, temperature, condition }: WeatherProps) => React.JSX.Element;
export {};
