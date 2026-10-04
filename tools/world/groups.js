"use strict";
/*
 * «Живые» группы: клиентский скрипт анимирует любые модели/детали, у которых
 * есть дочерняя Configuration с одним из этих имён.
 *   SpinGroup  — вращение вокруг PrimaryPart (NumberValue Speed, Vector3Value Axis)
 *   PulseGroup — пульсация прозрачности/размера (Speed, MinTransparency, MaxTransparency, Scale)
 *   BobGroup   — плавное покачивание вверх-вниз (Speed, Amplitude)
 */
const K = require("../lib/kit");

const numberValue = (name, v) => ({ className: "NumberValue", name, properties: { Value: v } });
const vecValue = K.V3;

function spinGroup(speedDeg, axis) {
  return {
    className: "Configuration",
    name: "SpinGroup",
    children: [numberValue("Speed", speedDeg), { className: "Vector3Value", name: "Axis", properties: { Value: vecValue(axis || [0, 1, 0]) } }],
  };
}
function pulseGroup(speed, minT, maxT, scale) {
  return {
    className: "Configuration",
    name: "PulseGroup",
    children: [
      numberValue("Speed", speed),
      numberValue("MinTransparency", minT !== undefined ? minT : 0.15),
      numberValue("MaxTransparency", maxT !== undefined ? maxT : 0.55),
      numberValue("Scale", scale !== undefined ? scale : 1),
    ],
  };
}
function bobGroup(speed, amplitude) {
  return {
    className: "Configuration",
    name: "BobGroup",
    children: [numberValue("Speed", speed), numberValue("Amplitude", amplitude)],
  };
}

module.exports = { spinGroup, pulseGroup, bobGroup, numberValue };
