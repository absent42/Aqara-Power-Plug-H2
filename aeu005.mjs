import * as tz from "zigbee-herdsman-converters/converters/toZigbee";
import * as lumi from "zigbee-herdsman-converters/lib/lumi";
import * as m from "zigbee-herdsman-converters/lib/modernExtend";

const {lumiModernExtend, manufacturerCode} = lumi;

const lumiChargingProtection = (args) =>
    m.binary({
        name: "charging_protection",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x0202, type: 0x10},
        valueOn: [true, 1],
        valueOff: [false, 0],
        description: "If the power remains below 3W for half an hour, automatically turn off the plug",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiChildLock = (args) =>
    m.binary({
        name: "child_lock",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x0285, type: 0x20},
        valueOn: [true, 1],
        valueOff: [false, 0],
        description: "Child lock (disables physical button)",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiIndicatorColorMode = (args) =>
    m.enumLookup({
        name: "indicator_color_mode",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x02df, type: 0x20},
        lookup: {fixed: 0, power_consumption: 1, power_per_day: 2, power_per_month: 3},
        description:
            "Whether the indicator light is a fixed settable colour, or displays power use through colour gradients; the light's colour and colour temperature only apply in fixed mode",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiPowerMax = (args) =>
    m.numeric({
        name: "power_max",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x02e0, type: 0x39},
        valueMin: 0,
        valueMax: 3250,
        valueStep: 1,
        unit: "W",
        description: "Maximum value of power consumption measurement for indicator light range",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiAccumulatedPowerMax = (args) =>
    m.numeric({
        name: "accumulated_power_max",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x02e1, type: 0x39},
        valueMin: 0,
        valueMax: 10000,
        valueStep: 1,
        unit: "kWh",
        description: "Maximum value of accumulated power measurement per day/month for indicator light range",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiLedState = () => {
    const result = m.binary({
        name: "state",
        endpointName: "led",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x0203, type: 0x10},
        valueOn: ["ON", 1],
        valueOff: ["OFF", 0],
        description: "LED indicator",
        access: "ALL",
        zigbeeCommandOptions: {manufacturerCode},
    });

    // The light expose already carries a "state" feature (property "state_led"), so this only needs
    // to supply its converters, stops Z2M picking it for the relay's unsuffixed "state".
    result.exposes = [];
    result.toZigbee[0].endpoints = ["led"];

    return result;
};

// Brightness and colour do share endpoint 1 with the socket relay, which is why that endpoint is named "led" (see
// deviceEndpoints below) - without moveToLevelWithOnOffDisable, setting brightness to 0 sends an
// implicit off that trips the relay.
const lumiLedLight = (args) => {
    const result = lumiModernExtend.lumiLight({moveToLevelWithOnOffDisable: true, ...args});

    // lumiLight wraps tz.light_onoff_brightness in a fresh object when endpointNames is set, so it
    // has to be matched on its keys rather than by identity. The replacement drops "state" from the
    // key list, leaving the light's on/off to lumiLedState() while brightness keeps working.
    result.toZigbee = (result.toZigbee ?? [])
        .filter((converter) => !(converter.key?.includes("state") && converter.key?.includes("brightness")))
        .concat({
            ...tz.light_onoff_brightness,
            endpoints: args?.endpointNames,
            key: ["brightness", "brightness_percent", "on_time", "off_wait_time"],
        });

    return result;
};

// Energy and current are only delivered inside the manuSpecificLumi 0xf7 aggregate
// (tags 0x95 = kWh, 0x97 = mA). The plug omits the voltage tag (0x96), so that expose is dropped.
const lumiEnergyMeter = () => {
    const result = lumiModernExtend.lumiElectricityMeter();
    result.exposes = result.exposes.filter((expose) => expose.name !== "voltage");
    return result;
};

// Disable device temperature expose since it's not supported on this device.
const lumiOnOff = (args) => {
    const result = lumiModernExtend.lumiOnOff(args);
    result.exposes = result.exposes.filter((expose) => expose.name !== "device_temperature");
    return result;
};

export default {
    zigbeeModel: ["lumi.plug.aeu005"],
    model: "SP-P05E",
    vendor: "Aqara",
    description: "Power Plug H2 EU (RGB)",

    extend: [
        lumiModernExtend.addManuSpecificLumiCluster(),
        lumiModernExtend.lumiZigbeeOTA(),

        // Naming endpoint 1 "led" gives the light its own MQTT topic pair and endpoint-suffixed
        // brightness/colour properties, which is what keeps it apart from the relay. multiEndpointSkip
        // holds the relay's "state" and the meter's "power" unsuffixed.
        m.deviceEndpoints({endpoints: {led: 1}, multiEndpointSkip: ["state", "power"]}),

        lumiLedState(), // must precede lumiOnOff(): Z2M uses the first converter whose key matches
        lumiOnOff(), // Device temperature not supported
        lumiModernExtend.lumiPowerOnBehavior(),

        // Live power comes from haElectricalMeasurement activePower (0x050b). The plug does not
        // implement the acCurrent*/acVoltage*/acFrequency* divisor attributes (reading them returns
        // UNSUPPORTED_ATTRIBUTE and aborts Z2M configure) and has no seMetering cluster, so the meter is
        // pinned to the electrical cluster. activePower is only reported in whole watts, so the
        // divisor/multiplier are forced to 1 rather than read from the device.
        m.electricityMeter({
            cluster: "electrical",
            power: {divisor: 1, multiplier: 1},
            voltage: false,
            current: false,
            acFrequency: false,
            powerFactor: false,
            apparentPower: false,
        }),
        lumiEnergyMeter(),

        lumiChildLock(),
        lumiChargingProtection(),
        lumiModernExtend.lumiOverloadProtection(),

        lumiModernExtend.lumiFlipIndicatorLight(),

        lumiIndicatorColorMode(),
        lumiPowerMax(),
        lumiAccumulatedPowerMax(),

        lumiLedLight({
            endpointNames: ["led"],
            colorTemp: true,
            deviceTemperature: false,
            powerOutageCount: false,
            color: {modes: ["xy"]},
        }),

        m.identify(),
    ],
};
