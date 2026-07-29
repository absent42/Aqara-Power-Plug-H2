# Aqara Power Plug H2 UK (RGB) Zigbee2MQTT converter
Zigbee2MQTT external converter for Aqara Power Plug H2 UK (RGB)

*Requires Zigbee2MQTT 2.9.2+*

## Installation

In Zigbee2MQTT go to **settings** → **dev console** → **external converters**, create a new converter named **aeu009.mjs** and paste in the contents of the file. Click save then restart Zigbee2MQTT via **settings** → **tools**

Alternatively place the file **aeu002.mjs** in the folder **zigbee2mqtt/data/external_converters** and restart Zigbee2MQTT.

If an external converter is active for a device a cyan icon with "Supported: external" will be displayed under the device name in Zigbee2MQTT.

## Features

- Replay On/Off
- Power On behaviour
- Power metering
- Overload protection
- Child lock
- Charging protection
- Indicator light on/off
- Indicator light status flip
- Incidcator light colour mode (fixed/power consumption/power per day/power per month)
- Power consumption for indicator light colour gradient range
- Accumulated power for indicator light colour gradient range
- Indicator light fixed colour temp/XY
- Indentify
- OTA updates
