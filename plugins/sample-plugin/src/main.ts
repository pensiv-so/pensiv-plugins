import { Plugin, type SettingsSchema } from '@pensiv/plugin-sdk';

/**
 * The canonical pensiv plugin. It shows the three things almost every plugin
 * does — a command, a settings tab, and reading the editor through the typed
 * Host API (`this.app`). Clone this folder, rename it in `manifest.json`, and
 * start editing here.
 *
 * Lifecycle: `onload()` runs whenever the plugin is enabled; everything you
 * register is torn down automatically on disable.
 */
const settings: SettingsSchema = {
  fields: [
    {
      key: 'greeting',
      type: 'text',
      label: 'Greeting',
      description: 'What the "Say hello" command says.',
      default: 'Hello from your plugin 👋'
    }
  ]
};

export default class SamplePlugin extends Plugin {
  onload(): void {
    // A command — shows in the command palette and is bindable to a shortcut.
    this.addCommand({
      id: 'say-hello',
      name: 'Sample: Say hello',
      run: () => {
        const greeting = this.app.storage.get<string>('greeting') ?? 'Hello!';
        const words = this.app.editor.count({ countType: 'word' }); // needs editor.read
        this.app.ui.toast(`${greeting} (${words} words so far)`);
      }
    });

    // A settings tab — the host renders the schema into a form and persists
    // values in this plugin's namespaced storage (read with app.storage.get).
    this.addSettingTab({ title: 'Sample Plugin', schema: settings });
  }
}
