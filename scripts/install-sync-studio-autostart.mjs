import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launchAgentsDir = path.join(process.env.HOME || "", "Library", "LaunchAgents");
const label = "com.toddacademy.sync-studio";
const plistPath = path.join(launchAgentsDir, `${label}.plist`);
const logDir = path.join(projectRoot, "logs");
const shellCommand = `cd ${JSON.stringify(projectRoot)} && npm run dev:sync`;

if (process.platform !== "darwin") {
  console.error("此安装脚本只支持 macOS。");
  process.exit(1);
}

fs.mkdirSync(launchAgentsDir, { recursive: true });
fs.mkdirSync(logDir, { recursive: true });

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>WorkingDirectory</key><string>${projectRoot}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/zsh</string><string>-lc</string><string>${shellCommand.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${path.join(logDir, "sync-studio.log")}</string>
  <key>StandardErrorPath</key><string>${path.join(logDir, "sync-studio-error.log")}</string>
</dict>
</plist>
`;

fs.writeFileSync(plistPath, plist, "utf8");
const domain = `gui/${process.getuid()}`;
try { execFileSync("launchctl", ["bootout", domain, plistPath], { stdio: "ignore" }); } catch {}
execFileSync("launchctl", ["bootstrap", domain, plistPath], { stdio: "inherit" });
execFileSync("launchctl", ["kickstart", "-k", `${domain}/${label}`], { stdio: "inherit" });
console.log(`已安装并启动：${label}`);
console.log(`本地工作台：http://127.0.0.1:4175/`);
console.log(`日志目录：${logDir}`);
