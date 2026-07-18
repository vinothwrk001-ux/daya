const test = require("node:test");
const assert = require("assert");
const { matchesBusinessShift, normalizeShiftValue } = require("../../utils/shiftTime");

test("normalizes supported shift values", () => {
  assert.equal(normalizeShiftValue("all"), "all");
  assert.equal(normalizeShiftValue("DAY"), "day");
  assert.equal(normalizeShiftValue("night"), "night");
  assert.equal(normalizeShiftValue(""), "all");
});

test("night shift spans midnight correctly", () => {
  assert.equal(matchesBusinessShift(new Date("2026-07-11T00:30:00.000Z"), "night"), true);
  assert.equal(matchesBusinessShift(new Date("2026-07-11T23:15:00.000Z"), "night"), true);
  assert.equal(matchesBusinessShift(new Date("2026-07-11T21:45:00.000Z"), "day"), true);
  assert.equal(matchesBusinessShift(new Date("2026-07-11T10:59:59.000Z"), "day"), true);
  assert.equal(matchesBusinessShift(new Date("2026-07-11T11:00:00.000Z"), "day"), true);
  assert.equal(matchesBusinessShift(new Date("2026-07-11T10:59:59.000Z"), "night"), false);
  assert.equal(matchesBusinessShift(new Date("2026-07-11T23:00:00.000Z"), "day"), false);
});
