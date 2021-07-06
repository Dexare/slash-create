import { DexareModule, DexareClient, BaseConfig, DexareCommand } from 'dexare';
import {
  CommandContext,
  GatewayServer,
  InteractionRequestData,
  InteractionResponseFlags,
  InteractionResponseType,
  SlashCreator
} from 'slash-create';
import Collection from '@discordjs/collection';
import uniq from 'lodash.uniq';
import SlashableDexareCommand from './command';
import { SyncCommandOptions } from './types';
import { RespondFunction } from 'slash-create/lib/server';
import { oneLine } from 'slash-create/lib/util';

export interface SlashCreateConfig extends BaseConfig {
  slashCreate: SlashCreateModuleOptions;
}

export interface SlashCreateModuleOptions {
  applicationID: string;
  token?: string;

  publicKey?: string;
  endpointPath?: string;
  serverPort?: number;
  serverHost?: string;
  maxSignatureTimestamp?: number;

  unknownCommandResponse?: boolean;
}

export { SlashableDexareCommand };

export default class SlashCreateModule<T extends DexareClient<any>> extends DexareModule<T> {
  creator: SlashCreator;

  constructor(client: T) {
    super(client, {
      name: 'slash-create',
      description: 'Slash command manager using slash-create',
      requires: ['commands']
    });

    const options = this.client.config.slashCreate;

    options.handleCommandsManually = true;
    options.allowedMentions = this.client.bot.options.allowedMentions;
    options.defaultImageFormat = this.client.bot.options.defaultImageFormat;
    options.defaultImageSize = this.client.bot.options.defaultImageSize;
    options.ratelimiterOffset =
      this.client.bot.options.rest?.ratelimiterOffset || this.client.bot.options.ratelimiterOffset;
    options.latencyThreshold =
      this.client.bot.options.rest?.latencyThreshold || this.client.bot.options.latencyThreshold;
    options.requestTimeout =
      this.client.bot.options.rest?.requestTimeout || this.client.bot.options.requestTimeout;
    options.agent = this.client.bot.options.rest?.agent || this.client.bot.options.agent;
    if (!options.token) options.token = (this.client.bot as any)._token || this.client.config.token;

    this.creator = new SlashCreator(options);
    this.filePath = __filename;
  }

  load() {
    this.creator.on('warn', (warning) => this.logger.warn(warning));
    this.creator.on('debug', (message) => this.logger.debug(message));
    this.creator.on('error', (err) => this.logger.error(err));
    this.creator.on('commandInteraction', this.onCommand.bind(this));

    this.creator.withServer(
      new GatewayServer((handler) =>
        this.registerEvent('rawWS', (event, packet) => {
          if (packet.t === 'INTERACTION_CREATE') handler(packet.d as any);
          event.set('slash-create/passed', true);
        })
      )
    );
  }

  unload() {
    this.unregisterAllEvents();
    this.creator.removeAllListeners();
    delete this.creator.server;
  }

  async onCommand(interaction: InteractionRequestData, respond: RespondFunction, webserverMode: boolean) {
    const command = this.getCommandFromInteraction(interaction);

    if (!command) {
      this.logger.debug(
        `Unknown command: ${interaction.data.name} (${interaction.data.id}, ${
          'guild_id' in interaction ? `guild ${interaction.guild_id}` : `user ${interaction.user.id}`
        })`
      );
      if (this.creator.options.unknownCommandResponse)
        return respond({
          status: 200,
          body: {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: oneLine`
                This command no longer exists.
                This command should no longer show up in an hour if it has been deleted.
              `,
              flags: InteractionResponseFlags.EPHEMERAL
            }
          }
        });
      else
        return respond({
          status: 400
        });
    } else {
      const ctx = new CommandContext(
        this.creator,
        interaction,
        respond,
        webserverMode,
        command.slashOptions.deferEphemeral
      );

      try {
        this.logger.debug(
          `Running command: ${ctx.data.data.name} (${ctx.data.data.id}, ${
            'guild_id' in ctx.data ? `guild ${ctx.data.guild_id}` : `user ${ctx.data.user.id}`
          })`
        );
        const promise = command.slashRun(ctx);
        const retVal = await promise;
        if (retVal) return command.slashFinalize(retVal, ctx);
      } catch (err) {
        try {
          return command.slashOnError(err, ctx);
        } catch (secondErr) {
          return this.logger.error(secondErr);
        }
      }
    }
  }

  /**
   * Sync guild commands.
   * @param guildID The guild to sync
   * @param deleteCommands Whether to delete command not found in the creator
   */
  async sync(opts?: SyncCommandOptions) {
    this.syncMockCommands();

    const options = Object.assign(
      {
        deleteCommands: true,
        syncGuilds: true,
        skipGuildErrors: true,
        syncPermissions: true
      },
      opts
    ) as SyncCommandOptions;

    let guildIDs: string[] = [];

    // Collect guild IDs with specific commands
    for (const [, command] of this.creator.commands) {
      if (command.guildIDs) guildIDs = uniq([...guildIDs, ...command.guildIDs]);
    }

    await this.creator.syncGlobalCommands(options.deleteCommands);
    this.logger.debug('Synced global commands');

    for (const guildID of guildIDs) {
      try {
        await this.creator.syncCommandsIn(guildID, options.deleteCommands);
        this.logger.debug(`Synced guild commands in ${guildID}`);
      } catch (e) {
        if (options.skipGuildErrors) {
          this.logger.warn(
            `An error occurred during guild sync (${guildID}), you may no longer have access to that guild.`
          );
        } else {
          throw e;
        }
      }
    }

    if (options.syncPermissions)
      try {
        await this.creator.syncCommandPermissions();
      } catch (e) {
        this.logger.error(e);
      }
  }

  /**
   * Sync global commands.
   * @param deleteCommands Whether to delete command not found in the creator
   */
  syncGlobal(deleteCommands = true) {
    this.syncMockCommands();
    return this.creator.syncGlobalCommands(deleteCommands);
  }

  /**
   * Sync guild commands.
   * @param guildID The guild to sync
   * @param deleteCommands Whether to delete command not found in the creator
   */
  syncGuild(guildID: string, deleteCommands = true) {
    this.syncMockCommands();
    return this.creator.syncCommandsIn(guildID, deleteCommands);
  }

  getSlashableCommands(): Collection<string, SlashableDexareCommand> {
    return this.client.commands.commands.filter((command: DexareCommand) => {
      const slashCommand = command as unknown as SlashableDexareCommand;
      return (
        !!slashCommand.slashOptions &&
        !!slashCommand.slashRun &&
        !!slashCommand.slashFinalize &&
        !!slashCommand.slashOnError
      );
    }) as unknown as Collection<string, SlashableDexareCommand>;
  }

  private syncMockCommands() {
    this.creator.commands.clear();
    this.getSlashableCommands().map((command) =>
      this.creator.commands.set(command.slashKeyName, {
        commandName: command.slashOptions.name,
        guildIDs: command.slashOptions.guildIDs,
        commandJSON: command.slashCommandJSON,
        keyName: command.slashKeyName,
        permissions: command.slashOptions.permissions,
        ids: new Collection<string, string>(),
        mock: true
      } as any)
    );
  }

  private getCommandFromInteraction(interaction: InteractionRequestData) {
    const commands = this.getSlashableCommands();

    return 'guild_id' in interaction
      ? commands.find(
          (command) =>
            !!(
              command.slashOptions.guildIDs &&
              command.slashOptions.guildIDs.includes(interaction.guild_id) &&
              command.slashOptions.name === interaction.data.name
            )
        ) || commands.find((command) => command.slashOptions.name === interaction.data.name)
      : commands.find((command) => command.slashOptions.name === interaction.data.name);
  }
}
