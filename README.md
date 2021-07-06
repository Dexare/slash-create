<img src="https://get.snaz.in/AcfDzFJ.png" height="50">

A [Dexare](https://github.com/Dexare/Dexare) module for managing slash commands with [slash-create](https://npm.im/slash-create).

```sh
npm install @dexare/slash-create
```

```js
const { DexareClient } = require('dexare');
const SlashCreateModule = require('@dexare/slash-create');

const config = {
  // All props in this config are optional EXCEPT applicationID, defaults are shown unless told otherwise
  slashCreate: {
    // This must be your bot application's ID
    applicationID: '1234567890',

    /**
     * Other options are mirrored from slash-create's creator options:
     *  https://slash-create.js.org/#/docs/main/latest/typedef/SlashCreatorOptions
     *
     * The following variables are not used since they are mirrored from Dexare:
     *  handleCommandsManually, allowedMentions, defaultImageFormat, defaultImageSize,
     *  ratelimiterOffset, latencyThreshold, requestTimeout, agent, token
     */
  }
}

const client = new DexareClient(config);
client.loadModules(SlashCreateModule);

// load commands here...
// This must be done before syncing.

const slashCreate = client.modules.get('slash-create');
slashCreate.sync();
```

### Command Example
> Note: Throttling and permissions must be handled within `slashRun()`.
```js
// ./src/commands/example.js
const { DexareClient, CommandContext } = require('dexare');
const { CommandContext: SlashCommandContext, CommandOptionType } = require('slash-create');
const { SlashableDexareCommand } = require('@dexare/slash-create');

export class ExampleCommand extends SlashableDexareCommand {
  constructor(client: DexareClient<any>) {
    super(
      client,
      { name: 'example' },
      {
        // The slash command name can differ from the base command
        name: 'dexare',
        description: 'Example description'
      }
    );

    this.filePath = __filename;
  }

  async run(ctx: CommandContext) {
    return 'This is from Dexare!';
  }

  async slashRun(ctx: SlashCommandContext) {
    return 'This is also from Dexare!';
  }
}
```
