import { CommandOptions, DexareClient, DexareCommand } from 'dexare';
import { CommandContext, PartialApplicationCommand, SlashCommandOptions } from 'slash-create';
import { DexareSlashCommandOptions } from './types';

export default class SlashableDexareCommand extends DexareCommand {
  slashOptions: Required<SlashCommandOptions>;

  constructor(client: DexareClient<any>, opts: CommandOptions, slashOpts: DexareSlashCommandOptions) {
    super(client, opts);

    const slashOptions = Object.assign({}, slashOpts) as SlashCommandOptions;
    if (!slashOptions.name) slashOptions.name = opts.name;
    if (slashOpts.guildIDs)
      slashOptions.guildIDs =
        typeof slashOpts.guildIDs == 'string' ? [slashOpts.guildIDs] : slashOpts.guildIDs;
    else slashOpts.guildIDs = [];
    slashOptions.unknown = slashOpts.unknown || false;
    slashOptions.deferEphemeral = slashOpts.deferEphemeral || false;
    slashOptions.defaultPermission =
      typeof slashOpts.defaultPermission === 'boolean' ? slashOpts.defaultPermission : true;

    this.slashOptions = slashOptions as Required<SlashCommandOptions>;

    this.filePath = __filename;
  }

  get slashKeyName() {
    const prefix = this.slashOptions.guildIDs ? (this.slashOptions.guildIDs as string[]).join(',') : 'global';
    return `${prefix}:${this.slashOptions.name}`;
  }

  async slashRun(ctx: CommandContext): Promise<any> { // eslint-disable-line @typescript-eslint/no-unused-vars, prettier/prettier
    throw new Error(`${this.constructor.name} doesn't have a run() method.`);
  }

  slashOnError(err: Error, ctx: CommandContext): any {
    if (!ctx.expired && !ctx.initiallyResponded)
      return ctx.send('An error occurred while running the command.', { ephemeral: true });
  }

  slashFinalize(response: any, ctx: CommandContext): any {
    if (!response && !ctx.initiallyResponded) return;

    if (
      typeof response === 'string' ||
      (response && response.constructor && response.constructor.name === 'Object')
    )
      return ctx.send(response);
  }

  get slashCommandJSON(): PartialApplicationCommand {
    return {
      name: this.slashOptions.name,
      description: this.slashOptions.description,
      default_permission: this.slashOptions.defaultPermission,
      ...(this.slashOptions.options ? { options: this.slashOptions.options } : {})
    };
  }
}
