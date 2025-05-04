import logging
import json
import os
from dotenv import load_dotenv
from azure.iot.device import IoTHubDeviceClient, Message, MethodResponse
from grove.gpio import GPIO


class AzureIoTClient:
    def __init__(self):
        load_dotenv()
        self.device_id = os.getenv("UUID")
        self.connection_string = os.getenv("IOT_CONNECTION_STRING")
        if not self.connection_string:
            logging.error("IOT_CONNECTION_STRING environment variable not set.")
            raise ValueError("Missing IoT Hub connection string")
        self.client = IoTHubDeviceClient.create_from_connection_string(
            self.connection_string
        )
        self.button_led = GPIO(16, GPIO.OUT) # Assuming you still want this?

        # --- TODO: Register command handler ---
        # self.client.on_message_received = self.handle_message # For C2D messages
        # self.client.on_method_request_received = self.handle_method_request # For Direct Methods
        logging.info("Azure IoT Client initialized.")


    def connect(self):
        logging.info("Connecting to Azure IoT Hub...")
        try:
            self.client.connect()
            logging.info("Connected successfully to Azure IoT Hub.")
        except Exception as e:
            logging.error(f"Failed to connect to Azure IoT Hub: {e}")
            raise # Re-raise exception to handle it in main or exit


    def shutdown(self):
        logging.info("Shutting down Azure IoT Hub client...")
        if self.client and self.client.connected:
            self.client.shutdown()
            logging.info("Azure IoT Hub client shut down.")


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
