import assert from "node:assert/strict";
import { finalMachineBuyPrice } from "../src/lib/itemWiseSalesBatteryBuyPrice.js";

const prices = new Map([
  ["id:11", 20000],
  ["name:battery", 20000],
]);

const separateMandatory = {
  is_mandatory: 1,
  package_status: "added",
  accessory_name: "Battery (11)",
  spare_name: "Battery",
  spare_id: 11,
  qty: 1,
};

const included = { ...separateMandatory, package_status: "available" };
const zeroPrice = { ...separateMandatory, spare_id: 99, spare_name: "Battery Zero" };

assert.equal(
  finalMachineBuyPrice(78400, [separateMandatory], prices),
  98400,
  "mandatory separate battery is added",
);

assert.equal(
  finalMachineBuyPrice(78400, [included], prices),
  78400,
  "battery already in the package is not added",
);

assert.equal(
  finalMachineBuyPrice(78400, [], prices),
  78400,
  "no battery keeps the machine buy price",
);

assert.equal(
  finalMachineBuyPrice(78400, [zeroPrice], prices),
  78400,
  "missing or zero battery buy price is ignored",
);

assert.equal(
  finalMachineBuyPrice(78400, [separateMandatory, { ...separateMandatory }], prices),
  98400,
  "the same battery is added only once",
);

assert.equal(
  finalMachineBuyPrice(78400, [{ ...separateMandatory, is_mandatory: 0 }], prices),
  98400,
  "added battery price is included even when the accessory is not marked mandatory",
);

console.log("item wise battery buy price cases passed");
