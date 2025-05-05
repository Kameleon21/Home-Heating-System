# Home Office IoT Monitoring System

**Student Name:** Kamil Rogozinski  
**Student Number:** 20089737


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
13. [Challenges & Solutions](#challenges--solutions)
14. [Troubleshooting](#troubleshooting)
15. [Acknowledgements](#acknowledgements)

## 1. Overview

This project implements an IoT-based environmental monitoring system for a home office environment. It collects data from multiple sensors connected to a Raspberry Pi, transmits the data to Azure IoT Hub, processes it in the cloud, and visualizes it through a responsive web dashboard.

### Personal Motivation

As someone who spends significant time working from my home office, I wanted to create a system that helps me maintain an optimal working environment. I've noticed that factors like temperature, humidity, light levels, and air quality significantly impact my productivity and well-being. 

Too often, I would find myself feeling tired or unfocused without understanding why, only to later realize the room had become too warm, too dark, or poorly ventilated. By creating this IoT monitoring system, I can now:

- Track environmental conditions throughout my workday
- Identify patterns that affect my comfort and productivity
- Make data-driven decisions about when to adjust heating, lighting, or ventilation
- Create a healthier, more comfortable workspace based on actual measurements rather than subjective feelings

Beyond solving my immediate needs, this project allowed me to explore how IoT technologies can create meaningful improvements in everyday life through continuous monitoring, cloud-based processing, and accessible visualization of environmental data.

The dashboard for this project is publicly accessible through GitHub Pages, allowing me to monitor my home office environment from anywhere with internet access.

<img width="1368" alt="Dashboard Preview" src="https://github.com/user-attachments/assets/9a63d566-608d-49a7-bc8c-b51b48fb0dfe" />
*Home Office IoT Dashboard displaying sensor data*

The system consists of the following components:

1. **IoT Device Layer**: Raspberry Pi 4 with Grove sensors
2. **Data Transmission Layer**: Azure IoT Hub integration via MQTT
3. **Data Storage Layer**: Azure Blob Storage for sensor data aggregation
4. **Data Processing Layer**: Azure Functions for data aggregation
5. **Visualization Layer**: Responsive web dashboard with Chart.js

### Key Screenshots

<img width="1368" alt="Dashboard Preview" src="https://github.com/user-attachments/assets/9a63d566-608d-49a7-bc8c-b51b48fb0dfe" />
*Home Office IoT Dashboard displaying sensor data*

### Raspberry Pi IoT Hub Connection Logs

```
2025-05-04 16:00:02,202 - INFO - Starting IoT data collection
2025-05-04 16:00:02,208 - INFO - Creating client for connecting using MQTT over TCP
2025-05-04 16:00:02,209 - INFO - Azure IoT Client initialized.
2025-05-04 16:00:02,209 - INFO - Connecting to Azure IoT Hub...
2025-05-04 16:00:02,209 - INFO - Connecting to Hub...
2025-05-04 16:00:02,213 - INFO - Connect using port 8883 (TCP)
2025-05-04 16:00:02,352 - INFO - connected with result code: 0 
2025-05-04 16:00:02,352 - INFO - _on_mqtt_connected called
2025-05-04 16:00:02,353 - INFO - Connection State - Connected 
2025-05-04 16:00:02,353 - INFO - Successfully connected to Hub
2025-05-04 16:00:02,353 - INFO - Connected successfully to Azure IoT Hub.
2025-05-04 16:00:03,022 - INFO - Collected sensor data: {'temperature': 21, 'humidity': 49, 'light': 514, 'co2': 846.9158170120922}
2025-05-04 16:00:03,022 - INFO - Sensor data: {'temperature': 21, 'humidity': 49, 'light': 514, 'co2': 846.9158170120922}
2025-05-04 16:00:03,023 - INFO - Sending message to Hub...
2025-05-04 16:00:03,023 - INFO - publishing on devices/soil-moisture-sensor/messages/events/%24.ct=application%2Fjson&%24.ce=utf-8 
2025-05-04 16:00:03,157 - INFO - payload published for 1
2025-05-04 16:00:03,157 - INFO - Successfully sent message to Hub
2025-05-04 16:00:03,158 - INFO - Sent telemetry: {"temperature": 21, "humidity": 49, "light": 514, "co2": 846.9158170120922}
2025-05-04 16:00:03,158 - INFO - Data sent successfully 
2025-05-04 16:00:03,158 - INFO - Shutting down Azure IoT Hub client...
2025-05-04 16:00:03,158 - INFO - Initiating client shutdown
2025-05-04 16:00:03,158 - INFO - Disconnecting from Hub...
2025-05-04 16:00:03,158 - INFO - disconnecting MQTT client
2025-05-04 16:00:03,159 - INFO - disconnected with result code: 0
2025-05-04 16:00:03,160 - INFO - MQTTTransportStage: _on_mqtt_disconnect called
2025-05-04 16:00:03,160 - INFO - Connection State - Disconnected
2025-05-04 16:00:03,160 - INFO - Cleared all pending method requests due to disconnect
2025-05-04 16:00:03,161 - INFO - Successfully disconnected from Hub
2025-05-04 16:00:03,162 - INFO - Forcing paho disconnect to prevent it from automatically reconnecting
2025-05-04 16:00:03,162 - INFO - Client shutdown complete
2025-05-04 16:00:03,162 - INFO - Azure IoT Hub client shut down.   
2025-05-04 16:00:03,162 - INFO - Script finished
```
*Console logs showing successful connection to Azure IoT Hub, data transmission, and clean shutdown*

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

Note: The system uses a cron job configured on the Raspberry Pi to run `main.py` every 3 minutes, automatically collecting sensor data and sending it to Azure IoT Hub. This ensures continuous data collection without manual intervention.

### Live Dashboard

The dashboard is deployed on GitHub Pages and can be accessed at:
[https://kameleon21.github.io/Home-Office-Pi/](https://kameleon21.github.io/Home-Office-Pi/)

This provides a convenient way to monitor the home office environment from any device with a web browser.

## 6. IoT Device Connection

The system uses a Raspberry Pi 4 with Grove sensors to collect environmental data. The Raspberry Pi connects to Azure IoT Hub using MQTT protocol for secure communication.

### Software Components:
- **main.py**: Entry point script that initializes components and triggers the data collection flow
- **sensors.py**: Manages sensor interactions through a unified SensorManager class
- **azure_client.py**: Handles Azure IoT Hub communication using the Azure IoT Device SDK

### Key Code Snippet

```python
# azure_client.py
def connect(self):
    logging.info("Connecting to Azure IoT Hub...")
    try:
        self.client.connect()
        logging.info("Connected successfully to Azure IoT Hub.")
    except Exception as e:
        logging.error(f"Failed to connect to Azure IoT Hub: {e}")
        raise # Re-raise exception to handle it in main
```

## 7. Sensor Data Collection

The system collects the following sensor data:
- Temperature (°C)
- Humidity (%RH)
- Light level (lux)
- CO2 concentration (PPM, simulated)

Data is timestamped at the source, and proper error handling ensures reliable data collection. The SensorManager class in `sensors.py` provides a unified interface for reading all sensor types.

### Key Code Snippet

```python
# sensors.py
def get_sensor_data(self):
    temp = self.read_temperature()
    humidity = self.read_humidity()
    light = self.read_light()
    co2 = self.read_co2()

    data = {}
    if temp is not None:
        data["temperature"] = temp
    if humidity is not None:
        data["humidity"] = humidity
    if light is not None:
        data["light"] = light
    data["co2"] = co2

    logging.info(f"Collected sensor data: {data}")
    return data
```

## 8. Telemetry Transmission to IoT Hub

Sensor data is formatted as JSON and securely transmitted to Azure IoT Hub using the Azure IoT Device SDK. The implementation includes:
- Secure data transmission with Azure IoT Device SDK
- Error handling and retry mechanisms
- JSON formatting of sensor readings

### Key Code Snippet

```python
# azure_client.py
def send_telemetry(self, data):
    if not data:
        logging.warning("No sensor data to send.")
        return

    try:
        telemetry = json.dumps(data)
        message = Message(telemetry)
        message.content_type = "application/json"
        message.content_encoding = "utf-8"
        self.client.send_message(message)
        logging.info(f"Sent telemetry: {telemetry}")
    except Exception as e:
        logging.error(f"Error sending telemetry: {e}")
```

## 9. Data Visualization

The dashboard visualization is built using:
- **docs/index.html**: Responsive web interface built with Tailwind CSS
- **docs/app.js**: Dashboard logic using Chart.js for data visualization

The dashboard:
1. Fetches aggregated sensor data from Azure Blob Storage
2. Displays data in responsive charts that work on both desktop and mobile
3. Provides enhanced time filtering options that clearly indicate both the data aggregation interval and the time span:
   - **3min/Last 1h**: 3-minute intervals for the last hour of data
   - **5min/Last 6h**: 5-minute intervals for the last 6 hours of data
   - **10min/Last 24h**: 10-minute intervals for the last 24 hours of data
   - **20min/Last 7d**: 20-minute intervals for the last 7 days of data
4. Features visual time range indicators that show the relative time spans at a glance
5. Displays time range information in chart titles for better context
6. Updates in real-time with a refresh button

### Key Code Snippet

```javascript
// docs/app.js
async function fetchAggregated(minutes) {
  const interval = minutes || 3;            // default 3min when "All"
  const filename = INTERVAL_FILE[interval];
  const url = `${BASE_URL}/${filename}?${CONFIG.storage.sasToken}`;

  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Fetch ${filename} failed: ${res.status}`);
  return await res.json();  // should be { temperature: [...], humidity: [...], co2: [...], light: [...] }
}
```

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

### Key Code Snippet

```python
# funcapp/processSensorRollups/__init__.py
def bin_and_average(points, interval_min):
    """Bucket + average (datetime, value) pairs into interval_min-minute bins."""
    if interval_min == 3:
        # for 3-min we just pass through raw points
        return [{"t": dt.isoformat(), "y": v} for dt, v in points]

    ms = interval_min * 60 * 1000
    buckets = {}
    for dt, v in points:
        key = (int(dt.timestamp() * 1000) // ms) * ms
        buckets.setdefault(key, []).append(v)

    out = []
    for key in sorted(buckets):
        vals = buckets[key]
        avg = sum(vals) / len(vals)
        out.append({
            "t": datetime.fromtimestamp(key / 1000, tz=timezone.utc).isoformat(),
            "y": avg,
        })
    return out
```

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

## 13. Challenges & Solutions

Throughout the development of this project, I encountered several challenges that required creative problem-solving:

- **CORS Configuration Issues**: Initially, the dashboard couldn't load data from Azure Blob Storage due to CORS restrictions.
  - *Solution*: Added appropriate CORS rules in the Azure Portal to allow requests from the dashboard domain.

- **Authentication and Authorization**: Securing access to the blob storage while allowing the dashboard to fetch data was challenging.
  - *Solution*: Implemented a short-lived SAS token approach with regular token refresh through Azure AD integration.

- **Client-side Performance Limitations**: Processing large amounts of raw sensor data in the browser caused significant performance issues.
  - *Solution*: Moved data aggregation workloads to Azure Functions, delivering pre-processed data to the dashboard.

- **Sensor Reading Reliability**: Occasional sensor reading failures disrupted the data collection process.
  - *Solution*: Implemented robust error handling with retry mechanisms and fallback values to ensure continuous operation.

- **Time Zone Handling**: Inconsistent timestamps between device, cloud, and dashboard visualization created confusion.
  - *Solution*: Standardized on UTC for all backend operations with proper conversion for display in the dashboard.

## 14. Troubleshooting

### Common Issues and Solutions

#### 401 Unauthorized Error When Accessing Blob Storage
- **Issue**: Dashboard shows "401 Unauthorized" when trying to fetch data.
- **Cause**: The SAS token has expired or is incorrectly formatted.
- **Solution**: Generate a new SAS token in the Azure Portal and update the `CONFIG.storage.sasToken` value in app.js.

#### Sensor Reading Failures
- **Issue**: Some sensor values show as "null" or are missing in the dashboard.
- **Cause**: The physical connection to the sensor might be loose or the sensor might be malfunctioning.
- **Solution**: Check the physical connections to the sensor. Verify that the sensor is properly connected to the Grove base hat. Check the logs at `~/iot_sensor.log` for specific error messages.

#### Azure Function Not Processing Data
- **Issue**: The dashboard shows outdated or no data despite the device sending telemetry.
- **Cause**: The Azure Function might not be running or encountering errors.
- **Solution**: Check the Function App logs in the Azure Portal. Ensure the function app settings are correctly configured with the proper container names.

#### Dashboard Loading Slowly
- **Issue**: The dashboard takes a long time to load or charts render slowly.
- **Cause**: Too much data being processed or network latency issues.
- **Solution**: Try selecting a shorter time range (3m instead of 20m). Check your network connection. Clear browser cache.

## 15. Acknowledgements

- Azure IoT SDK developers
- Chart.js library
- Tailwind CSS framework
- Grove sensor documentation
