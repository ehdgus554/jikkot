import { z } from "zod";
export const nicknameSchema = z
  .string()
  .trim()
  .regex(/^[가-힣a-zA-Z0-9_]+$/,"닉네임은 한글·영문·숫자·밑줄만 사용할 수 있어요.")
  .refine((value) => {
    const n = [
      ...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(value),
    ].length;
    return n >= 2 && n <= 20;
  }, "닉네임은 2~20글자로 입력해주세요.");
