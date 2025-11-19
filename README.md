<h1 align="center">Obsidian Mini Toolbar V2</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.1-6E56CF?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green?style=for-the-badge" alt="License">
</p>

<p align="center">
  <em>A context-aware toolbar for text manipulation in Obsidian.</em>
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/31c42842-d0ea-4990-b8ec-0bb6236dedac" alt="Demo Screenshot" width="600">
</p>

This plugin adds toolbar that appears when you select text, offering quick access to formatting options.

## Features:

- 🎨 Change the color of your selected text.
- 🖌️ Highlight text with <img src="assets/highlight-example.svg" height="20" style="vertical-align: middle;"/> colors.

 <details>
  <summary><strong>Limitations / Known Behaviors</strong></summary>
  - No Reading Mode support  </br>
  - Styles are plugin‑local, not markdown. Colors and underline are not written into the markdown file. If you open the note in another application or disable this plugin, the text will appear unstyled. This is intentional to keep files clean.  </br>
  - Embedded / fragment editors (tables, etc.). The mini toolbar is suppressed. </br>
  -  Multi-line highlighter removed.
</details>



 <details>
  <summary><strong>How to Install</strong></summary>

### Install via BRAT 

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) 
2. `CMD/CTRL+P` and type: **Add Beta plugin**
4. In new popup window add plugin URL: `https://github.com/xRyul/obsidian-mini-toolbar-v2`
5. Click **Add Plugin**
6. Go to **Settings** → **Community Plugins** and enable **Obsidian Mini Toolbar V2**

### Manual Installation

1. Download the latest release from the [Releases page](https://github.com/xRyul/obsidian-mini-toolbar-v2/releases)
2. Extract the files to your vault's `.obsidian/plugins/obsidian-mini-toolbar-v2/` directory
3. Reload Obsidian
4. Enable the plugin in **Settings** → **Community Plugins**
</details>

## Credits:
Forked from [Quorafind/Obsidian-Mini-Toolbar](https://github.com/Quorafind/Obsidian-Mini-Toolbar).
