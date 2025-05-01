import logging
import time
import os
from sensors import SensorManager
from azure_client import AzureIoTClient


def main():
    # Configure logging with user's home directory
    home_dir = os.path.expanduser('~')  # Get current user's home directory
    log_file = os.path.join(home_dir, 'iot_sensor.log')
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        filename=log_file,  # Use dynamic path based on user
        filemode='a'  # Append mode
    )
    logging.info("Starting IoT data collection")

    azure_client = None # Initialize to None
    try:
        # Initialize components
        sensors = SensorManager()
        azure_client = AzureIoTClient()

        # Connect to Azure
        azure_client.connect()

        # Get sensor readings
        sensor_data = sensors.get_sensor_data()
        logging.info(f"Sensor data: {sensor_data}")

        # Send to Azure if data exists
        if sensor_data:
            azure_client.send_telemetry(sensor_data)
            logging.info("Data sent successfully")
        else:
            logging.warning("No sensor data available to send")

    except Exception as e:
        logging.critical(f"Critical error: {e}", exc_info=True)
    finally:
        # Ensure client is shut down even if errors occur
        if azure_client:
            azure_client.shutdown()
        logging.info("Script finished")


if __name__ == "__main__":
    main() 