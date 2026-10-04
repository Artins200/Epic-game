"use strict";
/*
 * Освещение и постобработка: сумеречное небо, атмосфера, bloom, цветокоррекция.
 * Технология освещения — ShadowMap (лёгкая). Хотите максимум красоты — поменяйте
 * в Studio: Lighting.Technology = Future.
 */
const K = require("../lib/kit");
const { C3, C3f, types } = K;

function build() {
  return {
    className: "Lighting",
    name: "Lighting",
    properties: {
      Technology: 3,
      ClockTime: 19.35,
      GeographicLatitude: 24,
      Brightness: 2.35,
      Ambient: C3(24, 22, 34),
      OutdoorAmbient: C3(62, 56, 78),
      ColorShift_Top: C3f(0.12, 0.04, 0.22),
      ColorShift_Bottom: C3f(-0.06, -0.04, 0.08),
      ExposureCompensation: 0.12,
      GlobalShadows: true,
      ShadowSoftness: 0.32,
      EnvironmentDiffuseScale: 0.85,
      EnvironmentSpecularScale: 0.9,
      FogColor: C3f(0.13, 0.11, 0.2),
      FogStart: 260,
      FogEnd: 3200,
      Outlines: false,
      PrioritizeLightingQuality: true,
    },
    children: [
      { className: "Atmosphere", name: "Atmosphere", properties: {
        Density: 0.38, Offset: 0.12, Glare: 0.42, Haze: 1.35,
        Color: C3f(0.62, 0.5, 0.74), Decay: C3f(0.34, 0.28, 0.46),
      } },
      { className: "BloomEffect", name: "Bloom", properties: { Intensity: 1.15, Size: 26, Threshold: 1.02, Enabled: true } },
      { className: "SunRaysEffect", name: "SunRays", properties: { Intensity: 0.08, Spread: 0.86, Enabled: true } },
      { className: "ColorCorrectionEffect", name: "ColorGrade", properties: { Brightness: 0.02, Contrast: 0.13, Saturation: 0.18, TintColor: C3f(1, 0.965, 1), Enabled: true } },
      { className: "DepthOfFieldEffect", name: "DoF", properties: { FarIntensity: 0.1, FocusDistance: 64, InFocusRadius: 48, NearIntensity: 0, Enabled: true } },
      { className: "BlurEffect", name: "Blur", properties: { Size: 0, Enabled: false } },
    ],
  };
}

/** Настройки Workspace */
function workspaceProps() {
  return {
    Gravity: 180,
    StreamingEnabled: false,
    AllowThirdPartySales: false,
    FallenPartsDestroyHeight: -400,
    TouchesUseCollisionGroups: false,
  };
}

/** Настройки StarterPlayer */
function starterPlayer() {
  return {
    className: "StarterPlayer",
    name: "StarterPlayer",
    properties: {
      CharacterWalkSpeed: 20,
      CharacterJumpPower: 52,
      CharacterUseJumpPower: true,
      CharacterMaxSlopeAngle: 70,
      CharacterBreakJointsOnDeath: false,
      EnableMouseLockOption: false,
      CameraMaxZoomDistance: 110,
      CameraMinZoomDistance: 6,
      DevCameraOcclusionMode: 1,
      LoadCharacterAppearance: true,
      AutoJumpEnabled: true,
    },
    children: [
      { className: "StarterPlayerScripts", name: "StarterPlayerScripts", children: [] },
      { className: "StarterCharacterScripts", name: "StarterCharacterScripts", children: [] },
    ],
  };
}

module.exports = { build, workspaceProps, starterPlayer };
