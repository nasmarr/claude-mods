# nasmarr-mods

A small catalog of [Claude Code](https://claude.com/claude-code) mods.

## Install

Add the marketplace once:

```
/plugin marketplace add nasmarr/claude-mods
```

Then install any mod from it:

```
/plugin install vim-statusline@nasmarr-mods
```

### Get updates automatically

Auto-update is off by default for community marketplaces. Turn it on once:
run `/plugin`, open the **Marketplaces** tab, select `nasmarr-mods`, and choose
**Enable auto-update**. New versions download in the background and load the
next time you start Claude Code (or right away with `/reload-plugins`).

To update by hand instead: `/plugin marketplace update nasmarr-mods`.

## Mods

| Mod | What it does |
| --- | --- |
| [vim-statusline](plugins/vim-statusline)<br><img src="plugins/vim-statusline/screenshot.png" width="320"> | A Neovim-style status line in Catppuccin Mocha colors: git branch and changes, folder, model, context use, cost, usage limits and the time. |

## Developing

Each mod lives in `plugins/<name>/`. To work on one live, point Claude Code at
the folder in `~/.claude/settings.json`:

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claude-mods/plugins/vim-statusline" } }
```

Run a mod's tests with `claude plugin test plugins/<name>` and check the
catalog with `claude plugin validate .`.

To release, bump `version` in the mod's `.claude-plugin/plugin.json` and push.
Users only get an update when that number changes.

## License

MIT
