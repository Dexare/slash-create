import { SlashCommandOptions } from 'slash-create';

export interface DexareSlashCommandOptions extends Omit<SlashCommandOptions, 'name'> {
  /** The name of the command. */
  name?: string;
}

export interface SyncCommandOptions {
  deleteCommands?: boolean;
  syncGuilds?: boolean;
  skipGuildErrors?: boolean;
  syncPermissions?: boolean;
}
