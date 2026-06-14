/// <reference types="vite/client" />
// electron-vite 以 Vite 打包 main，import.meta.glob 在 build 期會被轉換；此引用提供其型別。

// electron-vite 的 ?asset 匯入：回傳資產檔案的路徑字串（dev/prod 皆正確）。
declare module '*?asset' {
  const src: string
  export default src
}
