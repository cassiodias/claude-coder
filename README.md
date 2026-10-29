# puppet-coder

A Claude Code mod: a Claude puppet sits at its laptop and plays Space Invaders above your prompt while a slash command you pick runs. Every tool call the command makes shoots an invader down.

```
coder-demo · 4 edits · 3 runs · 2 reads
            ╭───────────────── 00006 ╮
            │ ▞▚  ▞▚  ✶✶  ▞▚  ▞▚     │
 ▄████▄     │         ╻              │
 ███ ██   ▐ │         ▟▙             │
 ██████▀▀▄▟ ╰▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀╯
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
```

## How to use it

**1. Install.** At the prompt of a Claude Code terminal session, type:

```
/plugin install puppet-coder --marketplace cassiodias/claude-coder
```

Answer `y` to add the marketplace, then press Enter for the user scope. It works right away, no restart needed.

**2. See it.** Type:

```
/coder-demo
```

The coder works for 20 seconds above the prompt.

**3. Pick your commands.** No command starts the coder until you list some. Open `/config`, find the `puppet-coder` commands row, and list them comma separated, without the slash:

```
my-coding-skill, another-command
```

That's it. Next time one of those commands runs, the coder sits down by itself and stands up when the command is done.

## What you see

- The puppet types on its laptop while the command works.
- Every tool call fires a shot that takes an invader down and adds to the score on the screen. A cleared wave comes back.
- The header counts the command's edits (Edit, Write), runs (Bash) and reads (Read).
- When the command is done the game stops, the scene greys out with a ✓, and it clears a few seconds later.

## Options

| Setting | Values | Default |
| --- | --- | --- |
| `commands` | slash commands or skills, comma separated | none |
| `display` | `band`: a strip above the prompt that stays put while the chat scrolls. `pane`: a narrow pane beside the chat | `band` |

Set them in `/config`, or in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "puppet-coder": { "options": { "commands": "my-coding-skill", "display": "band" } } } }
```

## Demo options

| Command | Shows |
| --- | --- |
| `/coder-demo` | the coder in your `display` setting |
| `/coder-demo pane` | the coder in the pane |
| `/coder-demo band` | the coder in the band |

## Other ways to install

From a shell:

```
claude plugin install puppet-coder --marketplace cassiodias/claude-coder
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `cassiodias/claude-coder`, then Add plugin.

## Uninstall

From a shell:

```
claude plugin uninstall puppet-coder
```

## See also

[puppet-ping-pong](https://github.com/cassiodias/claude-ping-pong): two puppets play ping pong while a command's subagents work.

## License

MIT
