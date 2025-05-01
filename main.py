import logging
import time
from sensors import SensorManager
from azure_client import AzureIoTClient


def main():
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        filename='/home/pi/iot_sensor.log',  # Save logs to a file
        filemode='a'  # Append mode
    )

    azure_client = None # Initialize to None
    try:
        # Initialize components
        sensors = SensorManager()
        azure_client = AzureIoTClient()

        # Connect to Azure
        azure_client.connect()

        # Get sensor readings
        sensor_data = sensors.get_sensor_data()

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