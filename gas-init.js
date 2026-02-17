/**
 * GAS 高階執行顧問 (SOP 6.1) - Professional Edition
 * 功能：環境預檢、動態模板載入、專案初始化、直通式規則注入、專案稽核、自訂規則管理
 * 
 * 升級自 SOP 6.0：
 *   - 模板抽離至 templates/*.md（內建 fallback 保底）
 *   - 環境預檢：clasp / git 分開偵測，精準報錯
 *   - 路徑歸位：建立專案後不再強制退出，可回到主選單
 * 
 *   @author  dawish39
 *   @github  https://github.com/dawish39/gas-guard
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// --- [全域配置] ---
const TEMPLATE_DIR = path.join(__dirname, 'templates');
const CUSTOM_RULES_FILENAME = 'my-rules.md';

// --- [核心資產] 內建模板 (Fallback：當 templates/ 不存在時使用) ---
const BUILTIN_TEMPLATES = {
    hybrid: {
        id: 'hybrid',
        name: "⚖️  全能混合模式 (Hybrid - 推薦)",
        content: `# GAS 高階執行顧問協定 (Hybrid Protocol v5.0)

## 1. 核心原則：成本與架構並重
- **成本意識 (Cost Discipline)：** 預設使用 **Gemini 1.5 Flash**。嚴禁讀取 \`package-lock.json\` 或 \`*.log\`。
- **思考夥伴 (Thinking Partner)：** 你不是單純的執行者，而是架構顧問。若需求有邏輯漏洞或維運風險，必須在「階段一」提出挑戰。

## 2. 強制性兩階段作業 (Two-Phase Protocol)
### 階段一：對焦與規劃 (Phase 1: Plan)
在產出 Code 之前，提交一份簡短報告：
1. **需求本質：** 你理解的核心目標。
2. **顧問式挑戰：** 指出潛在風險 (Race Condition, Quota) 並提出替代方案。
3. **執行藍圖：** 預計修改哪些檔案？
4. **暫停點：** 等待用戶回覆「Go」。

### 階段二：執行與交付 (Phase 2: Execute)
- 獲得授權後，精準執行。
- 交付後主動建議下一步 (Next Step)。

## 3. GAS 技術邊界
- **物理隔離：** 源碼存放於 \`src/\`。
- **環境保護：** 嚴禁使用 \`require\` (除非測試)，僅限原生 V8。
- **批次原則：** 禁止迴圈內讀寫 Spreadsheet。
`
    },
    architect: {
        id: 'architect',
        name: "🧠 高階架構顧問 (Architect - 嚴格版)",
        content: `# GAS 高階執行顧問暨思考夥伴協定 (Executive Protocol)

## 1. 定位與角色：思考夥伴 (Thinking Partner)
- **非單純執行者：** 你是負責架構決策與邏輯驗證的顧問。嚴禁在未經思考的情況下直接轉譯用戶指令。
- **架構優於代碼：** 你的核心價值是「預測問題」而非「解決語法」。
- **建設性冒犯：** 如果用戶需求會導致維運困難，你必須在「階段一」直接提出挑戰。

## 2. 強制性兩階段作業 (Two-Phase Protocol)
### 階段一：對焦與規劃 (Phase 1: Plan)
1. **需求本質重述**
2. **顧問式挑戰 (Mandatory Challenge)：** 找出邏輯漏洞或執行風險。
3. **執行藍圖**
4. **互動確認：** 暫停並等待用戶回覆「Go/可以」。

### 階段二：執行與交付
- 獲得授權後才開始產出代碼。

## 3. GAS 技術邊界與行為慣例
- **物理隔離：** 源碼必須嚴格存放於 \`src/\`。
- **機密不落地：** 嚴禁硬編碼。
- **批次處理原則：** 禁止在迴圈內頻繁讀寫 Spreadsheet。

## 4. 溝通風格
- 精準、冷靜、精練。
- 刪除「好的、沒問題」等贅詞，直接從邏輯辯證開始。
`
    },
    cost_saver: {
        id: 'cost_saver',
        name: "💰 成本極簡模式 (Cost Saver - 省錢版)",
        content: `# GAS 成本控管協定 (Cost Protocol v4.0)

## 1. 絕對指令：省錢優先
你的運作消耗使用者的付費額度。你必須遵守以下「止血」原則：
- **模型強制：** 除非使用者明確要求，否則**必須**使用 **Gemini 1.5 Flash**。
- **Token 節流：** - 嚴禁讀取 \`package-lock.json\` 或 \`*.log\`。
    - 禁止使用 \`ls -R\` 或讀取超過 2 個非相關檔案。
    - 執行測試或指令時，必須加上 \`--silent\`。

## 2. 作業流程
- 直接給出 Code Diff，不要重寫整支檔案。
- 不要解釋太多原理，直接給修復方案。
`
    }
};

// --- [全域狀態] 目前選用的規則 ---
let ACTIVE_RULES = {
    sourceType: 'template',
    name: BUILTIN_TEMPLATES.hybrid.name,
    content: BUILTIN_TEMPLATES.hybrid.content
};

// --- [UI 工具模組] ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(r => rl.question(q, r));

function pad(str, len) {
    let realLen = 0;
    for (let i = 0; i < str.length; i++) realLen += (str.charCodeAt(i) > 255 ? 2 : 1);
    const padding = len - realLen;
    return str + ' '.repeat(padding > 0 ? padding : 0);
}

// --- [環境預檢] ---
function checkPreflight() {
    console.log('🔍 正在檢查開發環境...');
    let pass = true;

    try {
        const gitVer = execSync('git --version', { encoding: 'utf8' }).trim();
        console.log(`   ✅ ${gitVer}`);
    } catch (e) {
        console.error('   ❌ git 未安裝。請至 https://git-scm.com 安裝');
        pass = false;
    }

    // clasp 不檢查全域安裝，因為它是 per-project devDependency，透過 npx 執行
    console.log(`   ℹ️  clasp 將在建立專案時自動安裝為 devDependency`);

    if (pass) console.log('');
    return pass;
}

// --- [模板載入] ---
// 優先從 templates/ 資料夾讀取外部 .md 檔案，若資料夾不存在或為空則使用內建模板
function loadTemplates() {
    const external = [];

    if (fs.existsSync(TEMPLATE_DIR)) {
        const files = fs.readdirSync(TEMPLATE_DIR).filter(f => f.endsWith('.md'));
        files.forEach(f => {
            const id = f.replace('.md', '');
            const content = fs.readFileSync(path.join(TEMPLATE_DIR, f), 'utf8');
            // 嘗試從第一行 # 標題讀取顯示名稱
            const firstLine = content.split('\n').find(l => l.startsWith('# '));
            const displayName = firstLine ? firstLine.replace('# ', '').trim() : id;
            external.push({
                id: id,
                name: `📂 ${displayName}`,
                content: content,
                source: 'external'
            });
        });
    }

    if (external.length > 0) {
        console.log(`📂 已從 templates/ 載入 ${external.length} 個外部模板`);
        return external;
    }

    // Fallback: 使用內建模板
    console.log('📦 使用內建模板（如需自訂，請建立 templates/ 資料夾）');
    return Object.values(BUILTIN_TEMPLATES).map(t => ({ ...t, source: 'builtin' }));
}

// --- [核心功能模組] ---

// 1. 設定管理：切換規則來源（整合內建/外部模板 + 自訂檔案）
async function switchRuleSource(templates) {
    console.log('\n🎛️  設定 AI 規則來源 (Rule Source Selection)');
    console.log('----------------------------------------------------');

    // 動態列出所有可用模板
    templates.forEach((t, i) => {
        const marker = (ACTIVE_RULES.name === t.name) ? ' ← 目前' : '';
        console.log(`[${i + 1}] ${t.name}${marker}`);
    });

    const customIdx = templates.length + 1;
    const exportIdx = templates.length + 2;
    console.log(`[${customIdx}] 📂 讀取外部檔案 (${CUSTOM_RULES_FILENAME})`);
    console.log(`[${exportIdx}] 💾 將當前模板匯出至 ${CUSTOM_RULES_FILENAME} (以供編輯)`);
    console.log('----------------------------------------------------');

    const choice = await question('❓ 請選擇編號: ');
    const idx = parseInt(choice);

    // 選擇模板
    if (idx >= 1 && idx <= templates.length) {
        const selected = templates[idx - 1];
        ACTIVE_RULES = {
            sourceType: selected.source === 'builtin' ? 'template' : 'external',
            name: selected.name,
            content: selected.content
        };
        console.log(`✅ 已切換來源為：${ACTIVE_RULES.name}`);
    }
    // 讀取自訂檔案
    else if (idx === customIdx) {
        const filePath = path.join(__dirname, CUSTOM_RULES_FILENAME);
        if (fs.existsSync(filePath)) {
            ACTIVE_RULES = {
                sourceType: 'file',
                name: `外部檔案 (${CUSTOM_RULES_FILENAME})`,
                content: fs.readFileSync(filePath, 'utf8')
            };
            console.log(`✅ 已切換來源為：${ACTIVE_RULES.name}`);
        } else {
            console.log(`❌ 找不到 ${CUSTOM_RULES_FILENAME}，請先選擇 [${exportIdx}] 匯出模板或自行建立。`);
        }
    }
    // 匯出模板
    else if (idx === exportIdx) {
        const filePath = path.join(__dirname, CUSTOM_RULES_FILENAME);
        fs.writeFileSync(filePath, ACTIVE_RULES.content);
        console.log(`✅ 已將「${ACTIVE_RULES.name}」內容寫入 ${CUSTOM_RULES_FILENAME}。`);
        console.log('💡 您現在可以編輯該 Markdown 檔，然後選擇載入它。');
    }
    else {
        console.log('❌ 無效的選擇。');
    }

    await question('\n⌨️  按 Enter 返回主選單...');
}

// 2. Gitignore 補強
function smartUpdateGitignore(targetDir) {
    const ignoreFile = path.join(targetDir, '.gitignore');
    const essentialIgnores = [
        'node_modules/', '.clasp.json', 'creds.json', '.DS_Store', 'dist/',
        '*.log', 'package-lock.json', '.clinerules', '.cursorrules', CUSTOM_RULES_FILENAME
    ];
    let currentContent = '';
    if (fs.existsSync(ignoreFile)) currentContent = fs.readFileSync(ignoreFile, 'utf8');

    // 確保現有內容以換行結尾，避免追加時黏在上一行
    if (currentContent.length > 0 && !currentContent.endsWith('\n')) {
        fs.appendFileSync(ignoreFile, '\n');
        currentContent += '\n';
    }

    const lines = new Set(currentContent.split('\n').map(l => l.trim()));
    let added = [];
    essentialIgnores.forEach(item => {
        if (!lines.has(item)) {
            fs.appendFileSync(ignoreFile, `${item}\n`);
            added.push(item);
        }
    });
    return added;
}

// 3. 專案搜尋
function findGasProjects(baseDir) {
    const resolvedBase = path.resolve(baseDir);
    const selfDir = __dirname;
    if (!fs.existsSync(resolvedBase)) return [];

    return fs.readdirSync(resolvedBase, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => path.join(resolvedBase, dirent.name))
        .filter(dirPath => dirPath !== selfDir)
        .filter(dirPath => fs.existsSync(path.join(dirPath, '.clasp.json')));
}

// 4. 執行注入 (使用 ACTIVE_RULES)
function injectGovernance(targetDir) {
    fs.writeFileSync(path.join(targetDir, '.cursorrules'), ACTIVE_RULES.content);
    fs.writeFileSync(path.join(targetDir, '.clinerules'), ACTIVE_RULES.content);
    const addedIgnores = smartUpdateGitignore(targetDir);
    return { path: targetDir, ignoreUpdated: addedIgnores.length > 0 ? addedIgnores.join(', ') : '無須更新' };
}

// 5. 顯示專案規則內容
function displayProjectRules(projPath) {
    const ruleFile = path.join(projPath, '.clinerules');
    console.log(`\n👁️  [${path.basename(projPath)}] 完整規則內容:`);
    console.log('\x1b[36m====================== FILE START ======================\x1b[0m');
    if (fs.existsSync(ruleFile)) {
        console.log(fs.readFileSync(ruleFile, 'utf8'));
    } else {
        console.log('\x1b[31m⚠️  該專案尚未建立 .clinerules 檔案。\x1b[0m');
    }
    console.log('\x1b[36m======================= FILE END =======================\x1b[0m');
}

// 6. 儀表板
async function auditDashboard(scanPath) {
    const projects = findGasProjects(scanPath);
    if (projects.length === 0) { console.log('⚠️ 未發現任何 GAS 專案。'); return; }

    let reportData = projects.map((projPath, index) => {
        const dirName = path.basename(projPath);
        let scriptId = 'Unknown';
        try {
            const clasp = JSON.parse(fs.readFileSync(path.join(projPath, '.clasp.json'), 'utf8'));
            scriptId = clasp.scriptId ? clasp.scriptId.substring(0, 15) + '...' : 'N/A';
        } catch (e) {}
        const hasRules = fs.existsSync(path.join(projPath, '.clinerules'));
        return { index: index + 1, path: projPath, name: dirName, id: scriptId, protected: hasRules };
    });

    let firstRun = true;
    while (true) {
        if (!firstRun) console.log('\n' + '-'.repeat(50) + '\n');

        console.log('\n📊 專案稽核儀表板 (Audit Dashboard)');
        console.log(`📍 掃描路徑: ${path.resolve(scanPath)}`);
        console.log('========================================================================================');
        console.log(pad('No.', 5) + pad('專案名稱 (Project)', 30) + pad('Script ID (Prefix)', 20) + pad('防護狀態', 15));
        console.log('========================================================================================');
        reportData.forEach(d => {
            const status = d.protected ? '\x1b[32m✅ 已啟用\x1b[0m' : '\x1b[31m⚠️ 未防護\x1b[0m';
            console.log(pad(`[${d.index}]`, 5) + pad(d.name, 30) + pad(d.id, 20) + status);
        });
        console.log('========================================================================================');

        firstRun = false;

        const ans = await question(`
💡 指令: 
   [數字] 預覽完整 Prompt (Enter 返回)
   [fix]  一鍵修復所有未防護專案 (使用當前設定的規則)
   [q]    離開
> `);

        const input = ans.trim().toLowerCase();
        if (input === 'q') break;

        if (input === 'fix') {
            const risky = reportData.filter(d => !d.protected);
            if (risky.length === 0) {
                console.log('✨ 無需修復。'); await question('⌨️  按 Enter 返回...'); continue;
            }
            console.log(`\n🛠️ 正在修復 ${risky.length} 個專案...`);
            console.log(`📝 使用規則: ${ACTIVE_RULES.name}`);
            risky.forEach(d => {
                injectGovernance(d.path);
                console.log(`✅ [${d.name}] 注入完成`);
                d.protected = true;
            });
            console.log('🎉 修復完成！');
            await question('⌨️  按 Enter 返回...');
            continue;
        }

        const idx = parseInt(input);
        if (!isNaN(idx) && idx > 0 && idx <= reportData.length) {
            displayProjectRules(reportData[idx - 1].path);
            await question('\n⌨️  (內容已顯示完畢，請按 Enter 鍵重新整理儀表板...)');
        } else {
            console.log('❌ 無效指令');
        }
    }
}

// --- [主程式] ---
async function main() {
    // 環境預檢
    if (!checkPreflight()) {
        console.error('\n⚠️  請先安裝缺少的工具後再執行本程式。');
        process.exit(1);
    }

    // 載入模板
    const templates = loadTemplates();

    // 設定預設規則為第一個模板
    if (templates.length > 0) {
        ACTIVE_RULES = {
            sourceType: templates[0].source === 'builtin' ? 'template' : 'external',
            name: templates[0].name,
            content: templates[0].content
        };
    }

    // 記錄起始路徑（用於建立專案後歸位）
    const originalDir = process.cwd();

    while(true) {
        console.clear();
        console.log('\n🚀 GAS 專案治理工具 | Professional Edition (SOP 6.1)');
        console.log('====================================================');
        console.log(`📝 目前 AI 規則來源: \x1b[33m${ACTIVE_RULES.name}\x1b[0m`);
        console.log('====================================================');

        const mode = await question(`
❓ 請選擇功能:
  [1] 🆕 建立新專案 (New Project)
  [2] 📡 同步雲端專案 (Clone Project)
  [3] 💉 單一專案注入 (Inject Single)
  [4] 🔍 批量掃描並注入 (Batch Inject)
  [5] 🛡️ 專案稽核儀表板 (Audit Dashboard)
  [6] ⚙️ 設定規則來源 / 編輯自訂規則 (Settings)
  [h] ❓ 操作說明 (Help)
  [q] 離開
> `);

        if (mode.toLowerCase() === 'q') {
            console.log('👋 Bye!');
            break;
        }

        // --- Help ---
        if (mode.toLowerCase() === 'h') {
            console.log(`
📖 操作說明 (Help)
====================================================

[1] 建立新專案
    輸入專案名稱後，自動執行：
    npm init → 安裝 clasp → clasp create → 建立 src/ 資料夾
    → 搬移 GAS 檔案至 src/ → 注入 AI 規則 → git init + 首次 commit

[2] 同步雲端專案
    輸入專案名稱和 Script ID 後，自動執行：
    npm init → 安裝 clasp → clasp clone → 建立 src/ 資料夾
    → 搬移 GAS 檔案至 src/ → 注入 AI 規則 → git init + 首次 commit

[3] 單一專案注入
    指定一個資料夾，將目前選定的 AI 規則寫入
    .cursorrules 和 .clinerules，並補強 .gitignore

[4] 批量掃描並注入
    掃描目錄下所有含 .clasp.json 的資料夾（= GAS 專案），
    對每個專案執行注入

[5] 專案稽核儀表板
    列出所有 GAS 專案的防護狀態，支援：
    - 輸入編號預覽該專案的完整規則內容
    - 輸入 fix 一鍵修復所有未防護的專案

[6] 設定規則來源
    切換內建模板（Hybrid / Architect / Cost Saver）、
    載入自訂 .md 檔案、或匯出當前模板以供編輯

💡 提示：
    - AI 規則來源可隨時透過 [6] 切換，切換後的注入都會使用新規則
    - templates/ 資料夾內的 .md 檔案會在啟動時自動載入
    - 所有注入都會同時更新 .gitignore 防止敏感檔案外洩
====================================================`);
            await question('\n⌨️  按 Enter 返回主選單...');
            continue;
        }

        // --- 設定 (Mode 6) ---
        if (mode === '6') {
            await switchRuleSource(templates);
            continue;
        }

        // --- Dashboard (Mode 5) ---
        if (mode === '5') {
            const scope = await question('\n🔍 掃描範圍:\n  [1] 當前目錄 (.)\n  [2] 上一層目錄 (..) \n> ');
            const scanPath = scope === '2' ? '..' : '.';
            await auditDashboard(scanPath);
            await question('⌨️  按 Enter 返回主選單...');
            continue;
        }

        // --- Batch Inject (Mode 4) ---
        if (mode === '4') {
            const scope = await question('\n🔍 掃描範圍:\n  [1] 當前目錄 (.)\n  [2] 上一層目錄 (..) \n> ');
            const scanPath = scope === '2' ? '..' : '.';
            const projects = findGasProjects(scanPath);

            if (projects.length === 0) { console.log('⚠️ 無專案'); }
            else {
                console.log(`📋 發現 ${projects.length} 個專案...`);
                console.log(`📝 準備注入: ${ACTIVE_RULES.name}`);
                const confirm = await question('❓ 確認執行？(y/N): ');
                if (confirm.toLowerCase() === 'y') {
                    projects.forEach(proj => {
                        const res = injectGovernance(proj);
                        console.log(`✅ [${path.basename(res.path)}] 完成`);
                    });
                }
            }
            await question('⌨️  按 Enter 返回主選單...');
            continue;
        }

        // --- Single Inject (Mode 3) ---
        if (mode === '3') {
            let targetDir = await question('❓ 目標資料夾 (預設 .): ');
            targetDir = targetDir.trim() || '.';
            if (!fs.existsSync(targetDir)) {
                console.error('❌ 資料夾不存在');
            } else {
                const res = injectGovernance(targetDir);
                console.log(`✅ 注入完成 | Gitignore: ${res.ignoreUpdated}`);
            }
            await question('⌨️  按 Enter 返回主選單...');
            continue;
        }

        // --- New Project / Clone (Mode 1 & 2) ---
        if (mode === '1' || mode === '2') {
            const projectName = await question('❓ 新專案名稱: ');
            if (!projectName || fs.existsSync(projectName)) {
                console.error('❌ 名稱無效或已存在');
                await question('⌨️  按 Enter 返回...');
                continue;
            }

            console.log(`\n📂 建立: ${projectName}...`);
            fs.mkdirSync(projectName);
            process.chdir(projectName);

            try {
                execSync('npm init -y', { stdio: 'ignore' });
                execSync('npm install @google/clasp -D', { stdio: 'inherit' });

                if (mode === '2') {
                    const scriptId = await question('❓ Script ID: ');
                    execSync(`npx clasp clone "${scriptId}"`, { stdio: 'inherit' });
                } else {
                    execSync(`npx clasp create --title "${projectName}" --type sheets`, { stdio: 'inherit' });
                }

                // 源碼隔離：建立 src/ 並搬移 GAS 檔案
                if (!fs.existsSync('src')) fs.mkdirSync('src');
                const systemFiles = new Set([
                    'node_modules', 'src', 'package.json', 'package-lock.json',
                    '.clasp.json', '.gitignore', '.git', '.DS_Store',
                    'gas-init.js', CUSTOM_RULES_FILENAME
                ]);
                fs.readdirSync('.').filter(f => !systemFiles.has(f)).forEach(f => {
                    try { fs.renameSync(f, path.join('src', f)); } catch(e){}
                });

                // 更新 .clasp.json rootDir
                if (fs.existsSync('.clasp.json')) {
                    const conf = JSON.parse(fs.readFileSync('.clasp.json'));
                    conf.rootDir = "./src";
                    fs.writeFileSync('.clasp.json', JSON.stringify(conf, null, 2));
                }

                // 注入治理規則
                injectGovernance('.');

                // Git 初始化
                try {
                    execSync('git init', { stdio: 'ignore' });
                    execSync('git add .', { stdio: 'inherit' });
                    execSync('git commit -m "Init by GAS-SOP-6.1"', { stdio: 'inherit' });
                } catch (e) {}

                console.log('\n✅ 專案建立完成！');
            } catch (e) {
                console.error('❌ 專案建立過程出錯:', e.message);
            }

            // 路徑歸位（不再強制退出程式）
            process.chdir(originalDir);
            await question('⌨️  按 Enter 返回主選單...');
            continue;
        }
    }

    rl.close();
}

main();
