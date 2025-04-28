from azure.iot.device import IoTHubDeviceClient, Message, MethodResponse
import time
from grove.gpio import GPIO
import json
from seeed_dht import DHT
import os
from dotenv import load_dotenv
from grove.adc import ADC

class SensorManager:
    def __init__(self):
        self.dht_sensor = DHT("11", 5)  # DHT11 on pin 5
        self.adc = ADC(0x08)  # ADC for analog sensors
        self.light_sensor_channel = 0  # Light sensor on A0

    def read_temperature(self):
        return self.dht_sensor.read()[1]

    def read_humidity(self):
        return self.dht_sensor.read()[0]

    def read_light(self):
        return self.adc.read(self.light_sensor_channel)

    def get_sensor_data(self):
        return {
            'temperature': self.read_temperature(),
            'humidity': self.read_humidity(),
            'light': self.read_light()
        }

class AzureIoTClient:
    def __init__(self):
        load_dotenv()
        self.device_id = os.getenv('UUID')
        self.connection_string = os.getenv('IOT_CONNECTION_STRING')
        self.client = IoTHubDeviceClient.create_from_connection_string(self.connection_string)
        self.button_led = GPIO(16, GPIO.OUT)

    def connect(self):
        print('Connecting to Azure IoT Hub...')
        self.client.connect()
        print('Connected successfully')

    def send_telemetry(self, data):
        telemetry = json.dumps(data)
        message = Message(telemetry)
        message.content_type = "application/json"
        message.content_encoding = "utf-8"
        self.client.send_message(message)
        print("Sent telemetry:", telemetry)

    def handle_command(self, client, userdata, message):
        payload = json.loads(message.payload.decode())
        print("Command received:", payload)
        if payload.get('heating_on'):
            self.button_led.write(1)
        else:
            self.button_led.write(0)

def main():
    # Initialize components
    sensors = SensorManager()
    azure_client = AzureIoTClient()
    
    # Connect to Azure
    azure_client.connect()

    # Main loop
    while True:
        try:
            # Get sensor readings
            sensor_data = sensors.get_sensor_data()
            
            # Send to Azure
            azure_client.send_telemetry(sensor_data)
            
            # Wait before next reading
            time.sleep(60)
            
        except Exception as e:
            print(f"Error occurred: {e}")
            time.sleep(5)  # Wait before retrying

if __name__ == "__main__":
    main()
