import fs from "node:fs";
import path from "node:path";

const source = path.resolve("home.js");
const target = path.resolve("public/home.js");
if (!fs.existsSync(source)) throw new Error("Missing root home.js");
if (!fs.existsSync(target)) throw new Error("Missing built public/home.js");
fs.copyFileSync(source, target);
console.log("Replaced ZIP home.js with GitHub runtime home.js.");
