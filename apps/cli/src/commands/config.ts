import type { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { loadConfig, updateConfig } from '@hihi-agent/core';

export function registerConfig(program: Command): void {
  const cfg = program.command('config').description('配置管理');

  cfg
    .command('show')
    .description('打印当前配置')
    .action(() => {
      console.log(JSON.stringify(loadConfig(), null, 2));
    });

  cfg
    .command('set-provider')
    .description('交互式添加 / 更新模型')
    .action(async () => {
      const answers = await prompts([
        { type: 'text', name: 'id', message: '模型 id (例如 deepseek-chat)' },
        {
          type: 'select',
          name: 'provider',
          message: 'provider 类型',
          choices: [
            { title: 'openai-compat (DeepSeek/Qwen/Ollama)', value: 'openai-compat' },
            { title: 'openai', value: 'openai' },
            { title: 'github-copilot (登录态)', value: 'github-copilot' },
          ],
        },
        { type: (prev) => (prev === 'github-copilot' ? null : 'text'), name: 'baseURL', message: 'baseURL' },
        { type: (_, v) => (v.provider === 'github-copilot' ? null : 'password'), name: 'apiKey', message: 'apiKey' },
      ]);
      if (!answers.id) return;
      updateConfig((c) => {
        const idx = c.models.findIndex((m) => m.id === answers.id);
        const entry = {
          id: answers.id,
          provider: answers.provider,
          baseURL: answers.baseURL,
          apiKey: answers.apiKey,
        };
        if (idx >= 0) c.models[idx] = entry;
        else c.models.push(entry);
        if (!c.currentModel) c.currentModel = answers.id;
      });
      console.log(chalk.green(`已保存模型 ${answers.id}`));
    });

  cfg
    .command('use-model <id>')
    .description('设置默认模型')
    .action((id: string) => {
      const c = updateConfig((cc) => {
        if (!cc.models.find((m) => m.id === id)) {
          throw new Error(`未找到模型 ${id}`);
        }
        cc.currentModel = id;
      });
      console.log(chalk.green(`当前模型 -> ${c.currentModel}`));
    });

  cfg
    .command('list-models')
    .description('列出已配置模型')
    .action(() => {
      const c = loadConfig();
      if (!c.models.length) {
        console.log('（无）使用 `hihi config set-provider` 添加');
        return;
      }
      for (const m of c.models) {
        const mark = m.id === c.currentModel ? chalk.green('*') : ' ';
        console.log(`${mark} ${m.id}\t${m.provider}\t${m.baseURL || ''}`);
      }
    });

  cfg
    .command('rm-model <id>')
    .description('删除模型')
    .action((id: string) => {
      updateConfig((c) => {
        c.models = c.models.filter((m) => m.id !== id);
        if (c.currentModel === id) c.currentModel = c.models[0]?.id;
      });
      console.log(chalk.gray(`已删除 ${id}`));
    });
}
