"""Sensor management module for collecting environmental data.

This module provides a unified interface for reading data from various sensors:
- Temperature and humidity (DHT11)
- Light level (Grove analog sensor)
- CO2 level (simulated)
"""

import logging
import random
from typing import Dict, Optional, Union, Tuple
from seeed_dht import DHT
from grove.adc import ADC


class SensorManager:
    """Manages the collection of sensor data from multiple environmental sensors.
    
    This class provides a unified interface to read data from various sensors
    connected to the Raspberry Pi, including temperature, humidity, light level,
    and simulated CO2 readings.
    
    Attributes:
        dht_sensor: DHT11 temperature and humidity sensor instance
        adc: Analog-to-Digital converter for analog sensors
        light_sensor_channel: Channel number for the light sensor on ADC
    """

    def __init__(self) -> None:
        """Initialize sensor connections and configurations."""
        self.dht_sensor = DHT("11", 5)  # DHT11 on pin 5
        self.adc = ADC(0x08)  # ADC for analog sensors
        self.light_sensor_channel = 0  # Light sensor on A0

    def read_temperature(self) -> Optional[float]:
        """Read the current temperature from the DHT11 sensor.
        
        Returns:
            float or None: Temperature in Celsius if successful, None if reading fails
        """
        try:
            # Add retry logic or error handling if needed
            return self.dht_sensor.read()[1]
        except (IOError, TypeError, IndexError) as e:
            logging.error(f"Error reading temperature: {e}")
            return None # Or a default/previous value

    def read_humidity(self) -> Optional[float]:
        """Read the current humidity from the DHT11 sensor.
        
        Returns:
            float or None: Relative humidity percentage if successful, None if reading fails
        """
        try:
            # Add retry logic or error handling if needed
            return self.dht_sensor.read()[0]
        except (IOError, TypeError, IndexError) as e:
            logging.error(f"Error reading humidity: {e}")
            return None # Or a default/previous value

    def read_light(self) -> Optional[int]:
        """Read the current light level from the analog light sensor.
        
        Returns:
            int or None: Light level (0-1023) if successful, None if reading fails
        """
        try:
            return self.adc.read(self.light_sensor_channel)
        except IOError as e:
            logging.error(f"Error reading light sensor: {e}")
            return None

    def read_co2(self) -> float:
        """Simulate a CO2 reading.
        
        Returns:
            float: Simulated CO2 level in parts per million (ppm)
        """
        # Simulate CO2 reading (e.g., parts per million)
        return random.uniform(400, 1000)

    def get_sensor_data(self) -> Dict[str, Union[float, int]]:
        """Collect readings from all available sensors.
        
        Returns:
            dict: Dictionary containing sensor readings with keys:
                - 'temperature': Temperature in Celsius
                - 'humidity': Relative humidity percentage
                - 'light': Light level (0-1023)
                - 'co2': CO2 level in ppm (simulated)
                Note: Any failed readings will be omitted from the dictionary.
        """
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
        # Only include fake CO2
        data["co2"] = co2

        logging.info(f"Collected sensor data: {data}")
        return data