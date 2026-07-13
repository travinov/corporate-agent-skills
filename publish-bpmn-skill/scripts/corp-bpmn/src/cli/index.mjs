#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from '../commands/init.mjs';
import { generateCommand } from '../commands/generate.mjs';
import { layoutCommand } from '../commands/layout.mjs';
import { validateCommand } from '../commands/validate.mjs';
import { buildCommand } from '../commands/build.mjs';
import { migrateCommand } from '../commands/migrate.mjs';
import { selfCheckCommand } from '../commands/self-check.mjs';

const program = new Command();

program
  .name('corp-bpmn')
  .description('Local BPMN 2.0 generation, layout, validation, and documentation toolchain')
  .version('0.3.0');

program.command('init')
  .argument('<dir>', 'process directory to initialize')
  .option('--schema-version <version>', 'starter schema version (1 or 2)', '1')
  .description('create starter process.yaml and process.md')
  .action((dir, options) => initCommand(dir, options));

program.command('generate')
  .argument('<yaml>', 'process.yaml path')
  .requiredOption('-o, --out <file>', 'output BPMN file')
  .description('generate BPMN XML from process.yaml')
  .action((yamlPath, options) => generateCommand(yamlPath, options));

program.command('layout')
  .argument('<bpmn>', 'BPMN file path')
  .option('-o, --out <file>', 'output BPMN file')
  .description('add BPMN DI layout to a BPMN XML file')
  .action((bpmnPath, options) => layoutCommand(bpmnPath, options));

program.command('validate')
  .argument('<bpmn>', 'BPMN file path')
  .option('--yaml <file>', 'source process.yaml path')
  .option('-o, --out <file>', 'validation report JSON output path')
  .option('--strict', 'treat warnings as build failures')
  .description('validate BPMN XML and optional source process.yaml')
  .action((bpmnPath, options) => validateCommand(bpmnPath, options));

program.command('build')
  .argument('<yaml>', 'process.yaml path')
  .option('--strict', 'treat warnings as build failures')
  .description('generate, layout, validate, and document a BPMN process')
  .action((yamlPath, options) => buildCommand(yamlPath, options));

program.command('migrate')
  .argument('<yaml>', 'source process.yaml path')
  .requiredOption('--to-version <version>', 'target schema version')
  .requiredOption('-o, --out <file>', 'new migrated YAML file; source is never overwritten')
  .description('validate and migrate an unambiguous v1 model to v2')
  .action((yamlPath, options) => migrateCommand(yamlPath, options));

program.command('self-check')
  .description('compile shipped schemas and verify the capability matrix and required files')
  .action(selfCheckCommand);

program.parseAsync(process.argv).catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(error.exitCode || 6);
});
