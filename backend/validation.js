'use strict';

const NAME_RE = /^[a-zA-Z0-9 _-]+$/;
const ROOM_RE = /^[A-Z0-9]{4}$/;

function sanitizeName(value) {
  const name = String(value ?? '').trim().slice(0, 20);
  if (name.length < 2 || !NAME_RE.test(name)) return null;
  return name;
}

function normalizeRoom(value) {
  const room = String(value ?? '').trim().toUpperCase();
  return ROOM_RE.test(room) ? room : null;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function intInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function stringInSet(value, allowed) {
  return typeof value === 'string' && allowed.includes(value);
}

function payloadSizeOk(payload, maxBytes = 4096) {
  try { return Buffer.byteLength(JSON.stringify(payload)) <= maxBytes; }
  catch { return false; }
}

module.exports = { sanitizeName, normalizeRoom, isPlainObject, intInRange, stringInSet, payloadSizeOk };
