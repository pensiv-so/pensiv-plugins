import {
  Plugin,
  resolveLocalizedText,
  type HostApi,
  type LocalizedText,
  type SettingsSchema
} from '@pensiv/plugin-sdk';
import './styles.css';
import { BrowserPane, openBrowser } from './pane';

/** Localized-text helper: `L(en, ko, ja)`. */
const L = (en: string, ko: string, ja: string): LocalizedText => ({ en, ko, ja });
const tr = (app: HostApi, t: LocalizedText) => resolveLocalizedText(t, app.app.locale);

const TITLE = L('Browser', '브라우저', 'ブラウザ');

/**
 * Browser — a built-in web browser pane (address bar, back/forward/reload,
 * bookmark bar, live `<webview>`) plus its settings: a homepage URL, a bookmark
 * bar toggle, and an editable bookmark list. The webview runs in the host's
 * isolated `webviewConfig` session; opened via the command or sidebar item.
 */
const settings: SettingsSchema = {
  fields: [
    {
      type: 'group',
      fields: [
        {
          key: 'homepageUrl',
          type: 'text',
          label: L('Homepage', '홈페이지', 'ホームページ'),
          description: L(
            'Opened when you create a new browser tab',
            '새 브라우저 탭을 열 때 표시되는 페이지',
            '新しいブラウザタブを開いたときに表示されるページ'
          ),
          placeholder: 'https://www.google.com/',
          default: 'https://www.google.com/'
        },
        {
          key: 'showBookmarkBar',
          type: 'toggle',
          label: L('Show bookmark bar', '북마크 바 표시', 'ブックマークバーを表示'),
          description: L(
            'Display bookmarks below the address bar',
            '주소 표시줄 아래에 북마크를 표시합니다',
            'アドレスバーの下にブックマークを表示します'
          ),
          default: true
        }
      ]
    },
    {
      key: 'bookmarks',
      type: 'object-list',
      label: L('Bookmarks', '북마크', 'ブックマーク'),
      sortable: true,
      addLabel: L('Add Bookmark', '북마크 추가', 'ブックマークを追加'),
      emptyLabel: L(
        'No bookmarks yet. Add one to get started.',
        '북마크가 없습니다. 북마크를 추가해 보세요.',
        'ブックマークがありません。追加してみましょう。'
      ),
      default: [],
      columns: [
        {
          key: 'title',
          type: 'text',
          label: L('Title', '제목', 'タイトル'),
          placeholder: L('Title', '제목', 'タイトル'),
          role: 'title'
        },
        { key: 'url', type: 'text', label: 'URL', placeholder: 'URL' },
        { key: 'visible', type: 'toggle', label: L('Visible', '표시', '表示'), role: 'visible' }
      ]
    }
  ]
};

export default class BrowserPlugin extends Plugin {
  onload(): void {
    this.addSettingTab({ title: tr(this.app, TITLE), schema: settings });

    // Pane id `browser`: the host also aliases the legacy `browser` content type
    // to this, so any existing browser tabs keep rendering it.
    this.registerPane({
      id: 'browser',
      title: tr(this.app, TITLE),
      icon: 'Globe',
      render: BrowserPane
    });

    this.addCommand({
      id: 'open',
      name: L('Browser: Open', '브라우저: 열기', 'ブラウザ: 開く'),
      icon: 'Globe',
      run: () => openBrowser(this.app)
    });

    // No sidebar item — the browser is reachable via the command ("Browser: Open")
    // and existing browser tabs/panes; it intentionally does not occupy a sidebar slot.
  }
}
