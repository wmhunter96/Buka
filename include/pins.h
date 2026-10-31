#pragma once

#include <cstdint>

// =====================================================
// PINOUT
// =====================================================

#if defined(TE_BOARD_ESP32_DEVKIT)
// Classic ESP32 DevKit (ESP32-WROOM-32, 30/38-pin). GPIO0/2/5/12/15 are
// strapping pins, GPIO1/3 are the USB-serial UART, GPIO6-11 are the flash bus.

// I2C -> PCA9685 + OLED (ESP32 default I2C pins)
constexpr int I2C_SDA = 21;  // D21
constexpr int I2C_SCL = 22;  // D22

// I2S -> MAX98357A
constexpr int I2S_BCLK = 26; // D26
constexpr int I2S_LRC  = 25; // D25
constexpr int I2S_DIN  = 27; // D27

// No addressable RGB LED on a DevKit. GPIO10 is a flash pin here and must
// never be driven, so the RGB status code is compiled out (see rgb.cpp).
constexpr bool RGB_LED_PRESENT = false;
constexpr int RGB_LED_PIN = -1;

// PCA9685 output enable (active LOW). D13 → OE; not a strapping pin.
constexpr bool PCA9685_OE_WIRED = true;
constexpr int PCA9685_OE_PIN = 13;  // D13

#else  // ESP32-C3-Zero (stock)

// I2C -> PCA9685 + OLED
constexpr int I2C_SDA = 0;   // GP0
constexpr int I2C_SCL = 1;   // GP1

// I2S -> MAX98357A
constexpr int I2S_BCLK = 2;  // GP2
constexpr int I2S_LRC  = 3;  // GP3
constexpr int I2S_DIN  = 4;  // GP4

// Built-in WS2812 RGB
constexpr bool RGB_LED_PRESENT = true;
constexpr int RGB_LED_PIN = 10;

// PCA9685 output enable (active LOW). GP5 → OE; default on.
// Set PCA9685_OE_WIRED false only if OE is hard-tied off-chip (e.g. to GND).
constexpr bool PCA9685_OE_WIRED = true;
constexpr int PCA9685_OE_PIN = 5;

#endif

// =====================================================
// AUDIO
// =====================================================

// assets/ ships 44100 Hz WAVs; scripts/audio_pack.py halves them while packing LittleFS.
constexpr int SAMPLE_RATE = 22050;

// =====================================================
// PCA9685 / SERVOS
// =====================================================

constexpr uint8_t PCA9685_ADDRESS = 0x40;

constexpr int SERVO_STEP_MS = 10;

// Boot centering / sleep-pose rate (deg/s)
constexpr float SERVO_BOOT_SPEED_DEG_S = 35.0f;

// Servo pulse range
constexpr int SERVO_MIN_US = 800;
constexpr int SERVO_MAX_US = 2200;

// =====================================================
// OLED
// =====================================================

constexpr int OLED_WIDTH  = 128;
constexpr int OLED_HEIGHT = 32;
constexpr uint8_t OLED_ADDRESS = 0x3C;
