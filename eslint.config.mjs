import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/page.tsx"],
    rules: {
      // page.tsx의 구독 캘린더 effect는 외부 Supabase 상태를 동기화하는 effect다.
      // RPC 완료 후 state를 갱신하며, dependency 변경 시 원격 데이터를 다시 읽어야 한다.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
