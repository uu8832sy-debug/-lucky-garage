import fs from "node:fs";
import path from "node:path";

const file = path.resolve("public/home.js");
let js = fs.readFileSync(file, "utf8");
const pattern = /const batteryOptions=\(p\)=>\{[\s\S]*?return items\.filter\(\(x\)=>x\.price>0\);\s*\};/;
if (!pattern.test(js)) throw new Error("Unable to normalize installment batteryOptions");
js = js.replace(pattern, `const batteryOptions=(p)=>{
      const items=[{key:'lead',label:'鉛酸版',price:Number(p.priceLead||0)}];
      if(Number(p.priceTernary||0)>0)items.push({key:'ternary',label:'三元鋰 30Ah（可抽取）',price:Number(p.priceTernary)});
      if(Number(p.priceLithium||0)>0)items.push({key:'lifepo4',label:'鋰鐵 30Ah（可抽取）',price:Number(p.priceLithium)});
      return items.filter((x)=>x.price>0);
    };`);
fs.writeFileSync(file, js, "utf8");
console.log("Normalized Xiaoyu installment batteryOptions.");
