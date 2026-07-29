import * as fz from "zigbee-herdsman-converters/converters/fromZigbee";
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
        description: "Whether the indicator light is a fixed colour, or displays power use through colour gradients",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiIndicatorPowerMax = (args) =>
    m.numeric({
        name: "indicator_power_max",
        cluster: "manuSpecificLumi",
        attribute: {ID: 0x02e0, type: 0x39},
        valueMin: 0,
        valueMax: 3840,
        valueStep: 1,
        unit: "W",
        description: "Maximum value of power consumption measurement for indicator light range",
        access: "ALL",
        entityCategory: "config",
        zigbeeCommandOptions: {manufacturerCode},
        ...args,
    });

const lumiIndicatorAccumulatedPowerMax = (args) =>
    m.numeric({
        name: "indicator_accumulated_power_max",
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

// The LED indicator's brightness/colour share the same genOnOff and genLevelCtrl cluster/endpoint as the
// socket relay, and without moveToLevelWithOnOffDisable, setting brightness to 0 turns off the relay.
// The lights on/off expose is also removed since the relay's on/off is already exposed by lumiOnOff()
const lumiIndicatorLight = (args) => {
    const result = lumiModernExtend.lumiLight({moveToLevelWithOnOffDisable: true, ...args});

    for (const expose of result.exposes ?? []) {
        if (typeof expose === "object" && expose.type === "light" && Array.isArray(expose.features)) {
            expose.features = expose.features.filter((feature) => feature.name !== "state");
        }
    }

    result.fromZigbee = (result.fromZigbee ?? []).filter((converter) => converter !== fz.on_off);
    result.toZigbee = (result.toZigbee ?? [])
        .filter((converter) => converter !== tz.light_onoff_brightness)
        .concat({...tz.light_onoff_brightness, key: ["brightness", "brightness_percent", "on_time", "off_wait_time"]});

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
        lumiModernExtend.lumiOnOff(), // Device temperature not supported
        lumiModernExtend.lumiPower(),
        lumiModernExtend.lumiElectricityMeter(), // Device voltage not supported
        lumiModernExtend.lumiPowerOnBehavior(),

        lumiChildLock(),
        lumiChargingProtection(),
        lumiModernExtend.lumiOverloadProtection(),

        lumiModernExtend.lumiLedIndicator(),
        lumiModernExtend.lumiFlipIndicatorLight(),

        lumiIndicatorColorMode(),
        lumiIndicatorPowerMax(),
        lumiIndicatorAccumulatedPowerMax(),

        lumiIndicatorLight({
            colorTemp: true,
            deviceTemperature: false,
            powerOutageCount: false,
            color: {modes: ["xy"]},
        }),

        m.identify(),
    ],
};
