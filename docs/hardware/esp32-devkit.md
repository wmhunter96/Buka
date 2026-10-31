# Classic ESP32 DevKit build (no main control board)

Unofficial variant: a classic **ESP32 DevKit** (ESP32-WROOM-32, 30- or 38-pin, 4 MB flash) wired to breakout modules instead of the ESP32-C3-Zero and the main control board.

Firmware: `pio run -e esp32-devkit`. Pin map: the `TE_BOARD_ESP32_DEVKIT` block in [`include/pins.h`](../../include/pins.h).

## Parts

| Part | Qty | Notes |
| --- | --- | --- |
| ESP32 DevKit (ESP32-WROOM-32) | 1 | DOIT DevKit V1 style or similar |
| PCA9685 16-channel servo driver breakout | 1 | Adafruit 815 or clone. Address 0x40 (no address jumpers) |
| MAX98357A I2S amp breakout | 1 | |
| 0.91" SSD1306 OLED, 128×32, I2C | 1 | Address 0x3C |
| SG90 servos | 5 | |
| 8 Ω 1 W speaker | 1 | |
| 5 V / ≥ 2 A supply | 1 | See Power |

## Pin map

| Function | DevKit pin | Goes to |
| --- | --- | --- |
| I2C SDA | **D21** | PCA9685 SDA, OLED SDA |
| I2C SCL | **D22** | PCA9685 SCL, OLED SCL |
| I2S BCLK | **D26** | MAX98357A BCLK |
| I2S LRC / WS | **D25** | MAX98357A LRC |
| I2S DIN | **D27** | MAX98357A DIN |
| PCA9685 OE (active low) | **D13** | PCA9685 OE |
| 3V3 | **3V3** | PCA9685 VCC, OLED VCC |
| GND | **GND** | every module |

Avoid for add-ons: GPIO0, 2, 5, 12, 15 (boot strapping), GPIO1 and 3 (USB serial), GPIO6–11 (flash). GPIO34–39 are input-only.

There is no RGB status LED on a DevKit, so the firmware's RGB status code is compiled out on this build. The OLED face and serial log still show status.

## Power

Servos draw far more than the DevKit's USB port and onboard regulator can supply. Feed **5 V / ≥ 2 A** to a shared 5 V rail:

| From | To |
| --- | --- |
| 5 V supply + | DevKit **VIN**, PCA9685 **V+** (servo terminal), MAX98357A **Vin** |
| 5 V supply − | common **GND** |

- PCA9685 **VCC** is 3.3 V logic from the DevKit's 3V3 pin. **V+** is the 5 V servo rail. Never connect them.
- Don't plug the DevKit's USB cable in while the 5 V supply is feeding VIN unless your DevKit has a diode between USB 5 V and VIN (most DOIT-style boards do; check yours). Easiest habit: flash with the 5 V supply off and servos unplugged.
- Speaker goes across MAX98357A **+** and **−**. **−** is not ground.

## Connect in this order

1. Common GND to every module.
2. Signals: SDA/SCL, BCLK/LRC/DIN, OE.
3. 3V3 to PCA9685 VCC and OLED VCC.
4. 5 V last. Leave servo leads unplugged until the firmware has centered them.

## Flashing

The web flasher and release binaries are built for the C3, so build and flash from source with PlatformIO:

```
pio run -e esp32-devkit -t upload
pio run -e esp32-devkit -t uploadfs
```

`uploadfs` (the LittleFS image with sounds and faces) also runs automatically after `upload`. If upload stalls at "Connecting...", hold the DevKit's BOOT button until it starts.

Wi-Fi setup, the HTTP API and the agent integrations (`npx -y tiny-engineer setup`) are the same as the stock build. The USB serial transport runs over the DevKit's USB-UART bridge at 115200 baud, which is slower than the C3's native USB, so prefer the default Wi-Fi/HTTP transport for audio playback.

## Desk fit

The desk's electronics pocket is sized for the C3-Zero. Check that the DevKit fits your printed desk, and keep its PCB antenna (the end with the zig-zag trace) clear of metal and away from the servos.
