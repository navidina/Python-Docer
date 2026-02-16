
import React, { useState } from 'react';
import { Copy, Check, Terminal, Code2 } from 'lucide-react';

const CliCodeViewer: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState(false);
  const [copiedPackage, setCopiedPackage] = useState(false);

  const packageJsonContent = `{
  "name": "rayan-docs-cli",
  "version": "1.0.0",
  "description": "Auto-generate documentation using local Ollama (Rayan HamAfza)",
  "main": "index.js",
  "type": "module",
  "bin": {
    "rayandocs": "./index.js"
  },
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "ollama": "^0.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`;

  const part1 = `#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import ollama from 'ollama';

// --- Configuration ---
const CONFIG = {
  model: 'qwen2.5-coder:14b', // پیش‌فرض: بهترین مدل برای کد
  ignoredDirs: new Set([
    'node_modules', '.git', '.vscode', 'dist', 'build', 'coverage', '.next', 'target',
    'venv', '.venv', 'env', '.env', '__pycache__', 'Lib', 'site-packages', 'Scripts', 'Include'
  ]),
  ignoredExts: new Set(['.png', '.jpg', '.jpeg', '.lock', '.exe', '.bin', '.gz', '.zip', '.pdf']),
  configFiles: new Set([
    'package.json', 'tsconfig.json', 'Dockerfile', 'requirements.txt', 
    'Cargo.toml', 'go.mod', 'README.md', 'Makefile'
  ]),
  maxFileSize: 20000 // characters
};

// --- System Prompts (Table-Based Structure) ---
const PROMPTS = {
  global: \`شما یک معمار نرم‌افزار ارشد هستید.
وظیفه: تحلیل جامع پروژه.
قوانین: اصطلاحات فنی انگلیسی بمانند. خروجی مارک‌داون باشد.

ساختار خروجی:
1. **مقدمه جامع (Executive Summary):** توضیحات کامل درباره هدف پروژه.
2. **جدول استک فنی (Tech Stack Table):**
   | دسته | تکنولوژی | توضیحات |
   | --- | --- | --- |
3. **تحلیل ساختار:** بررسی معماری پوشه‌ها.\`,

  code: \`شما یک Senior Developer هستید.
وظیفه: مستندسازی فایل کد.
قوانین: نام‌های خاص انگلیسی بمانند.

ساختار خروجی:
1. **هدف:** پاراگراف توضیحی.
2. **جدول اجزا (Components Table):**
   | نام (انگلیسی) | عملکرد (فارسی) | نوع/ورودی (انگلیسی) |
   | --- | --- | --- |
3. **تحلیل منطق:** توضیحات تکمیلی.\`
};

// --- Helper: Scan Directory ---
async function scanDirectory(dir, rootDir = dir) {
  let fileTree = '';
  let sourceFiles = [];
  let configContents = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (CONFIG.ignoredDirs.has(entry.name)) continue;
      fileTree += \`DIR: \${relativePath}\\n\`;
      const result = await scanDirectory(fullPath, rootDir);
      fileTree += result.fileTree;
      sourceFiles.push(...result.sourceFiles);
      configContents.push(...result.configContents);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONFIG.ignoredExts.has(ext)) continue;

      fileTree += \`FILE: \${relativePath}\\n\`;

      if (CONFIG.configFiles.has(entry.name)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          configContents.push(\`--- \${relativePath} ---\\n\${content}\\n\`);
        } catch (e) { console.warn(\`Skipped reading config \${relativePath}: \${e.message}\`); }
      } else {
        sourceFiles.push(fullPath);
      }
    }
  }

  return { fileTree, sourceFiles, configContents };
}

// --- Helper: LLM Interaction ---
async function queryLLM(prompt, system) {
  try {
    const response = await ollama.chat({
      model: CONFIG.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
    });
    return response.message.content;
  } catch (error) {
    console.error(\`❌ LLM Error: \${error.message}\`);
    return "> **خطا در تولید مستندات برای این بخش.**";
  }
}

// --- Main Execution ---
async function main() {
  const repoPath = process.argv[2] || process.cwd();
  const absPath = path.resolve(repoPath);

  console.log(\`🚀 شروع رایان‌داکس روی مسیر: \${absPath}\`);
  console.log(\`🤖 استفاده از مدل: \${CONFIG.model}\`);

  try {
    // Phase 0: Scan
    console.log('\\n📂 در حال اسکن فایل‌های پروژه...');
    const { fileTree, sourceFiles, configContents } = await scanDirectory(absPath);
    console.log(\`✅ تعداد \${sourceFiles.length} فایل کد و \${configContents.length} فایل کانفیگ پیدا شد.\`);

    let finalDoc = \`# مستندات جامع پروژه\\n\\nتولید شده برای مسیر: \${absPath}\\n\\n\`;

    // Phase 1: Architecture
    console.log('\\n🧠 فاز ۱: تحلیل معماری و تکنولوژی‌ها...');
    
    // Read source content for better context (Prevents hallucinations)
    const sourceContextPromises = sourceFiles.map(async (f) => {
      try {
        const stats = await fs.stat(f);
        if (stats.size > CONFIG.maxFileSize) return '';
        const content = await fs.readFile(f, 'utf-8');
        return \`\\n--- SOURCE FILE: \${path.relative(absPath, f)} ---\\n\${content}\`;
      } catch (e) { return ''; }
    });
    const fullSourceContext = (await Promise.all(sourceContextPromises)).join('\\n');

    const globalPrompt = \`File Tree:\\n\${fileTree}\\n\\nConfig Files:\\n\${configContents.join('')}\\n\\nSource Code Content:\\n\${fullSourceContext}\`;
    
    const archDoc = await queryLLM(globalPrompt, PROMPTS.global);
    finalDoc += \`## نمای کلی معماری\\n\\n\${archDoc}\\n\\n---\\n\\n## تحلیل فایل‌ها\\n\\n\`;
    console.log('✅ تحلیل معماری انجام شد.');

    // Phase 2: File Analysis
    console.log(\`\\n📝 فاز ۲: پردازش \${sourceFiles.length} فایل...\`);
    
    for (const filePath of sourceFiles) {
      const relPath = path.relative(absPath, filePath);
      process.stdout.write(\`   در حال پردازش: \${relPath} ... \`);

      try {
        const stats = await fs.stat(filePath);
        if (stats.size > CONFIG.maxFileSize) {
          console.log('⚠️ رد شد (حجم زیاد)');
          finalDoc += \`### \${relPath}\\n\\n*Skipped: File too large (>20KB)*\\n\\n\`;
          continue;
        }

        const content = await fs.readFile(filePath, 'utf-8');`;

  const part2 = `
        const filePrompt = \`File: \${relPath}\\n\\nCode:\\n\`\`\`\\n\${content}\\n\`\`\`\`;
        const analysis = await queryLLM(filePrompt, PROMPTS.code);
        
        finalDoc += \`### \${relPath}\\n\\n\${analysis}\\n\\n\`;
        console.log('✅');
      } catch (err) {
        console.log('❌ خطا');
      }
    }

    // Phase 3: Save
    const outputPath = path.join(process.cwd(), 'DOCUMENTATION.md');
    await fs.writeFile(outputPath, finalDoc);
    console.log(\`\\n🎉 مستندات با موفقیت ذخیره شد در: \${outputPath}\`);

  } catch (error) {
    console.error('🔥 خطای بحرانی:', error);
    process.exit(1);
  }
}

main();`;

  const indexJsContent = part1 + part2;

  const copyToClipboard = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const CodeCard = ({ title, lang, content, copied, setCopied }: any) => (
    <div className="bg-[#0f172a] rounded-[2.5rem] overflow-hidden border border-slate-700 shadow-2xl relative group ring-4 ring-slate-900/5 transition-all hover:scale-[1.01]">
        {/* Glow Effect */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-brand-500/10 blur-[80px] rounded-full pointer-events-none"></div>
        
        {/* Glass Header */}
        <div className="bg-slate-900/80 backdrop-blur-md px-6 py-4 flex justify-between items-center border-b border-white/5 relative z-10">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl border border-white/10 ${lang === 'JSON' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    <Code2 className="w-5 h-5" />
                </div>
                <div>
                    <span className="text-sm font-bold text-white tracking-wide block">{title}</span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">{lang} FILE</span>
                </div>
            </div>
            <button 
                onClick={() => copyToClipboard(content, setCopied)}
                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all border border-white/5"
            >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>

        {/* Code Content */}
        <div className="relative">
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0f172a]/50 to-transparent pointer-events-none"></div>
            <pre className="bg-[#0b1120] p-6 overflow-x-auto text-sm font-mono text-slate-300 h-[24rem] text-left dir-ltr custom-scrollbar leading-relaxed">
                {content}
            </pre>
        </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      <CodeCard 
        title="package.json" 
        lang="JSON" 
        content={packageJsonContent} 
        copied={copiedPackage} 
        setCopied={setCopiedPackage} 
      />

      <CodeCard 
        title="index.js" 
        lang="JAVASCRIPT" 
        content={indexJsContent} 
        copied={copiedIndex} 
        setCopied={setCopiedIndex} 
      />

      {/* Instruction Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-900/20 relative overflow-hidden border border-slate-700/50">
        {/* Abstract circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-500/10 blur-[80px] rounded-full"></div>
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
           <div className="bg-brand-500/20 p-3 rounded-2xl border border-brand-500/30 text-brand-300 shadow-glow"><Terminal className="w-6 h-6" /></div>
           <div>
               <h4 className="font-bold text-xl">راهنمای سریع اجرا (CLI Mode)</h4>
               <p className="text-xs text-slate-400 mt-1">اجرای اسکریپت بدون نیاز به مرورگر</p>
           </div>
        </div>
        
        <ul className="space-y-5 relative z-10">
          {[
            'یک پوشه جدید بسازید و فایل‌های بالا را در آن ذخیره کنید.',
            'دستور npm install را اجرا کنید تا وابستگی‌ها نصب شوند.',
            'مطمئن شوید سرویس Ollama در پس‌زمینه در حال اجراست.',
            'مدل مورد نظر (مثلاً qwen2.5-coder) را پول (pull) کنید.',
            'با دستور node index.js مسیر پروژه خود را تحلیل کنید.'
          ].map((item, i) => (
             <li key={i} className="flex items-start gap-4 text-slate-300 text-sm group">
                <span className="bg-white/5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 shrink-0 border border-white/5 group-hover:bg-brand-500 group-hover:text-white transition-colors">{i+1}</span>
                <span className="leading-relaxed group-hover:text-white transition-colors">{item}</span>
             </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CliCodeViewer;
