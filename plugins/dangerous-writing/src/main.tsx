import { Plugin } from '@pensiv/plugin-sdk';
import './styles.css';
import { dwStore } from './store';
import { settingsSchema } from './settings';
import { confettiBurst } from './confetti';
import { DangerousWritingOverlay } from './overlay';
import { STR, tr } from './i18n';

/**
 * Dangerous Writing — a port of the Dangerous Writing Prompt App.
 *
 * Keep typing or lose it all: a fuse burns down whenever you stop, and running it
 * out wipes your OPEN document for real (`editor.setContent('', { resetHistory:
 * true })`). Two surfaces share one {@link dwStore}:
 *   - a **document-header button** (`registerHeaderAction`) that toggles a
 *     launcher popover (goal presets + Start), rendered by the overlay since the
 *     file-header API has no render slot of its own;
 *   - a full-screen **overlay** that reddens as the fuse burns, shows the live
 *     countdown / word progress, and ends on a win / wiped banner.
 * Plus a settings tab (goal + difficulty). No practice pane, prompts, or sounds.
 */
export default class DangerousWritingPlugin extends Plugin {
  onload(): void {
    // Confetti on a win (mirrors Timer's `onComplete`); cleared on unload.
    dwStore.feedback = {
      onSuccess: () => confettiBurst()
    };
    this.register(() => {
      dwStore.cancel();
      dwStore.feedback = {};
    });

    this.addSettingTab({ title: tr(this.app, STR.title), schema: settingsSchema });

    // Document toolbar button: toggles the launcher popover (rendered by the
    // overlay), where the user sees settings and presses Start. Lives on the
    // document header so it's right where the user is writing.
    this.registerHeaderAction({
      id: 'arm',
      label: tr(this.app, STR.title),
      icon: 'Fire',
      fileTypes: ['document'],
      onClick: () => dwStore.setPopover(!dwStore.popoverOpen),
      isActive: () => dwStore.status === 'running' || dwStore.popoverOpen
    });

    // Full-screen danger overlay. Mounted bare and always present; it renders
    // nothing until a session is live.
    this.registerWidget({
      id: 'overlay',
      surface: 'any',
      frame: 'none',
      component: DangerousWritingOverlay
    });
  }
}
