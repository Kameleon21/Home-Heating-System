# Home Office Pi IoT Project

This project collects sensor data from a Raspberry Pi with Grove sensors and sends it to Azure IoT Hub.

## Sensors
- Temperature and Humidity (DHT11)
- Light sensor
- Simulated CO2 sensor

## Project Structure
- `main.py`: Primary entry point
- `sensors.py`: SensorManager class responsible for reading sensors
- `azure_client.py`: AzureIoTClient class handling IoT Hub communication
- `collectData.py`: Legacy entry point (uses main.py)
- `requirements.txt`: Project dependencies

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Create a `.env` file with the following variables:
   ```
   IOT_CONNECTION_STRING=your_iot_hub_connection_string
   UUID=your_device_id
   ```

3. Run the application:
   ```
   python main.py
   ```

## Notes
- The LED on GPIO 16 can be controlled remotely (implementation commented out)
- CO2 readings are simulated with random values
- Sensor readings are sent to Azure IoT Hub every 60 seconds
