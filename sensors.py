import logging
import random
from seeed_dht import DHT
from grove.adc import ADC


class SensorManager:
    def __init__(self):
        self.dht_sensor = DHT("11", 5)  # DHT11 on pin 5
        self.adc = ADC(0x08)  # ADC for analog sensors
        self.light_sensor_channel = 0  # Light sensor on A0

    def read_temperature(self):
        try:
            # Add retry logic or error handling if needed
            return self.dht_sensor.read()[1]
        except (IOError, TypeError, IndexError) as e:
            logging.error(f"Error reading temperature: {e}")
            return None # Or a default/previous value

    def read_humidity(self):
        try:
            # Add retry logic or error handling if needed
            return self.dht_sensor.read()[0]
        except (IOError, TypeError, IndexError) as e:
            logging.error(f"Error reading humidity: {e}")
            return None # Or a default/previous value

    def read_light(self):
        try:
            return self.adc.read(self.light_sensor_channel)
        except IOError as e:
            logging.error(f"Error reading light sensor: {e}")
            return None

    def read_co2(self):
        # Simulate CO2 reading (e.g., parts per million)
        return random.uniform(400, 1000)

    def read_pressure(self):
        # Simulate pressure reading (e.g., hectopascals/millibars)
        # Typical atmospheric pressure ranges around 950-1050 hPa
        return random.uniform(980, 1030)

    def get_sensor_data(self):
        temp = self.read_temperature()
        humidity = self.read_humidity()
        light = self.read_light()
        co2 = self.read_co2()
        pressure = self.read_pressure() # Read fake pressure

        data = {}
        if temp is not None:
            data["temperature"] = temp
        if humidity is not None:
            data["humidity"] = humidity
        if light is not None:
            data["light"] = light
        # Always include fake CO2 and pressure
        data["co2"] = co2
        data["pressure"] = pressure # Add pressure to the dictionary

        logging.info(f"Collected sensor data: {data}") # Added logging
        return data 