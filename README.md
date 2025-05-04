# Project Title

A smart Home Office IoT monitoring system that collects, processes, and visualizes environmental data for optimal workspace conditions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [IoT Device Connection](#iot-device-connection)
7. [Sensor Data Collection](#sensor-data-collection)
8. [Telemetry Transmission to IoT Hub](#telemetry-transmission-to-iot-hub)
9. [Data Visualization](#data-visualization)
10. [Data Processing & Actuation](#data-processing--actuation)
11. [Design Decisions](#design-decisions)
12. [Project Presentation & Documentation](#project-presentation--documentation)
13. [License](#license)
14. [Acknowledgements](#acknowledgements)

## 1. Overview

This project implements an IoT-based environmental monitoring system for a home office environment. It collects data from multiple sensors connected to a Raspberry Pi, transmits the data to Azure IoT Hub, processes it in the cloud, and visualizes it through a responsive web dashboard.

<img width="1368" alt="Screenshot 2025-05-04 at 15 54 48" src="https://github.com/user-attachments/assets/9a63d566-608d-49a7-bc8c-b51b48fb0dfe" />

The system consists of the following components:

1. **IoT Device Layer**: Raspberry Pi 4 with Grove sensors
2. **Data Transmission Layer**: Azure IoT Hub integration via MQTT
3. **Data Storage Layer**: Azure Blob Storage for sensor data aggregation
4. **Data Processing Layer**: Azure Functions for data aggregation
5. **Visualization Layer**: Responsive web dashboard with Chart.js

## 2. Prerequisites

- Raspberry Pi 4
- Grove base hat for Raspberry Pi
- Grove temperature and humidity sensor (DHT11)
- Grove light sensor
- CO2 sensor (simulated in the current implementation)
- Python 3.7+
- Azure account with IoT Hub instance
- Azure Blob Storage container
- Azure Functions core tools (for local function development)

## 3. Installation

1. Clone this repository to your Raspberry Pi
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```
3. Deploy the Azure Function:
   ```
   cd funcapp
   func azure functionapp publish your-function-app-name
   ```

## 4. Configuration

1. Create a `.env` file with the following variables:
   ```
   IOT_CONNECTION_STRING=your_iot_hub_connection_string
   UUID=your_device_id
   ```
2. For Azure Functions, configure the following application settings:
   ```
   RAW_CONTAINER=sensor-raw
   ROLLUP_CONTAINER=sensor-rollups
   ```

## 5. Usage

1. Connect the sensors to the Grove base hat
2. Connect the base hat to the Raspberry Pi
3. Power on the Raspberry Pi
4. Start the data collection script:
   ```
   python main.py
   ```
5. Access the dashboard by opening `docs/index.html` in a web browser

## 6. IoT Device Connection

The system uses a Raspberry Pi 4 with Grove sensors to collect environmental data. The Raspberry Pi connects to Azure IoT Hub using MQTT protocol for secure communication.

### Software Components:
- **main.py**: Entry point script that initializes components and triggers the data collection flow
- **sensors.py**: Manages sensor interactions through a unified SensorManager class
- **azure_client.py**: Handles Azure IoT Hub communication using the Azure IoT Device SDK

## 7. Sensor Data Collection

The system collects the following sensor data:
- Temperature (°C)
- Humidity (%RH)
- Light level (lux)
- CO2 concentration (PPM, simulated)

Data is timestamped at the source, and proper error handling ensures reliable data collection. The SensorManager class in `sensors.py` provides a unified interface for reading all sensor types.

## 8. Telemetry Transmission to IoT Hub

Sensor data is formatted as JSON and securely transmitted to Azure IoT Hub using the Azure IoT Device SDK. The implementation includes:
- Secure data transmission with Azure IoT Device SDK
- Error handling and retry mechanisms
- JSON formatting of sensor readings

## 9. Data Visualization

The dashboard visualization is built using:
- **docs/index.html**: Responsive web interface built with Tailwind CSS
- **docs/app.js**: Dashboard logic using Chart.js for data visualization

The dashboard:
1. Fetches aggregated sensor data from Azure Blob Storage
2. Displays data in responsive charts that work on both desktop and mobile
3. Provides time filtering options to view data at different time scales (3m, 5m, 10m, 20m)
4. Updates in real-time with a refresh button

## 10. Data Processing & Actuation

The `funcapp` directory contains the Azure Function implementation that processes sensor data:

- **processSensorRollups/__init__.py**: Timer-triggered function that runs every 3 minutes to process raw sensor data
- **processSensorRollups/function.json**: Configuration for the timer trigger
- **requirements.txt**: Azure Function dependencies
- **host.json**: Function app configuration

The function performs the following tasks:
1. Reads raw sensor data from Azure Blob Storage
2. Filters data based on timestamp for different time windows
3. Aggregates data points into specified time intervals (3, 5, 10, and 20 minutes)
4. Calculates average values for each sensor type within each time window
5. Writes the aggregated data as JSON files to the appropriate paths in Azure Blob Storage:
   - 3-minute aggregation for the last hour (3min/last1h.json)
   - 5-minute aggregation for the last 6 hours (5min/last6h.json)
   - 10-minute aggregation for the last 24 hours (10min/last24h.json)
   - 20-minute aggregation for the last 7 days (20min/last7d.json)

## 11. Design Decisions

### Cloud-based vs. Client-side Aggregation

Initially, data aggregation was implemented on the client side in the dashboard application. However, this approach quickly revealed performance limitations:

- With a growing number of data points, client-side processing significantly increased page load times
- Browser performance varied across devices, leading to inconsistent user experience
- Processing large datasets in JavaScript consumed excessive memory and CPU resources
- Mobile devices particularly struggled with the computational demands

The solution that I came up with was to move data aggregation to Azure Functions in the cloud:

- Pre-aggregated data can be loaded much faster by the client
- The workload is shifted from the user's device to scalable cloud infrastructure
- Standardized time intervals allow for more efficient querying based on user-selected time ranges
- The dashboard remains responsive even when visualizing large datasets
- Bandwidth usage is significantly reduced by only transferring the data points needed for visualization

Through my own experience, I witnessed firsthand how slow the page load became when processing large datasets on the client side. This personal struggle led me to appreciate why offloading operations to the cloud is sometimes the better approach. By moving data processing to specialized cloud services, I was able to create a system where lightweight clients could focus solely on presentation, resulting in a much more responsive and efficient IoT solution.

## 12. Project Presentation & Documentation

### How This Project Fulfills Assignment Requirements

#### IoT Device Connection (10%)
- ✅ Set up a Raspberry Pi 4 device
- ✅ Configured MQTT communication with Azure IoT Hub
- ✅ Verified data transmission with logging and dashboard visualization

#### Sensor Data Collection (15%)
- ✅ Implemented three sensors (temperature, humidity, light, and simulated CO2)
- ✅ Created Python scripts for data collection
- ✅ Ensured all data is timestamped

#### Telemetry Transmission to IoT Hub (15%)
- ✅ Formatted sensor readings as JSON
- ✅ Implemented secure data transmission with Azure IoT Device SDK
- ✅ Added error handling and retry mechanisms

#### Data Visualization (15%)
- ✅ Created a responsive web dashboard
- ✅ Displayed key parameters (temperature, humidity, CO2, light)
- ✅ Implemented real-time updates and time-based filtering

#### Data Processing & Actuation (30%)
- ✅ Implemented data aggregation at different time intervals through Azure Functions
- ✅ Used Azure Blob Storage for efficient data management
- ✅ Created time-based data rollups for optimized visualization (3min, 5min, 10min, 20min)

#### Project Documentation (15%)
- ✅ Provided this detailed README
- ✅ Included system architecture explanation
- ✅ Added code comments and documentation throughout the codebase

## 13. Acknowledgements

- Azure IoT SDK developers
- Chart.js library
- Tailwind CSS framework
- Grove sensor documentation
