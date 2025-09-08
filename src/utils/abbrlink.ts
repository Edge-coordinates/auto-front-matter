import crc from "crc";

// 生成 abbrlink（支持 crc32 / crc16 + hex / dec）
export function generateAbbrlink(str, alg = "crc32", rep = "hex") {
  let value;

  if (alg === "crc32") {
    value = crc.crc32(str) >>> 0; // >>>0 保证无符号
  } else if (alg === "crc16") {
    value = crc.crc16(str) >>> 0;
  } else {
    throw new Error("Unsupported algorithm: " + alg);
  }

  if (rep === "hex") {
    return value.toString(16);
  } else if (rep === "dec") {
    return value.toString(10);
  } else {
    throw new Error("Unsupported representation: " + rep);
  }
}
