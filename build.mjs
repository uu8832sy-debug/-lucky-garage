import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const payload = "site_payload_v33.zip";
const input = fs.readFileSync(payload);
const outDir = path.resolve("public");
fs.rmSync(outDir,{recursive:true,force:true});
fs.mkdirSync(outDir,{recursive:true});
let offset=0,count=0;
while(offset+4<=input.length){
  const sig=input.readUInt32LE(offset);
  if(sig!==0x04034b50) break;
  const flags=input.readUInt16LE(offset+6);
  const method=input.readUInt16LE(offset+8);
  const compressedSize=input.readUInt32LE(offset+18);
  const fileNameLength=input.readUInt16LE(offset+26);
  const extraLength=input.readUInt16LE(offset+28);
  if(flags&0x08) throw new Error("ZIP data descriptors are not supported.");
  const nameStart=offset+30;
  const dataStart=nameStart+fileNameLength+extraLength;
  const name=input.subarray(nameStart,nameStart+fileNameLength).toString("utf8");
  const safeName=name.replaceAll("\\","/");
  if(safeName.startsWith("/")||safeName.split("/").includes("..")) throw new Error(`Unsafe ZIP path: ${name}`);
  const data=input.subarray(dataStart,dataStart+compressedSize);
  const target=path.join(outDir,safeName);
  if(safeName.endsWith("/")) fs.mkdirSync(target,{recursive:true});
  else {
    fs.mkdirSync(path.dirname(target),{recursive:true});
    const output=method===0?data:method===8?zlib.inflateRawSync(data):(()=>{throw new Error(`Unsupported ZIP method ${method}`)})();
    fs.writeFileSync(target,output); count++;
  }
  offset=dataStart+compressedSize;
}
const required=["index.html","products.html","plate.html","warranty.html","admin/index.html","assets/brand/logo-round.webp"];
for(const file of required){ if(!fs.existsSync(path.join(outDir,file))) throw new Error(`Deployment payload missing: ${file}`); }
console.log(`Extracted ${count} runtime files to ${outDir}`);
