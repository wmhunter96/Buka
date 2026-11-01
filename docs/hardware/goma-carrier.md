# Buka: ESP32 DevKit on a Goma carrier

An ESP32 DevKit plugged into a spare Sesame/Goma **DevKit Carrier v1**, driving the five servos straight from GPIO (no PCA9685), with a 0.96" 128×64 OLED. Powered from a 5 V USB supply. Firmware env: **`buka`**.

For the PCA9685 breakout version of the DevKit build see [esp32-devkit.md](esp32-devkit.md).

## Carrier: what to fit

| Fit | Leave empty |
| --- | --- |
| J1, J2 DevKit sockets | U1 Pololu regulator |
| C1 470 µF (long leg / + to the square pad) | C3 |
| Servo headers L1, L2, L3, L4, R3 | R1, R2, C2 (battery sense) |
| | J6 battery pads, SW1 switch pads |

OLED and power are soldered straight to J3 and J5 (no headers needed). J4 is only for adding the speaker later.

Before plugging anything in: continuity between 5V and GND must **not** beep.

## Servos

| Servo | Header | DevKit pin |
| --- | --- | --- |
| Head | L1 | D23 |
| Neck | L2 | D19 |
| Left arm | L3 | D17 |
| Right arm | R3 | D16 |
| Body | L4 | D18 |

Headers are **S + −** from the DevKit outward: orange toward the DevKit, brown on the outer pin. R1 (D15) and R2 (D2) are boot strapping pins and stay unused.

## OLED (J3)

| J3 | OLED |
| --- | --- |
| C | SCL |
| D | SDA |
| V | VCC (3.3 V) |
| G | GND |

Match by the labels on your OLED, not by its pin order.

## Power (J5)

5 V / ≥ 2 A USB supply into J5 **5V** and **G** (leave pin 13 empty), from a USB-C power breakout or a cut USB cable, 22 AWG. That feeds the servo headers and the DevKit's VIN together. Don't run the servos from the DevKit's own micro-USB port.

## Flash

Needs PlatformIO (the VS Code extension, or `pip install platformio`) and Node 20.19+ or 22.12+ (the build packs the web UI).

1. Unplug the J5 supply and all servos.
2. Plug a USB **data** cable into the DevKit.
3. From the repo root:
   ```
   pio run -e buka -t upload
   ```
   This builds, flashes the firmware, then uploads the filesystem (faces, sounds, web UI). If it stalls at `Connecting...`, hold the DevKit's **BOOT** button until it starts.
4. If upload can't find the port, install the USB-serial driver for your DevKit's chip (CP2102 or CH340, printed on the chip next to the USB port).

The OLED should show the sleeping face, then the setup Wi-Fi steps.

## Center the servos

Same as the stock [assembly guide](../3d/assembly.md#center-a-servo):

1. Unplug the computer. Plug the servo(s) into their headers, then power from the J5 USB supply.
2. On your phone, join the **`TinyEngineer-XXXX`** Wi-Fi.
3. Open **http://192.168.4.1/config** → **Assembly support** → **Move all to 90°**. Use **Identify** to wiggle one joint if you need to check which is which.
4. Fit the printed part on that servo, then unplug it before the next step, as the assembly guide says.

Don't run the guided range calibration or finish the setup wizard until assembly §20.
