# Home-Office-Monitoring 
## Project Proposal
This is my project for the IoT module, where I'm building a home monitoring system using a Raspberry Pi 4 connected to Azure Cloud services. The system will collect data from multiple sensors, process it, and visualize it on a GitHub Pages website.

I'll create an IoT solution that:

- Collects environmental data (temperature, humidity, light, CO2) using sensors connected to a Raspberry Pi
- Securely sends this data to Azure IoT Hub
- Processes and stores the data in Azure
- Visualizes the data on a free static website hosted on GitHub Pages
- Implements automated alerts for unusual readings

## System Architeture 
<img width="1353" alt="Screenshot 2025-04-12 at 13 04 24" src="https://github.com/user-attachments/assets/b255dd34-98f8-4dcc-a35b-939a8497f578" />

### Components:
#### Edge Device Layer
- **Raspberry Pi 4**: This will be my main IoT device
- **Sensors**: I'm using these sensors:
  - Temperature/Humidity sensor (DHT22)
  - Light level sensor (LDR or BH1750)
  - CO2 sensor (MH-Z19 or similar)
- **Local Storage**: I'll store data locally in a SQLite database as a backup and to reduce transmission frequency
  
#### Communication Layer
- **Protocol**: MQTT for efficient communication
- **Data Format**: JSON with timestamps
- **Security**: TLS encryption and Azure shared access signatures

#### Azure Cloud Platform (Free Tier)
- **Azure IoT Hub** (F1 free tier): For device communication
- **Azure Blob Storage**: To store processed sensor readings
- **Azure Functions**: To process data and create visualization files

#### Visualization Layer
- **GitHub Pages**: Free hosting for my dashboard
- **JavaScript Charts**: Using Chart.js to display sensor data graphically
- **Real-time Updates**: Dashboard will automatically refresh with new data

#### Automation & Alerts
- **Email Notifications**: Sent when readings exceed thresholds
- **Alert Logic**: Implemented in Azure Functions
