import type { Command } from 'commander';
import chalk from 'chalk';
import { skills, skillhub, awesomeCopilot, loadConfig } from '@hihi-agent/core';

export function registerSkill(program: Command): void {
  const s = program.command('skill').description('Skill 管理');

  s.command('list').description('已安装 skill').action(() => {
    const list = skills.listLocalSkills();
    for (const sk of list) {
      console.log(`${sk.enabled ? chalk.green('*') : ' '} ${sk.id}\t${sk.name}`);
    }
  });

  s.command('search <keyword>')
    .description('搜索 skill (默认 SkillHub)')
    .option('--source <src>', 'skillhub | awesome-copilot')
    .action(async (keyword: string, opts: { source?: string }) => {
      const source = opts.source || loadConfig().skillSource || 'skillhub';
      if (source === 'awesome-copilot') {
        const r = await awesomeCopilot.search(keyword);
        r.forEach((x) => console.log(`${x.id}\t${x.description.slice(0, 80)}`));
      } else {
        const r = await skillhub.search(keyword);
        if (!r.length) {
          console.log(chalk.yellow('SkillHub 无结果或不可用，可加 --source awesome-copilot'));
        }
        r.forEach((x) => console.log(`${x.id}\t${x.name}\t${x.description}`));
      }
    });

  s.command('add <id>')
    .description('安装 skill')
    .option('--source <src>', 'skillhub | awesome-copilot', 'awesome-copilot')
    .action(async (id: string, opts: { source: string }) => {
      if (opts.source === 'awesome-copilot') {
        const dest = await awesomeCopilot.install(id);
        console.log(chalk.green(`已安装到 ${dest}`));
      } else {
        console.log(chalk.yellow('SkillHub 安装接口尚未实现，请暂用 --source awesome-copilot'));
      }
    });

  s.command('rm <id>').action((id: string) => {
    skills.removeSkill(id);
    console.log(chalk.gray(`已删除 ${id}`));
  });

  s.command('enable <id>').action((id: string) => skills.setSkillEnabled(id, true));
  s.command('disable <id>').action((id: string) => skills.setSkillEnabled(id, false));
}
