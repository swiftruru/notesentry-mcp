import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { EnvCheck } from '@shared/types'
import { loadConfig, resolveProjectPath } from './config/configStore'
import { tMain } from './i18n'

/** 連線測試用的環境診斷：檢查 SQLite 檔是否存在、Python 是否可執行。 */
export function checkEnvironment(): Promise<EnvCheck> {
  const cfg = loadConfig()
  const dbAbsPath = resolveProjectPath(cfg.dbPath)
  const dbExists = existsSync(dbAbsPath)

  return new Promise<EnvCheck>((resolve) => {
    execFile(cfg.pythonPath, ['--version'], { timeout: 5000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          dbPath: cfg.dbPath,
          dbAbsPath,
          dbExists,
          pythonOk: false,
          pythonInfo: err.message
        })
      } else {
        // Python 3 印到 stdout，舊版印到 stderr，兩者都取。
        const version = (stdout || stderr || '').trim()
        resolve({
          dbPath: cfg.dbPath,
          dbAbsPath,
          dbExists,
          pythonOk: true,
          pythonInfo: version || tMain('main.env.runnable')
        })
      }
    })
  })
}
