from azure.iot.device import IoTHubDeviceClient, Message, MethodResponse
import time
from grove.gpio import GPIO
import json
from seeed_dht import DHT
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get environment variables
id = os.getenv('UUID')
connection_string = os.getenv('IOT_CONNECTION_STRING')

device_client = IoTHubDeviceClient.create_from_connection_string(connection_string)

print('Connecting')
device_client.connect()
print('Connected')

client_name = id + '_temp_humi_sensor'
client_telemetry_topic = id + '/telemetry'
server_command_topic = id + '/commands'
button_led = GPIO(16, GPIO.OUT)

# Initialize the DHT11 sensor on pin 5
sensor = DHT("11", 5)

def handle_command(client, userdata, message):
    payload = json.loads(message.payload.decode())
    print("Message received:", payload)

    if payload['heating_on']:
        button_led.write(1)
    else:
        button_led.write(0)


while True:
    # Read temperature from the sensor
    temp = sensor.read()[1]
    
    # Read humidity from the sensor
    humi = sensor.read()[0]
    
    # Create payload
    payload = {'temperature': temp, 'humidity': humi}
    telemetry = json.dumps(payload)
    
    # Create IoT Hub message
    message = Message(telemetry)
    
    # Add message properties if needed
    message.content_type = "application/json"
    message.content_encoding = "utf-8"
    
    # Send the message to IoT Hub
    device_client.send_message(message)
    
    print("Sending telemetry: ", telemetry)

    # Wait before the next reading
    time.sleep(60)
